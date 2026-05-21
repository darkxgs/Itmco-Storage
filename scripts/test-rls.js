const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env manually
const envPath = path.join(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value.trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

const clientAnon = createClient(supabaseUrl, supabaseAnonKey);

async function testRLS() {
  console.log('Testing Anon client insertion into branches...');
  const testBranchCode = 'TEST-' + Math.floor(Math.random() * 10000);
  
  // 1. Try to insert a branch
  const { data: branchInsertData, error: branchInsertError } = await clientAnon
    .from('branches')
    .insert({
      name: 'فرع تجريبي ' + testBranchCode,
      code: testBranchCode,
      is_active: false // Test boolean sanitization impact
    })
    .select();
    
  if (branchInsertError) {
    console.error('❌ Branch Insert Error:', branchInsertError.message);
  } else {
    console.log('✅ Branch Inserted Successfully:', branchInsertData);
  }

  // 2. Try to select the inserted branch
  const { data: branchSelectData, error: branchSelectError } = await clientAnon
    .from('branches')
    .select('*')
    .eq('code', testBranchCode);

  if (branchSelectError) {
    console.error('❌ Branch Select Error:', branchSelectError.message);
  } else {
    console.log('✅ Branch Selected Successfully:', branchSelectData);
  }

  // Cleanup inserted branch
  if (branchInsertData && branchInsertData.length > 0) {
    await clientAnon.from('branches').delete().eq('id', branchInsertData[0].id);
    console.log('Cleanup branch done.');
  }

  console.log('\nTesting Anon client insertion into stock_entries...');
  
  // 3. Try to insert a stock entry
  // We need a valid product_id. Let's fetch one product first.
  const { data: products } = await clientAnon.from('products').select('id, name, item_code').limit(1);
  if (!products || products.length === 0) {
    console.log('No products found to test stock entries.');
    return;
  }
  
  const product = products[0];
  console.log(`Using product: ID ${product.id}, Name: "${product.name}"`);
  
  const { data: entryInsertData, error: entryInsertError } = await clientAnon
    .from('stock_entries')
    .insert({
      product_id: product.id,
      product_name: product.name,
      item_code: product.item_code,
      quantity_added: 5,
      previous_stock: 10,
      new_stock: 15,
      entered_by: 'فحص تلقائي RLS',
      notes: 'إدخال اختبار RLS'
    })
    .select();

  if (entryInsertError) {
    console.error('❌ Stock Entry Insert Error:', entryInsertError.message);
  } else {
    console.log('✅ Stock Entry Inserted Successfully:', entryInsertData);
  }

  // 4. Try to select the stock entry
  if (entryInsertData && entryInsertData.length > 0) {
    const { data: entrySelectData, error: entrySelectError } = await clientAnon
      .from('stock_entries')
      .select('*')
      .eq('id', entryInsertData[0].id);

    if (entrySelectError) {
      console.error('❌ Stock Entry Select Error:', entrySelectError.message);
    } else {
      console.log('✅ Stock Entry Selected Successfully:', entrySelectData);
    }

    // Cleanup stock entry
    await clientAnon.from('stock_entries').delete().eq('id', entryInsertData[0].id);
    console.log('Cleanup stock entry done.');
  }
}

testRLS();
