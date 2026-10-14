-- New matches/rounds have only win/loss outcomes. Keep historical enum values
-- and rows intact so this additive migration never fabricates a result.
create function public.check_current_match_result() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.result = 'draw' then
    if tg_op = 'INSERT' then
      raise exception 'Only win or loss is allowed for new records';
    elsif old.result is distinct from new.result then
      raise exception 'Only win or loss is allowed for new results';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.check_current_match_result() from public, anon, authenticated;
create trigger matches_current_result before insert or update on public.matches
  for each row execute function public.check_current_match_result();
create trigger rounds_current_result before insert or update on public.tournament_rounds
  for each row execute function public.check_current_match_result();
