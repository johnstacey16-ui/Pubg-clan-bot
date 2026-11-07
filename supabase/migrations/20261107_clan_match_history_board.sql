-- Cache-only historical clan match comparison, without exposing individual account
-- IDs, game IDs, opponents, raw match JSON or the restricted archive table.
-- In particular, one match with several clan members produces several
-- player-match observations; distinct games are reported separately.
-- 7/30/180-day periods are exact rolling windows from the database clock.
create or replace function public.get_clan_match_history_board(p_days integer)
returns jsonb
language sql stable security invoker set search_path = ''
as $fn$
with verified as (
  select p.id,p.gamertag,p.platform
  from public.players p
  where p.platform in ('xbox','psn')
    and p.pubg_account_id ~ '^[A-Za-z0-9._-]{8,160}$'
    and exists (
      select 1 from public.player_import_queue q
      where q.is_clan_member=true and q.status='matched'
        and pg_catalog.lower(q.gamertag)=pg_catalog.lower(p.gamertag)
        and (q.platform is null or q.platform=p.platform)
    )
), observed as (
  select v.id as player_id,v.gamertag,v.platform,a.match_id,a.played_at,
    coalesce(nullif(pg_catalog.left(a.summary->>'map',100),''),'Unknown map') as map,
    coalesce(nullif(pg_catalog.left(a.summary->>'mode',100),''),'Unknown mode') as mode,
    nullif(public.optional_pubg_stat_number(a.summary->>'placement'),0) as placement,
    public.optional_pubg_stat_number(a.summary->>'kills') as kills,
    public.optional_pubg_stat_number(a.summary->>'damage') as damage,
    public.optional_pubg_stat_number(a.summary->>'assists') as assists,
    public.optional_pubg_stat_number(a.summary->>'knocks') as knocks,
    public.optional_pubg_stat_number(a.summary->>'timeSurvivedSeconds') as survival
  from verified v
  join public.clan_match_archive a on a.player_id=v.id
  where p_days in (7,30,180)
    and a.played_at>=pg_catalog.now()-(p_days*interval '1 day')
    and a.played_at<=pg_catalog.now()
), grouped as (
  select gamertag,platform,map,mode,
    count(*)::integer as games,
    count(placement)::integer as placed,
    count(*) filter(where placement=1)::integer as wins,
    count(*) filter(where placement between 1 and 10)::integer as top10,
    count(kills)::integer as kills_observed,
    coalesce(sum(kills),0) as kills_total,
    count(damage)::integer as damage_observed,
    coalesce(sum(damage),0) as damage_total,
    count(assists)::integer as assists_observed,
    coalesce(sum(assists),0) as assists_total,
    count(knocks)::integer as knocks_observed,
    coalesce(sum(knocks),0) as knocks_total,
    count(survival)::integer as survival_observed,
    coalesce(sum(survival),0) as survival_seconds,
    coalesce(sum(placement),0) as placement_total,
    max(played_at) as latest
  from observed
  group by gamertag,platform,map,mode
)
select pg_catalog.jsonb_build_object(
  'schemaVersion',1,
  'periodDays',p_days,
  'generatedAt',pg_catalog.now(),
  'clanPlayers',(select count(*)::integer from verified),
  'observedPlayers',(select count(distinct player_id)::integer from observed),
  'playerMatchObservations',(select count(*)::integer from observed),
  'distinctMatches',(select count(distinct match_id)::integer from observed),
  'rows',coalesce((
    select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'name',gamertag,'platform',platform,'map',map,'mode',mode,
        'games',games,'placed',placed,'wins',wins,'top10',top10,
        'killsObserved',kills_observed,'kills',kills_total,
        'damageObserved',damage_observed,'damage',damage_total,
        'assistsObserved',assists_observed,'assists',assists_total,
        'knocksObserved',knocks_observed,'knocks',knocks_total,
        'survivalObserved',survival_observed,'survivalSeconds',survival_seconds,
        'placementTotal',placement_total,
        'latest',latest
      ) order by games desc,pg_catalog.lower(gamertag),map,mode
    )
    from grouped
  ),'[]'::jsonb)
)
$fn$;

revoke all on function public.get_clan_match_history_board(integer)
  from public,anon,authenticated;
grant execute on function public.get_clan_match_history_board(integer)
  to service_role;
