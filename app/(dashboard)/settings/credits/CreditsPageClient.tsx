'use client'

import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import CreditTiersManager from './CreditTiersManager'
import UserCreditsOverride from './UserCreditsOverride'
import CreditAuditLog from './CreditAuditLog'

interface CreditTier {
  tier: string
  credit_amount: number
  renewal_period: 'one_time' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  renewal_interval_days: number | null
}

interface Props {
  initialTiers: CreditTier[]
}

export default function CreditsPageClient({ initialTiers }: Props) {
  const [tiers, setTiers] = useState<CreditTier[]>(initialTiers)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'tiers' | 'users' | 'audit'>('tiers')

  const loadTiers = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/credits/tiers')
      if (!res.ok) throw new Error('Failed to load tiers')
      const data = await res.json()
      setTiers(data.data)
    } catch (err) {
      console.error('Failed to load credit tiers:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="mb-6 flex items-center gap-2">
        <button
          onClick={loadTiers}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
        >
          <RefreshCw size={16} />
          Actualiser
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('tiers')}
          className={`px-4 py-3 text-sm font-medium ${
            activeTab === 'tiers'
              ? 'border-b-2 border-violet-600 text-violet-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Tiers (Free/Premium)
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-3 text-sm font-medium ${
            activeTab === 'users'
              ? 'border-b-2 border-violet-600 text-violet-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Overrides utilisateurs
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-3 text-sm font-medium ${
            activeTab === 'audit'
              ? 'border-b-2 border-violet-600 text-violet-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Journal d'audit
        </button>
      </div>

      {/* Content */}
      <div className="space-y-6">
        {activeTab === 'tiers' && (
          <CreditTiersManager tiers={tiers} onUpdate={loadTiers} />
        )}
        {activeTab === 'users' && <UserCreditsOverride />}
        {activeTab === 'audit' && <CreditAuditLog />}
      </div>
    </>
  )
}
