-- Migration script to add pricing fields to products table
-- This script adds purchase_price and selling_price fields and removes the old price field

-- Add new pricing columns
ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_price DECIMAL(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS selling_price DECIMAL(10,2);

-- Copy existing price data to selling_price (assuming current price is selling price)
UPDATE products SET selling_price = price WHERE price IS NOT NULL;

-- Set default purchase_price to 0 for existing products (to be updated manually)
UPDATE products SET purchase_price = 0 WHERE purchase_price IS NULL;

-- Drop the old price column
ALTER TABLE products DROP COLUMN IF EXISTS price;

-- Add comments for clarity
COMMENT ON COLUMN products.purchase_price IS 'سعر الشراء - السعر الرسمي للمنتج';
COMMENT ON COLUMN products.selling_price IS 'سعر البيع - السعر المباع به للعملاء';

-- Create index for better performance on price queries
CREATE INDEX IF NOT EXISTS idx_products_purchase_price ON products(purchase_price);
CREATE INDEX IF NOT EXISTS idx_products_selling_price ON products(selling_price);

-- Add constraints to ensure prices are not negative
ALTER TABLE products ADD CONSTRAINT check_purchase_price_positive CHECK (purchase_price >= 0);
ALTER TABLE products ADD CONSTRAINT check_selling_price_positive CHECK (selling_price >= 0);