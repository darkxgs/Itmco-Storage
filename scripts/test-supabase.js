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
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Supabase URL:', supabaseUrl);
console.log('Has Anon Key:', !!supabaseAnonKey);
console.log('Has Service Key:', !!supabaseServiceKey);

const clientAnon = createClient(supabaseUrl, supabaseAnonKey);
const clientService = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log('\n--- 1. Testing branches table (Anon client) ---');
  try {
    const { data, error } = await clientAnon.from('branches').select('*').limit(5);
    if (error) {
      console.error('Error fetching branches (Anon):', error);
    } else {
      console.log(`Fetched ${data.length} branches successfully:`);
      data.forEach(b => console.log(` - ID: ${b.id}, Code: ${b.code}, Name: "${b.name}", Customer ID: ${b.customer_id}, Active: ${b.is_active}`));
    }
  } catch (err) {
    console.error('Exception fetching branches (Anon):', err);
  }

  console.log('\n--- 2. Testing branches table (Service client) ---');
  try {
    const { data, error } = await clientService.from('branches').select('*').limit(5);
    if (error) {
      console.error('Error fetching branches (Service):', error);
    } else {
      console.log(`Fetched ${data.length} branches successfully with service client.`);
    }
  } catch (err) {
    console.error('Exception fetching branches (Service):', err);
  }

  console.log('\n--- 3. Testing stock_entries table (Anon client) ---');
  try {
    const { data, error } = await clientAnon.from('stock_entries').select('*').limit(5);
    if (error) {
      console.error('Error fetching stock_entries (Anon):', error);
    } else {
      console.log(`Fetched ${data.length} stock entries successfully:`);
      data.forEach(e => console.log(` - ID: ${e.id}, Prod ID: ${e.product_id}, Qty: ${e.quantity_added}, Date: ${e.entry_date}, Time: ${e.entry_time}, Datetime: ${e.entry_datetime}`));
    }
  } catch (err) {
    console.error('Exception fetching stock_entries (Anon):', err);
  }

  console.log('\n--- 4. Testing stock_entries table (Service client) ---');
  try {
    const { data, error } = await clientService.from('stock_entries').select('*').limit(5);
    if (error) {
      console.error('Error fetching stock_entries (Service):', error);
    } else {
      console.log(`Fetched ${data.length} stock entries successfully with service client:`);
      data.forEach(e => console.log(` - ID: ${e.id}, Prod ID: ${e.product_id}, Qty: ${e.quantity_added}, Date: ${e.entry_date}, Time: ${e.entry_time}, Datetime: ${e.entry_datetime}`));
    }
  } catch (err) {
    console.error('Exception fetching stock_entries (Service):', err);
  }

  console.log('\n--- 5. Checking RLS policies via SQL (Service client) ---');
  try {
    // Check if table RLS is enabled
    const { data: rlsData, error: rlsError } = await clientService.rpc('exec_sql', {
      sql_query: `
        SELECT tablename, rowsecurity 
        FROM pg_tables 
        WHERE schemaname = 'public' AND tablename IN ('branches', 'stock_entries');
      `
    });
    
    if (rlsError) {
      // If exec_sql RPC doesn't exist, we can try running simple queries or checking
      console.log('exec_sql RPC not found or failed:', rlsError.message);
    } else {
      console.log('RLS Status of tables:', rlsData);
    }
  } catch (err) {
    console.error('Exception checking RLS:', err);
  }
}

run();
