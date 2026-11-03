-- Genuine daily lifetime snapshots; captured from both Discord and roster-import writes.
-- One sample per UTC calendar day per PUBG player. Never fabricate previous points.
create table if not exists public.player_stat_snapshots (
  player_id bigint not null references public.players(id) on delete cascade,
  snapshot_date date not null,
  observed_at timestamptz not null,
  kills integer not null default 0,
  wins integer not null default 0,
  matches integer not null default 0,
  primary key (player_id, snapshot_date)
);
create index if not exists player_stat_snapshots_recent_idx
  on public.player_stat_snapshots (player_id, observed_at desc);
alter table public.player_stat_snapshots enable row level security;
revoke all on public.player_stat_snapshots from anon, authenticated;
grant select, insert, update, delete on public.player_stat_snapshots to service_role;
create or replace function public.capture_player_stat_snapshot()
returns trigger language plpgsql
set search_path = ''
as $$
declare observed timestamptz;
begin
  if new.last_checked is null then return new; end if;
  if tg_op = 'UPDATE' and
     new.last_checked is not distinct from old.last_checked and
     new.total_kills is not distinct from old.total_kills and
     new.total_wins is not distinct from old.total_wins and
     new.matches_played is not distinct from old.matches_played
  then return new; end if;
  observed := new.last_checked;
  insert into public.player_stat_snapshots
    (player_id,snapshot_date,observed_at,kills,wins,matches)
  values (new.id, (observed at time zone 'UTC')::date, observed,
    greatest(coalesce(new.total_kills,0),0),
    greatest(coalesce(new.total_wins,0),0),
    greatest(coalesce(new.matches_played,0),0))
  on conflict (player_id,snapshot_date)
  do update set
    observed_at=excluded.observed_at,
    kills=excluded.kills, wins=excluded.wins, matches=excluded.matches
  where excluded.observed_at >= public.player_stat_snapshots.observed_at;
  return new;
end
$$;
drop trigger if exists players_capture_stat_snapshot on public.players;
create trigger players_capture_stat_snapshot
  after insert or update of total_kills, total_wins, matches_played, last_checked
  on public.players
  for each row execute function public.capture_player_stat_snapshot();

-- The baseline uses the genuine last_checked time already saved by the PUBG bot.
insert into public.player_stat_snapshots
  (player_id,snapshot_date,observed_at,kills,wins,matches)
select id,(last_checked at time zone 'UTC')::date,last_checked,
  greatest(coalesce(total_kills,0),0),
  greatest(coalesce(total_wins,0),0),
  greatest(coalesce(matches_played,0),0)
from public.players
where last_checked is not null
on conflict (player_id,snapshot_date) do nothing;