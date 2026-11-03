-- Allow platform auto-detection, and fix the cooldown timestamp variable:
-- CURRENT_TIME is a built-in SQL expression, so the previous variable name
-- was parsed as timetz and broke comparison with timestamptz.
-- The atomic advisory transaction lock and 90s/15m limits remain intact.
CREATE OR REPLACE FUNCTION public.reserve_web_refresh(p_player_key text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  reservation_at timestamptz := clock_timestamp();
  next_global timestamptz;
  next_player timestamptz;
  player_scope text;
begin
  if p_player_key is null or length(p_player_key) > 180
    or p_player_key !~ '^(auto|xbox|psn):[^,[:cntrl:]]{1,100}$'
  then return false; end if;
  player_scope := 'player:' || lower(p_player_key);
  -- Serialize across ALL Vercel functions, including parallel POSTs.
  perform pg_catalog.pg_advisory_xact_lock(87119521);
  select next_allowed into next_global
    from public.web_refresh_guard where scope='global';
  select next_allowed into next_player
    from public.web_refresh_guard where scope=player_scope;
  -- Keep public web traffic below one refresh attempt every 90 seconds globally.
  if (next_global is not null and next_global>reservation_at)
    or (next_player is not null and next_player>reservation_at)
  then return false; end if;
  insert into public.web_refresh_guard(scope,next_allowed,updated_at)
    values ('global',reservation_at+interval '90 seconds',reservation_at)
    on conflict(scope) do update set next_allowed=excluded.next_allowed,
      updated_at=excluded.updated_at;
  insert into public.web_refresh_guard(scope,next_allowed,updated_at)
    values (player_scope,reservation_at+interval '15 minutes',reservation_at)
    on conflict(scope) do update set next_allowed=excluded.next_allowed,
      updated_at=excluded.updated_at;
  return true;
end
$function$;
revoke all on function public.reserve_web_refresh(text) from public,anon,authenticated;
grant execute on function public.reserve_web_refresh(text) to service_role;
