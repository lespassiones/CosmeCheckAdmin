import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, tier, creditAmount, renewalPeriod, renewalIntervalDays, userId } = body

    if (!action) {
      return NextResponse.json(
        { error: 'Missing action' },
        { status: 400 }
      )
    }

    const sb = supabaseAdmin()

    if (action === 'update_tier') {
      // Update tier configuration
      const { data, error } = await sb.rpc('cosme_check_admin_update_credit_tier', {
        p_tier: tier,
        p_credit_amount: creditAmount,
        p_renewal_period: renewalPeriod,
        p_renewal_interval_days: renewalIntervalDays,
      })

      if (error) throw error
      return NextResponse.json({ success: true, message: `Tier ${tier} updated`, data })
    } else if (action === 'set_override') {
      // Set user override
      const { data, error } = await sb.rpc('cosme_check_admin_set_user_override', {
        p_user_id: userId,
        p_credit_amount: creditAmount,
        p_renewal_period: renewalPeriod,
        p_renewal_interval_days: renewalIntervalDays,
        p_active: true,
      })

      if (error) throw error
      return NextResponse.json({ success: true, message: `Override set for user`, data })
    } else if (action === 'remove_override') {
      // Remove user override by setting active=false
      const { data, error } = await sb.rpc('cosme_check_admin_set_user_override', {
        p_user_id: userId,
        p_credit_amount: 0,
        p_renewal_period: 'one_time',
        p_renewal_interval_days: null,
        p_active: false,
      })

      if (error) throw error
      return NextResponse.json({ success: true, message: `Override removed for user`, data })
    } else {
      return NextResponse.json(
        { error: 'Unknown action' },
        { status: 400 }
      )
    }
  } catch (err) {
    console.error('Credit action failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Action failed' },
      { status: 500 }
    )
  }
}
