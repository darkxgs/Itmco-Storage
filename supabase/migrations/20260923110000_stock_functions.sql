-- =====================================================================
-- ITMCO: atomic stock operations
--
-- Before this, the browser read a product's stock, then wrote "old - quantity" in a
-- separate request, then inserted the issuance in another. Two people issuing the same
-- product at once lost one of the decrements, and a failure half-way left stock and
-- issuances out of step. These functions do each operation in one transaction, with the
-- stock check inside the UPDATE so concurrent requests queue on the row lock.
--
-- Only ADDS things, so it is safe to run before deploying the new app version (the
-- currently deployed version keeps working). Run it BEFORE the lock-down migration
-- 20260923120000_auth_rls_lockdown.sql. See SECURITY_MIGRATION.md. Safe to re-run.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Role of the signed-in user; null for anonymous, unknown or inactive accounts.
-- security definer so it can read users regardless of the caller's policies.
-- ---------------------------------------------------------------------
create or replace function public.app_role() returns text
language sql stable security definer set search_path = public as $$
  select role::text from public.users where id = auth.uid() and is_active is true
$$;

-- ---------------------------------------------------------------------
-- Guard rails. NOT VALID: enforced on every new write without re-checking existing rows,
-- so adding them can't fail on old data.
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_stock_not_negative') then
    alter table public.products add constraint products_stock_not_negative check (stock >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'issuances_quantity_positive') then
    alter table public.issuances add constraint issuances_quantity_positive check (quantity > 0) not valid;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Prices at the time of issuing. Reports used the product's *current* price, so editing
-- a price rewrote the revenue of every past issuance.
-- ---------------------------------------------------------------------
alter table public.issuances add column if not exists unit_price numeric(12, 2);
alter table public.issuances add column if not exists unit_cost numeric(12, 2);

-- Custom selling prices used to be stored only inside notes, e.g. "سعر البيع: 1500.75"
update public.issuances
set unit_price = substring(notes from 'سعر البيع:\s*([0-9]+(\.[0-9]+)?)')::numeric
where unit_price is null and notes ~ 'سعر البيع:\s*[0-9]';

-- ---------------------------------------------------------------------
-- Private helpers: a schema the API does not expose
-- ---------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;

-- Insert one issuance from JSON, using only the keys that are real columns, so the
-- function keeps working whatever optional columns this database has.
create or replace function private.insert_issuance_row(p_row jsonb) returns public.issuances
language plpgsql security definer set search_path = public as $$
declare
  v_cols text;
  v_result public.issuances;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'issuances'
    and column_name not in ('id', 'created_at') and p_row ? column_name;

  execute format(
    'insert into public.issuances (%1$s) select %1$s from jsonb_populate_record(null::public.issuances, $1) returning *',
    v_cols
  ) into v_result using p_row;
  return v_result;
end $$;

-- ---------------------------------------------------------------------
-- Issue one or more products. All of them are issued, or none are.
-- p_items: [{ product_id, quantity, customer_name, branch, ... , unit_price? }, ...]
-- issued_by is always the caller.
-- ---------------------------------------------------------------------
create or replace function public.issue_products(p_items jsonb) returns setof public.issuances
language plpgsql security definer set search_path = public as $$
declare
  v_item jsonb;
  v_qty integer;
  v_product public.products;
begin
  if public.app_role() is null then
    raise exception 'غير مصرح' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'لا توجد منتجات للإصدار' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'quantity')::integer;
    if v_qty is null or v_qty <= 0 then
      raise exception 'كمية غير صحيحة' using errcode = '22023';
    end if;

    -- Decrements only when enough stock is left; the row lock queues concurrent issues
    update public.products
    set stock = stock - v_qty, updated_at = now()
    where id = (v_item->>'product_id')::integer and stock >= v_qty
    returning * into v_product;

    if not found then
      raise exception 'الكمية المطلوبة من "%" غير متوفرة في المخزون',
        coalesce(v_item->>'product_name', v_item->>'product_id') using errcode = 'P0001';
    end if;

    return next private.insert_issuance_row(v_item || jsonb_build_object(
      'issued_by', auth.uid(),
      'product_name', coalesce(nullif(v_item->>'product_name', ''), v_product.name),
      'brand', coalesce(nullif(v_item->>'brand', ''), v_product.brand),
      'item_code', coalesce(nullif(v_item->>'item_code', ''), v_product.item_code),
      'unit_price', coalesce(nullif(v_item->>'unit_price', '')::numeric, v_product.selling_price),
      'unit_cost', v_product.purchase_price
    ));
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Edit an issuance. Quantity changes adjust the product's stock; switching to another
-- product returns the old quantity and takes the new one from the new product.
-- Allowed for admins and for whoever issued it.
-- ---------------------------------------------------------------------
create or replace function public.update_issuance(p_id integer, p_changes jsonb) returns public.issuances
language plpgsql security definer set search_path = public as $$
declare
  v_old public.issuances;
  v_product public.products;
  v_changes jsonb := coalesce(p_changes, '{}'::jsonb) - 'id' - 'issued_by' - 'created_at' - 'unit_cost';
  v_new_product integer;
  v_new_qty integer;
  v_delta integer;
  v_sets text;
  v_result public.issuances;
