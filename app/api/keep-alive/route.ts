import { getAdminClient } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Simple query to keep database active (head-only, returns no rows)
    const { error } = await getAdminClient()
      .from('products')
      .select('id', { count: 'exact', head: true })

    if (error) {
      console.error('Keep-alive query failed:', error)
      return NextResponse.json({
        success: false,
        error: 'Database query failed'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Database is active',
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('Keep-alive error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
