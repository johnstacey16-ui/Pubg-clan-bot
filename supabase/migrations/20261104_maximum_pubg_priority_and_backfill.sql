-- PUBG key default: 10 rate-limited calls/minute. A 65-second sliding
-- window guarantees no more than 10 in any 60-second interval.
-- All calls use one existing reservations table and a single advisory lock.
create or replace function public.reserve_pubg_requests(p_count integer)
returns boolean language plpgsql security invoker set search_path = ''
as $fn$
declare used_count integer;
begin
  if p_count is null or p_count < 1 or p_count > 10 then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(551167711);
  delete from public.pubg_api_requests
    where requested_at <= pg_catalog.clock_timestamp()-interval '65 seconds';
  select count(*) into used_count from public.pubg_api_requests;
  if used_count+p_count > 10 then return false; end if;
  insert into public.pubg_api_requests(requested_at)
    select pg_catalog.clock_timestamp() from pg_catalog.generate_series(1,p_count);
  return true;
end
$fn$;
revoke all on function public.reserve_pubg_requests(integer) from public,anon,authenticated;
grant execute on function public.reserve_pubg_requests(integer) to service_role;

-- Background jobs can consume eight calls/65s at most, preserving two fresh
-- slots for users when the key has not already been spent interactively.
-- A background call never bypasses the shared authoritative 10-slot bucket.
create or replace function public.reserve_pubg_background_requests(p_count integer)
returns boolean language plpgsql security invoker set search_path = ''
as $fn$
declare used_count integer;
begin
  if p_count is null or p_count < 1 or p_count > 8 then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(551167711);
  delete from public.pubg_api_requests
    where requested_at <= pg_catalog.clock_timestamp()-interval '65 seconds';
  select count(*) into used_count from public.pubg_api_requests;
  if used_count+p_count > 8 then return false; end if;
  insert into public.pubg_api_requests(requested_at)
    select pg_catalog.clock_timestamp() from pg_catalog.generate_series(1,p_count);
  return true;
end
$fn$;
revoke all on function public.reserve_pubg_background_requests(integer) from public,anon,authenticated;
grant execute on function public.reserve_pubg_background_requests(integer) to service_role;

-- Different people can refresh at the same time when shared PUBG capacity is
-- available. Deduplicate the same player/scope for two minutes. Previously a
-- GLOBAL 90-second gate prevented all other users from refreshing.
create or replace function public.reserve_web_refresh(p_player_key text)
returns boolean language plpgsql security invoker set search_path = ''
as $fn$
declare
  reservation_at timestamptz := pg_catalog.clock_timestamp();
  next_player timestamptz;
  player_scope text;
begin
  if p_player_key is null or pg_catalog.length(p_player_key) > 180
    or p_player_key !~ '^(auto|xbox|psn):[^,[:cntrl:]]{1,100}$'
  then return false; end if;
  player_scope := 'player:'||pg_catalog.lower(p_player_key);
  perform pg_catalog.pg_advisory_xact_lock(87119521);
  select next_allowed into next_player from public.web_refresh_guard
    where scope=player_scope;
  if next_player is not null and next_player>reservation_at then return false; end if;
  insert into public.web_refresh_guard(scope,next_allowed,updated_at)
    values (player_scope,reservation_at+interval '2 minutes',reservation_at)
    on conflict(scope) do update set
      next_allowed=excluded.next_allowed,updated_at=excluded.updated_at;
  return true;
end
$fn$;
revoke all on function public.reserve_web_refresh(text) from public,anon,authenticated;
grant execute on function public.reserve_web_refresh(text) to service_role;

