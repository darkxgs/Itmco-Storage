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
--   2. deploy the new app version                        (logs in through Supabase Auth)
--   3. run this file in the Supabase SQL Editor
-- Running it before step 2 locks the currently deployed app out of the database.
--
-- Safe to run more than once. Tables that don't exist in this database are skipped.
-- =====================================================================

begin;

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
-- 3. Role of the signed-in user; null for anonymous, unknown or inactive accounts.
--    security definer so it can read users regardless of the caller's policies.
-- ---------------------------------------------------------------------
create or replace function public.app_role() returns text
language sql stable security definer set search_path = public as $$
  select role::text from public.users where id = auth.uid() and is_active is true
$$;

-- ---------------------------------------------------------------------
-- 4. After a restore re-inserts rows with their original ids, move each id
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
-- 5. Drop every existing policy on the app tables (they were all USING (true))
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
-- 6. New policies. (select public.app_role()) is evaluated once per statement.
--    Roles: admin > inventory_manager > engineer. Mirrors what each role's pages do:
--      engineer          – issuances (own rows), stock changes those cause
--      inventory_manager – + products, stock entries, warehouses, categories
--      admin             – everything, including users, customers, branches, permissions
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

  -- products: managers add/remove; any user may update, because issuing and deleting
  -- an issuance adjusts products.stock from the browser
  execute format('create policy "managers insert" on public.products for insert to authenticated with check (%s)', is_manager);
  execute format('create policy "users update" on public.products for update to authenticated using (%s) with check (%s)', is_user, is_user);
  execute format('create policy "managers delete" on public.products for delete to authenticated using (%s)', is_manager);

  -- issuances: anyone may issue, recorded as themselves; only the issuer or an admin may
  -- edit/delete (same rule as the UI)
  execute format('create policy "users insert" on public.issuances for insert to authenticated with check (%s and issued_by = auth.uid())', is_user);
  execute format('create policy "issuer or admin update" on public.issuances for update to authenticated using (%s or issued_by = auth.uid()) with check (%s or issued_by = auth.uid())', is_admin, is_admin);
  execute format('create policy "issuer or admin delete" on public.issuances for delete to authenticated using (%s or issued_by = auth.uid())', is_admin);

  -- stock entries
  if to_regclass('public.stock_entries') is not null then
    execute format('create policy "users insert" on public.stock_entries for insert to authenticated with check (%s)', is_user);
    execute format('create policy "managers update" on public.stock_entries for update to authenticated using (%s) with check (%s)', is_manager, is_manager);
    execute format('create policy "managers delete" on public.stock_entries for delete to authenticated using (%s)', is_manager);
  end if;

  -- warehouses, categories: managers
  foreach t in array array['warehouses', 'categories']
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
-- 7. Privileges (defense in depth on top of RLS)
-- ---------------------------------------------------------------------
-- Anonymous visitors get nothing at all
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Functions: nothing for anonymous callers (PUBLIC is granted EXECUTE by default)
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.reset_id_sequences() from authenticated;

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

-- ---------------------------------------------------------------------
-- 8. Reports filter and sort issuances by their date
-- ---------------------------------------------------------------------
create index if not exists idx_issuances_date on public.issuances (date desc, id desc);

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
