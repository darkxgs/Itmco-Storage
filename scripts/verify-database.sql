-- Script to verify database structure and data

-- Check products table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'products' 
ORDER BY ordinal_position;

-- Check if description column exists
SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'products' 
    AND column_name = 'description'
) AS description_column_exists;

-- Sample products data
SELECT 
    id,
    name,
    brand,
    model,
    category,
    stock,
    min_stock,
    description,
    created_at
FROM products 
LIMIT 5;

-- Count products by category
SELECT 
    category,
    COUNT(*) as product_count
FROM products 
GROUP BY category
ORDER BY product_count DESC;