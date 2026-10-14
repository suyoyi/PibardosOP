-- Manual cards are private, user-supplied facts. Shared catalog data remains read-only.
alter table public.cards add column user_id uuid references auth.users(id) on delete cascade;
-- Defer card references until transaction end so cascading account deletion can
-- remove owned cards and their private decks/matches in either trigger order.
alter table public.cards drop constraint cards_canonical_card_id_fkey;
alter table public.cards add constraint cards_canonical_card_id_fkey foreign key(canonical_card_id)
  references public.cards(id) deferrable initially deferred;
alter table public.decks alter constraint decks_leader_card_id_fkey deferrable initially deferred;
alter table public.deck_versions alter constraint deck_versions_leader_card_id_fkey deferrable initially deferred;
alter table public.deck_cards alter constraint deck_cards_card_id_fkey deferrable initially deferred;
alter table public.matches alter constraint matches_opponent_leader_id_fkey deferrable initially deferred;
alter table public.collection_items alter constraint collection_items_card_id_fkey deferrable initially deferred;
alter table public.cards drop constraint cards_card_number_language_printing_code_key;
create unique index cards_shared_printing_key on public.cards(card_number, language, printing_code) where user_id is null;
create unique index cards_private_printing_key on public.cards(user_id, card_number, language, printing_code) where user_id is not null;
create index cards_owner_idx on public.cards(user_id);
drop policy cards_read on public.cards;
create policy cards_read on public.cards for select to authenticated using (user_id is null or user_id = (select auth.uid()));
grant insert on public.cards to authenticated;
create policy cards_manual_insert on public.cards for insert to authenticated
  with check (user_id = (select auth.uid()) and source = 'manual' and image_url is null and source_updated_at is null);

-- A forged UUID must not attach another user's private card through an FK or a definer RPC.
create function public.check_card_access() returns trigger language plpgsql security definer set search_path = '' as $$
declare card uuid; owner uuid;
begin
  if tg_table_name = 'cards' then card := new.canonical_card_id; owner := new.user_id;
  elsif tg_table_name = 'deck_cards' then
    card := new.card_id; select user_id into owner from public.deck_versions where id = new.deck_version_id;
  elsif tg_table_name = 'matches' then card := new.opponent_leader_id; owner := new.user_id;
  elsif tg_table_name = 'collection_items' then card := new.card_id; owner := new.user_id;
  else card := new.leader_card_id; owner := new.user_id; end if;
  -- Self-canonical insert is checked by the identity trigger.
  if tg_table_name = 'cards' then
    if card is null or card = new.id then return new; end if;
  end if;
  if not exists(select 1 from public.cards c where c.id = card and (c.user_id is null or c.user_id = owner)) then
    raise exception 'Card not available to owner';
  end if;
  return new;
end $$;
create trigger cards_access before insert on public.cards for each row execute function public.check_card_access();
create trigger decks_card_access before insert or update on public.decks for each row execute function public.check_card_access();
create trigger versions_card_access before insert on public.deck_versions for each row execute function public.check_card_access();
create trigger entries_card_access before insert on public.deck_cards for each row execute function public.check_card_access();
create trigger matches_card_access before insert or update on public.matches for each row execute function public.check_card_access();
create trigger collection_card_access before insert or update on public.collection_items for each row execute function public.check_card_access();

