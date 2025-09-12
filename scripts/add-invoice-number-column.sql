-- Add invoice_number column to issuances table
ALTER TABLE issuances ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(255);

-- Add comment to the column
COMMENT ON COLUMN issuances.invoice_number IS 'رقم الفاتورة للمنتجات بدون ضمان';

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'issuances' AND column_name = 'invoice_number';