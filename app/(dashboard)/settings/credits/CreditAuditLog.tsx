'use client'

import { useState, useEffect } from 'react'
import { supabaseAdmin } from '@/lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

interface AuditLog {
  id: string
  tier: string
  old_credit_amount: number | null
  new_credit_amount: number | null
  old_renewal_period: string | null
  new_renewal_period: string | null
  changed_by_email: string
  changed_at: string
}

const renewalPeriodLabels: Record<string, string> = {
  none: 'Unique',
  daily: 'Quotidien',
  weekly: 'Hebdomadaire',
  monthly: 'Mensuel',
  custom: 'Personnalisé',
}

export default function CreditAuditLog() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadLogs = async () => {
      try {
        const sb = supabaseAdmin()
        const { data, error } = await sb.rpc('cosme_check_admin_get_credit_audit_log', {
          p_limit: 100,
        })
        if (!error && data) {
          setLogs(data)
        }
      } catch (err) {
        console.error('Failed to load audit log:', err)
      } finally {
        setLoading(false)
      }
    }

    loadLogs()
  }, [])

  if (loading) {
    return <div className="text-center text-slate-500">Chargement du journal...</div>
  }

  if (logs.length === 0) {
    return <div className="text-center text-slate-500">Aucune modification enregistrée</div>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-slate-700">Tier</th>
            <th className="px-4 py-3 text-left font-semibold text-slate-700">Crédits</th>
            <th className="px-4 py-3 text-left font-semibold text-slate-700">Renouvellement</th>
            <th className="px-4 py-3 text-left font-semibold text-slate-700">Modifié par</th>
            <th className="px-4 py-3 text-left font-semibold text-slate-700">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {logs.map((log) => (
            <tr key={log.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <span
                  className={`inline-block rounded px-2 py-1 text-xs font-semibold ${
                    log.tier === 'premium'
                      ? 'bg-violet-100 text-violet-900'
                      : 'bg-slate-100 text-slate-900'
                  }`}
                >
                  {log.tier}
                </span>
              </td>
              <td className="px-4 py-3">
                {log.old_credit_amount !== null && log.new_credit_amount !== null ? (
                  <span>
                    <span className="line-through">{log.old_credit_amount}</span>
                    {' → '}
                    <span className="font-bold text-emerald-600">{log.new_credit_amount}</span>
                  </span>
                ) : (
                  '-'
                )}
              </td>
              <td className="px-4 py-3">
                {log.old_renewal_period && log.new_renewal_period ? (
                  <span>
                    <span className="line-through text-xs">
                      {renewalPeriodLabels[log.old_renewal_period]}
                    </span>
                    {' → '}
                    <span className="font-medium text-emerald-600">
                      {renewalPeriodLabels[log.new_renewal_period]}
                    </span>
                  </span>
                ) : (
                  '-'
                )}
              </td>
              <td className="px-4 py-3">
                <code className="rounded bg-slate-100 px-2 py-1 text-xs">
                  {log.changed_by_email || 'Système'}
                </code>
              </td>
              <td className="px-4 py-3 text-xs text-slate-600">
                {formatDistanceToNow(new Date(log.changed_at), {
                  addSuffix: true,
                  locale: fr,
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
