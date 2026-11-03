-- Compact, observed PUBG season and ranked history for saved Xbox/PSN players.
-- One latest genuine PUBG observation per hour/mode/season; no synthetic
-- history from an old lifetime total. No raw PUBG JSON or account IDs stored.
create table if not exists public.player_season_snapshots (
  player_id bigint not null references public.players(id) on delete cascade,
  season_id text not null,
  kind text not null check (kind in ('season','ranked')),
  mode text not null check (mode in ('solo','duo','squad','solo-fpp','duo-fpp','squad-fpp')),
  snapshot_hour timestamptz not null,
  captured_at timestamptz not null,
  matches numeric,
  kills numeric,
  wins numeric,
  damage numeric,
  rank_points numeric,
  tier text,
  sub_tier text,
  primary key (player_id,season_id,kind,mode,snapshot_hour)
);
create index if not exists player_season_snapshots_recent
 on public.player_season_snapshots (player_id,kind,captured_at desc);
alter table public.player_season_snapshots enable row level security;
revoke all on public.player_season_snapshots from anon,authenticated;
grant select,insert,update,delete on public.player_season_snapshots to service_role;

create or replace function public.record_pubg_season_snapshot(
  p_key text,p_payload jsonb,p_fetched_at timestamptz
) returns integer language plpgsql
set search_path = ''
as $$
declare
  parts text[];
  actual_player_id bigint;
  season_kind text;
  stats_by_mode jsonb;
  mode_key text;
  row_stats jsonb;
  recorded integer := 0;
begin
  parts := pg_catalog.regexp_match(p_key,
    '^pubg:v1:(xbox|psn)/players/([A-Za-z0-9._-]{8,160})/seasons/([A-Za-z0-9._-]{4,128})(/ranked)?$');
  if parts is null or p_fetched_at is null
    or p_fetched_at < pg_catalog.now()-interval '18 months'
    or p_fetched_at > pg_catalog.now()+interval '1 day'
  then return 0; end if;
  select p.id into actual_player_id from public.players p
    where p.platform=parts[1] and p.pubg_account_id=parts[2]
    order by p.id limit 1;
  if actual_player_id is null then return 0; end if;
  season_kind := case when parts[4]='/ranked' then 'ranked' else 'season' end;
  stats_by_mode:=p_payload #> array['data','attributes',
    case when season_kind='ranked' then 'rankedGameModeStats' else 'gameModeStats' end];
  if pg_catalog.jsonb_typeof(stats_by_mode)<>'object' then return 0; end if;
  foreach mode_key in array array['solo','duo','squad','solo-fpp','duo-fpp','squad-fpp'] loop
    row_stats:=stats_by_mode->mode_key;
    if pg_catalog.jsonb_typeof(row_stats)<>'object' then continue; end if;
    insert into public.player_season_snapshots (
      player_id,season_id,kind,mode,snapshot_hour,captured_at,
      matches,kills,wins,damage,rank_points,tier,sub_tier
    ) values (
      actual_player_id,parts[3],season_kind,mode_key,
      pg_catalog.date_trunc('hour',p_fetched_at),p_fetched_at,
      case when row_stats ? 'roundsPlayed' then public.safe_pubg_stat_number(row_stats->>'roundsPlayed') else null end,
      case when row_stats ? 'kills' then public.safe_pubg_stat_number(row_stats->>'kills') else null end,
      case when row_stats ? 'wins' then public.safe_pubg_stat_number(row_stats->>'wins') else null end,
      case when row_stats ? 'damageDealt' then public.safe_pubg_stat_number(row_stats->>'damageDealt') else null end,
      case when season_kind='ranked' and row_stats ? 'currentRankPoint'
        then public.safe_pubg_stat_number(row_stats->>'currentRankPoint') else null end,
      case when season_kind='ranked' and pg_catalog.jsonb_typeof(row_stats->'currentTier')='object'
        then pg_catalog.left(coalesce(row_stats #>> '{currentTier,tier}',''),50) else null end,
      case when season_kind='ranked' and pg_catalog.jsonb_typeof(row_stats->'currentTier')='object'
        then pg_catalog.left(coalesce(row_stats #>> '{currentTier,subTier}',''),16) else null end
    )
    on conflict(player_id,season_id,kind,mode,snapshot_hour)
      do update set captured_at=excluded.captured_at,
        matches=excluded.matches,kills=excluded.kills,wins=excluded.wins,
        damage=excluded.damage,rank_points=excluded.rank_points,
        tier=excluded.tier,sub_tier=excluded.sub_tier
      where public.player_season_snapshots.captured_at <= excluded.captured_at;
    recorded:=recorded+1;
  end loop;
  return recorded;
end;
$$;
revoke all on function public.record_pubg_season_snapshot(text,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.record_pubg_season_snapshot(text,jsonb,timestamptz) to service_role;

create or replace function public.capture_pubg_season_cache()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  perform public.record_pubg_season_snapshot(new.cache_key,new.payload,new.fetched_at);
  return new;
exception when others then
  raise warning 'PUBG season snapshot capture skipped: %',SQLERRM;
  return new;
end;
$$;
revoke all on function public.capture_pubg_season_cache() from public,anon,authenticated;
grant execute on function public.capture_pubg_season_cache() to service_role;

drop trigger if exists archive_pubg_season_cache on public.pubg_endpoint_cache;
create trigger archive_pubg_season_cache
  after insert or update of payload,fetched_at on public.pubg_endpoint_cache
  for each row execute function public.capture_pubg_season_cache();

create or replace function public.prune_player_season_snapshots()
returns integer language plpgsql
set search_path = ''
as $$
declare
  deleted integer;
begin
  delete from public.player_season_snapshots
    where captured_at < pg_catalog.now()-interval '18 months';
  get diagnostics deleted = row_count;
  return deleted;
end;
$$;
revoke all on function public.prune_player_season_snapshots() from public,anon,authenticated;
grant execute on function public.prune_player_season_snapshots() to service_role;

-- Capture real cache fetch times, not a fabricated 2026-11-03 "history".
select public.record_pubg_season_snapshot(cache_key,payload,fetched_at)
from public.pubg_endpoint_cache
where cache_key like 'pubg:v1:%/players/%/seasons/%';
