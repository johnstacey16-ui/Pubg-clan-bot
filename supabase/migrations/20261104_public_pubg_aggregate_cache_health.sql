-- Aggregate health for the existing public status page.
-- Only the service role can execute. Never return cache keys, payloads,
-- player identities, event data or raw request records.
create or replace function public.get_public_pubg_cache_health()
returns jsonb
language sql stable security invoker set search_path = ''
as $$
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
  'reservationLimit',8,'rollingWindowSeconds',65,'reserved',quota.reserved,
  'remaining',greatest(0,8-quota.reserved),'lastReservedAt',quota.latest
 ),
 'observations',pg_catalog.jsonb_build_object(
  'lifetimePlayers',(select count(distinct player_id)::int from public.player_stat_snapshots),
  'seasonPlayers',(select count(distinct player_id)::int from public.player_season_snapshots),
  'seasonAttempts',(select count(*)::int from public.clan_season_sync_state)
 )
)
from totals cross join groups cross join quota;
$$;
revoke all on function public.get_public_pubg_cache_health()
 from public,anon,authenticated;
grant execute on function public.get_public_pubg_cache_health()
 to service_role;
