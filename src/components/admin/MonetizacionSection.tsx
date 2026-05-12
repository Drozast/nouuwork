import React, { useState, useEffect, useCallback } from 'react';
import { auth } from '../../lib/firebase';
import { RefreshCw, Loader2, DollarSign, TrendingUp, CreditCard, Zap } from 'lucide-react';

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

function formatCLP(n: number) {
  return `$${Math.round(n).toLocaleString('es-CL')}`;
}

interface Transaction {
  id: string;
  userId?: string;
  type?: string;
  amount?: number;
  status?: string;
  platform?: string;
  createdAt?: any;
  description?: string;
  nouuId?: string;
}

const TYPE_COLORS: Record<string, string> = {
  subscription: 'text-amber-400 bg-amber-500/10',
  goldPurchase: 'text-yellow-400 bg-yellow-500/10',
  creditUsage: 'text-blue-400 bg-blue-500/10',
  advertisement: 'text-green-400 bg-green-500/10',
  refund: 'text-red-400 bg-red-500/10',
};

const TYPE_LABELS: Record<string, string> = {
  subscription: 'Suscripción',
  goldPurchase: 'Nouu Gold',
  creditUsage: 'Crédito Gold',
  advertisement: 'Anuncio',
  refund: 'Reembolso',
};

export const MonetizacionSection: React.FC = () => {
  const [data, setData] = useState<{ transactions: Transaction[]; totalRevenue: number; byType: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    const q = typeFilter !== 'all' ? `?type=${typeFilter}` : '';
    apiFetch(`/api/admin/transacciones${q}`)
      .then(d => setData(d))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [typeFilter]);

  useEffect(() => { load(); }, [load]);

  const transactions = data?.transactions || [];
  const approved = transactions.filter(t => t.status === 'approved' || t.status === 'completed');
  const byType = data?.byType || {};

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Monetización / Transacciones</h2>
        <button onClick={load} className="text-gray-400 hover:text-white"><RefreshCw className="w-5 h-5" /></button>
      </div>

      {/* Revenue Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#222222] border border-gray-800 rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-green-500/15 flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <p className="text-xl font-bold text-white">{data ? formatCLP(data.totalRevenue) : '-'}</p>
            <p className="text-sm text-gray-400">Revenue total</p>
          </div>
        </div>
        <div className="bg-[#222222] border border-gray-800 rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-amber-500/15 flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <p className="text-xl font-bold text-white">{formatCLP(byType.subscription || 0)}</p>
            <p className="text-sm text-gray-400">Suscripciones</p>
          </div>
        </div>
        <div className="bg-[#222222] border border-gray-800 rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-yellow-500/15 flex items-center justify-center">
            <Zap className="w-6 h-6 text-yellow-400" />
          </div>
          <div>
            <p className="text-xl font-bold text-white">{formatCLP(byType.goldPurchase || 0)}</p>
            <p className="text-sm text-gray-400">Nouu Gold</p>
          </div>
        </div>
        <div className="bg-[#222222] border border-gray-800 rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-blue-500/15 flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <p className="text-xl font-bold text-white">{formatCLP(byType.advertisement || 0)}</p>
            <p className="text-sm text-gray-400">Anuncios</p>
          </div>
        </div>
      </div>

      {/* Revenue by Type */}
      {data && Object.keys(byType).length > 0 && (
        <div className="bg-[#222222] border border-gray-800 rounded-xl p-5 mb-6">
          <h3 className="text-sm font-semibold text-white mb-4">Distribución de revenue</h3>
          <div className="space-y-3">
            {Object.entries(byType).map(([type, amount]) => {
              const total = data.totalRevenue || 1;
              const pct = Math.round((amount / total) * 100);
              return (
                <div key={type}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[type] || 'text-gray-400 bg-gray-500/10'}`}>
                      {TYPE_LABELS[type] || type}
                    </span>
                    <span className="text-sm text-white font-medium">{formatCLP(amount)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-[#f83758] rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="mb-5">
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="bg-[#222222] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#f83758]">
          <option value="all">Todos los tipos</option>
          <option value="subscription">Suscripciones</option>
          <option value="goldPurchase">Nouu Gold</option>
          <option value="creditUsage">Uso de créditos</option>
          <option value="advertisement">Anuncios</option>
          <option value="refund">Reembolsos</option>
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
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Monto</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Usuario</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">Plataforma</th>
                <th className="px-4 py-3 font-medium text-center">Estado</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Sin transacciones</td></tr>
              ) : transactions.map(t => (
                <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[t.type || ''] || 'text-gray-400 bg-gray-500/10'}`}>
                      {TYPE_LABELS[t.type || ''] || t.type || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-medium ${(t.amount || 0) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCLP(t.amount || 0)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs hidden md:table-cell">{t.userId?.slice(0, 12) || '-'}…</td>
                  <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">{t.platform || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      t.status === 'approved' || t.status === 'completed' ? 'text-green-400 bg-green-500/10' :
                      t.status === 'pending' ? 'text-yellow-400 bg-yellow-500/10' :
                      'text-red-400 bg-red-500/10'
                    }`}>
                      {t.status || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{formatDate(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default MonetizacionSection;
