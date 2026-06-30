import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Users + their effective credit config for the "Overrides utilisateurs" tab.
 * Emails come from auth.users (the cosme_check.user_profiles table has NO email
 * column — selecting it was the bug that made this tab render empty). Credit
 * figures come from the canonical cosme_check_admin_users_overview() RPC.
 */
export async function GET() {
  try {
    const sb = supabaseAdmin()

    const [{ data: authPage }, { data: profiles }, { data: overview }] = await Promise.all([
      sb.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      sb.schema('cosme_check').from('user_profiles').select('id, first_name, tier'),
      sb.rpc('cosme_check_admin_users_overview'),
    ])

    const emailById = new Map((authPage?.users ?? []).map((u) => [u.id, u.email ?? '']))
    const profById = new Map(
      ((profiles ?? []) as { id: string; first_name: string | null; tier: string | null }[]).map(
        (p) => [p.id, p],
      ),
    )

    type OverviewRow = {
      user_id: string
      tier: string
      has_override: boolean
      credit_amount: number
      renewal_period: string
      used_period: number
      bonus: number
      remaining: number
    }

    const data = ((overview as OverviewRow[] | null) ?? []).map((o) => {
      const p = profById.get(o.user_id)
      return {
        id: o.user_id,
        email: emailById.get(o.user_id) || o.user_id,
        first_name: p?.first_name ?? null,
        tier: o.tier,
        creditAmount: o.credit_amount,
        renewalPeriod: o.renewal_period,
        hasOverride: o.has_override,
        usedPeriod: o.used_period,
        bonus: o.bonus,
        remaining: o.remaining,
      }
    })
    // Newest-ish ordering is irrelevant here; sort by email for stable display.
    data.sort((a, b) => a.email.localeCompare(b.email))

    return NextResponse.json({ data })
  } catch (err) {
    console.error('Failed to get users credit overview:', err)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}
