-- Database Updates for Enhanced Inventory Management System
-- This script adds new tables and updates existing ones

-- Create branches table
CREATE TABLE IF NOT EXISTS branches (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  code VARCHAR(50) NOT NULL UNIQUE,
  address TEXT,
  phone VARCHAR(50),
  manager_name VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  contact_person VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create warehouses table
CREATE TABLE IF NOT EXISTS warehouses (
  id SERIAL PRIMARY KEY,
  warehouse_number VARCHAR(50) NOT NULL UNIQUE, -- Auto-generated, non-editable
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add new columns to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS item_code VARCHAR(100) UNIQUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS warehouse_id INTEGER REFERENCES warehouses(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS price DECIMAL(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;

-- Update issuances table to support multiple products and better search
ALTER TABLE issuances ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id);
ALTER TABLE issuances ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);
ALTER TABLE issuances ADD COLUMN IF NOT EXISTS item_code VARCHAR(100);
ALTER TABLE issuances ADD COLUMN IF NOT EXISTS warehouse_id INTEGER REFERENCES warehouses(id);

-- Create release_items table for multiple products per release
CREATE TABLE IF NOT EXISTS release_items (
  id SERIAL PRIMARY KEY,
  issuance_id INTEGER REFERENCES issuances(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  item_code VARCHAR(100),
  product_name VARCHAR(255) NOT NULL,
  brand VARCHAR(255) NOT NULL,
  model VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2),
  total_price DECIMAL(10,2),
  serial_numbers TEXT[], -- Array of serial numbers
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_branches_code ON branches(code);
CREATE INDEX IF NOT EXISTS idx_branches_active ON branches(is_active);
CREATE INDEX IF NOT EXISTS idx_customers_code ON customers(code);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_warehouses_number ON warehouses(warehouse_number);
CREATE INDEX IF NOT EXISTS idx_products_item_code ON products(item_code);
CREATE INDEX IF NOT EXISTS idx_products_warehouse_id ON products(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_issuances_customer_id ON issuances(customer_id);
CREATE INDEX IF NOT EXISTS idx_issuances_branch_id ON issuances(branch_id);
CREATE INDEX IF NOT EXISTS idx_issuances_item_code ON issuances(item_code);
CREATE INDEX IF NOT EXISTS idx_release_items_issuance_id ON release_items(issuance_id);
CREATE INDEX IF NOT EXISTS idx_release_items_product_id ON release_items(product_id);
CREATE INDEX IF NOT EXISTS idx_release_items_item_code ON release_items(item_code);

-- Enable Row Level Security for new tables
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE release_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for new tables
CREATE POLICY "Enable read access for all users" ON branches FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON branches FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON branches FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON branches FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON customers FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON customers FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON customers FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON warehouses FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON warehouses FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON warehouses FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON warehouses FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON release_items FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON release_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON release_items FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON release_items FOR DELETE USING (true);

-- Function to auto-generate warehouse numbers
CREATE OR REPLACE FUNCTION generate_warehouse_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.warehouse_number IS NULL OR NEW.warehouse_number = '' THEN
    NEW.warehouse_number := 'WH' || LPAD(nextval('warehouses_id_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate warehouse numbers
DROP TRIGGER IF EXISTS trigger_generate_warehouse_number ON warehouses;
CREATE TRIGGER trigger_generate_warehouse_number
  BEFORE INSERT ON warehouses
  FOR EACH ROW
  EXECUTE FUNCTION generate_warehouse_number();

-- Insert default branches from existing BRANCHES array
INSERT INTO branches (name, code) VALUES
('الفرع الرئيسي - القاهرة', 'CAI-MAIN'),
('فرع الجيزة', 'GIZ'),
('فرع الإسكندرية', 'ALX'),
('فرع المنصورة', 'MAN'),
('فرع طنطا', 'TAN'),
('فرع الزقازيق', 'ZAG'),
('فرع شبرا الخيمة', 'SHB'),
('فرع 6 أكتوبر', 'OCT'),
('فرع المعادي', 'MAA'),
('فرع مدينة نصر', 'NAS'),
('فرع مصر الجديدة', 'HEL'),
('فرع حلوان', 'HLW'),
('فرع العاشر من رمضان', 'RAM'),
('فرع بدر', 'BAD'),
('فرع الشروق', 'SHR'),
('فرع بني سويف', 'BSW'),
('فرع المنيا', 'MIN'),
('فرع أسيوط', 'ASY'),
('فرع سوهاج', 'SOH'),
('فرع قنا', 'QEN'),
('فرع الأقصر', 'LUX'),
('فرع أسوان', 'ASW'),
('فرع دمنهور', 'DAM'),
('فرع كفر الشيخ', 'KFS'),
('فرع المحلة الكبرى', 'MAH'),
('فرع دمياط', 'DMT'),
('فرع بورسعيد', 'POR'),
('فرع الإسماعيلية', 'ISM'),
('فرع السويس', 'SUE'),
('فرع الفيوم', 'FAY'),
('فرع مطروح', 'MAT'),
('فرع الغردقة', 'HUR'),
('فرع شرم الشيخ', 'SSH'),
('فرع العريش', 'ARI')
ON CONFLICT (code) DO NOTHING;

-- Insert default warehouses
INSERT INTO warehouses (name, location, description) VALUES
('المخزن الرئيسي', 'القاهرة - المقر الرئيسي', 'المخزن الرئيسي للشركة'),
('مخزن الإسكندرية', 'الإسكندرية', 'مخزن فرع الإسكندرية'),
('مخزن الجيزة', 'الجيزة', 'مخزن فرع الجيزة')
ON CONFLICT (warehouse_number) DO NOTHING;

-- Add some sample customers
INSERT INTO customers (name, code, email, phone) VALUES
('البنك الأهلي المصري', 'NBE', 'info@nbe.com.eg', '+20-2-XXXXXXX'),
('بنك مصر', 'BM', 'info@banquemisr.com', '+20-2-XXXXXXX'),
('البنك التجاري الدولي', 'CIB', 'info@cibeg.com', '+20-2-XXXXXXX'),
('بنك القاهرة', 'BOC', 'info@banqueducaire.com', '+20-2-XXXXXXX'),
('البنك العربي الأفريقي الدولي', 'AAIB', 'info@aaib.com', '+20-2-XXXXXXX')
ON CONFLICT (code) DO NOTHING;

-- Update existing products with sample item codes (if they don't have them)
UPDATE products SET item_code = 'ITM' || LPAD(id::text, 6, '0') WHERE item_code IS NULL;

COMMIT;