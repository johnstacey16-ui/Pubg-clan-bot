-- Extend the existing service-role-only 180-day archive without raw PUBG JSON.
-- Retains the historical function name/trigger and keeps all upstream requests cached.
-- Nullable official participant fields do not convert missing results into zero.
CREATE OR REPLACE FUNCTION public.optional_pubg_stat_number(value text)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  SELECT CASE WHEN value ~ '^[0-9]{1,9}(\.[0-9]{1,5})?$'
    THEN least(value::numeric, 100000000) ELSE NULL END
$function$;
REVOKE ALL ON FUNCTION public.optional_pubg_stat_number(text) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.optional_pubg_stat_number(text) TO service_role;

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
      'knocks',public.safe_pubg_stat_number(part #>> '{attributes,stats,DBNOs}'),
      'headshots',public.optional_pubg_stat_number(part #>> '{attributes,stats,headshotKills}'),
      'revives',public.optional_pubg_stat_number(part #>> '{attributes,stats,revives}'),
      'timeSurvivedSeconds',public.optional_pubg_stat_number(part #>> '{attributes,stats,timeSurvived}'),
      'deathType',case when part #>> '{attributes,stats,deathType}'
        in ('alive','byplayer','byzone','suicide','logout')
        then part #>> '{attributes,stats,deathType}' else null end
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
        'knocks',public.safe_pubg_stat_number(stats->>'DBNOs'),
        'headshots',public.optional_pubg_stat_number(stats->>'headshotKills'),
        'revives',public.optional_pubg_stat_number(stats->>'revives'),
        'timeSurvivedSeconds',public.optional_pubg_stat_number(stats->>'timeSurvived'),
        'deathType',case when stats->>'deathType' in
          ('alive','byplayer','byzone','suicide','logout')
          then stats->>'deathType' else null end
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
      'swimMeters',public.optional_pubg_stat_number(stats->>'swimDistance'),
      'timeSurvivedSeconds',public.optional_pubg_stat_number(stats->>'timeSurvived'),
      'killPlace',public.optional_pubg_stat_number(stats->>'killPlace'),
      'killStreaks',public.optional_pubg_stat_number(stats->>'killStreaks'),
      'roadKills',public.optional_pubg_stat_number(stats->>'roadKills'),
      'teamKills',public.optional_pubg_stat_number(stats->>'teamKills'),
      'vehicleDestroys',public.optional_pubg_stat_number(stats->>'vehicleDestroys'),
      'weaponsAcquired',public.optional_pubg_stat_number(stats->>'weaponsAcquired'),
      'deathType',case when stats->>'deathType' in
        ('alive','byplayer','byzone','suicide','logout')
        then stats->>'deathType' else null end,
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


-- Existing archive function grants remain service-role-only after replacement.
REVOKE ALL ON FUNCTION public.archive_verified_clan_match(jsonb) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.archive_verified_clan_match(jsonb) TO service_role;
-- Previously saved archive rows remain intact. Backfill from cached PUBG
-- match data can be run separately without any additional external API calls.
