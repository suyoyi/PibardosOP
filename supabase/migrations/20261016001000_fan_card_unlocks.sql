-- Discoveries are private, durable and append-only for ordinary accounts.
create table public.fan_card_unlocks (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fan_card_id uuid not null references public.fan_cards(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, fan_card_id)
);
create index fan_card_unlocks_card_idx on public.fan_card_unlocks(fan_card_id);
alter table public.fan_card_unlocks enable row level security;
revoke all on public.fan_card_unlocks from anon, authenticated;
grant select on public.fan_card_unlocks to authenticated;
grant insert (user_id, fan_card_id) on public.fan_card_unlocks to authenticated;
create policy fan_card_unlocks_owner_read on public.fan_card_unlocks
  for select to authenticated using (user_id = (select auth.uid()));
create policy fan_card_unlocks_owner_insert on public.fan_card_unlocks
  for insert to authenticated with check (user_id = (select auth.uid()));
