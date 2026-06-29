import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const sb = supabaseAdmin()

    // Get all user profiles with current credit info
    const { data: users, error } = await sb
      .schema('cosme_check')
      .from('user_profiles')
      .select('id, email, tier, first_name, created_at')
      .order('created_at', { ascending: false })

    if (error) throw error

    // For each user, get their credit config (tier-based or override)
    const usersWithCredits = await Promise.all(
      (users || []).map(async (user) => {
        const { data: config, error: configError } = await sb.rpc(
          'cosme_check_get_credit_config',
          { p_user_id: user.id }
        )
        return {
          ...user,
          creditConfig: config,
          hasOverride: config?.override_by ? true : false,
        }
      })
    )

    return NextResponse.json({ users: usersWithCredits })
  } catch (err) {
    console.error('Failed to get users:', err)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}
