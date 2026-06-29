import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const sb = supabaseAdmin()
    const { data, error } = await sb.rpc('cosme_check_admin_get_credit_tiers')

    if (error) throw error

    return NextResponse.json({ data })
  } catch (err) {
    console.error('Failed to get credit tiers:', err)
    return NextResponse.json(
      { error: 'Failed to fetch credit tiers' },
      { status: 500 }
    )
  }
}
