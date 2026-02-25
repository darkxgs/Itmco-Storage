-- Clean seed database script without hardcoded sample data
-- This script only creates essential users and sample products

-- Insert default users with the actual hashed passwords
INSERT INTO users (email, name, role, password_hash) VALUES
('itmcoadmin@gmail.com', 'مدير النظام', 'admin', '$2b$10$UQWLCOX4ITXd.ekx3YXW/ukQy8mU.CuRwJuTRF8PQj6Wk0mh1NYfW'),
('inventory@itmco.com', 'مدير المخزون', 'inventory_manager', '$2b$10$a76qFN/1ekMInSqOEC.vMu2.BtSkNRp/lGzcwcLVm8pY29pZ0msbK'),
('engineer@itmco.com', 'مهندس', 'engineer', '$2b$10$YKFjPDbGmZCyXF38wUkhW.tC6jsYDuWIA7HMKtLL8NzemO.FW1xJa')
ON CONFLICT (email) DO NOTHING;

-- Insert sample products with descriptions
INSERT INTO products (name, brand, model, category, stock, min_stock, description) VALUES
('آلة عد النقود المتقدمة', 'Canon', 'CC-2000', 'آلات عد النقود', 15, 5, 'آلة عد نقود متطورة بتقنية الكشف المتعدد للعملات المزيفة وسرعة عد عالية'),
('آلة ربط النقود الأوتوماتيكية', 'Hitachi', 'BS-500', 'آلات ربط النقود', 8, 3, 'آلة ربط نقود أوتوماتيكية بالكامل مع إمكانية ربط فئات مختلفة من العملات'),
('جهاز فحص الشيكات الذكي', 'Panasonic', 'CV-300', 'آلات فحص الشيكات', 2, 5, 'جهاز فحص شيكات ذكي مع تقنية OCR لقراءة البيانات وكشف التزوير'),
('ساعة أمان رقمية', 'Seiko', 'SW-100', 'ساعات الأمان', 25, 10, 'ساعة أمان رقمية مقاومة للماء والصدمات مع نظام إنذار متقدم'),
('نظام حضور بصمة الإصبع', 'ZKTeco', 'AT-200', 'أنظمة الحضور والانصراف', 12, 8, 'نظام حضور وانصراف بتقنية بصمة الإصبع مع قاعدة بيانات تتسع لـ 3000 بصمة'),
('ساعة سكرتارية ذكية', 'Casio', 'CS-150', 'ساعات السكرتارية', 18, 6, 'ساعة سكرتارية ذكية مع منبه متعدد ومؤقت وحاسبة مدمجة'),
('بوابة أمان إلكترونية', 'Samsung', 'SG-300', 'بوابات الأمان', 6, 2, 'بوابة أمان إلكترونية مع كاشف معادن وكاميرا مراقبة مدمجة')
ON CONFLICT DO NOTHING;

-- No sample issuances or activity logs - system starts clean
-- Users will create their own data through the application interface