-- Optional one-time data repair.
-- The old input "sanitizer" saved text HTML-escaped: "/" became "&#x2F;", "'" became "&#x27;",
-- "&" became "&amp;" and so on. This turns those back into the characters people typed.
--
-- 1. Run it as-is: it only REPORTS how many values in each column are affected.
-- 2. If the counts look right, change  apply boolean := false  to  true  and run it again.
--
-- إصلاح اختياري: بيرجّع الرموز اللي اتحفظت بشكل مشفّر زي &#x2F; لأصلها "/".
-- شغّله الأول زي ما هو (بيعرض العدد بس)، وبعدين غيّر apply لـ true.

do $$
declare
  apply boolean := false;
  col record;
  affected bigint;
  decoded text;
begin
  for col in
    select c.table_name, c.column_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name in ('products', 'branches', 'customers', 'warehouses', 'categories')
      and c.data_type in ('text', 'character varying')
  loop
    execute format(
      'select count(*) from public.%I where %I ~ ''&(amp|lt|gt|quot|#x27|#x2F);''',
      col.table_name, col.column_name
    ) into affected;

    if affected > 0 then
      raise notice '%.%: % value(s) to repair', col.table_name, col.column_name, affected;

      if apply then
        -- &amp; last, so "&amp;#x2F;" (a literal "&#x2F;" typed by someone) is restored correctly
        decoded := format(
          'replace(replace(replace(replace(replace(replace(%I, ''&#x2F;'', ''/''), ''&#x27;'', ''''''''), ''&quot;'', ''"''), ''&lt;'', ''<''), ''&gt;'', ''>''), ''&amp;'', ''&'')',
          col.column_name
        );
        execute format(
          'update public.%I set %I = %s where %I ~ ''&(amp|lt|gt|quot|#x27|#x2F);''',
          col.table_name, col.column_name, decoded, col.column_name
        );
      end if;
    end if;
  end loop;

  if not apply then
    raise notice 'Preview only. Set apply := true to fix the values above.';
  end if;
end $$;
