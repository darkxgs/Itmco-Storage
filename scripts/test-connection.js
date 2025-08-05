// For testing in the browser environment, we'll use a simpler approach
console.log("Testing Supabase connection...")

// Check if we're in a browser environment
if (typeof window !== "undefined") {
  console.log("Running in browser environment")

  // Get environment variables from the app
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  console.log("Supabase URL:", supabaseUrl ? "✅ Set" : "❌ Missing")
  console.log("Supabase Key:", supabaseKey ? "✅ Set" : "❌ Missing")
} else {
  // Node.js environment
  console.log("Running in Node.js environment")
  console.log("Environment variables:")
  console.log("NEXT_PUBLIC_SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL ? "✅ Set" : "❌ Missing")
  console.log("NEXT_PUBLIC_SUPABASE_ANON_KEY:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "✅ Set" : "❌ Missing")
}

// Simple connection test that can be run in the browser
async function testSupabaseConnection() {
  try {
    // This will be handled by the actual app components
    console.log("Database connection test should be run from the application")
    console.log("Please check the browser console when using the app")
  } catch (error) {
    console.error("Connection test failed:", error)
  }
}

testSupabaseConnection()
