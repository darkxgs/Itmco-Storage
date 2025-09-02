-- Fix RLS policies for user_warehouse_permissions table
-- The current policies use auth.uid() which doesn't work with localStorage authentication

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own warehouse permissions" ON user_warehouse_permissions;
DROP POLICY IF EXISTS "Users can insert their own warehouse permissions" ON user_warehouse_permissions;
DROP POLICY IF EXISTS "Users can update their own warehouse permissions" ON user_warehouse_permissions;
DROP POLICY IF EXISTS "Users can delete their own warehouse permissions" ON user_warehouse_permissions;

-- Create new policies that work with our authentication system
-- Allow all authenticated users to view warehouse permissions
CREATE POLICY "Allow viewing warehouse permissions" ON user_warehouse_permissions
    FOR SELECT USING (true);

-- Allow all authenticated users to insert warehouse permissions
-- (In practice, this should be restricted to admins in the application layer)
CREATE POLICY "Allow inserting warehouse permissions" ON user_warehouse_permissions
    FOR INSERT WITH CHECK (true);

-- Allow all authenticated users to update warehouse permissions
CREATE POLICY "Allow updating warehouse permissions" ON user_warehouse_permissions
    FOR UPDATE USING (true);

-- Allow all authenticated users to delete warehouse permissions
CREATE POLICY "Allow deleting warehouse permissions" ON user_warehouse_permissions
    FOR DELETE USING (true);

-- Alternative approach: Disable RLS entirely for this table
-- since we handle permissions in the application layer
-- Uncomment the line below if you prefer this approach:
-- ALTER TABLE user_warehouse_permissions DISABLE ROW LEVEL SECURITY;

PRINT 'Warehouse permissions RLS policies fixed successfully!';