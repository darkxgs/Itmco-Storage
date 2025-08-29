-- Add date column to issuances table
-- This script adds the missing 'date' column that the application expects

-- Add the date column to the issuances table
ALTER TABLE issuances ADD COLUMN IF NOT EXISTS date DATE;

-- Update existing records to set the date from created_at
UPDATE issuances SET date = created_at::date WHERE date IS NULL;

-- Make the date column NOT NULL after populating existing records
ALTER TABLE issuances ALTER COLUMN date SET NOT NULL;

-- Add a default value for new records
ALTER TABLE issuances ALTER COLUMN date SET DEFAULT CURRENT_DATE;

-- Create an index on the date column for better performance
CREATE INDEX IF NOT EXISTS idx_issuances_date ON issuances(date);

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'issuances' AND column_name = 'date';