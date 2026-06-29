'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { SectionHeader } from '@/components/PageHeader';
import { formatEUR } from '@/lib/utils';
import { TrendingUp, Users } from 'lucide-react';

interface RevenuecatStats {
  totalCustomers: number;
  premiumCustomers: number;
  freeCustomers: number;
  monthlyRecurringRevenue: number;
}

export default function RevenuecatStatsClient() {
  const [stats, setStats] = useState<RevenuecatStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/revenucat/stats');
      if (!res.ok) throw new Error('Failed to load stats');
      const data = await res.json();
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <SectionHeader title="RevenueCat (Abonnements actifs)" />
        <button
          type="button"
          onClick={loadStats}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      {error && (
        <article className="glass-card-rose p-6 mb-8">
          <p className="text-sm text-rose-900">Erreur: {error}</p>
        </article>
      )}

      {loading ? (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="neo-card h-24 animate-pulse" />
          ))}
        </div>
      ) : stats ? (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="MRR RevenueCat"
            value={formatEUR(stats.monthlyRecurringRevenue)}
            hint="revenu mensuel récurrent"
            icon={TrendingUp}
            tone="emerald"
          />
          <StatCard
            label="Users Premium"
            value={stats.premiumCustomers}
            hint="abonnés actifs"
            icon={Users}
            tone="amber"
          />
          <StatCard
            label="Users Gratuits"
            value={stats.freeCustomers}
            hint="utilisateurs free"
            icon={Users}
            tone="violet"
          />
          <StatCard
            label="Total Utilisateurs"
            value={stats.totalCustomers}
            hint="tous les comptes"
            icon={Users}
            tone="neutral"
          />
        </div>
      ) : null}
    </>
  );
}