-- Persist a structured change summary when inserting each immutable snapshot.
create or replace function public.save_deck_version(
  p_deck_id uuid,
  p_leader_card_id uuid,
  p_cards jsonb,
  p_notes text default ''
) returns uuid language plpgsql security definer set search_path = '' as $$
declare d public.decks%rowtype; new_id uuid; next_number integer; changes jsonb; old_version public.deck_versions%rowtype;
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
  select * into old_version from public.deck_versions where id=d.current_version_id;
  with previous as (select card_id,quantity,role::text role from public.deck_cards where deck_version_id=d.current_version_id),
    upcoming as (select card_id,quantity,coalesce(role,'main') role from jsonb_to_recordset(p_cards) e(card_id uuid,quantity integer,role text))
  select coalesce(jsonb_agg(jsonb_build_object('card_id',coalesce(a.card_id,b.card_id),'before',coalesce(a.quantity,0),'after',coalesce(b.quantity,0),'before_role',a.role,'after_role',b.role) order by coalesce(a.card_id,b.card_id)),'[]')
    into changes from previous a full join upcoming b on a.card_id=b.card_id where a.quantity is distinct from b.quantity or a.role is distinct from b.role;
  insert into public.deck_versions(deck_id,user_id,version_number,leader_card_id,format,notes,change_summary)
    values(d.id,d.user_id,next_number,p_leader_card_id,d.format,coalesce(p_notes,''),
      jsonb_build_object('cards',changes,'leader_changed',old_version.leader_card_id is distinct from p_leader_card_id,'format_changed',old_version.format is distinct from d.format)) returning id into new_id;
  insert into public.deck_cards(deck_version_id,card_id,quantity,role)
    select new_id,e.card_id,e.quantity,coalesce(e.role,'main')::public.card_role
    from jsonb_to_recordset(p_cards) as e(card_id uuid,quantity smallint,role text);
  update public.decks set current_version_id = new_id, leader_card_id = p_leader_card_id where id = d.id;
  return new_id;
end $$;

