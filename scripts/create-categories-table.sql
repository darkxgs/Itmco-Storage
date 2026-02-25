-- إنشاء جدول الفئات
-- Create categories table

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- إضافة فهرس على اسم الفئة
-- Add index on category name
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active);

-- إضافة trigger لتحديث updated_at تلقائياً
-- Add trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- إدراج بعض الفئات الافتراضية
-- Insert some default categories
INSERT INTO categories (name, description) VALUES 
('آلات عد النقود', 'أجهزة عد وفرز النقود الورقية والمعدنية'),
('آلات ربط النقود', 'أجهزة ربط وتجميع النقود'),
('آلات فحص الشيكات', 'أجهزة فحص وتصديق الشيكات'),
('ساعات الأمان', 'ساعات الحضور والانصراف الأمنية'),
('أنظمة الحضور والانصراف', 'أنظمة تتبع الحضور والانصراف'),
('ساعات السكرتارية', 'ساعات إدارية ومكتبية'),
('بوابات الأمان', 'بوابات الدخول والخروج الأمنية'),
('أجهزة كمبيوتر', 'أجهزة كمبيوتر مكتبية ومحمولة'),
('طابعات', 'طابعات ليزر ونافثة للحبر'),
('شاشات', 'شاشات عرض مختلفة الأحجام')
ON CONFLICT (name) DO NOTHING;

-- التحقق من إنشاء الجدول
-- Verify table creation
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'categories'
ORDER BY ordinal_position;

-- عرض الفئات المدرجة
-- Show inserted categories
SELECT * FROM categories ORDER BY name;