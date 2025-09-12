-- إضافة عمود warranty_type إلى جدول issuances
-- Add warranty_type column to issuances table

ALTER TABLE issuances 
ADD COLUMN warranty_type VARCHAR(50) DEFAULT 'no_warranty';

-- إضافة قيود للتحقق من القيم المسموحة
-- Add check constraint for allowed values
ALTER TABLE issuances 
ADD CONSTRAINT check_warranty_type 
CHECK (warranty_type IN ('comprehensive', 'warranty', 'no_warranty'));

-- التحقق من إضافة العمود
-- Verify column addition
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'issuances' AND column_name = 'warranty_type';

-- عرض بنية الجدول المحدثة
-- Show updated table structure
\d issuances;