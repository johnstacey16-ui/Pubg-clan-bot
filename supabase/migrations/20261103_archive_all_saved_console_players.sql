-- Include every saved Xbox and PlayStation player in the existing
-- private, sanitised 180-day match archive, without raw match JSON.
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
    where p.pubg_account_id = stats->>'playerId'
      and p.platform in ('xbox','psn')
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
$function$;

-- Use already cached PUBG matches; consumes no new PUBG API requests.
select public.archive_verified_clan_match(payload)
from public.pubg_endpoint_cache
where cache_key like 'pubg:v1:console/matches/%'
  and cache_key='pubg:v1:console/matches/'||coalesce(payload #>> '{data,id}','');
