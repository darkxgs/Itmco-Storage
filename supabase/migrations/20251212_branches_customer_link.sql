-- Add customer_id column to branches table to link branches with customers
ALTER TABLE branches ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_branches_customer_id ON branches(customer_id);

-- Update RLS policies to allow reading branches by customer
DROP POLICY IF EXISTS "Allow read branches" ON branches;
CREATE POLICY "Allow read branches" ON branches FOR SELECT USING (true);