begin
  select * into v_old from public.issuances where id = p_id for update;
  if not found then
    raise exception 'الإصدار غير موجود' using errcode = 'P0002';
  end if;
  if public.app_role() is null
     or (public.app_role() <> 'admin' and v_old.issued_by is distinct from auth.uid()) then
    raise exception 'غير مصرح بتعديل هذا الإصدار' using errcode = '42501';
  end if;

  v_new_product := coalesce((v_changes->>'product_id')::integer, v_old.product_id);
  v_new_qty := coalesce((v_changes->>'quantity')::integer, v_old.quantity);
  if v_new_qty <= 0 then
    raise exception 'كمية غير صحيحة' using errcode = '22023';
  end if;

  if v_new_product is distinct from v_old.product_id then
    if v_old.product_id is not null then
      update public.products set stock = stock + v_old.quantity, updated_at = now() where id = v_old.product_id;
    end if;

    update public.products
    set stock = stock - v_new_qty, updated_at = now()
    where id = v_new_product and stock >= v_new_qty
    returning * into v_product;
    if not found then
      raise exception 'الكمية المطلوبة غير متوفرة في مخزون المنتج الجديد' using errcode = 'P0001';
    end if;

    -- The stored product details follow the product
    v_changes := v_changes || jsonb_build_object(
      'product_name', v_product.name,
      'brand', v_product.brand,
      'item_code', v_product.item_code,
      'unit_cost', v_product.purchase_price
    );
    if not (v_changes ? 'unit_price') then
      v_changes := v_changes || jsonb_build_object('unit_price', v_product.selling_price);
    end if;
  elsif v_new_qty <> v_old.quantity and v_old.product_id is not null then
    v_delta := v_new_qty - v_old.quantity;
    update public.products
    set stock = stock - v_delta, updated_at = now()
    where id = v_old.product_id and stock >= v_delta
    returning * into v_product;
    if not found then
      raise exception 'الكمية المطلوبة غير متوفرة في المخزون' using errcode = 'P0001';
    end if;
  end if;

  select string_agg(format('%I = r.%I', column_name, column_name), ', ') into v_sets
  from information_schema.columns
  where table_schema = 'public' and table_name = 'issuances'
    and column_name not in ('id', 'created_at', 'issued_by') and v_changes ? column_name;

  if v_sets is null then
    return v_old;
  end if;

  execute format(
    'update public.issuances i set %s from jsonb_populate_record(null::public.issuances, $1) r where i.id = $2 returning i.*',
    v_sets
  ) into v_result using v_changes, p_id;
  return v_result;
end $$;

-- ---------------------------------------------------------------------
-- Delete an issuance and put its quantity back in stock. Admins and the issuer.
-- ---------------------------------------------------------------------
create or replace function public.delete_issuance(p_id integer) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_old public.issuances;
begin
  select * into v_old from public.issuances where id = p_id for update;
  if not found then
    raise exception 'الإصدار غير موجود' using errcode = 'P0002';
  end if;
  if public.app_role() is null
     or (public.app_role() <> 'admin' and v_old.issued_by is distinct from auth.uid()) then
    raise exception 'غير مصرح بحذف هذا الإصدار' using errcode = '42501';
  end if;

  if v_old.product_id is not null then
    update public.products set stock = stock + v_old.quantity, updated_at = now() where id = v_old.product_id;
  end if;
  delete from public.issuances where id = p_id;
end $$;

