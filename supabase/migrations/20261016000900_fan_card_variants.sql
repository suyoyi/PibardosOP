-- Additional illustrations belong to one original fan card, not a new card row.
create table public.fan_card_variants (
  fan_card_id uuid not null references public.fan_cards(id) on delete cascade,
  artwork_id text not null unique check (artwork_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  label text not null check (length(btrim(label)) between 1 and 100),
  created_at timestamptz not null default now(),
  primary key(fan_card_id, artwork_id)
);
alter table public.fan_card_variants enable row level security;
revoke all on public.fan_card_variants from anon, authenticated;
grant select on public.fan_card_variants to authenticated;
create policy fan_card_variants_authenticated_read on public.fan_card_variants
  for select to authenticated using ((select auth.uid()) is not null);

insert into public.fan_card_variants(fan_card_id,artwork_id,label)
values('d515ca79-15ba-4f9f-b730-d5fba7f27a07','su-d-yoyi-awakening','Arte alternativo');
