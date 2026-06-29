import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const sb = supabaseAdmin()

    const { data: audit, error } = await sb
      .schema('cosme_check')
      .from('credit_tier_audit_log')
      .select('*')
      .order('changed_at', { ascending: false })
      .limit(200)

    if (error) throw error

    return NextResponse.json({ audit })
  } catch (err) {
    console.error('Failed to get audit log:', err)
    return NextResponse.json(
      { error: 'Failed to fetch audit log' },
      { status: 500 }
    )
  }
}
