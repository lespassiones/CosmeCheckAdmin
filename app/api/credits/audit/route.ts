import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Unified credit/admin audit feed for the "Journal d'audit" tab.
 * Reads cosme_check.admin_audit_log (where every admin server action logs via
 * logAudit) filtered to credit + user actions, and resolves target emails.
 * This is what surfaces "les gains que j'ai donnés" (credits.grant_bonus),
 * overrides, tier changes, suspensions, deletions, resets.
 */
export async function GET() {
  try {
    const sb = supabaseAdmin()

    const { data: rows, error } = await sb
      .schema('cosme_check')
      .from('admin_audit_log')
      .select('id, admin_email, action, target_user_id, payload, created_at')
      .or('action.like.credits.%,action.like.user.%')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) throw error

    const log = (rows ?? []) as Array<{
      id: number
      admin_email: string | null
      action: string
      target_user_id: string | null
      payload: Record<string, unknown> | null
      created_at: string
    }>

    // Resolve target emails in one auth listing (cheap at this scale).
    const targetIds = new Set(log.map((r) => r.target_user_id).filter(Boolean) as string[])
    const emailById = new Map<string, string>()
    if (targetIds.size > 0) {
      const { data: authPage } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 })
      for (const u of authPage?.users ?? []) {
        if (targetIds.has(u.id)) emailById.set(u.id, u.email ?? '')
      }
    }

    const audit = log.map((r) => ({
      ...r,
      target_email: r.target_user_id ? emailById.get(r.target_user_id) ?? null : null,
    }))

    return NextResponse.json({ audit })
  } catch (err) {
    console.error('Failed to get audit log:', err)
    return NextResponse.json({ error: 'Failed to fetch audit log' }, { status: 500 })
  }
}
