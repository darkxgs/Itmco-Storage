-- تشغيل migration لإنشاء جدول تتبع إدخال الكميات
-- يجب تشغيل هذا الملف في Supabase SQL Editor

-- إنشاء جدول تتبع إدخال الكميات للمنتجات
CREATE TABLE IF NOT EXISTS stock_entries (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  item_code TEXT,
  quantity_added INTEGER NOT NULL CHECK (quantity_added > 0),
  previous_stock INTEGER NOT NULL DEFAULT 0,
  new_stock INTEGER NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  entry_time TIME NOT NULL DEFAULT CURRENT_TIME,
  entry_datetime TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  notes TEXT,
  entered_by TEXT NOT NULL,
  user_id TEXT,
  warehouse_id INTEGER REFERENCES warehouses(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- إنشاء فهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_stock_entries_product_id ON stock_entries(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_entries_entry_date ON stock_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_stock_entries_user_id ON stock_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_entries_warehouse_id ON stock_entries(warehouse_id);

-- إنشاء دالة لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_stock_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- إنشاء trigger لتحديث updated_at
DROP TRIGGER IF EXISTS trigger_update_stock_entries_updated_at ON stock_entries;
CREATE TRIGGER trigger_update_stock_entries_updated_at
  BEFORE UPDATE ON stock_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_entries_updated_at();

-- إضافة تعليقات للجدول والأعمدة
COMMENT ON TABLE stock_entries IS 'جدول تتبع عمليات إدخال الكميات للمنتجات';
COMMENT ON COLUMN stock_entries.product_id IS 'معرف المنتج';
COMMENT ON COLUMN stock_entries.product_name IS 'اسم المنتج وقت الإدخال';
COMMENT ON COLUMN stock_entries.item_code IS 'كود الصنف';
COMMENT ON COLUMN stock_entries.quantity_added IS 'الكمية المضافة';
COMMENT ON COLUMN stock_entries.previous_stock IS 'المخزون السابق';
COMMENT ON COLUMN stock_entries.new_stock IS 'المخزون الجديد بعد الإضافة';
COMMENT ON COLUMN stock_entries.entry_date IS 'تاريخ الإدخال (ميلادي)';
COMMENT ON COLUMN stock_entries.entry_time IS 'وقت الإدخال';
COMMENT ON COLUMN stock_entries.entry_datetime IS 'التاريخ والوقت الكامل للإدخال';
COMMENT ON COLUMN stock_entries.notes IS 'ملاحظات حول عملية الإدخال';
COMMENT ON COLUMN stock_entries.entered_by IS 'اسم المستخدم الذي أدخل الكمية';
COMMENT ON COLUMN stock_entries.user_id IS 'معرف المستخدم';
COMMENT ON COLUMN stock_entries.warehouse_id IS 'معرف المخزن';

-- إنشاء بيانات تجريبية (اختياري)
-- INSERT INTO stock_entries (product_id, product_name, item_code, quantity_added, previous_stock, new_stock, notes, entered_by, user_id)
-- SELECT 
--   p.id,
--   p.name,
--   p.item_code,
--   p.stock,
--   0,
--   p.stock,
--   'إدخال أولي من البيانات الموجودة',
--   'النظام',
--   NULL
-- FROM products p
-- WHERE p.stock > 0;

SELECT 'تم إنشاء جدول stock_entries بنجاح!' as result;