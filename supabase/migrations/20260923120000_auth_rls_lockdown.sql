-- =====================================================================
-- ITMCO security lock-down
--
-- Before this migration every table was readable and writable by anyone holding
-- the public anon key (all policies were USING (true)), including users.password_hash.
-- After it, only signed-in Supabase Auth users with an active row in public.users can
-- touch data, and what they can write depends on their role.
--
-- ORDER MATTERS (see SECURITY_MIGRATION.md):
--   1. node scripts/migrate-users-to-supabase-auth.mjs   (copies logins into Supabase Auth)
--   2. 20260923110000_stock_functions.sql               (adds app_role() and the stock functions)
--   3. deploy the new app version                        (logs in through Supabase Auth)
--   4. run this file in the Supabase SQL Editor
-- Running it before step 3 locks the currently deployed app out of the database.
--
-- Safe to run more than once. Tables that don't exist in this database are skipped.
-- =====================================================================

begin;

do $$
begin
  if to_regprocedure('public.app_role()') is null or to_regprocedure('public.issue_products(jsonb)') is null then
    raise exception 'Run supabase/migrations/20260923110000_stock_functions.sql first';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Remove the arbitrary-SQL RPC that /api/fix-policies used to call
-- ---------------------------------------------------------------------
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('exec_sql', 'execute_sql', 'run_sql')
  loop
    execute 'drop function if exists ' || f.sig;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 2. Passwords now live in Supabase Auth
-- ---------------------------------------------------------------------
alter table public.users alter column password_hash drop not null;

-- ---------------------------------------------------------------------
-- 3. After a restore re-inserts rows with their original ids, move each id
--    sequence past the highest id. Only the server (service role) may call it.
-- ---------------------------------------------------------------------
create or replace function public.reset_id_sequences() returns void
language plpgsql security definer set search_path = public as $$
declare
  t text;
  seq text;
begin
  foreach t in array array['warehouses', 'categories', 'customers', 'branches', 'products', 'issuances',
                           'release_items', 'stock_entries', 'user_warehouse_permissions', 'activity_logs']
  loop
    if to_regclass('public.' || t) is not null then
      seq := pg_get_serial_sequence('public.' || t, 'id');
      if seq is not null then
        execute format('select setval(%L, coalesce((select max(id) from public.%I), 0) + 1, false)', seq, t);
      end if;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4. Drop every existing policy on the app tables (they were all USING (true))
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename = any (array['users', 'products', 'issuances', 'warehouses', 'categories', 'customers',
                                 'branches', 'stock_entries', 'release_items', 'user_warehouse_permissions',
                                 'activity_logs', 'notifications', 'security_logs', 'backup_history', 'backup_config'])
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 5. New policies. (select public.app_role()) is evaluated once per statement.
--    Roles: admin > inventory_manager > engineer. Mirrors what each role's pages do:
--      engineer          – reads; issues through issue_products()/update_issuance()/delete_issuance()
--      inventory_manager – + products, stock entries, warehouses, categories
--      admin             – everything, including users, customers, branches, permissions
--    Issuances and stock changes are written only through the functions in
--    20260923110000_stock_functions.sql, which keep stock and issuances in step.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  is_user text := '(select public.app_role()) is not null';
  is_manager text := '(select public.app_role()) in (''admin'', ''inventory_manager'')';
  is_admin text := '(select public.app_role()) = ''admin''';
begin
  -- Every active user can read the operational tables
  foreach t in array array['users', 'products', 'issuances', 'warehouses', 'categories', 'customers', 'branches',
                           'stock_entries', 'release_items', 'user_warehouse_permissions', 'activity_logs', 'notifications']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('create policy "active users read" on public.%I for select to authenticated using (%s)', t, is_user);
    end if;
  end loop;

  -- Admin/service-only tables: RLS on, admins may read, writes only via the server
  foreach t in array array['security_logs', 'backup_history', 'backup_config']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('create policy "admins read" on public.%I for select to authenticated using (%s)', t, is_admin);
    end if;
  end loop;

  -- users: admins only (account creation goes through /api/admin/users with the service role)
  execute format('create policy "admins write" on public.users for all to authenticated using (%s) with check (%s)', is_admin, is_admin);

  -- products: managers. Engineers change stock only by issuing (through the functions).
  -- issuances: no direct writes at all, only issue_products()/update_issuance()/delete_issuance().
  -- stock entries, warehouses, categories: managers
  foreach t in array array['products', 'stock_entries', 'warehouses', 'categories']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('create policy "managers write" on public.%I for all to authenticated using (%s) with check (%s)', t, is_manager, is_manager);
    end if;
  end loop;

  -- customers, branches, warehouse permissions: admins
  foreach t in array array['customers', 'branches', 'user_warehouse_permissions']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('create policy "admins write" on public.%I for all to authenticated using (%s) with check (%s)', t, is_admin, is_admin);
    end if;
  end loop;

  -- release items and notifications: any active user
  foreach t in array array['release_items', 'notifications']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('create policy "users write" on public.%I for all to authenticated using (%s) with check (%s)', t, is_user, is_user);
    end if;
  end loop;

  -- activity log: append-only, and only as yourself
  execute format('create policy "users append own" on public.activity_logs for insert to authenticated with check (%s and user_id = auth.uid())', is_user);
end $$;

-- ---------------------------------------------------------------------
-- 6. Privileges (defense in depth on top of RLS)
-- ---------------------------------------------------------------------
-- Anonymous visitors get nothing at all
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Functions: signed-in users may call only what the app calls; the server (service role)
-- keeps everything. Trigger functions don't need EXECUTE to fire.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
grant execute on function public.app_role(), public.issue_products(jsonb), public.update_issuance(integer, jsonb),
  public.delete_issuance(integer), public.add_stock(integer, integer, text),
  public.set_product_stock(integer, integer, integer) to authenticated;

-- password_hash is readable by nobody except the service role
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'users' and column_name <> 'password_hash';

  revoke select on public.users from authenticated;
  execute format('grant select (%s) on public.users to authenticated', cols);
end $$;

commit;

-- ---------------------------------------------------------------------
-- Checks to run afterwards
-- ---------------------------------------------------------------------
-- select tablename, policyname, cmd, roles from pg_policies where schemaname = 'public' order by 1, 2;
-- select id, email from auth.users where id not in (select id from public.users);   -- logins with no profile
-- select id, email from public.users where id not in (select id from auth.users);   -- profiles that can't log in
--
-- Once everyone has logged in successfully with the new version, the old hashes can go:
-- update public.users set password_hash = null;
