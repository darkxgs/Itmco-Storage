-- Update numbering format for items and warehouses
-- This script updates the auto-generation functions to use ITM-01, ITM-02 and WH-01, WH-02 format

-- Drop existing warehouse number generation trigger and function
DROP TRIGGER IF EXISTS trigger_generate_warehouse_number ON warehouses;
DROP FUNCTION IF EXISTS generate_warehouse_number();

-- Create new warehouse number generation function with updated format
CREATE OR REPLACE FUNCTION generate_warehouse_number()
RETURNS TRIGGER AS $$
DECLARE
  next_number INTEGER;
  last_warehouse_number TEXT;
BEGIN
  IF NEW.warehouse_number IS NULL OR NEW.warehouse_number = '' THEN
    -- Get the last warehouse number
    SELECT warehouse_number INTO last_warehouse_number
    FROM warehouses
    WHERE warehouse_number ~ '^WH-\d+$'
    ORDER BY CAST(SUBSTRING(warehouse_number FROM 'WH-(\d+)') AS INTEGER) DESC
    LIMIT 1;
    
    -- Calculate next number
    IF last_warehouse_number IS NULL THEN
      next_number := 1;
    ELSE
      next_number := CAST(SUBSTRING(last_warehouse_number FROM 'WH-(\d+)') AS INTEGER) + 1;
    END IF;
    
    -- Generate new warehouse number in format WH-01, WH-02, etc.
    NEW.warehouse_number := 'WH-' || LPAD(next_number::text, 2, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for warehouse number generation
CREATE TRIGGER trigger_generate_warehouse_number
  BEFORE INSERT ON warehouses
  FOR EACH ROW
  EXECUTE FUNCTION generate_warehouse_number();

-- Update existing warehouse numbers to new format (only if they follow old format)
UPDATE warehouses 
SET warehouse_number = 'WH-' || LPAD(
  CASE 
    WHEN warehouse_number ~ '^WH\d{6}$' THEN 
      CAST(SUBSTRING(warehouse_number FROM 'WH(\d+)') AS INTEGER)::text
    ELSE 
      id::text
  END, 
  2, '0'
)
WHERE warehouse_number ~ '^WH\d{6}$' OR warehouse_number IS NULL;

-- Update existing product item codes to new format (only if they follow old format)
UPDATE products 
SET item_code = 'ITM-' || LPAD(
  CASE 
    WHEN item_code ~ '^ITM\d{6}$' THEN 
      CAST(SUBSTRING(item_code FROM 'ITM(\d+)') AS INTEGER)::text
    ELSE 
      id::text
  END, 
  2, '0'
)
WHERE item_code ~ '^ITM\d{6}$' OR item_code IS NULL;

COMMIT;