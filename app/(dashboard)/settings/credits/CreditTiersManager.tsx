'use client'

import { useState } from 'react'
import { supabaseAdmin } from '@/lib/supabase'
import { AlertCircle, Check } from 'lucide-react'

interface CreditTier {
  tier: string
  credit_amount: number
  renewal_period: 'none' | 'daily' | 'weekly' | 'monthly' | 'custom'
  renewal_interval_days: number | null
}

interface Props {
  tiers: CreditTier[]
  onUpdate: () => void
}

const renewalPeriodLabels: Record<string, string> = {
  none: 'Non renouvelable (usage unique)',
  daily: 'Quotidien',
  weekly: 'Hebdomadaire',
  monthly: 'Mensuel',
  custom: 'Personnalisé',
}

export default function CreditTiersManager({ tiers, onUpdate }: Props) {
  const [editing, setEditing] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [forms, setForms] = useState<Record<string, Partial<CreditTier>>>(
    tiers.reduce((acc, tier) => ({ ...acc, [tier.tier]: tier }), {})
  )

  const handleUpdate = async (tier: string) => {
    if (!forms[tier]?.credit_amount || !forms[tier]?.renewal_period) return

    setLoading(true)
    try {
      const sb = supabaseAdmin()
      const { error } = await sb.rpc('cosme_check_update_credit_tier', {
        p_tier: tier,
        p_credit_amount: forms[tier].credit_amount,
        p_renewal_period: forms[tier].renewal_period,
        p_renewal_interval_days: forms[tier].renewal_interval_days || null,
      })

      if (error) throw error

      setMessage({ type: 'success', text: `Tier ${tier} mis à jour avec succès` })
      setEditing(null)
      onUpdate()
    } catch (err) {
      setMessage({ type: 'error', text: `Erreur: ${err instanceof Error ? err.message : 'Inconnu'}` })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`flex gap-3 rounded-lg p-4 ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-900'
              : 'bg-red-50 text-red-900'
          }`}
        >
          {message.type === 'success' ? <Check size={20} /> : <AlertCircle size={20} />}
          <p>{message.text}</p>
        </div>
      )}

      {tiers.map((tier) => (
        <article key={tier.tier} className="glass-card rounded-lg border border-slate-200 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold capitalize">
              {tier.tier === 'free' ? '👤 Free (Gratuit)' : '⭐ Premium'}
            </h3>
            {editing === tier.tier ? (
              <button
                onClick={() => setEditing(null)}
                className="text-sm text-slate-600 hover:text-slate-900"
              >
                Annuler
              </button>
            ) : (
              <button
                onClick={() => setEditing(tier.tier)}
                className="text-sm text-violet-600 hover:text-violet-700"
              >
                Modifier
              </button>
            )}
          </div>

          {editing === tier.tier ? (
            <div className="space-y-4">
              {/* Credit Amount */}
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Nombre de crédits
                </label>
                <input
                  type="number"
                  value={forms[tier.tier]?.credit_amount || 0}
                  onChange={(e) =>
                    setForms({
                      ...forms,
                      [tier.tier]: { ...forms[tier.tier], credit_amount: parseInt(e.target.value) },
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>

              {/* Renewal Period */}
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Fréquence de renouvellement
                </label>
                <select
                  value={forms[tier.tier]?.renewal_period || 'none'}
                  onChange={(e) =>
                    setForms({
                      ...forms,
                      [tier.tier]: {
                        ...forms[tier.tier],
                        renewal_period: e.target.value as any,
                      },
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                >
                  {Object.entries(renewalPeriodLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom Interval (if custom period) */}
              {forms[tier.tier]?.renewal_period === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Intervalle de renouvellement (en jours)
                  </label>
                  <input
                    type="number"
                    value={forms[tier.tier]?.renewal_interval_days || 30}
                    onChange={(e) =>
                      setForms({
                        ...forms,
                        [tier.tier]: {
                          ...forms[tier.tier],
                          renewal_interval_days: parseInt(e.target.value),
                        },
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              )}

              {/* Save Button */}
              <button
                onClick={() => handleUpdate(tier.tier)}
                disabled={loading}
                className="w-full rounded-lg bg-violet-600 px-4 py-2 text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {loading ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm text-slate-600">Crédits</p>
                <p className="text-2xl font-bold">{tier.credit_amount}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Renouvellement</p>
                <p className="font-medium">{renewalPeriodLabels[tier.renewal_period]}</p>
              </div>
              {tier.renewal_period === 'custom' && (
                <div>
                  <p className="text-sm text-slate-600">Intervalle</p>
                  <p className="font-medium">{tier.renewal_interval_days} jours</p>
                </div>
              )}
            </div>
          )}
        </article>
      ))}
    </div>
  )
}
