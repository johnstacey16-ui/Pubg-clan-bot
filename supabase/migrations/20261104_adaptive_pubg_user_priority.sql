-- One PUBG key: 10 reservations per 65 seconds. Background is allowed
-- all ten when idle, but retains three for fresh unknown-player lookups while
-- user demand has been observed within the previous ten minutes.
create or replace function public.reserve_pubg_requests(p_count integer)
returns boolean language plpgsql security invoker set search_path = ''
as $fn$
declare
 now_at timestamptz := pg_catalog.clock_timestamp();
 used_count integer;
begin
 if p_count is null or p_count < 1 or p_count > 10 then return false; end if;
 perform pg_catalog.pg_advisory_xact_lock(551167711);
 -- Both website and Discord user requests signal demand, even when full.
 insert into public.web_refresh_guard(scope,next_allowed,updated_at)
 values ('interactive:last',now_at+interval '10 minutes',now_at)
 on conflict(scope) do update set
   next_allowed=excluded.next_allowed,updated_at=excluded.updated_at;
 delete from public.pubg_api_requests where requested_at<=now_at-interval '65 seconds';
 select count(*) into used_count from public.pubg_api_requests;
 if used_count+p_count > 10 then return false; end if;
 insert into public.pubg_api_requests(requested_at)
 select now_at from pg_catalog.generate_series(1,p_count);
 return true;
end
$fn$;
revoke all on function public.reserve_pubg_requests(integer) from public,anon,authenticated;
grant execute on function public.reserve_pubg_requests(integer) to service_role;

create or replace function public.reserve_web_refresh(p_player_key text)
returns boolean language plpgsql security invoker set search_path = ''
as $fn$
declare
 reservation_at timestamptz := pg_catalog.clock_timestamp();
 next_player timestamptz;
 player_scope text;
begin
 if p_player_key is null or pg_catalog.length(p_player_key)>180
   or p_player_key !~ '^(auto|xbox|psn):[^,[:cntrl:]]{1,100}$'
 then return false; end if;
 player_scope:='player:'||pg_catalog.lower(p_player_key);
 perform pg_catalog.pg_advisory_xact_lock(87119521);
 select next_allowed into next_player from public.web_refresh_guard
 where scope=player_scope;
 if next_player is not null and next_player>reservation_at then return false; end if;
 insert into public.web_refresh_guard(scope,next_allowed,updated_at)
 values (player_scope,reservation_at+interval '2 minutes',reservation_at)
 on conflict(scope) do update set
   next_allowed=excluded.next_allowed,updated_at=excluded.updated_at;
 -- Public searches that still need PUBG capacity also activate priority.
 insert into public.web_refresh_guard(scope,next_allowed,updated_at)
 values ('interactive:last',reservation_at+interval '10 minutes',reservation_at)
 on conflict(scope) do update set
   next_allowed=excluded.next_allowed,updated_at=excluded.updated_at;
 return true;
end
$fn$;
revoke all on function public.reserve_web_refresh(text) from public,anon,authenticated;
grant execute on function public.reserve_web_refresh(text) to service_role;

create or replace function public.reserve_pubg_background_requests(p_count integer)
returns boolean language plpgsql security invoker set search_path = ''
as $fn$
declare
 now_at timestamptz := pg_catalog.clock_timestamp();
 used_count integer;
 interactive_active boolean;
 background_ceiling integer;
begin
 if p_count is null or p_count < 1 or p_count > 10 then return false; end if;
 perform pg_catalog.pg_advisory_xact_lock(551167711);
 select exists(select 1 from public.web_refresh_guard
   where scope='interactive:last' and next_allowed>now_at)
 into interactive_active;
 background_ceiling:=case when interactive_active then 7 else 10 end;
 delete from public.pubg_api_requests where requested_at<=now_at-interval '65 seconds';
 select count(*) into used_count from public.pubg_api_requests;
 if used_count+p_count>background_ceiling then return false; end if;
 insert into public.pubg_api_requests(requested_at)
 select now_at from pg_catalog.generate_series(1,p_count);
 return true;
end
$fn$;
revoke all on function public.reserve_pubg_background_requests(integer) from public,anon,authenticated;
grant execute on function public.reserve_pubg_background_requests(integer) to service_role;
