-- Security hardening for legacy bot tables after verifying all API handlers
-- use SUPABASE_SERVICE_KEY server-side and that service_role bypasses RLS.
-- No anonymous or authenticated client needs direct table access.
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.clan_records enable row level security;

revoke all on table public.players, public.matches, public.clan_records
  from anon, authenticated;
grant select, insert, update, delete on table
  public.players, public.matches, public.clan_records to service_role;

-- No client RLS policies are necessary. All legitimate Discord and website
-- data access flows through authenticated server-side service-role functions.