-- ---------------------------------------------------------------------
-- Add stock and record it in stock_entries, together. Admins and inventory managers.
-- ---------------------------------------------------------------------
create or replace function public.add_stock(p_product_id integer, p_quantity integer, p_notes text default null)
returns public.stock_entries
language plpgsql security definer set search_path = public as $$
declare
  v_product public.products;
  v_entry public.stock_entries;
begin
  if public.app_role() is null or public.app_role() not in ('admin', 'inventory_manager') then
    raise exception 'غير مصرح' using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'كمية غير صحيحة' using errcode = '22023';
  end if;

  update public.products set stock = stock + p_quantity, updated_at = now()
  where id = p_product_id
  returning * into v_product;
  if not found then
    raise exception 'المنتج غير موجود' using errcode = 'P0002';
  end if;

  insert into public.stock_entries
    (product_id, product_name, item_code, quantity_added, previous_stock, new_stock, notes, entered_by, user_id, warehouse_id)
  values
    (v_product.id, v_product.name, v_product.item_code, p_quantity, v_product.stock - p_quantity, v_product.stock,
     nullif(p_notes, ''), coalesce((select name from public.users where id = auth.uid()), 'غير معروف'),
     auth.uid()::text, v_product.warehouse_id)
  returning * into v_entry;
  return v_entry;
end $$;

-- ---------------------------------------------------------------------
-- Manual stock correction from the product edit dialog. Applies only if the stock is
-- still what the dialog showed, so it can't silently undo an issuance made meanwhile.
-- Admins and inventory managers.
-- ---------------------------------------------------------------------
create or replace function public.set_product_stock(p_product_id integer, p_expected integer, p_new integer)
returns public.products
language plpgsql security definer set search_path = public as $$
declare
  v_product public.products;
begin
  if public.app_role() is null or public.app_role() not in ('admin', 'inventory_manager') then
    raise exception 'غير مصرح' using errcode = '42501';
  end if;
  if p_new is null or p_new < 0 then
    raise exception 'كمية غير صحيحة' using errcode = '22023';
  end if;

  update public.products set stock = p_new, updated_at = now()
  where id = p_product_id and stock = p_expected
  returning * into v_product;

  if not found then
    if exists (select 1 from public.products where id = p_product_id) then
      raise exception 'تغيّرت كمية هذا المنتج أثناء التعديل (إصدار أو إضافة). أعد فتح المنتج وحاول مرة أخرى'
        using errcode = 'P0001';
    end if;
    raise exception 'المنتج غير موجود' using errcode = 'P0002';
  end if;

  -- Increases go into the stock history like any other addition
  if p_new > p_expected then
    insert into public.stock_entries
      (product_id, product_name, item_code, quantity_added, previous_stock, new_stock, notes, entered_by, user_id, warehouse_id)
    values
      (v_product.id, v_product.name, v_product.item_code, p_new - p_expected, p_expected, p_new, 'تعديل يدوي للكمية',
       coalesce((select name from public.users where id = auth.uid()), 'غير معروف'), auth.uid()::text, v_product.warehouse_id);
  end if;
  return v_product;
end $$;

-- ---------------------------------------------------------------------
-- Who may call what. New functions are executable by PUBLIC by default.
-- ---------------------------------------------------------------------
revoke all on function private.insert_issuance_row(jsonb) from public;
revoke all on function public.app_role() from public;
revoke all on function public.issue_products(jsonb) from public;
revoke all on function public.update_issuance(integer, jsonb) from public;
revoke all on function public.delete_issuance(integer) from public;
revoke all on function public.add_stock(integer, integer, text) from public;
revoke all on function public.set_product_stock(integer, integer, integer) from public;

do $$
begin
  -- Supabase's default privileges also grant these roles directly
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function private.insert_issuance_row(jsonb) from anon, authenticated';
    execute 'revoke all on function public.app_role(), public.issue_products(jsonb), public.update_issuance(integer, jsonb),
             public.delete_issuance(integer), public.add_stock(integer, integer, text),
             public.set_product_stock(integer, integer, integer) from anon';
    execute 'grant execute on function public.app_role(), public.issue_products(jsonb), public.update_issuance(integer, jsonb),
             public.delete_issuance(integer), public.add_stock(integer, integer, text),
             public.set_product_stock(integer, integer, integer) to authenticated';
  end if;
end $$;

-- Reports filter and sort issuances by their date
create index if not exists idx_issuances_date on public.issuances (date desc, id desc);

commit;
