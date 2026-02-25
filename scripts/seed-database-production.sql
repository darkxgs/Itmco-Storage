-- Production seed data for ITMCO Inventory Management System
-- This file contains only essential data needed for production

-- Insert default users with secure hashed passwords
INSERT INTO users (email, name, role, password_hash) VALUES
('itmcoadmin@gmail.com', 'مدير النظام', 'admin', '$2b$10$UQWLCOX4ITXd.ekx3YXW/ukQy8mU.CuRwJuTRF8PQj6Wk0mh1NYfW'),
('inventory@itmco.com', 'مدير المخزون', 'inventory_manager', '$2b$10$a76qFN/1ekMInSqOEC.vMu2.BtSkNRp/lGzcwcLVm8pY29pZ0msbK'),
('engineer@itmco.com', 'مهندس', 'engineer', '$2b$10$YKFjPDbGmZCyXF38wUkhW.tC6jsYDuWIA7HMKtLL8NzemO.FW1xJa')
ON CONFLICT (email) DO NOTHING;

-- Insert sample products (these can be modified or removed as needed)
INSERT INTO products (name, brand, model, category, stock, min_stock, description) VALUES
('آلة عد النقود المتقدمة', 'Canon', 'CC-2000', 'آلات عد النقود', 15, 5, 'آلة عد نقود متطورة بتقنية الكشف المتعدد للعملات المزيفة وسرعة عد عالية'),
('آلة ربط النقود الأوتوماتيكية', 'Hitachi', 'BS-500', 'آلات ربط النقود', 8, 3, 'آلة ربط نقود أوتوماتيكية بالكامل مع إمكانية ربط فئات مختلفة من العملات'),
('جهاز فحص الشيكات الذكي', 'Panasonic', 'CV-300', 'آلات فحص الشيكات', 2, 5, 'جهاز فحص شيكات ذكي مع تقنية OCR لقراءة البيانات وكشف التزوير'),
('ساعة أمان رقمية', 'Seiko', 'SW-100', 'ساعات الأمان', 25, 10, 'ساعة أمان رقمية مقاومة للماء والصدمات مع نظام إنذار متقدم'),
('نظام حضور بصمة الإصبع', 'ZKTeco', 'AT-200', 'أنظمة الحضور والانصراف', 12, 8, 'نظام حضور وانصراف بتقنية بصمة الإصبع مع قاعدة بيانات تتسع لـ 3000 بصمة'),
('ساعة سكرتارية ذكية', 'Casio', 'CS-150', 'ساعات السكرتارية', 18, 6, 'ساعة سكرتارية ذكية مع منبه متعدد ومؤقت وحاسبة مدمجة'),
('بوابة أمان إلكترونية', 'Samsung', 'SG-300', 'بوابات الأمان', 6, 2, 'بوابة أمان إلكترونية مع كاشف معادن وكاميرا مراقبة مدمجة')
ON CONFLICT DO NOTHING;

-- No sample issuances - database starts clean for production
-- Users will add their own issuances through the application

-- Insert initial system activity log
DO $
DECLARE
    admin_id UUID;
BEGIN
    -- Get admin user ID
    SELECT id INTO admin_id FROM users WHERE email = 'itmcoadmin@gmail.com' LIMIT 1;
    
    -- Insert system initialization log
    IF admin_id IS NOT NULL THEN
        INSERT INTO activity_logs (user_id, user_name, action, module, details) VALUES
        (admin_id, 'مدير النظام', 'تهيئة النظام', 'النظام', 'تم تهيئة النظام وإعداد البيانات الأولية');
    END IF;
END $;