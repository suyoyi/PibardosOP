-- Authoritative storage. Public users never receive catalog write or snapshot write privileges.
create type public.card_color as enum ('red', 'green', 'blue', 'purple', 'black', 'yellow');
create type public.card_type as enum ('leader', 'character', 'event', 'stage', 'don');
create type public.deck_status as enum ('draft', 'active', 'archived');
create type public.card_role as enum ('main', 'don');
create type public.match_result as enum ('win', 'loss', 'draw');
create type public.restriction_type as enum ('banned', 'restricted', 'limited');
create type public.import_status as enum ('pending', 'preview', 'confirmed', 'failed');

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  card_number text not null check (length(card_number) between 1 and 40),
  name text not null check (length(name) between 1 and 200),
  colors public.card_color[] not null default '{}',
  card_type public.card_type not null,
  cost smallint check (cost >= 0),
  power integer check (power >= 0),
  counter integer check (counter >= 0),
  life smallint check (life >= 0),
  attribute text,
  traits text[] not null default '{}',
  effect_text text,
  set_code text,
  rarity text,
  language text not null default 'en',
  printing_code text not null default 'standard',
  image_url text check (image_url is null or image_url like 'https://%'),
  canonical_card_id uuid not null references public.cards(id) on delete restrict,
  source text not null,
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (card_number, language, printing_code)
);
create index cards_canonical_idx on public.cards(canonical_card_id);
create index cards_name_idx on public.cards(lower(name));
create index cards_colors_idx on public.cards using gin(colors);
create index cards_set_type_idx on public.cards(set_code, card_type);

create function public.set_card_identity() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.canonical_card_id is null then new.canonical_card_id := new.id; end if;
  if new.canonical_card_id <> new.id and not exists (
    select 1 from public.cards c where c.id = new.canonical_card_id and c.canonical_card_id = c.id
  ) then raise exception 'Canonical identity must reference a root printing'; end if;
  if tg_op = 'UPDATE' and (new.id <> old.id or new.canonical_card_id <> old.canonical_card_id) then
    raise exception 'Card identity is immutable';
  end if;
  return new;
end $$;
create trigger cards_identity before insert or update on public.cards for each row execute function public.set_card_identity();

create table public.decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  leader_card_id uuid not null references public.cards(id),
  description text not null default '' check (length(description) <= 10000),
  tags text[] not null default '{}',
  format text not null default 'standard' check (length(format) between 1 and 60),
  status public.deck_status not null default 'draft',
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index decks_owner_idx on public.decks(user_id, updated_at desc);

create table public.deck_versions (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null,
  user_id uuid not null,
  version_number integer not null check (version_number > 0),
  leader_card_id uuid not null references public.cards(id),
  format text not null,
  notes text not null default '' check (length(notes) <= 10000),
  change_summary jsonb not null default '{}',
  created_at timestamptz not null default now(),
  foreign key (deck_id, user_id) references public.decks(id, user_id) on delete cascade,
  unique (deck_id, version_number),
  unique (id, deck_id),
  unique (id, user_id)
);
alter table public.decks add constraint decks_current_version_fk
  foreign key (current_version_id, id) references public.deck_versions(id, deck_id) deferrable initially deferred;
create index deck_versions_owner_idx on public.deck_versions(user_id);

create table public.deck_cards (
  deck_version_id uuid not null references public.deck_versions(id) on delete cascade,
  card_id uuid not null references public.cards(id),
  quantity smallint not null check (quantity between 1 and 50),
  role public.card_role not null default 'main',
  primary key (deck_version_id, card_id)
);
create index deck_cards_card_idx on public.deck_cards(card_id);

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 200),
  event_date date not null,
  location text,
  format text not null default 'standard',
  deck_version_id uuid,
  placement integer check (placement > 0),
  notes text not null default '',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (deck_version_id, user_id) references public.deck_versions(id, user_id)
);
create index tournaments_owner_date_idx on public.tournaments(user_id, event_date desc);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  deck_version_id uuid not null,
  opponent_leader_id uuid not null references public.cards(id),
  result public.match_result not null,
  went_first boolean not null,
  played_at timestamptz not null default now(),
  format text not null default 'standard',
  match_type text not null default 'practice',
  opponent_name text check (length(opponent_name) <= 200),
  tournament_id uuid,
  notes text not null default '' check (length(notes) <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (deck_version_id, user_id) references public.deck_versions(id, user_id),
  foreign key (tournament_id, user_id) references public.tournaments(id, user_id),
  unique (id, user_id),
  unique (id, tournament_id, user_id)
);
create index matches_owner_date_idx on public.matches(user_id, played_at desc);
create index matches_version_idx on public.matches(deck_version_id);
create index matches_event_idx on public.matches(tournament_id);
create index matches_opponent_idx on public.matches(user_id, opponent_leader_id);

