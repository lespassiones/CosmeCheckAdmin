'use client'

import { useState, useEffect } from 'react'
import { Search, Trash2, AlertCircle } from 'lucide-react'

interface UserCredit {
  user_id: string
  email: string
  tier: string
  credit_amount: number
  renewal_period: string
  has_override: boolean
  today_used: number
  today_limit: number
}

const renewalPeriodLabels: Record<string, string> = {
  one_time: '✨ Une seule fois',
  daily: '📅 Par jour',
  weekly: '📆 Par semaine',
  monthly: '📊 Par mois',
  yearly: '📈 Par an',
}

export default function UserCreditsOverride() {
  const [users, setUsers] = useState<UserCredit[]>([])
  const [filtered, setFiltered] = useState<UserCredit[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [overrideForm, setOverrideForm] = useState({
    credit_amount: 100,
    renewal_period: 'monthly' as const,
    note: '',
  })

  const loadUsers = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/credits/users')
      if (!res.ok) throw new Error('Failed to load users')
      const data = await res.json()
      // Map API response to UserCredit format
      const mappedUsers = data.data.map((u: any) => ({
        user_id: u.id,
        email: u.email || u.id,
        tier: u.tier,
        credit_amount: u.creditAmount || 0,
        renewal_period: u.renewalPeriod || 'daily',
        has_override: u.hasOverride || false,
        today_used: 0,
        today_limit: u.creditAmount || 0,
      }))
      setUsers(mappedUsers)
      setFiltered(mappedUsers)
    } catch (err) {
      console.error('Failed to load users:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const handleSearch = (query: string) => {
    setSearch(query)
    setFiltered(
      users.filter(
        (u) =>
          u.email?.toLowerCase().includes(query.toLowerCase()) ||
          u.user_id?.toLowerCase().includes(query.toLowerCase())
      )
    )
  }

  const handleSetOverride = async (userId: string) => {
    try {
      const res = await fetch('/api/credits/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_override',
          userId,
          creditAmount: overrideForm.credit_amount,
          renewalPeriod: overrideForm.renewal_period,
          renewalIntervalDays: null,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Update failed')

      setMessage({ type: 'success', text: 'Override appliqué avec succès' })
      setEditingUser(null)
      loadUsers()
    } catch (err) {
      setMessage({ type: 'error', text: `Erreur: ${err instanceof Error ? err.message : 'Inconnu'}` })
    }
  }

  const handleRemoveOverride = async (userId: string) => {
    try {
      const res = await fetch('/api/credits/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove_override',
          userId,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Update failed')

      setMessage({ type: 'success', text: 'Override supprimé' })
      loadUsers()
    } catch (err) {
      setMessage({ type: 'error', text: `Erreur: ${err instanceof Error ? err.message : 'Inconnu'}` })
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
          <AlertCircle size={20} />
          <p>{message.text}</p>
        </div>
      )}

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 size-5 text-slate-400" />
          <input
            type="text"
            placeholder="Chercher par email ou ID..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Email</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Tier</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Crédits</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Renouvellement</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Aujourd'hui</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Override</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filtered.map((user) => (
              <tr key={user.user_id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <code className="rounded bg-slate-100 px-2 py-1 text-xs">{user.email}</code>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded px-2 py-1 text-xs font-semibold ${
                      user.tier === 'premium'
                        ? 'bg-violet-100 text-violet-900'
                        : 'bg-slate-100 text-slate-900'
                    }`}
                  >
                    {user.tier}
                  </span>
                </td>
                <td className="px-4 py-3 font-bold">{user.credit_amount}</td>
                <td className="px-4 py-3">{renewalPeriodLabels[user.renewal_period]}</td>
                <td className="px-4 py-3">
                  {user.today_used} / {user.today_limit}
                </td>
                <td className="px-4 py-3">
                  {user.has_override ? (
                    <span className="inline-block rounded bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-900">
                      Oui
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">Non</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editingUser === user.user_id ? (
                    <button
                      onClick={() => setEditingUser(null)}
                      className="text-xs text-slate-600 hover:text-slate-900"
                    >
                      Fermer
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingUser(user.user_id)
                        setOverrideForm({
                          credit_amount: user.credit_amount,
                          renewal_period: user.renewal_period as 'one_time' | 'daily' | 'weekly' | 'monthly' | 'yearly',
                          note: '',
                        })
                      }}
                      className="text-xs text-violet-600 hover:text-violet-700"
                    >
                      Modifier
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Form */}
      {editingUser && (
        <article className="glass-card rounded-lg border border-violet-200 bg-violet-50 p-6">
          <h3 className="mb-4 font-semibold">
            Modifier les crédits de {filtered.find((u) => u.user_id === editingUser)?.email}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Crédits</label>
              <input
                type="number"
                value={overrideForm.credit_amount}
                onChange={(e) =>
                  setOverrideForm({ ...overrideForm, credit_amount: parseInt(e.target.value) })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Renouvellement</label>
              <select
                value={overrideForm.renewal_period}
                onChange={(e) =>
                  setOverrideForm({ ...overrideForm, renewal_period: e.target.value })
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

            <div>
              <label className="block text-sm font-medium">Note (optionnel)</label>
              <input
                type="text"
                placeholder="Ex: Bonus client VIP"
                value={overrideForm.note}
                onChange={(e) => setOverrideForm({ ...overrideForm, note: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleSetOverride(editingUser)}
                className="flex-1 rounded-lg bg-violet-600 px-4 py-2 text-white hover:bg-violet-700"
              >
                Appliquer
              </button>
              {filtered.find((u) => u.user_id === editingUser)?.has_override && (
                <button
                  onClick={() => handleRemoveOverride(editingUser)}
                  className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
        </article>
      )}
    </div>
  )
}
