import { PageHeader } from '@/components/PageHeader'
import { supabaseAdmin } from '@/lib/supabase'
import CreditsPageClient from './CreditsPageClient'

export const metadata = { title: 'Gestion des crédits' }
export const dynamic = 'force-dynamic'

interface CreditTier {
  tier: string
  credit_amount: number
  renewal_period: 'one_time' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  renewal_interval_days: number | null
}

async function getTiers(): Promise<CreditTier[]> {
  try {
    const sb = supabaseAdmin()
    const { data, error } = await sb.rpc('cosme_check_admin_get_credit_tiers')
    if (error) throw error
    return data || []
  } catch (err) {
    console.error('Failed to load credit tiers:', err)
    return []
  }
}

export default async function CreditsPage() {
  const initialTiers = await getTiers()

  return (
    <>
      <PageHeader
        title="Gestion des crédits"
        subtitle="Configurer les crédits pour les tiers Free et Premium"
      />

      <CreditsPageClient initialTiers={initialTiers} />
    </>
  )
}
