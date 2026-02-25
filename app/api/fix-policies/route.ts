import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function POST() {
  try {
    // Add UPDATE policy for issuances
    const { error: updatePolicyError } = await supabase.rpc('exec_sql', {
      sql: `CREATE POLICY "Enable update for all users" ON issuances FOR UPDATE USING (true);`
    })

    if (updatePolicyError && !updatePolicyError.message.includes('already exists')) {
      console.error('Error creating UPDATE policy:', updatePolicyError)
    }

    // Add DELETE policy for issuances
    const { error: deletePolicyError } = await supabase.rpc('exec_sql', {
      sql: `CREATE POLICY "Enable delete for all users" ON issuances FOR DELETE USING (true);`
    })

    if (deletePolicyError && !deletePolicyError.message.includes('already exists')) {
      console.error('Error creating DELETE policy:', deletePolicyError)
    }

    // Verify policies
    const { data: policies, error: verifyError } = await supabase.rpc('exec_sql', {
      sql: `SELECT schemaname, tablename, policyname, cmd FROM pg_policies WHERE tablename = 'issuances' ORDER BY cmd;`
    })

    if (verifyError) {
      console.error('Error verifying policies:', verifyError)
    }

    return NextResponse.json({
      success: true,
      message: 'RLS policies have been updated for issuances table',
      policies: policies || [],
      updatePolicyError: updatePolicyError?.message || null,
      deletePolicyError: deletePolicyError?.message || null
    })

  } catch (error) {
    console.error('Error fixing policies:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        message: 'Failed to update RLS policies. Please run the SQL script manually in Supabase SQL Editor.'
      },
      { status: 500 }
    )
  }
}