-- Archived-PUBG-only clan single-match record book.
-- Server-side service-role RPC; no raw match JSON, account IDs, player IDs,
-- telemetry addresses, or match IDs are sent to the web browser.
-- At most five *distinct clan players* per metric: their best actual
-- observed match inside the selected rolling 7/30/180-day window.
-- Missing and invalid stats do not compete as fake zero performances.
create or replace function public.get_clan_match_record_book(p_days integer)
returns jsonb
language sql stable security invoker set search_path = ''
as $fn$
with metrics as (
  select metric from (
    values ('kills'),('damage'),('headshots'),('assists'),
      ('knocks'),('revives'),('longestKillMeters'),
      ('timeSurvivedSeconds'),('roadKills'),('vehicleDestroys')
  ) v(metric)
), verified as (
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
  select p.id as player_id,p.gamertag as player_name,p.platform,
    a.match_id,a.played_at,a.summary
  from verified p
  join public.clan_match_archive a on a.player_id=p.id
  where p_days in (7,30,180)
    and a.played_at between pg_catalog.now()-p_days*interval '1 day'
      and pg_catalog.now()
), scored as (
  select o.player_id,o.player_name,o.platform,o.match_id,o.played_at,
    pg_catalog.left(coalesce(o.summary->>'map','Unknown map'),100) as map,
    pg_catalog.left(coalesce(o.summary->>'mode','Unknown mode'),100) as mode,
    m.metric,public.optional_pubg_stat_number(o.summary->>m.metric) as value
  from observed o cross join metrics m
), coverage as (
  select m.metric,count(s.value)::integer as observed
  from metrics m left join scored s on s.metric=m.metric
  group by m.metric
), best_per_player as (
  select s.*,
    row_number() over (
      partition by s.metric,s.player_id
      order by s.value desc,s.played_at desc,s.match_id
    ) as player_rank
  from scored s where s.value>0
), ranked as (
  select b.*,
    row_number() over (
      partition by b.metric
      order by b.value desc,b.played_at desc,pg_catalog.lower(b.player_name),b.player_id
    ) as record_rank
  from best_per_player b where b.player_rank=1
)
select pg_catalog.jsonb_build_object(
  'schemaVersion',1,
  'periodDays',p_days,
  'generatedAt',pg_catalog.now(),
  'verifiedPlayers',(select count(*)::integer from verified),
  'observedPlayers',(select count(distinct player_id)::integer from observed),
  'playerMatchObservations',(select count(*)::integer from observed),
  'distinctMatches',(select count(distinct match_id)::integer from observed),
  'coverage',coalesce((
    select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object('metric',metric,'observed',observed)
      order by metric
    ) from coverage
  ),'[]'::jsonb),
  'records',coalesce((
    select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'metric',metric,'rank',record_rank,'value',value,
        'name',player_name,'platform',platform,
        'map',map,'mode',mode,'playedAt',played_at
      ) order by metric,record_rank
    ) from ranked where record_rank<=5
  ),'[]'::jsonb)
)
$fn$;
revoke all on function public.get_clan_match_record_book(integer)
  from public,anon,authenticated;
grant execute on function public.get_clan_match_record_book(integer)
  to service_role;
