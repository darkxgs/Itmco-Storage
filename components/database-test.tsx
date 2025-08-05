"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"

export function DatabaseTest() {
  const [testing, setTesting] = useState(false)
  const [results, setResults] = useState<any[]>([])

  const runTests = async () => {
    setTesting(true)
    const testResults = []

    // Test 1: Environment Variables
    testResults.push({
      name: "Environment Variables",
      status: process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "success" : "error",
      message:
        process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
          ? "Environment variables are set"
          : "Missing environment variables",
    })

    // Test 2: Users Table
    try {
      const { data, error } = await supabase.from("users").select("count")
      testResults.push({
        name: "Users Table",
        status: error ? "error" : "success",
        message: error ? error.message : "Users table accessible",
      })
    } catch (error) {
      testResults.push({
        name: "Users Table",
        status: "error",
        message: error.message,
      })
    }

    // Test 3: Products Table
    try {
      const { data, error } = await supabase.from("products").select("count")
      testResults.push({
        name: "Products Table",
        status: error ? "error" : "success",
        message: error ? error.message : "Products table accessible",
      })
    } catch (error) {
      testResults.push({
        name: "Products Table",
        status: "error",
        message: error.message,
      })
    }

    // Test 4: Issuances Table
    try {
      const { data, error } = await supabase.from("issuances").select("count")
      testResults.push({
        name: "Issuances Table",
        status: error ? "error" : "success",
        message: error ? error.message : "Issuances table accessible",
      })
    } catch (error) {
      testResults.push({
        name: "Issuances Table",
        status: "error",
        message: error.message,
      })
    }

    // Test 5: Activity Logs Table
    try {
      const { data, error } = await supabase.from("activity_logs").select("count")
      testResults.push({
        name: "Activity Logs Table",
        status: error ? "error" : "success",
        message: error ? error.message : "Activity logs table accessible",
      })
    } catch (error) {
      testResults.push({
        name: "Activity Logs Table",
        status: "error",
        message: error.message,
      })
    }

    // Test 6: Sample Data
    try {
      const { data, error } = await supabase.from("users").select("*").limit(1)
      testResults.push({
        name: "Sample Data",
        status: error ? "error" : data && data.length > 0 ? "success" : "warning",
        message: error ? error.message : data && data.length > 0 ? "Sample data found" : "No sample data found",
      })
    } catch (error) {
      testResults.push({
        name: "Sample Data",
        status: "error",
        message: error.message,
      })
    }

    setResults(testResults)
    setTesting(false)
  }

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white">Database Connection Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={runTests} disabled={testing} className="w-full">
          {testing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Testing...
            </>
          ) : (
            "Run Database Tests"
          )}
        </Button>

        {results.length > 0 && (
          <div className="space-y-2">
            {results.map((result, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                <span className="text-white font-medium">{result.name}</span>
                <div className="flex items-center gap-2">
                  {result.status === "success" && <CheckCircle className="w-5 h-5 text-green-400" />}
                  {result.status === "error" && <XCircle className="w-5 h-5 text-red-400" />}
                  {result.status === "warning" && <XCircle className="w-5 h-5 text-yellow-400" />}
                  <span
                    className={`text-sm ${
                      result.status === "success"
                        ? "text-green-400"
                        : result.status === "error"
                          ? "text-red-400"
                          : "text-yellow-400"
                    }`}
                  >
                    {result.message}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 p-4 bg-slate-700 rounded-lg">
          <h4 className="text-white font-medium mb-2">Environment Variables Status:</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-300">NEXT_PUBLIC_SUPABASE_URL:</span>
              <span className={process.env.NEXT_PUBLIC_SUPABASE_URL ? "text-green-400" : "text-red-400"}>
                {process.env.NEXT_PUBLIC_SUPABASE_URL ? "✅ Set" : "❌ Missing"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-300">NEXT_PUBLIC_SUPABASE_ANON_KEY:</span>
              <span className={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "text-green-400" : "text-red-400"}>
                {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "✅ Set" : "❌ Missing"}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
