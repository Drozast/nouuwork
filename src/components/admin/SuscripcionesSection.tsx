import React, { useState, useEffect, useCallback } from 'react';
import { auth } from '../../lib/firebase';
import { RefreshCw, Loader2, Crown, Users, DollarSign, Star, X } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

async function apiFetch(path: string) {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

function formatDate(d: any) {
  if (!d) return '-';
  const ts = typeof d === 'object' && d._seconds ? new Date(d._seconds * 1000) : new Date(d);
  if (isNaN(ts.getTime())) return '-';
  return ts.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface Subscription {
  id: string;
  userId?: string;
  tier?: string;
  status?: string;
  currentCredits?: number;
  createdAt?: any;
  expiresAt?: any;
  platform?: string;
}

const TIER_COLORS: Record<string, string> = {
  premium: 'text-amber-400 bg-amber-500/10',
  premium_aiep: 'text-blue-400 bg-blue-500/10',
  free: 'text-gray-400 bg-gray-500/10',
};

const StatusDot: React.FC<{ status?: string }> = ({ status }) => (
  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
    status === 'active' ? 'text-green-400 bg-green-500/10' :
    status === 'expired' ? 'text-red-400 bg-red-500/10' :
    'text-gray-400 bg-gray-500/10'
  }`}>
    <span className={`w-1.5 h-1.5 rounded-full ${status === 'active' ? 'bg-green-400' : status === 'expired' ? 'bg-red-400' : 'bg-gray-400'}`} />
    {status || '-'}
  </span>
);

export const SuscripcionesSection: React.FC = () => {
  const [data, setData] = useState<{ subscriptions: Subscription[]; totalPremium: number; estimatedMonthlyRevenue: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tierFilter, setTierFilter] = useState('all');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ limit: '200' });
    if (tierFilter !== 'all') params.set('status', tierFilter);
    apiFetch(`/api/admin/suscripciones?${params}`)
      .then(d => setData(d))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [tierFilter]);

  useEffect(() => { load(); }, [load]);

  const subs = data?.subscriptions || [];
  const activePremium = subs.filter(s => (s.tier === 'premium' || s.tier === 'premium_aiep') && s.status === 'active').length;
  const aiep = subs.filter(s => s.tier === 'premium_aiep').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Suscripciones Premium</h2>
        <button onClick={load} className="text-gray-400 hover:text-white"><RefreshCw className="w-5 h-5" /></button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-[#222222] border border-gray-800 rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-amber-500/15 flex items-center justify-center">
            <Crown className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{activePremium}</p>
            <p className="text-sm text-gray-400">Premium activos</p>
          </div>
        </div>
        <div className="bg-[#222222] border border-gray-800 rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-blue-500/15 flex items-center justify-center">
            <Star className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{aiep}</p>
            <p className="text-sm text-gray-400">AIEP</p>
          </div>
        </div>
        <div className="bg-[#222222] border border-gray-800 rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-green-500/15 flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">${(activePremium * 7890).toLocaleString()}</p>
            <p className="text-sm text-gray-400">Revenue estimado/mes</p>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="mb-5">
        <select
          value={tierFilter}
          onChange={e => setTierFilter(e.target.value)}
          className="bg-[#222222] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#f83758]"
        >
          <option value="all">Todos los tiers</option>
          <option value="premium">NOUU Premium</option>
          <option value="premium_aiep">Premium AIEP</option>
          <option value="free">Free</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-[#f83758] animate-spin" /></div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">{error}</div>
      ) : (
        <div className="bg-[#222222] border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-gray-500 text-xs uppercase">
                <th className="px-4 py-3 font-medium">Usuario ID</th>
                <th className="px-4 py-3 font-medium">Tier</th>
                <th className="px-4 py-3 font-medium text-center">Estado</th>
                <th className="px-4 py-3 font-medium text-center hidden md:table-cell">Créditos Gold</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">Plataforma</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">Expira</th>
              </tr>
            </thead>
            <tbody>
              {subs.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Sin resultados</td></tr>
              ) : subs.map(s => (
                <tr key={s.id} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                  <td className="px-4 py-3 text-gray-300 font-mono text-xs">{s.userId?.slice(0, 12) || s.id.slice(0, 12)}…</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TIER_COLORS[s.tier || ''] || 'text-gray-400 bg-gray-500/10'}`}>
                      {s.tier === 'premium_aiep' ? 'AIEP' : s.tier || 'free'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center"><StatusDot status={s.status} /></td>
                  <td className="px-4 py-3 text-center hidden md:table-cell">
                    <span className="text-amber-400 font-medium">{s.currentCredits ?? 0}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">{s.platform || '-'}</td>
                  <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">{formatDate(s.expiresAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SuscripcionesSection;
