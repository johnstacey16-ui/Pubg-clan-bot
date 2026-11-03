-- Atomic shared web refresh cooldown. Server-side only, never browser-accessible.
-- The separate reserve_pubg_requests RPC remains the final PUBG API budget.
create table if not exists public.web_refresh_guard (
  scope text primary key,
  next_allowed timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.web_refresh_guard enable row level security;
revoke all on public.web_refresh_guard from anon,authenticated;
grant select,insert,update,delete on public.web_refresh_guard to service_role;
CREATE OR REPLACE FUNCTION public.reserve_web_refresh(p_player_key text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  current_time timestamptz := clock_timestamp();
  next_global timestamptz;
  next_player timestamptz;
  player_scope text;
begin
  if p_player_key is null or length(p_player_key) > 180
    or p_player_key !~ '^(xbox|psn):[^,[:cntrl:]]{1,100}$'
  then return false; end if;
  player_scope := 'player:' || lower(p_player_key);
  -- Serialize across ALL Vercel functions, including parallel POSTs.
  perform pg_catalog.pg_advisory_xact_lock(87119521);
  select next_allowed into next_global
    from public.web_refresh_guard where scope='global';
  select next_allowed into next_player
    from public.web_refresh_guard where scope=player_scope;
  -- Keep public web traffic below one refresh attempt every 90 seconds globally.
  if (next_global is not null and next_global>current_time)
    or (next_player is not null and next_player>current_time)
  then return false; end if;
  insert into public.web_refresh_guard(scope,next_allowed,updated_at)
    values ('global',current_time+interval '90 seconds',current_time)
    on conflict(scope) do update set next_allowed=excluded.next_allowed,
      updated_at=excluded.updated_at;
  insert into public.web_refresh_guard(scope,next_allowed,updated_at)
    values (player_scope,current_time+interval '15 minutes',current_time)
    on conflict(scope) do update set next_allowed=excluded.next_allowed,
      updated_at=excluded.updated_at;
  return true;
end
$function$;
revoke all on function public.reserve_web_refresh(text) from public,anon,authenticated;
grant execute on function public.reserve_web_refresh(text) to service_role;