-- One atomic operation creates/edits metadata, snapshots the complete list and confirms its import.
-- An expected-version token prevents a stale tab overwriting a newer version.
create function public.save_deck(p_input jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare d public.decks%rowtype; did uuid; vid uuid; leader uuid; entries jsonb;
  normalized jsonb; previous jsonb; expected uuid; job uuid; changed boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_input is null or jsonb_typeof(p_input) <> 'object' or length(p_input::text)>200000 then raise exception 'Invalid deck input'; end if;
  did := (p_input->>'id')::uuid; leader := (p_input->>'leader_card_id')::uuid;
  expected := nullif(p_input->>'expected_version_id','')::uuid;
  entries := p_input->'cards'; job := nullif(p_input->>'import_job_id','')::uuid;
  if did is null or leader is null or entries is null or jsonb_typeof(entries) <> 'array' or jsonb_array_length(entries) > 100 then
    raise exception 'Invalid deck input';
  end if;
  select * into d from public.decks where id = did for update;
  if found then
    if d.user_id <> auth.uid() then raise exception 'Deck not found or not owned'; end if;
    if d.current_version_id is distinct from expected then raise exception 'STALE_VERSION'; end if;
  else
    if expected is not null then raise exception 'Deck not found'; end if;
    insert into public.decks(id,user_id,name,leader_card_id) values(did,auth.uid(),p_input->>'name',leader);
  end if;
  update public.decks set name=p_input->>'name', leader_card_id=leader,
    description=coalesce(p_input->>'description',''), format=coalesce(p_input->>'format','standard'),
    tags=array(select jsonb_array_elements_text(coalesce(p_input->'tags','[]'))),
    status=coalesce(p_input->>'status','draft')::public.deck_status where id=did;
  select coalesce(jsonb_agg(jsonb_build_object('card_id',e.card_id,'quantity',e.quantity,'role',coalesce(e.role,'main')) order by e.card_id),'[]')
    into normalized from jsonb_to_recordset(entries) e(card_id uuid,quantity numeric,role text);
  select coalesce(jsonb_agg(jsonb_build_object('card_id',card_id,'quantity',quantity,'role',role) order by card_id),'[]')
    into previous from public.deck_cards where deck_version_id=d.current_version_id;
  changed := d.current_version_id is null or normalized <> previous or d.leader_card_id is distinct from leader or d.format is distinct from coalesce(p_input->>'format','standard');
  if changed then vid := public.save_deck_version(did,leader,entries,coalesce(p_input->>'notes',''));
  else vid := d.current_version_id; end if;
  if job is not null then
    update public.import_jobs set status='confirmed' where id=job and user_id=auth.uid()
      and raw_input=p_input->>'raw_input' and status in ('preview','confirmed');
    if not found then raise exception 'Import preview missing or changed'; end if;
  end if;
  return did;
end $$;
revoke all on function public.save_deck(jsonb) from public, anon;
grant execute on function public.save_deck(jsonb) to authenticated;

alter table public.tournaments add constraint tournament_notes_length check(length(notes)<=10000);
alter table public.tournaments add constraint tournament_format_length check(length(format) between 1 and 60);
alter table public.matches add constraint match_format_length check(length(format) between 1 and 60);
alter table public.matches add constraint match_type_length check(length(match_type) between 1 and 60);

-- Event history uses a single exact version. Changing it after games is disallowed.
create function public.check_event_version() returns trigger language plpgsql security definer set search_path = '' as $$
declare event public.tournaments%rowtype;
begin
  if tg_table_name = 'tournaments' then
    if (new.deck_version_id is distinct from old.deck_version_id or new.format is distinct from old.format) and exists(select 1 from public.matches where tournament_id=old.id) then
      raise exception 'Event version has recorded matches';
    end if;
  else
    if not exists(select 1 from public.deck_versions where id=new.deck_version_id and user_id=new.user_id and format=new.format) then
      raise exception 'Match format must agree with version';
    end if;
    if new.tournament_id is null then return new; end if;
    select * into event from public.tournaments where id=new.tournament_id for update;
    if event.user_id is distinct from new.user_id or event.deck_version_id is distinct from new.deck_version_id or event.format <> new.format then
      raise exception 'Event and match version/format must agree';
    end if;
    if event.archived_at is not null and tg_op='INSERT' and not exists(select 1 from public.matches where id=new.id and user_id=new.user_id and tournament_id=new.tournament_id) then raise exception 'Event is archived'; end if;
  end if;
  return new;
end $$;
create trigger tournament_version before update on public.tournaments for each row execute function public.check_event_version();
create trigger match_event_version before insert or update on public.matches for each row execute function public.check_event_version();

-- Match and round are committed together. The fixed match ID protects retries from duplicates.
create function public.save_match(p_input jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare mid uuid; tid uuid; existing public.matches%rowtype; event public.tournaments%rowtype; round_no integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  mid := (p_input->>'id')::uuid; tid := nullif(p_input->>'tournament_id','')::uuid;
  round_no := nullif(p_input->>'round_number','')::integer;
  if mid is null then raise exception 'Match ID required'; end if;
  select * into existing from public.matches where id=mid for update;
  if found and existing.user_id<>auth.uid() then raise exception 'Match not owned'; end if;
  if tid is not null then
    select * into event from public.tournaments where id=tid and user_id=auth.uid() for update;
    if not found or (event.archived_at is not null and (existing.id is null or existing.tournament_id is distinct from tid)) then raise exception 'Event not available'; end if;
    if round_no is null or round_no<1 then raise exception 'Round number required'; end if;
  elsif round_no is not null then raise exception 'Round requires event'; end if;
  -- Delete only the derived round for this owned match, before a possible event reassignment.
  delete from public.tournament_rounds where match_id=mid and user_id=auth.uid();
  insert into public.matches(id,user_id,deck_version_id,opponent_leader_id,result,went_first,played_at,format,match_type,opponent_name,tournament_id,notes)
  values(mid,auth.uid(),(p_input->>'deck_version_id')::uuid,(p_input->>'opponent_leader_id')::uuid,
    (p_input->>'result')::public.match_result,(p_input->>'went_first')::boolean,(p_input->>'played_at')::timestamptz,
    p_input->>'format',p_input->>'match_type',nullif(p_input->>'opponent_name',''),tid,coalesce(p_input->>'notes',''))
  on conflict(id) do update set deck_version_id=excluded.deck_version_id, opponent_leader_id=excluded.opponent_leader_id,
    result=excluded.result, went_first=excluded.went_first, played_at=excluded.played_at, format=excluded.format,
    match_type=excluded.match_type, opponent_name=excluded.opponent_name, tournament_id=excluded.tournament_id, notes=excluded.notes;
  if tid is not null then
    insert into public.tournament_rounds(tournament_id,user_id,round_number,match_id,opponent_name,result,notes)
      values(tid,auth.uid(),round_no,mid,nullif(p_input->>'opponent_name',''),(p_input->>'result')::public.match_result,coalesce(p_input->>'notes',''));
  end if;
  return mid;
end $$;
revoke all on function public.save_match(jsonb) from public, anon;
grant execute on function public.save_match(jsonb) to authenticated;
revoke all on function public.check_card_access(), public.check_event_version() from public, anon, authenticated;
notify pgrst, 'reload schema';
