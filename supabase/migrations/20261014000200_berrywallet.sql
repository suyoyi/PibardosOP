-- Imported facts remain immutable and private. Quotes may be refreshed separately.
alter table public.cards add column provider_card_id text check(provider_card_id is null or (provider_card_id ~ '^op_[A-Za-z0-9_-]+$' and length(provider_card_id)<=1003));
alter table public.cards add constraint cards_id_owner_key unique(id,user_id);
drop index public.cards_private_printing_key;
create unique index cards_private_printing_key on public.cards(user_id,card_number,language,printing_code) where user_id is not null and source <> 'berrywallet';
create unique index cards_provider_key on public.cards(user_id,provider_card_id) where source='berrywallet';
create table public.card_provider_items (
  card_id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  external_id text not null check(external_id ~ '^op_[A-Za-z0-9_-]+$' and length(external_id)<=1003),
  image_path text not null check(image_path ~ '^/images/[A-Za-z0-9_-]+$' and length(image_path)<=1032),
  prices jsonb not null default '[]' check(jsonb_typeof(prices)='array' and jsonb_array_length(prices)<=20),
  fetched_at timestamptz not null default now(),
  foreign key(card_id,user_id) references public.cards(id,user_id) on delete cascade deferrable initially deferred,
  unique(user_id,external_id)
);
alter table public.card_provider_items enable row level security;
revoke all on public.card_provider_items from anon,authenticated;
grant select on public.card_provider_items to authenticated;
create policy provider_items_owner on public.card_provider_items for select to authenticated using(user_id=(select auth.uid()));
create function public.cache_berrywallet_card(p_card jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid; canonical uuid; external text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_card is null or jsonb_typeof(p_card)<>'object' or length(p_card::text)>30000 then raise exception 'Invalid provider card'; end if;
  external:=p_card->>'external_id';
  if external is null or (external !~ '^op_[A-Za-z0-9_-]+$' or length(external)>1003) then raise exception 'Invalid external ID'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||external,0));
  select card_id into cid from public.card_provider_items where user_id=auth.uid() and external_id=external;
  if cid is null then
    -- Serialize all printings of a printed code so their canonical root stays stable.
    perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||(p_card->>'card_number'),0));
    select id into canonical from public.cards where card_number=p_card->>'card_number' and canonical_card_id=id
      and (user_id is null or user_id=auth.uid()) and card_type::text=p_card->>'card_type' order by user_id nulls first,id limit 1;
    cid:=gen_random_uuid();
    insert into public.cards(id,user_id,provider_card_id,card_number,name,colors,card_type,cost,power,counter,life,attribute,traits,effect_text,set_code,rarity,language,printing_code,canonical_card_id,source)
      values(cid,auth.uid(),external,p_card->>'card_number',p_card->>'name',array(select jsonb_array_elements_text(p_card->'colors'))::public.card_color[],(p_card->>'card_type')::public.card_type,
        (p_card->>'cost')::smallint,(p_card->>'power')::integer,(p_card->>'counter')::integer,(p_card->>'life')::smallint,p_card->>'attribute',array(select jsonb_array_elements_text(p_card->'traits')),
        p_card->>'effect_text',p_card->>'set_code',p_card->>'rarity',p_card->>'language',p_card->>'variant',coalesce(canonical,cid),'berrywallet');
  end if;
  insert into public.card_provider_items(card_id,user_id,external_id,image_path,prices)
    values(cid,auth.uid(),external,p_card->>'image_path',p_card->'prices')
    on conflict(user_id,external_id) do update set prices=excluded.prices,image_path=excluded.image_path,fetched_at=now();
  return cid;
end $$;
revoke all on function public.cache_berrywallet_card(jsonb) from public,anon;
grant execute on function public.cache_berrywallet_card(jsonb) to authenticated;
notify pgrst,'reload schema';
