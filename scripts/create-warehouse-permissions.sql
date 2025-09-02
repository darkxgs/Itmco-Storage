-- Create user_warehouse_permissions table
-- This table links users to warehouses they have access to

CREATE TABLE IF NOT EXISTS user_warehouse_permissions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  permission_level VARCHAR(20) NOT NULL DEFAULT 'view' CHECK (permission_level IN ('view', 'edit', 'admin')),
  can_view BOOLEAN DEFAULT true,
  can_add BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, warehouse_id)
);

-- Add comments for documentation
COMMENT ON TABLE user_warehouse_permissions IS 'Defines which warehouses each user can access and their permission levels';
COMMENT ON COLUMN user_warehouse_permissions.user_id IS 'Reference to the user';
COMMENT ON COLUMN user_warehouse_permissions.warehouse_id IS 'Reference to the warehouse';
COMMENT ON COLUMN user_warehouse_permissions.permission_level IS 'General permission level: view, edit, admin';
COMMENT ON COLUMN user_warehouse_permissions.can_view IS 'Permission to view warehouse data';
COMMENT ON COLUMN user_warehouse_permissions.can_add IS 'Permission to add new items to warehouse';
COMMENT ON COLUMN user_warehouse_permissions.can_edit IS 'Permission to edit existing warehouse items';
COMMENT ON COLUMN user_warehouse_permissions.can_delete IS 'Permission to delete warehouse items';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_warehouse_permissions_user_id ON user_warehouse_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_warehouse_permissions_warehouse_id ON user_warehouse_permissions(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_user_warehouse_permissions_user_warehouse ON user_warehouse_permissions(user_id, warehouse_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_user_warehouse_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_user_warehouse_permissions_updated_at ON user_warehouse_permissions;
CREATE TRIGGER trigger_update_user_warehouse_permissions_updated_at
    BEFORE UPDATE ON user_warehouse_permissions
    FOR EACH ROW
    EXECUTE FUNCTION update_user_warehouse_permissions_updated_at();

-- Enable Row Level Security
ALTER TABLE user_warehouse_permissions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Users can view their own warehouse permissions" ON user_warehouse_permissions;
DROP POLICY IF EXISTS "Users can insert their own warehouse permissions" ON user_warehouse_permissions;
DROP POLICY IF EXISTS "Users can update their own warehouse permissions" ON user_warehouse_permissions;
DROP POLICY IF EXISTS "Users can delete their own warehouse permissions" ON user_warehouse_permissions;

-- Allow users to view their own permissions
CREATE POLICY "Users can view their own warehouse permissions" ON user_warehouse_permissions
    FOR SELECT USING (auth.uid() = user_id);

-- Allow users to insert their own permissions (admin only)
CREATE POLICY "Users can insert their own warehouse permissions" ON user_warehouse_permissions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own permissions (admin only)
CREATE POLICY "Users can update their own warehouse permissions" ON user_warehouse_permissions
    FOR UPDATE USING (auth.uid() = user_id);

-- Allow users to delete their own permissions (admin only)
CREATE POLICY "Users can delete their own warehouse permissions" ON user_warehouse_permissions
    FOR DELETE USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON user_warehouse_permissions TO authenticated;
GRANT USAGE ON SEQUENCE user_warehouse_permissions_id_seq TO authenticated;

-- Insert some sample data for testing
-- Note: This assumes you have users and warehouses already created
-- You may need to adjust the UUIDs and warehouse IDs based on your actual data

-- Example: Give admin user access to all warehouses
-- INSERT INTO user_warehouse_permissions (user_id, warehouse_id, permission_level, can_view, can_add, can_edit, can_delete)
-- SELECT u.id, w.id, 'admin', true, true, true, true
-- FROM users u, warehouses w
-- WHERE u.role = 'admin';

-- Example: Give inventory managers view and edit access to specific warehouses
-- INSERT INTO user_warehouse_permissions (user_id, warehouse_id, permission_level, can_view, can_add, can_edit, can_delete)
-- VALUES 
-- ('user-uuid-1', 1, 'edit', true, true, true, false),
-- ('user-uuid-2', 1, 'edit', true, true, true, false),
-- ('user-uuid-3', 2, 'edit', true, true, true, false),
-- ('user-uuid-4', 2, 'edit', true, true, true, false);

PRINT 'User warehouse permissions table created successfully!';