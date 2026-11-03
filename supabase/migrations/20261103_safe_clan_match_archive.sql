-- Applied to Supabase on 2026-11-03. This idempotent schema is the
-- exact deployed functions, exported with pg_get_functiondef.
-- Only compact verified-clan summaries are archived, never raw payloads.
create table if not exists public.clan_match_archive (
  player_id bigint not null references public.players(id) on delete cascade,
  match_id text not null,
  played_at timestamptz not null,
  summary jsonb not null,
  recorded_at timestamptz not null default now(),
  primary key (player_id,match_id)
);
create index if not exists clan_match_archive_recent
  on public.clan_match_archive (player_id,played_at desc);
alter table public.clan_match_archive enable row level security;
revoke all on public.clan_match_archive from anon, authenticated;
grant select,insert,update,delete on public.clan_match_archive to service_role;

CREATE OR REPLACE FUNCTION public.safe_pubg_stat_number(value text)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case when value ~ '^[0-9]{1,9}(\.[0-9]{1,5})?$'
    then least(value::numeric, 100000000) else 0 end;
$function$
;
revoke all on function public.safe_pubg_stat_number(text) from public,anon,authenticated;
grant execute on function public.safe_pubg_stat_number(text) to service_role;

CREATE OR REPLACE FUNCTION public.archive_verified_clan_match(payload jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  match_id_value text;
  played timestamptz;
  attrs jsonb;
  included jsonb;
  participant jsonb;
  stats jsonb;
  teammates jsonb;
  references_json jsonb;
  summary_value jsonb;
  official_player_id bigint;
  count_archived integer := 0;
begin
  match_id_value := payload #>> '{data,id}';
  if match_id_value is null
     or match_id_value !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
  then return 0; end if;
  attrs := payload #> '{data,attributes}';
  if coalesce(jsonb_typeof(payload->'included'),'null') <> 'array' then return 0; end if;
  included := payload->'included';
  if nullif(attrs->>'createdAt','') is null then return 0; end if;
  played := (attrs->>'createdAt')::timestamptz;
  if played < now()-interval '180 days' or played > now()+interval '1 day'
  then return 0; end if;

  for participant in select value from jsonb_array_elements(included)
    where value->>'type'='participant'
  loop
    stats := participant #> '{attributes,stats}';
    official_player_id := null;
    select p.id into official_player_id
    from public.players p
    join public.player_import_queue q on lower(q.gamertag)=lower(p.gamertag)
    where p.pubg_account_id = stats->>'playerId'
      and p.platform in ('xbox','psn')
      and q.is_clan_member = true
      and q.status = 'matched'
    order by p.id limit 1;
    if official_player_id is null then continue; end if;

    references_json := '[]'::jsonb;
    select coalesce(r.value #> '{relationships,participants,data}','[]'::jsonb)
      into references_json
    from jsonb_array_elements(included) r
    where r.value->>'type'='roster'
      and jsonb_typeof(r.value #> '{relationships,participants,data}')='array'
      and exists(
        select 1 from jsonb_array_elements(r.value #> '{relationships,participants,data}') j
        where j.value->>'id'=participant->>'id'
      )
    limit 1;

    if references_json is null then references_json := '[]'::jsonb; end if;
    select coalesce(jsonb_agg(jsonb_build_object(
      'name',left(coalesce(part #>> '{attributes,stats,name}','Unknown'),100),
      'isSelf',(part->>'id')=(participant->>'id'),
      'kills',public.safe_pubg_stat_number(part #>> '{attributes,stats,kills}'),
      'damage',public.safe_pubg_stat_number(part #>> '{attributes,stats,damageDealt}'),
      'assists',public.safe_pubg_stat_number(part #>> '{attributes,stats,assists}'),
      'knocks',public.safe_pubg_stat_number(part #>> '{attributes,stats,DBNOs}')
    )),'[]'::jsonb) into teammates
    from (
      select x.value as part from jsonb_array_elements(included) x
      where x.value->>'type'='participant'
        and exists(select 1 from jsonb_array_elements(references_json) j
          where j.value->>'id'=x.value->>'id')
      limit 8
    ) team_parts;

    if jsonb_array_length(teammates)=0 then
      teammates := jsonb_build_array(jsonb_build_object(
        'name',left(coalesce(stats->>'name','Unknown'),100),
        'isSelf',true,
        'kills',public.safe_pubg_stat_number(stats->>'kills'),
        'damage',public.safe_pubg_stat_number(stats->>'damageDealt'),
        'assists',public.safe_pubg_stat_number(stats->>'assists'),
        'knocks',public.safe_pubg_stat_number(stats->>'DBNOs')
      ));
    end if;

    summary_value := jsonb_build_object(
      'id',match_id_value,
      'map',left(coalesce(attrs->>'mapName','Unknown map'),100),
      'mode',left(coalesce(attrs->>'gameMode','Unknown mode'),100),
      'playedAt',played,
      'durationSeconds',public.safe_pubg_stat_number(attrs->>'duration'),
      'placement',case when public.safe_pubg_stat_number(stats->>'winPlace')>0
        then public.safe_pubg_stat_number(stats->>'winPlace') else null end,
      'kills',public.safe_pubg_stat_number(stats->>'kills'),
      'damage',public.safe_pubg_stat_number(stats->>'damageDealt'),
      'assists',public.safe_pubg_stat_number(stats->>'assists'),
      'knocks',public.safe_pubg_stat_number(stats->>'DBNOs'),
      'headshots',public.safe_pubg_stat_number(stats->>'headshotKills'),
      'revives',public.safe_pubg_stat_number(stats->>'revives'),
      'heals',public.safe_pubg_stat_number(stats->>'heals'),
      'boosts',public.safe_pubg_stat_number(stats->>'boosts'),
      'longestKillMeters',public.safe_pubg_stat_number(stats->>'longestKill'),
      'walkMeters',public.safe_pubg_stat_number(stats->>'walkDistance'),
      'driveMeters',public.safe_pubg_stat_number(stats->>'rideDistance'),
      'squad',teammates
    );
    insert into public.clan_match_archive
       (player_id,match_id,played_at,summary,recorded_at)
    values (official_player_id,match_id_value,played,summary_value,now())
    on conflict (player_id,match_id)
    do update set played_at=excluded.played_at, summary=excluded.summary,
      recorded_at=excluded.recorded_at;
    count_archived := count_archived+1;
  end loop;
  return count_archived;
exception when others then
  raise warning 'PUBG archive extraction skipped: %',SQLERRM;
  return 0;
end;
$function$
;
revoke all on function public.archive_verified_clan_match(jsonb) from public,anon,authenticated;
grant execute on function public.archive_verified_clan_match(jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.capture_pubg_cached_match()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.cache_key like 'pubg:v1:console/matches/%' and
     new.cache_key = 'pubg:v1:console/matches/' || coalesce(new.payload #>> '{data,id}','')
  then
    perform public.archive_verified_clan_match(new.payload);
  end if;
  return new;
end;
$function$
;
revoke all on function public.capture_pubg_cached_match() from public,anon,authenticated;
grant execute on function public.capture_pubg_cached_match() to service_role;

drop trigger if exists archive_pubg_match_cache on public.pubg_endpoint_cache;
CREATE TRIGGER archive_pubg_match_cache AFTER INSERT OR UPDATE OF payload ON public.pubg_endpoint_cache FOR EACH ROW EXECUTE FUNCTION public.capture_pubg_cached_match();

CREATE OR REPLACE FUNCTION public.prune_clan_match_archive()
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare deleted integer;
begin
  delete from public.clan_match_archive
  where played_at < now() - interval '180 days';
  get diagnostics deleted = row_count;
  return deleted;
end;
$function$
;
revoke all on function public.prune_clan_match_archive() from public,anon,authenticated;
grant execute on function public.prune_clan_match_archive() to service_role;

-- Backfill existing cached PUBG match reports without spending API quota.
select public.archive_verified_clan_match(payload)
from public.pubg_endpoint_cache
where cache_key like 'pubg:v1:console/matches/%'
  and cache_key='pubg:v1:console/matches/'||coalesce(payload #>> '{data,id}','');
