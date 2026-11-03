-- Latest actual saved lifetime observation, matched to the nearest
-- actual observation 6–14 days earlier. No interpolated weeks.
create or replace function public.get_clan_weekly_progress()
returns table (
 player_name text, platform text, latest_at timestamptz, previous_at timestamptz,
 latest_kills integer, latest_wins integer, latest_matches integer,
 previous_kills integer, previous_wins integer, previous_matches integer
)
language sql stable security invoker set search_path = ''
as $$
 select p.gamertag::text,p.platform::text,
  recent.observed_at,old.observed_at,
  recent.kills,recent.wins,recent.matches,
  old.kills,old.wins,old.matches
 from public.players p
 join lateral (
  select s.observed_at,s.kills,s.wins,s.matches
  from public.player_stat_snapshots s where s.player_id=p.id
  order by s.observed_at desc limit 1
 ) recent on true
 left join lateral (
  select s.observed_at,s.kills,s.wins,s.matches
  from public.player_stat_snapshots s
  where s.player_id=p.id
    and s.observed_at <= recent.observed_at - interval '6 days'
    and s.observed_at >= recent.observed_at - interval '14 days'
  order by s.observed_at desc limit 1
 ) old on true
 where p.platform in ('xbox','psn') and exists (
  select 1 from public.player_import_queue q
  where q.is_clan_member=true and q.status='matched'
    and pg_catalog.lower(q.gamertag)=pg_catalog.lower(p.gamertag)
    and (q.platform is null or q.platform=p.platform)
 )
 order by p.gamertag;
$$;
revoke all on function public.get_clan_weekly_progress()
 from public,anon,authenticated;
grant execute on function public.get_clan_weekly_progress() to service_role;