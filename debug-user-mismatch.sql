-- Debug script to identify the mismatch between provided user data and database

-- 1. Check what users actually exist in the database
SELECT 'Database Users:' as info;
SELECT id, email, name, role, created_at, updated_at FROM users ORDER BY email;

-- 2. Check if the specific admin user exists
SELECT 'Admin User Check:' as info;
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM users WHERE id = '4217434d-14fd-494c-861c-eb732ded6a4f') 
        THEN 'Admin user EXISTS in database'
        ELSE 'Admin user NOT FOUND in database'
    END as admin_status;

-- 3. Check if any user with admin email exists
SELECT 'Admin Email Check:' as info;
SELECT id, email, name, role 
FROM users 
WHERE email = 'itmcoadmin@gmail.com';

-- 4. Show all users with their IDs for comparison
SELECT 'All Users for Comparison:' as info;
SELECT 
    id,
    email,
    name,
    role,
    CASE 
        WHEN id = '4217434d-14fd-494c-861c-eb732ded6a4f' THEN 'MATCHES PROVIDED ADMIN ID'
        WHEN id = '0b1becf8-9c44-48ab-82f9-d060a4d7c6fb' THEN 'MATCHES PROVIDED ENGINEER ID'
        WHEN id = '8568a82e-dbbf-402f-9ccb-11fb7afa8bca' THEN 'MATCHES PROVIDED INVENTORY ID'
        WHEN id = 'c1956708-a4c7-448d-9fce-e5b66cc05bcd' THEN 'MATCHES PROVIDED TEST ID'
        ELSE 'NO MATCH'
    END as match_status
FROM users 
ORDER BY email;

-- 5. If users don't exist, here are INSERT statements to create them
-- (Only run these if the users are missing from the database)

/*
-- Insert admin user if missing
INSERT INTO users (id, email, name, role, password_hash, created_at, updated_at)
VALUES (
    '4217434d-14fd-494c-861c-eb732ded6a4f',
    'itmcoadmin@gmail.com',
    'مدير النظام',
    'admin',
    '$2b$10$placeholder_hash_replace_with_actual_hash',
    NOW(),
    NOW()
);

-- Insert engineer user if missing
INSERT INTO users (id, email, name, role, password_hash, created_at, updated_at)
VALUES (
    '0b1becf8-9c44-48ab-82f9-d060a4d7c6fb',
    'engineer@itmco.com',
    'مهندس',
    'engineer',
    '$2b$10$placeholder_hash_replace_with_actual_hash',
    NOW(),
    NOW()
);

-- Insert inventory manager if missing
INSERT INTO users (id, email, name, role, password_hash, created_at, updated_at)
VALUES (
    '8568a82e-dbbf-402f-9ccb-11fb7afa8bca',
    'inventory@itmco.com',
    'مدير المخزون',
    'inventory_manager',
    '$2b$10$placeholder_hash_replace_with_actual_hash',
    NOW(),
    NOW()
);

-- Insert test user if missing
INSERT INTO users (id, email, name, role, password_hash, created_at, updated_at)
VALUES (
    'c1956708-a4c7-448d-9fce-e5b66cc05bcd',
    'testtest@gmail.com',
    'TESTtest',
    'inventory_manager',
    '$2b$10$placeholder_hash_replace_with_actual_hash',
    NOW(),
    NOW()
);
*/

-- 6. After creating missing users, verify they exist
SELECT 'Verification after INSERT:' as info;
SELECT id, email, name, role FROM users WHERE id IN (
    '4217434d-14fd-494c-861c-eb732ded6a4f',
    '0b1becf8-9c44-48ab-82f9-d060a4d7c6fb',
    '8568a82e-dbbf-402f-9ccb-11fb7afa8bca',
    'c1956708-a4c7-448d-9fce-e5b66cc05bcd'
) ORDER BY email;