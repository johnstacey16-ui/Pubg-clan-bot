-- Applied to the existing PUBG Bot Supabase project on 2026-11-03.
-- Latest genuine observation per official roster member / season / mode.
-- Server/service-role only; never grant browser clients direct table access.
create index if not exists player_season_snapshots_board_idx
  on public.player_season_snapshots (kind,mode,season_id,player_id,captured_at desc);

create or replace function public.get_clan_season_leaderboard(
  p_kind text,
  p_mode text
)
returns table (
  season_id text, player_name text, platform text, captured_at timestamptz,
  matches numeric, kills numeric, wins numeric, damage numeric,
  rank_points numeric, tier text, sub_tier text
)
language sql stable security invoker
set search_path = ''
as $$
  select distinct on (s.season_id, s.player_id)
    s.season_id, p.gamertag, p.platform, s.captured_at,
    s.matches, s.kills, s.wins, s.damage, s.rank_points,
    s.tier, s.sub_tier
  from public.player_season_snapshots as s
  join public.players as p on p.id = s.player_id
  where p_kind in ('season','ranked')
    and p_mode in ('solo','duo','squad','solo-fpp','duo-fpp','squad-fpp')
    and s.kind = p_kind
    and s.mode = p_mode
    and p.platform in ('xbox','psn')
    and exists (
      select 1 from public.player_import_queue as q
      where q.is_clan_member = true
        and q.status = 'matched'
        and pg_catalog.lower(q.gamertag) = pg_catalog.lower(p.gamertag)
        and (q.platform is null or q.platform = p.platform)
    )
  order by s.season_id, s.player_id, s.captured_at desc
$$;
revoke all on function public.get_clan_season_leaderboard(text,text)
  from public, anon, authenticated;
grant execute on function public.get_clan_season_leaderboard(text,text)
  to service_role;
