-- Lightweight date-based activity intelligence built strictly from archived,
-- verified clan-player match observations. A game with several clan players
-- counts once as a distinct game but once per player as a player-match.
-- UTC calendar days are used (including the current partial UTC day); an empty
-- date means no SAVED report, not proof that nobody played.
create or replace function public.get_clan_activity_pulse(p_days integer)
returns jsonb
language sql stable security invoker set search_path = ''
as $fn$
with limits as (
  select (pg_catalog.now() at time zone 'UTC')::date as today
  where p_days in (7,30,180)
), dates as (
  select g::date as day
  from limits l
  cross join lateral pg_catalog.generate_series(
    l.today-(p_days-1),l.today,interval '1 day') g
), verified as (
  select p.id
  from public.players p
  where p.platform in ('xbox','psn')
    and p.pubg_account_id ~ '^[A-Za-z0-9._-]{8,160}$'
    and exists(
      select 1 from public.player_import_queue q
      where q.is_clan_member=true and q.status='matched'
        and pg_catalog.lower(q.gamertag)=pg_catalog.lower(p.gamertag)
        and (q.platform is null or q.platform=p.platform)
    )
), archived as (
  select a.player_id,a.match_id,a.played_at,
    (a.played_at at time zone 'UTC')::date as day,
    public.optional_pubg_stat_number(a.summary->>'kills') as kills,
    public.optional_pubg_stat_number(a.summary->>'damage') as damage,
    nullif(public.optional_pubg_stat_number(a.summary->>'placement'),0) as placement
  from verified v join public.clan_match_archive a on a.player_id=v.id
  where a.played_at>=((select min(day) from dates)::timestamp at time zone 'UTC')
    and a.played_at<=pg_catalog.now()
), per_day as (
  select day,
    count(*)::integer as player_matches,
    count(distinct match_id)::integer as distinct_games,
    count(distinct player_id)::integer as active_players,
    count(kills)::integer as kills_observed,
    coalesce(sum(kills),0) as kills_total,
    count(damage)::integer as damage_observed,
    coalesce(sum(damage),0) as damage_total,
    count(placement)::integer as placed,
    count(*) filter(where placement=1)::integer as player_wins,
    count(*) filter(where placement between 1 and 10)::integer as player_top10
  from archived group by day
)
select pg_catalog.jsonb_build_object(
  'schemaVersion',1,
  'periodDays',p_days,
  'generatedAt',pg_catalog.now(),
  'timeZone','UTC',
  'verifiedPlayers',(select count(*)::integer from verified),
  'observedPlayers',(select count(distinct player_id)::integer from archived),
  'playerMatchObservations',(select count(*)::integer from archived),
  'distinctMatches',(select count(distinct match_id)::integer from archived),
  'firstMatchAt',(select min(played_at) from archived),
  'lastMatchAt',(select max(played_at) from archived),
  'days',coalesce((
    select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'day',pg_catalog.to_char(d.day,'YYYY-MM-DD'),
        'playerMatches',coalesce(t.player_matches,0),
        'distinctMatches',coalesce(t.distinct_games,0),
        'activePlayers',coalesce(t.active_players,0),
        'killsObserved',coalesce(t.kills_observed,0),
        'kills',coalesce(t.kills_total,0),
        'damageObserved',coalesce(t.damage_observed,0),
        'damage',coalesce(t.damage_total,0),
        'knownPlacements',coalesce(t.placed,0),
        'playerWins',coalesce(t.player_wins,0),
        'playerTop10',coalesce(t.player_top10,0)
      ) order by d.day
    ) from dates d left join per_day t on t.day=d.day
  ),'[]'::jsonb)
)
$fn$;
revoke all on function public.get_clan_activity_pulse(integer)
  from public,anon,authenticated;
grant execute on function public.get_clan_activity_pulse(integer)
  to service_role;
