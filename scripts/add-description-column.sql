-- Migration script to add description column to products table
-- Run this if you already have an existing database

-- Add description column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;

-- Update existing products with sample descriptions (optional)
UPDATE products SET description = 'وصف المنتج' WHERE description IS NULL;