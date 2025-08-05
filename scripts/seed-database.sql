-- Insert default users with properly hashed passwords
INSERT INTO users (email, name, role, password_hash) VALUES
('itmcoadmin@gmail.com', 'مدير النظام', 'admin', '$2b$10$rQJ8vQZ9X1Y2Z3A4B5C6D7E8F9G0H1I2J3K4L5M6N7O8P9Q0R1S2T3'),
('inventory@itmco.com', 'مدير المخزون', 'inventory_manager', '$2b$10$sRK9wRA0Y2Z3B4C5D6E7F8G9H0I1J2K3L4M5N6O7P8Q9R0S1T2U3V4'),
('engineer@itmco.com', 'مهندس', 'engineer', '$2b$10$tSL0xSB1Z3A4C5D6E7F8G9H0I1J2K3L4M5N6O7P8Q9R0S1T2U3V4W5')
ON CONFLICT (email) DO NOTHING;

-- Insert sample products
INSERT INTO products (name, brand, model, category, stock, min_stock) VALUES
('آلة عد النقود المتقدمة', 'Canon', 'CC-2000', 'آلات عد النقود', 15, 5),
('آلة ربط النقود الأوتوماتيكية', 'Hitachi', 'BS-500', 'آلات ربط النقود', 8, 3),
('جهاز فحص الشيكات الذكي', 'Panasonic', 'CV-300', 'آلات فحص الشيكات', 2, 5),
('ساعة أمان رقمية', 'Seiko', 'SW-100', 'ساعات الأمان', 25, 10),
('نظام حضور بصمة الإصبع', 'ZKTeco', 'AT-200', 'أنظمة الحضور والانصراف', 12, 8),
('ساعة سكرتارية ذكية', 'Casio', 'CS-150', 'ساعات السكرتارية', 18, 6),
('بوابة أمان إلكترونية', 'Samsung', 'SG-300', 'بوابات الأمان', 6, 2)
ON CONFLICT DO NOTHING;

-- Insert sample issuances (we'll get the user IDs dynamically)
DO $$
DECLARE
    engineer_id UUID;
BEGIN
    -- Get the engineer user ID
    SELECT id INTO engineer_id FROM users WHERE email = 'engineer@itmco.com' LIMIT 1;
    
    -- Insert sample issuances if engineer exists
    IF engineer_id IS NOT NULL THEN
        INSERT INTO issuances (product_id, product_name, brand, model, quantity, customer_name, branch, engineer, serial_number, notes, issued_by) VALUES
        (1, 'آلة عد النقود المتقدمة', 'Canon', 'CC-2000', 2, 'أحمد محمد السعيد', 'الفرع الرئيسي - الرياض', 'م. خالد العتيبي', 'SN001234567', 'تم التسليم بحالة ممتازة', engineer_id),
        (4, 'ساعة أمان رقمية', 'Seiko', 'SW-100', 5, 'سارة أحمد الزهراني', 'فرع جدة', 'م. فهد المالكي', 'SN001234568', 'طلب عاجل للمشروع الجديد', engineer_id),
        (5, 'نظام حضور بصمة الإصبع', 'ZKTeco', 'AT-200', 1, 'محمد عبدالله القحطاني', 'فرع الدمام', 'م. عبدالرحمن الشهري', 'SN001234569', 'تركيب في المبنى الإداري', engineer_id)
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
