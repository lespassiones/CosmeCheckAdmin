'use client'

import { useState, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

interface AuditEntry {
  id: number
  admin_email: string | null
  action: string
  target_user_id: string | null
  target_email: string | null
  payload: Record<string, unknown> | null
  created_at: string
}

const ACTION_LABELS: Record<string, { label: string; tone: string }> = {
  'credits.grant_bonus': { label: 'Crédits bonus', tone: 'bg-emerald-100 text-emerald-900' },
  'credits.override_set': { label: 'Override défini', tone: 'bg-violet-100 text-violet-900' },
  'credits.override_clear': { label: 'Override retiré', tone: 'bg-slate-100 text-slate-900' },
  'credits.tier_update': { label: 'Tier modifié', tone: 'bg-amber-100 text-amber-900' },
  'credits.reset_today': { label: 'Compteur reset', tone: 'bg-slate-100 text-slate-900' },
  'user.suspend': { label: 'Compte suspendu', tone: 'bg-red-100 text-red-900' },
  'user.unsuspend': { label: 'Compte réactivé', tone: 'bg-emerald-100 text-emerald-900' },
  'user.delete': { label: 'Compte supprimé', tone: 'bg-red-100 text-red-900' },
  'user.send_password_reset': { label: 'Reset mot de passe', tone: 'bg-slate-100 text-slate-900' },
}

function describe(e: AuditEntry): string {
  const p = e.payload ?? {}
  if (e.action === 'credits.grant_bonus') {
    const amt = p.amount as number | undefined
    return `${amt && amt > 0 ? '+' : ''}${amt ?? '?'} crédits${p.note ? ` — ${p.note}` : ''}`
  }
  if (e.action === 'credits.override_set') {
    return `${p.creditAmount ?? p.amount ?? '?'} crédits · ${p.renewalPeriod ?? p.period ?? '?'}`
  }
  if (e.action === 'credits.tier_update') {
    return `${p.tier ?? '?'} → ${p.creditAmount ?? '?'} · ${p.renewalPeriod ?? '?'}`
  }
  return ''
}

export default function CreditAuditLog() {
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/credits/audit')
        if (!res.ok) throw new Error('Failed to load logs')
        const data = await res.json()
        setLogs(data.audit ?? [])
      } catch (err) {
        console.error('Failed to load audit log:', err)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) return <div className="text-center text-slate-500">Chargement du journal...</div>
  if (logs.length === 0)
    return <div className="text-center text-slate-500">Aucune modification enregistrée</div>

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-slate-700">Action</th>
            <th className="px-4 py-3 text-left font-semibold text-slate-700">Détail</th>
            <th className="px-4 py-3 text-left font-semibold text-slate-700">Utilisateur</th>
            <th className="px-4 py-3 text-left font-semibold text-slate-700">Par</th>
            <th className="px-4 py-3 text-left font-semibold text-slate-700">Quand</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {logs.map((log) => {
            const meta = ACTION_LABELS[log.action] ?? { label: log.action, tone: 'bg-slate-100 text-slate-900' }
            return (
              <tr key={log.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <span className={`inline-block rounded px-2 py-1 text-xs font-semibold ${meta.tone}`}>
                    {meta.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-700">{describe(log) || '—'}</td>
                <td className="px-4 py-3">
                  {log.target_email ? (
                    <code className="rounded bg-slate-100 px-2 py-1 text-xs">{log.target_email}</code>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <code className="rounded bg-slate-100 px-2 py-1 text-xs">
                    {log.admin_email || 'Système'}
                  </code>
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: fr })}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
