-- Public catalog facts do not imply ownership. Wishes refer to exact printings;
-- physical reservations remain separate and serialize on inventory lots.
create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  card_id uuid not null references public.cards(id) deferrable initially deferred,
  target_quantity integer not null check (target_quantity between 1 and 9999),
  priority text not null default 'normal' check (priority in ('high','normal','low')),
  notes text not null default '' check (length(notes)<=3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,card_id)
);
alter table public.wishlist_items enable row level security;
revoke all on public.wishlist_items from anon,authenticated;
grant select,insert,update,delete on public.wishlist_items to authenticated;
create policy wishlist_owner on public.wishlist_items for all to authenticated
  using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create function public.check_wishlist_card() returns trigger language plpgsql set search_path='' as $$
begin
  if not exists(select 1 from public.cards where id=new.card_id and (user_id is null or user_id=new.user_id)) then
    raise exception 'Card unavailable for this owner';
  end if;
  if tg_op='UPDATE' and (new.card_id<>old.card_id or new.user_id<>old.user_id) then
    raise exception 'Wishlist identity cannot change';
  end if;
  return new;
end $$;
create trigger wishlist_card_access before insert or update on public.wishlist_items
  for each row execute function public.check_wishlist_card();

create function public.touch_owned_record() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=clock_timestamp(); return new; end $$;
create trigger wishlist_updated before update on public.wishlist_items for each row execute function public.touch_owned_record();

-- Wall-clock timestamps also distinguish successive writes in one transaction.
drop trigger collection_items_updated_at on public.collection_items;
create trigger collection_items_updated_at before update on public.collection_items
  for each row execute function public.touch_owned_record();

-- A physical lot may not disappear while copies remain in physical decks.
create function public.check_collection_delete() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.collection_allocations where collection_item_id=old.id)
     and exists(select 1 from auth.users where id=old.user_id) then
    raise exception 'Release physical reservations before deleting inventory';
  end if;
  return old;
end $$;
create trigger collection_delete_reserved before delete on public.collection_items
  for each row execute function public.check_collection_delete();

-- Replace one physical deck's reservations atomically. Expected version prevents
-- silently building a newer list; item locks serialize competing physical decks.
create function public.set_deck_allocations(p_deck_id uuid,p_version_id uuid,p_entries jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare current_id uuid; entry jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select current_version_id into current_id from public.decks where id=p_deck_id and user_id=auth.uid() for update;
  if not found then raise exception 'Deck unavailable'; end if;
  if current_id is distinct from p_version_id then raise exception 'STALE_VERSION'; end if;
  if p_entries is null or jsonb_typeof(p_entries)<>'array' or jsonb_array_length(p_entries)>500 then raise exception 'Invalid reservations'; end if;
  if exists(select 1 from jsonb_array_elements(p_entries) e group by e->>'collection_item_id' having count(*)>1) then raise exception 'Duplicate reservation'; end if;
  -- Include previous lots, then acquire every lot in the same stable order.
  perform id from public.collection_items where user_id=auth.uid() and
    (id in(select collection_item_id from public.collection_allocations where deck_id=p_deck_id)
     or id in(select (e->>'collection_item_id')::uuid from jsonb_array_elements(p_entries) e)) order by id for update;
  delete from public.collection_allocations where deck_id=p_deck_id and user_id=auth.uid();
  for entry in select value from jsonb_array_elements(p_entries) loop
    insert into public.collection_allocations(user_id,collection_item_id,deck_id,quantity)
      values(auth.uid(),(entry->>'collection_item_id')::uuid,p_deck_id,(entry->>'quantity')::integer);
  end loop;
end $$;

-- Idempotent missing-card wishes only raise the goal; never reduce an existing
-- desired quantity, erase a note or claim an acquisition.
create function public.raise_wishlist_target(p_card_id uuid,p_target integer) returns void
language sql security invoker set search_path='' as $$
  insert into public.wishlist_items(user_id,card_id,target_quantity) values(auth.uid(),p_card_id,p_target)
  on conflict(user_id,card_id) do update set target_quantity=greatest(public.wishlist_items.target_quantity,excluded.target_quantity);
$$;
revoke all on function public.check_wishlist_card(),public.touch_owned_record(),public.check_collection_delete() from public,anon,authenticated;
revoke all on function public.set_deck_allocations(uuid,uuid,jsonb), public.raise_wishlist_target(uuid,integer) from public,anon;
grant execute on function public.set_deck_allocations(uuid,uuid,jsonb), public.raise_wishlist_target(uuid,integer) to authenticated;