-- Persist progress so backfill continues between Vercel invocations, and
-- missing or temporarily unavailable resources cannot starve later players.
create table if not exists public.pubg_backfill_jobs (
  player_id bigint not null references public.players(id) on delete cascade,
  scope text not null check (scope in ('lifetime','profile','weapons','survival')),
  state text not null default 'pending'
    check (state in ('pending','leased','done','unavailable')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default pg_catalog.now(),
  last_attempt_at timestamptz,
  completed_at timestamptz,
  last_outcome text,
  primary key (player_id,scope)
);
create index if not exists pubg_backfill_jobs_due_idx on public.pubg_backfill_jobs
  (state,next_attempt_at,player_id);
alter table public.pubg_backfill_jobs enable row level security;
revoke all on public.pubg_backfill_jobs from public,anon,authenticated;
grant select,insert,update,delete on public.pubg_backfill_jobs to service_role;

create or replace function public.seed_pubg_backfill_jobs()
returns integer language plpgsql security invoker set search_path = ''
as $fn$
declare added integer;
begin
  -- Existing saved results are refreshed only when genuinely stale: lifetime
  -- and match indexes daily, mastery once per week, not on every page view.
  update public.pubg_backfill_jobs j set state='pending',
    next_attempt_at=pg_catalog.clock_timestamp(),completed_at=null
  where j.state='done' and j.completed_at < pg_catalog.clock_timestamp()-
    (case when j.scope in ('lifetime','profile') then interval '24 hours'
          else interval '7 days' end);
  insert into public.pubg_backfill_jobs(player_id,scope)
  select p.id,s.scope
    from public.players p
    cross join (values ('lifetime'),('profile'),('weapons'),('survival')) s(scope)
   where p.platform in ('xbox','psn')
     and p.pubg_account_id ~ '^[A-Za-z0-9._-]{8,160}$'
     and exists (
       select 1 from public.player_import_queue q
       where q.is_clan_member=true and q.status='matched'
         and pg_catalog.lower(q.gamertag)=pg_catalog.lower(p.gamertag)
         and (q.platform is null or q.platform=p.platform)
     )
  on conflict(player_id,scope) do nothing;
  get diagnostics added = row_count;
  return added;
end
$fn$;
revoke all on function public.seed_pubg_backfill_jobs() from public,anon,authenticated;
grant execute on function public.seed_pubg_backfill_jobs() to service_role;

-- Claim at most six independently leased jobs, with skip-locked to prevent
-- simultaneous workers from fetching the same resource. The lease expires.
create or replace function public.claim_pubg_backfill_jobs(p_limit integer)
returns table (
  player_id bigint, platform text, pubg_account_id text,
  gamertag text, scope text, attempts integer
)
language sql volatile security invoker set search_path = ''
as $fn$
with selected as (
  select j.player_id,j.scope
  from public.pubg_backfill_jobs j
  where j.state in ('pending','leased') and
    j.next_attempt_at <= pg_catalog.clock_timestamp()
  order by case j.scope when 'lifetime' then 1 when 'profile' then 2 when 'weapons' then 3 else 4 end,
    j.next_attempt_at,j.player_id
  limit least(6,greatest(1,coalesce(p_limit,6)))
  for update of j skip locked
), acquired as (
  update public.pubg_backfill_jobs j set
    state='leased',attempts=j.attempts+1,
    last_attempt_at=pg_catalog.clock_timestamp(),
    next_attempt_at=pg_catalog.clock_timestamp()+interval '3 minutes'
  from selected s
  where j.player_id=s.player_id and j.scope=s.scope
  returning j.player_id,j.scope,j.attempts
)
select a.player_id,p.platform,p.pubg_account_id,p.gamertag,a.scope,a.attempts
from acquired a join public.players p on p.id=a.player_id;
$fn$;
revoke all on function public.claim_pubg_backfill_jobs(integer) from public,anon,authenticated;
grant execute on function public.claim_pubg_backfill_jobs(integer) to service_role;

create or replace function public.get_pubg_backfill_status()
returns jsonb language sql stable security invoker set search_path = ''
as $fn$
select pg_catalog.jsonb_build_object(
  'total',count(*)::int,
  'done',count(*) filter(where state='done')::int,
  'pending',count(*) filter(where state='pending')::int,
  'leased',count(*) filter(where state='leased')::int,
  'unavailable',count(*) filter(where state='unavailable')::int
) from public.pubg_backfill_jobs;
$fn$;
revoke all on function public.get_pubg_backfill_status() from public,anon,authenticated;
grant execute on function public.get_pubg_backfill_status() to service_role;

-- Keep the public aggregate health projection truthful after the new limit.
create or replace function public.get_public_pubg_cache_health()
returns jsonb
language sql stable security invoker set search_path = ''
as $fn$
with classified as (
 select case
  when cache_key like 'web:telemetry:%' then 'telemetry_reports'
  when cache_key like 'pubg:v1:console/matches/%' then 'matches'
  when cache_key like '%/leaderboards/%' then 'regional_leaderboards'
  when cache_key like '%/seasons/%/ranked' then 'ranked'
  when cache_key like '%/seasons/%' then 'season'
  when cache_key like '%/weapon_mastery' then 'weapons'
  when cache_key like '%/survival_mastery' then 'survival'
  when cache_key like '%/seasons' then 'season_catalogues'
  when cache_key like '%/players/%' then 'player_profiles'
  else 'other' end as category,expires_at,fetched_at
 from public.pubg_endpoint_cache
), totals as (
 select count(*)::int total,
  count(*) filter(where expires_at>pg_catalog.now())::int fresh,
  count(*) filter(where expires_at<=pg_catalog.now())::int expired,
  max(fetched_at) newest
 from classified
), groups as (
 select coalesce(pg_catalog.jsonb_object_agg(category,n),'{}'::jsonb) items
 from (select category,count(*)::int n from classified group by category) counts
), quota as (
 select count(*) filter(
  where requested_at>pg_catalog.now()-interval '65 seconds'
 )::int reserved,max(requested_at) latest
 from public.pubg_api_requests
)
select pg_catalog.jsonb_build_object(
 'schemaVersion',1,'checkedAt',pg_catalog.now(),
 'cache',pg_catalog.jsonb_build_object(
  'total',totals.total,'fresh',totals.fresh,'expired',totals.expired,
  'newestFetchedAt',totals.newest,'byCategory',groups.items
 ),
 'budget',pg_catalog.jsonb_build_object(
  'reservationLimit',10,'rollingWindowSeconds',65,'reserved',quota.reserved,
  'remaining',greatest(0,10-quota.reserved),'lastReservedAt',quota.latest
 ),
 'observations',pg_catalog.jsonb_build_object(
  'lifetimePlayers',(select count(distinct player_id)::int from public.player_stat_snapshots),
  'seasonPlayers',(select count(distinct player_id)::int from public.player_season_snapshots),
  'seasonAttempts',(select count(*)::int from public.clan_season_sync_state)
 )
)
from totals cross join groups cross join quota;
$fn$;
revoke all on function public.get_public_pubg_cache_health() from public,anon,authenticated;
grant execute on function public.get_public_pubg_cache_health() to service_role;
