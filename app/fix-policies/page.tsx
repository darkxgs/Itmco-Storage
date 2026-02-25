"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"

export default function FixPoliciesPage() {
  const [status, setStatus] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [policies, setPolicies] = useState<any[]>([])

  const checkPolicies = async () => {
    setLoading(true)
    setStatus("Checking current RLS policies...")
    
    try {
      // Try to query policies (this might not work due to permissions)
      const { data, error } = await supabase
        .from('pg_policies')
        .select('schemaname, tablename, policyname, cmd')
        .eq('tablename', 'issuances')
        .order('cmd')
      
      if (error) {
        setStatus(`Cannot check policies directly: ${error.message}`)
      } else {
        setPolicies(data || [])
        setStatus(`Found ${data?.length || 0} policies for issuances table`)
      }
    } catch (error) {
      setStatus(`Error: ${error.message}`)
    }
    
    setLoading(false)
  }

  const testDelete = async () => {
    setLoading(true)
    setStatus("Testing delete operation...")
    
    try {
      // Try a test delete operation (this should fail with current setup)
      const { data, error } = await supabase
        .from('issuances')
        .delete()
        .eq('id', -1) // Non-existent ID to avoid actual deletion
      
      if (error) {
        if (error.message.includes('policy')) {
          setStatus(`❌ Delete failed due to missing RLS policy: ${error.message}`)
        } else {
          setStatus(`✅ Delete operation allowed (no policy error): ${error.message}`)
        }
      } else {
        setStatus("✅ Delete operation completed successfully")
      }
    } catch (error) {
      setStatus(`Error during test: ${error.message}`)
    }
    
    setLoading(false)
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Fix RLS Policies for Issuances</h1>
      
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold text-yellow-800 mb-2">⚠️ Issue Detected</h2>
        <p className="text-yellow-700">
          The issuances table is missing UPDATE and DELETE policies in Row Level Security (RLS).
          This causes the 406 error when trying to delete issuances.
        </p>
      </div>

      <div className="space-y-4 mb-6">
        <button
          onClick={checkPolicies}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? "Checking..." : "Check Current Policies"}
        </button>
        
        <button
          onClick={testDelete}
          disabled={loading}
          className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 disabled:opacity-50 ml-2"
        >
          {loading ? "Testing..." : "Test Delete Operation"}
        </button>
      </div>

      {status && (
        <div className="bg-gray-50 border rounded-lg p-4 mb-6">
          <h3 className="font-semibold mb-2">Status:</h3>
          <p className="text-sm font-mono">{status}</p>
        </div>
      )}

      {policies.length > 0 && (
        <div className="bg-white border rounded-lg p-4 mb-6">
          <h3 className="font-semibold mb-2">Current Policies:</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Policy Name</th>
                  <th className="text-left p-2">Command</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((policy, index) => (
                  <tr key={index} className="border-b">
                    <td className="p-2">{policy.policyname}</td>
                    <td className="p-2">{policy.cmd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-blue-800 mb-2">🔧 Manual Fix Required</h2>
        <p className="text-blue-700 mb-4">
          To fix this issue, you need to run the following SQL in your Supabase SQL Editor:
        </p>
        
        <div className="bg-gray-900 text-green-400 p-4 rounded font-mono text-sm overflow-x-auto">
          <pre>{`-- Add missing RLS policies for issuances table
CREATE POLICY "Enable update for all users" ON issuances FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON issuances FOR DELETE USING (true);

-- Verify policies
SELECT schemaname, tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename = 'issuances' 
ORDER BY cmd;`}</pre>
        </div>
        
        <div className="mt-4 text-blue-700">
          <h3 className="font-semibold mb-2">Steps:</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Go to your Supabase Dashboard</li>
            <li>Navigate to SQL Editor</li>
            <li>Copy and paste the SQL above</li>
            <li>Click "Run" to execute</li>
            <li>Refresh this page and test again</li>
          </ol>
        </div>
      </div>
    </div>
  )
}