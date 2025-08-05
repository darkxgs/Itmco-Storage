-- Insert default users with the actual hashed passwords
INSERT INTO users (email, name, role, password_hash) VALUES
('itmcoadmin@gmail.com', 'مدير النظام', 'admin', '$2b$10$UQWLCOX4ITXd.ekx3YXW/ukQy8mU.CuRwJuTRF8PQj6Wk0mh1NYfW'),
('inventory@itmco.com', 'مدير المخزون', 'inventory_manager', '$2b$10$a76qFN/1ekMInSqOEC.vMu2.BtSkNRp/lGzcwcLVm8pY29pZ0msbK'),
('engineer@itmco.com', 'مهندس', 'engineer', '$2b$10$YKFjPDbGmZCyXF38wUkhW.tC6jsYDuWIA7HMKtLL8NzemO.FW1xJa')
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
        
        -- Update product stock after issuances
        UPDATE products SET stock = stock - 2 WHERE id = 1;
        UPDATE products SET stock = stock - 5 WHERE id = 4;
        UPDATE products SET stock = stock - 1 WHERE id = 5;
    END IF;
END $$;

-- Insert some sample activity logs
DO $$
DECLARE
    admin_id UUID;
    engineer_id UUID;
BEGIN
    -- Get user IDs
    SELECT id INTO admin_id FROM users WHERE email = 'itmcoadmin@gmail.com' LIMIT 1;
    SELECT id INTO engineer_id FROM users WHERE email = 'engineer@itmco.com' LIMIT 1;
    
    -- Insert sample activity logs
    IF admin_id IS NOT NULL AND engineer_id IS NOT NULL THEN
        INSERT INTO activity_logs (user_id, user_name, action, module, details) VALUES
        (admin_id, 'مدير النظام', 'تسجيل دخول', 'المصادقة', 'تم تسجيل الدخول بنجاح'),
        (engineer_id, 'مهندس', 'إصدار منتج', 'الإصدار', 'تم إصدار آلة عد النقود للعميل أحمد محمد السعيد'),
        (engineer_id, 'مهندس', 'إصدار منتج', 'الإصدار', 'تم إصدار ساعة أمان للعميل سارة أحمد الزهراني'),
        (admin_id, 'مدير النظام', 'عرض تقرير', 'التقارير', 'تم عرض تقرير الإصدارات الشهرية');
    END IF;
END $$;