create table public.tournament_rounds (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null,
  user_id uuid not null default auth.uid(),
  round_number integer not null check (round_number > 0),
  match_id uuid not null unique,
  opponent_name text,
  result public.match_result not null,
  notes text not null default '',
  foreign key (tournament_id, user_id) references public.tournaments(id, user_id) on delete cascade,
  foreign key (match_id, tournament_id, user_id) references public.matches(id, tournament_id, user_id) on delete cascade,
  unique (tournament_id, round_number)
);

create table public.collection_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  card_id uuid not null references public.cards(id),
  quantity_owned integer not null default 0 check (quantity_owned >= 0),
  quantity_tradeable integer not null default 0 check (quantity_tradeable between 0 and quantity_owned),
  language text not null default 'en',
  finish text not null default 'standard',
  storage_location text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, card_id, language, finish, storage_location)
);
create index collection_owner_idx on public.collection_items(user_id);

create table public.collection_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  collection_item_id uuid not null,
  deck_id uuid not null,
  quantity integer not null check (quantity > 0),
  foreign key (collection_item_id, user_id) references public.collection_items(id, user_id) on delete cascade,
  foreign key (deck_id, user_id) references public.decks(id, user_id) on delete cascade,
  unique (collection_item_id, deck_id)
);
create index allocation_deck_idx on public.collection_allocations(deck_id);
create index allocation_owner_idx on public.collection_allocations(user_id);

create table public.card_restrictions (
  id uuid primary key default gen_random_uuid(),
  canonical_card_id uuid not null references public.cards(id),
  format text not null,
  restriction_type public.restriction_type not null,
  maximum_quantity smallint not null check (maximum_quantity between 0 and 50),
  effective_from date not null,
  effective_until date check (effective_until >= effective_from),
  source_url text not null check (source_url like 'https://%'),
  verified_at timestamptz,
  check (restriction_type <> 'banned' or maximum_quantity = 0)
);
create index restrictions_lookup_idx on public.card_restrictions(canonical_card_id, format, effective_from);

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source text not null,
  status public.import_status not null default 'pending',
  raw_input text not null check (length(raw_input) <= 100000),
  error_report jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index import_jobs_owner_idx on public.import_jobs(user_id, created_at desc);

