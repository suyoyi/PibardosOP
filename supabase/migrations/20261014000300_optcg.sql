-- Additional provider; historical BerryWallet records and snapshots stay intact.
alter table public.cards drop constraint cards_provider_card_id_check;
alter table public.cards add constraint cards_provider_card_id_check check(provider_card_id is null or (provider_card_id ~ '^[A-Za-z0-9_-]+$' and length(provider_card_id)<=1003));
drop index public.cards_private_printing_key;
create unique index cards_private_printing_key on public.cards(user_id,card_number,language,printing_code) where user_id is not null and source not in ('berrywallet','optcgapi');
create unique index cards_optcg_key on public.cards(user_id,provider_card_id) where source='optcgapi';
create table public.optcg_card_items (
 card_id uuid primary key,
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 external_id text not null check(external_id ~ '^optcg_(sets|decks|promos|don)_[A-Za-z0-9_-]+$' and length(external_id)<=214),
 family text not null check(family in ('sets','decks','promos','don')),
 image_url text check(image_url is null or (length(image_url)<=2048 and image_url ~ '^https://(www\.)?optcgapi\.com/media/static/Card_Images/[A-Za-z0-9_.-]+\.(jpg|jpeg|png|webp|avif)$' and image_url not like '%..%')),
 prices jsonb not null default '[]' check(jsonb_typeof(prices)='array' and jsonb_array_length(prices)<=2),
 source_date date,
 fetched_at timestamptz not null default now(),
 foreign key(card_id,user_id) references public.cards(id,user_id) on delete cascade deferrable initially deferred,
 unique(user_id,external_id)
);
alter table public.optcg_card_items enable row level security;
revoke all on public.optcg_card_items from anon,authenticated;
grant select on public.optcg_card_items to authenticated;
create policy optcg_items_owner on public.optcg_card_items for select to authenticated using(user_id=(select auth.uid()));
create function public.cache_optcg_card(p_card jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid; canonical uuid; external text; family text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_card is null or jsonb_typeof(p_card)<>'object' or length(p_card::text)>30000 then raise exception 'Invalid provider card'; end if;
 external:=p_card->>'external_id'; family:=p_card->>'family';
 if family is null or family not in ('sets','decks','promos','don') or external is null or external !~ '^optcg_(sets|decks|promos|don)_[A-Za-z0-9_-]+$' or length(external)>214 or external not like 'optcg_'||family||'_%' then raise exception 'Invalid provider identity'; end if;
 if p_card->>'language' is distinct from 'en' then raise exception 'Unsupported provider language'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||external,0));
 select card_id into cid from public.optcg_card_items where user_id=auth.uid() and external_id=external;
 if cid is null then
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||(p_card->>'card_number'),0));
  select id into canonical from public.cards where card_number=p_card->>'card_number' and canonical_card_id=id and (user_id is null or user_id=auth.uid()) and card_type::text=p_card->>'card_type' order by user_id nulls first,id limit 1;
  cid:=gen_random_uuid();
  insert into public.cards(id,user_id,provider_card_id,card_number,name,colors,card_type,cost,power,counter,life,attribute,traits,effect_text,set_code,rarity,language,printing_code,canonical_card_id,source,source_updated_at)
   values(cid,auth.uid(),external,p_card->>'card_number',p_card->>'name',array(select jsonb_array_elements_text(p_card->'colors'))::public.card_color[],(p_card->>'card_type')::public.card_type,(p_card->>'cost')::smallint,(p_card->>'power')::integer,(p_card->>'counter')::integer,(p_card->>'life')::smallint,p_card->>'attribute',array(select jsonb_array_elements_text(p_card->'traits')),p_card->>'effect_text',p_card->>'set_code',p_card->>'rarity','en',p_card->>'variant',coalesce(canonical,cid),'optcgapi',(p_card->>'source_date')::date::timestamp at time zone 'UTC');
 end if;
 insert into public.optcg_card_items(card_id,user_id,external_id,family,image_url,prices,source_date)
  values(cid,auth.uid(),external,family,p_card->>'image_url',p_card->'prices',(p_card->>'source_date')::date)
  on conflict(user_id,external_id) do update set image_url=excluded.image_url,prices=excluded.prices,source_date=excluded.source_date,fetched_at=now();
 return cid;
end $$;
revoke all on function public.cache_optcg_card(jsonb) from public,anon;
grant execute on function public.cache_optcg_card(jsonb) to authenticated;
notify pgrst,'reload schema';
