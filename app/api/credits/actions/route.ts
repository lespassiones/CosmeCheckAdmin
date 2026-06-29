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
      const { error } = await sb.rpc('cosme_check_update_credit_tier', {
        p_tier: tier,
        p_credit_amount: creditAmount,
        p_renewal_period: renewalPeriod,
        p_renewal_interval_days: renewalIntervalDays,
      })

      if (error) throw error
      return NextResponse.json({ success: true, message: `Tier ${tier} updated` })
    } else if (action === 'set_override') {
      // Set user override
      const { error } = await sb.rpc('cosme_check_set_user_credit_override', {
        p_user_id: userId,
        p_credit_amount: creditAmount,
        p_renewal_period: renewalPeriod,
        p_renewal_interval_days: renewalIntervalDays,
      })

      if (error) throw error
      return NextResponse.json({ success: true, message: `Override set for user` })
    } else if (action === 'remove_override') {
      // Remove user override
      const { error } = await sb.rpc('cosme_check_remove_user_credit_override', {
        p_user_id: userId,
      })

      if (error) throw error
      return NextResponse.json({ success: true, message: `Override removed for user` })
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
