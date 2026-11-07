-- True observed improvement windows, using the latest saved lifetime snapshot
-- and a real earlier snapshot closest to the selected target interval.
-- There is NO interpolation, projection, or external PUBG request.
-- Keep the old 6-14 day RPC intact for compatibility.
create or replace function public.get_clan_observed_progress(p_days integer)
returns table (
 player_name text, platform text, latest_at timestamptz, previous_at timestamptz,
 latest_kills integer, latest_wins integer, latest_matches integer,
 previous_kills integer, previous_wins integer, previous_matches integer
)
language sql stable security invoker set search_path = ''
as $fn$
 select p.gamertag::text,p.platform::text,
  recent.observed_at,older.observed_at,
  recent.kills,recent.wins,recent.matches,
  older.kills,older.wins,older.matches
 from public.players p
 join lateral (
  select s.observed_at,s.kills,s.wins,s.matches
  from public.player_stat_snapshots s
  where s.player_id=p.id
  order by s.observed_at desc limit 1
 ) recent on true
 left join lateral (
  select s.observed_at,s.kills,s.wins,s.matches
  from public.player_stat_snapshots s
  where s.player_id=p.id
    and p_days in (1,3,7,14)
    and s.observed_at <= recent.observed_at -
      (case p_days when 1 then 0.75 when 3 then 2
        when 7 then 6 when 14 then 12 else 999 end)*interval '1 day'
    and s.observed_at >= recent.observed_at -
      (case p_days when 1 then 1.5 when 3 then 4
        when 7 then 9 when 14 then 17 else 999 end)*interval '1 day'
  order by pg_catalog.abs(
    pg_catalog.extract(epoch from (recent.observed_at-s.observed_at)) -
    p_days*86400
  ),s.observed_at desc
  limit 1
 ) older on true
 where p_days in (1,3,7,14) and p.platform in ('xbox','psn')
   and exists(
     select 1 from public.player_import_queue q
     where q.is_clan_member=true and q.status='matched'
       and pg_catalog.lower(q.gamertag)=pg_catalog.lower(p.gamertag)
       and (q.platform is null or q.platform=p.platform)
   )
 order by p.gamertag;
$fn$;
revoke all on function public.get_clan_observed_progress(integer)
  from public,anon,authenticated;
grant execute on function public.get_clan_observed_progress(integer)
  to service_role;
