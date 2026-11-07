-- On-demand, aggregate-only collection progress and recorded-source freshness.
-- Called only by the Data Health UI through the existing /api/health function.
-- A last_checked timestamp is a database check, NOT proof of a new PUBG reply.
-- A match played_at date is event time; recorded_at is archive write time.
-- Job states are collector bookkeeping, NOT guarantees of live freshness.
create or replace function public.get_clan_collection_health()
returns jsonb
language sql stable security invoker set search_path = ''
as $fn$
with verified as (
  select p.id,p.last_checked
  from public.players p
  where p.platform in ('xbox','psn')
    and p.pubg_account_id ~ '^[A-Za-z0-9._-]{8,160}$'
    and exists (
      select 1 from public.player_import_queue q
      where q.is_clan_member=true and q.status='matched'
        and pg_catalog.lower(q.gamertag)=pg_catalog.lower(p.gamertag)
        and (q.platform is null or q.platform=p.platform)
    )
), player_counts as (
  select count(*)::int total,
    count(last_checked)::int checked,
    count(*) filter(where last_checked >= pg_catalog.now()-interval '24 hours'
      and last_checked <=pg_catalog.now())::int checked24h,
    count(*) filter(where last_checked >= pg_catalog.now()-interval '48 hours'
      and last_checked <=pg_catalog.now())::int checked48h,
    count(*) filter(where last_checked < pg_catalog.now()-interval '48 hours')::int older48h,
    max(last_checked) latest,
    min(last_checked) oldest
  from verified
), archive_counts as (
  select count(*)::int observations,
    count(distinct a.player_id)::int observed_players,
    count(distinct a.match_id)::int distinct_games,
    count(*) filter(where a.recorded_at >= pg_catalog.now()-interval '24 hours'
      and a.recorded_at <=pg_catalog.now())::int written24h,
    max(a.recorded_at) last_write,
    max(a.played_at) last_game
  from public.clan_match_archive a
  join verified v on v.id=a.player_id
), scopes as (
  select scope from (values ('lifetime'),('profile'),('weapons'),('survival')) x(scope)
), grouped as (
  select s.scope,
    count(j.player_id)::int total,
    count(*) filter(where j.state='done')::int done,
    count(*) filter(where j.state='pending')::int pending,
    count(*) filter(where j.state='leased')::int leased,
    count(*) filter(where j.state='unavailable')::int unavailable,
    count(*) filter(where j.state='pending'
      and j.next_attempt_at <=pg_catalog.now())::int ready,
    count(*) filter(where j.state='pending'
      and j.last_attempt_at < pg_catalog.now()-interval '48 hours')::int retry_older48h,
    max(j.last_attempt_at) last_attempt,
    max(j.completed_at) last_completion
  from scopes s
  left join public.pubg_backfill_jobs j on j.scope=s.scope
    and exists(select 1 from verified v where v.id=j.player_id)
  group by s.scope
), seasons as (
  select count(*)::int tracked,
    count(*) filter(where last_attempt_at>=pg_catalog.now()-interval '24 hours'
      and last_attempt_at<=pg_catalog.now())::int attempted24h,
    count(*) filter(where last_finished_at>=pg_catalog.now()-interval '24 hours'
      and last_finished_at<=pg_catalog.now())::int completed24h,
    max(last_attempt_at) last_attempt,
    max(last_finished_at) last_completion
  from public.clan_season_sync_state s
  where exists(select 1 from verified v where v.id=s.player_id)
)
select pg_catalog.jsonb_build_object(
  'schemaVersion',1,'checkedAt',pg_catalog.now(),
  'players',pg_catalog.jsonb_build_object(
    'verified',p.total,'checked',p.checked,'checkedWithin24h',p.checked24h,
    'checkedWithin48h',p.checked48h,'checkedOlderThan48h',p.older48h,
    'latestCheckedAt',p.latest,'oldestCheckedAt',p.oldest
  ),
  'archive',pg_catalog.jsonb_build_object(
    'playerMatchObservations',a.observations,'observedPlayers',a.observed_players,
    'distinctMatches',a.distinct_games,'writesWithin24h',a.written24h,
    'lastWrittenAt',a.last_write,'lastMatchPlayedAt',a.last_game
  ),
  'scopes',coalesce((
    select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
       'scope',scope,'total',total,'done',done,'pending',pending,
       'leased',leased,'unavailable',unavailable,
       'readyForRetry',ready,'pendingOlderThan48h',retry_older48h,
       'lastAttemptAt',last_attempt,'lastCompletedAt',last_completion
      ) order by case scope when 'lifetime' then 1 when 'profile' then 2
         when 'weapons' then 3 when 'survival' then 4 end
    ) from grouped
  ),'[]'::jsonb),
  'season',pg_catalog.jsonb_build_object(
    'tracked',s.tracked,'attemptedWithin24h',s.attempted24h,
    'completedWithin24h',s.completed24h,'lastAttemptAt',s.last_attempt,
    'lastCompletedAt',s.last_completion
  )
)
from player_counts p cross join archive_counts a cross join seasons s;
$fn$;
revoke all on function public.get_clan_collection_health()
 from public,anon,authenticated;
grant execute on function public.get_clan_collection_health()
 to service_role;
