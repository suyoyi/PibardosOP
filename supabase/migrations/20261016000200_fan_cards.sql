-- Original fan creations are a display catalog, never official/playable cards.
-- No fabricated canonical identity, numeric rules or market quotes are assigned.
create table public.fan_cards (
  id uuid primary key,
  name text not null check (length(btrim(name)) between 1 and 200),
  display_number text check (length(display_number) between 1 and 40),
  edition_code text not null check (edition_code = 'fan-pirate-gods'),
  artwork_id text not null unique check (artwork_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz not null default now()
);
create index fan_cards_edition_idx on public.fan_cards(edition_code);
alter table public.fan_cards enable row level security;
revoke all on public.fan_cards from anon, authenticated;
grant select on public.fan_cards to authenticated;
create policy fan_cards_authenticated_read on public.fan_cards
  for select to authenticated using ((select auth.uid()) is not null);

insert into public.fan_cards(id,name,display_number,edition_code,artwork_id)
values('5086888e-aee5-4295-8bd9-f9f1dafbb718','Vin D. Ny, el DJ del Caos','OP-001','fan-pirate-gods','vin-d-ny');
