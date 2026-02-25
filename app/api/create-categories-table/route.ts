import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function POST() {
  try {
    // Create categories table
    const { error: createTableError } = await supabase
      .from('categories')
      .select('*')
      .limit(1)
    
    // If table doesn't exist, we'll get an error, so we create it
    if (createTableError && createTableError.message.includes('relation "categories" does not exist')) {
      // For now, return a message asking to create the table manually
      return NextResponse.json({
        success: false,
        message: 'Categories table does not exist. Please create it manually in Supabase SQL Editor with the following SQL:',
        sql: `
          CREATE TABLE IF NOT EXISTS categories (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            description TEXT,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
          
          CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);
          CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active);
          
          CREATE OR REPLACE FUNCTION update_updated_at_column()
          RETURNS TRIGGER AS $$
          BEGIN
              NEW.updated_at = CURRENT_TIMESTAMP;
              RETURN NEW;
          END;
          $$ language 'plpgsql';
          
          DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
          CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
              FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
          
          INSERT INTO categories (name, description) VALUES 
          ('آلات عد النقود', 'أجهزة عد وفرز النقود الورقية والمعدنية'),
          ('آلات ربط النقود', 'أجهزة ربط وتجميع النقود'),
          ('آلات فحص الشيكات', 'أجهزة فحص وتصديق الشيكات'),
          ('ساعات الأمان', 'ساعات الحضور والانصراف الأمنية'),
          ('أنظمة الحضور والانصراف', 'أنظمة تتبع الحضور والانصراف'),
          ('ساعات السكرتارية', 'ساعات إدارية ومكتبية'),
          ('بوابات الأمان', 'بوابات الدخول والخروج الأمنية'),
          ('أجهزة كمبيوتر', 'أجهزة كمبيوتر مكتبية ومحمولة'),
          ('طابعات', 'طابعات ليزر ونافثة للحبر'),
          ('شاشات', 'شاشات عرض مختلفة الأحجام')
          ON CONFLICT (name) DO NOTHING;
        `
      }, { status: 400 })
    }

    // If we reach here, the table exists, so let's fetch the categories
    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('*')
      .order('name')

    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError)
      return NextResponse.json(
        {
          success: false,
          error: categoriesError.message,
          message: 'Failed to fetch categories'
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Categories table exists and data retrieved successfully',
      categories: categories || []
    })

  } catch (error) {
    console.error('Error creating categories table:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        message: 'Failed to create categories table. Please run the SQL script manually in Supabase SQL Editor.'
      },
      { status: 500 }
    )
  }
}