-- Common metadata. Owners cannot move rows to another account through RLS.
create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
do $$ declare t text; begin
  foreach t in array array['cards','decks','matches','tournaments','collection_items'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()', t || '_updated_at', t);
  end loop;
end $$;

create function public.check_leader() returns trigger language plpgsql set search_path = '' as $$
declare leader uuid;
begin
  if tg_table_name = 'matches' then leader := new.opponent_leader_id; else leader := new.leader_card_id; end if;
  if not exists(select 1 from public.cards where id = leader and card_type = 'leader') then
    raise exception 'Exactly one leader card is required';
  end if;
  return new;
end $$;
create trigger decks_leader before insert or update on public.decks for each row execute function public.check_leader();
create trigger versions_leader before insert on public.deck_versions for each row execute function public.check_leader();
create trigger matches_leader before insert or update on public.matches for each row execute function public.check_leader();

create function public.reject_snapshot_update() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'Saved deck snapshots are immutable'; end $$;
create trigger versions_immutable before update on public.deck_versions for each row execute function public.reject_snapshot_update();
create trigger deck_cards_immutable before update on public.deck_cards for each row execute function public.reject_snapshot_update();

-- Serialize inventory reservations on the physical item, including concurrent allocations.
create function public.check_allocation() returns trigger language plpgsql security definer set search_path = '' as $$
declare available integer; reserved integer;
begin
  if tg_op = 'UPDATE' and new.collection_item_id <> old.collection_item_id then
    raise exception 'Reassign inventory by deleting and recreating the allocation';
  end if;
  select quantity_owned - quantity_tradeable into available from public.collection_items
    where id = new.collection_item_id and user_id = new.user_id for update;
  if available is null then raise exception 'Inventory item does not belong to allocation owner'; end if;
  select coalesce(sum(quantity),0) into reserved from public.collection_allocations
    where collection_item_id = new.collection_item_id and id <> new.id;
  if reserved + new.quantity > available then raise exception 'Insufficient unallocated physical copies'; end if;
  return new;
end $$;
create trigger allocation_quantity before insert or update on public.collection_allocations for each row execute function public.check_allocation();

create function public.check_inventory_reduction() returns trigger language plpgsql security definer set search_path = '' as $$
declare reserved integer;
begin
  select coalesce(sum(quantity),0) into reserved from public.collection_allocations where collection_item_id = old.id;
  if reserved > new.quantity_owned - new.quantity_tradeable then raise exception 'Allocated copies cannot be removed or traded'; end if;
  if reserved > 0 and (new.card_id <> old.card_id or new.user_id <> old.user_id) then raise exception 'Allocated printing cannot change'; end if;
  return new;
end $$;
create trigger collection_reduction before update on public.collection_items for each row execute function public.check_inventory_reduction();

-- A round's result is a projection of its linked match, not an independent result.
create function public.sync_round_result() returns trigger language plpgsql set search_path = '' as $$
begin
  select result into new.result from public.matches where id = new.match_id;
  return new;
end $$;
create trigger rounds_result before insert or update on public.tournament_rounds for each row execute function public.sync_round_result();
create function public.sync_match_result() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.tournament_rounds set result = new.result where match_id = new.id;
  return new;
end $$;
create trigger matches_round_result after update of result on public.matches for each row execute function public.sync_match_result();

-- RLS is mandatory even when UI checks already enforce authentication.
do $$ declare t text; begin
  foreach t in array array['cards','card_restrictions','decks','deck_versions','deck_cards','matches','tournaments','tournament_rounds','collection_items','collection_allocations','import_jobs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
  foreach t in array array['decks','matches','tournaments','tournament_rounds','collection_items','collection_allocations','import_jobs'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_owner', t);
  end loop;
end $$;
grant select on public.cards, public.card_restrictions, public.deck_versions, public.deck_cards to authenticated;
create policy cards_read on public.cards for select to authenticated using (true);
create policy restrictions_read on public.card_restrictions for select to authenticated using (true);
create policy versions_read on public.deck_versions for select to authenticated using (user_id = (select auth.uid()));
create policy version_cards_read on public.deck_cards for select to authenticated using (
  exists (select 1 from public.deck_versions v where v.id = deck_version_id and v.user_id = (select auth.uid()))
);

-- Only this transaction may insert a snapshot and its complete entries.
create function public.save_deck_version(
  p_deck_id uuid,
  p_leader_card_id uuid,
  p_cards jsonb,
  p_notes text default ''
) returns uuid language plpgsql security definer set search_path = '' as $$
declare d public.decks%rowtype; new_id uuid; next_number integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into d from public.decks where id = p_deck_id and user_id = auth.uid() for update;
  if not found then raise exception 'Deck not found or not owned'; end if;
  if p_cards is null or jsonb_typeof(p_cards) <> 'array' or jsonb_array_length(p_cards) > 100 then
    raise exception 'Card entries must be a bounded array';
  end if;
  if exists (select 1 from jsonb_array_elements(p_cards) e where
    jsonb_typeof(e) <> 'object' or not (e ? 'card_id' and e ? 'quantity') or
    jsonb_typeof(e->'quantity') <> 'number' or (e->>'quantity') !~ '^[1-9][0-9]*$'
  ) then raise exception 'Invalid card entry'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_cards) as e(card_id uuid, quantity integer, role text)
    left join public.cards c on c.id = e.card_id
    where c.id is null or e.quantity not between 1 and 50 or coalesce(e.role,'main') not in ('main','don')
      or (coalesce(e.role,'main') = 'main' and c.card_type not in ('character','event','stage'))
      or (e.role = 'don' and c.card_type <> 'don')
  ) then raise exception 'Invalid card type, role or quantity'; end if;
  select coalesce(max(version_number),0)+1 into next_number from public.deck_versions where deck_id = d.id;
  insert into public.deck_versions(deck_id,user_id,version_number,leader_card_id,format,notes)
    values(d.id,d.user_id,next_number,p_leader_card_id,d.format,coalesce(p_notes,'')) returning id into new_id;
  insert into public.deck_cards(deck_version_id,card_id,quantity,role)
    select new_id,e.card_id,e.quantity,coalesce(e.role,'main')::public.card_role
    from jsonb_to_recordset(p_cards) as e(card_id uuid,quantity smallint,role text);
  update public.decks set current_version_id = new_id, leader_card_id = p_leader_card_id where id = d.id;
  return new_id;
end $$;
revoke all on function public.save_deck_version(uuid,uuid,jsonb,text) from public, anon;
grant execute on function public.save_deck_version(uuid,uuid,jsonb,text) to authenticated;
-- Trigger functions are not public RPCs; privileges do not affect trigger execution.
revoke all on function public.set_card_identity(), public.touch_updated_at(), public.check_leader(),
  public.reject_snapshot_update(), public.check_allocation(), public.check_inventory_reduction(),
  public.sync_round_result(), public.sync_match_result() from public, anon, authenticated;
