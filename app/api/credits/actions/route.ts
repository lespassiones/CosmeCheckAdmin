import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/authGuard'
import { logAudit } from '@/lib/audit'

/**
 * Credit admin actions for the Gestion des crédits page. Repointed to the
 * canonical RPCs (credits_canonical_core_v1 / credits_admin_rpcs_v1):
 *   update_tier     -> cosme_check_admin_set_tier(tier, amount, period)
 *   set_override    -> cosme_check_admin_set_override(user, amount, period)
 *   remove_override -> cosme_check_admin_clear_override(user)
 *   grant_bonus     -> cosme_check_admin_grant_credits(user, amount, note)
 * renewal_interval_days is derived server-side from the period (no longer sent).
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const body = await request.json()
    const { action, tier, creditAmount, renewalPeriod, userId, note } = body
    if (!action) return NextResponse.json({ error: 'Missing action' }, { status: 400 })

    const sb = supabaseAdmin()

    if (action === 'update_tier') {
      const { data, error } = await sb.rpc('cosme_check_admin_set_tier', {
        p_tier: tier,
        p_credit_amount: creditAmount,
        p_renewal_period: renewalPeriod,
      })
      if (error) throw error
      await logAudit({
        adminEmail: admin.email,
        action: 'credits.tier_update',
        payload: { tier, creditAmount, renewalPeriod },
      })
      return NextResponse.json({ success: true, message: `Tier ${tier} mis à jour`, data })
    }

    if (action === 'set_override') {
      const { data, error } = await sb.rpc('cosme_check_admin_set_override', {
        p_user_id: userId,
        p_credit_amount: creditAmount,
        p_renewal_period: renewalPeriod,
      })
      if (error) throw error
      await logAudit({
        adminEmail: admin.email,
        action: 'credits.override_set',
        targetUserId: userId,
        payload: { creditAmount, renewalPeriod },
      })
      return NextResponse.json({ success: true, message: 'Override appliqué', data })
    }

    if (action === 'remove_override') {
      const { data, error } = await sb.rpc('cosme_check_admin_clear_override', {
        p_user_id: userId,
      })
      if (error) throw error
      await logAudit({ adminEmail: admin.email, action: 'credits.override_clear', targetUserId: userId })
      return NextResponse.json({ success: true, message: 'Override retiré', data })
    }

    if (action === 'grant_bonus') {
      const { data, error } = await sb.rpc('cosme_check_admin_grant_credits', {
        p_user_id: userId,
        p_amount: creditAmount,
        p_note: note ?? null,
        p_admin: admin.email,
      })
      if (error) throw error
      await logAudit({
        adminEmail: admin.email,
        action: 'credits.grant_bonus',
        targetUserId: userId,
        payload: { amount: creditAmount, note: note ?? null },
      })
      return NextResponse.json({ success: true, message: 'Crédits bonus ajoutés', data })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    console.error('Credit action failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Action failed' },
      { status: 500 },
    )
  }
}
