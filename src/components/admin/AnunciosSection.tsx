import React, { useState, useEffect, useCallback } from 'react';
import { auth } from '../../lib/firebase';
import { RefreshCw, Loader2, CheckCircle2, XCircle, Eye, X, DollarSign, Calendar } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
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

interface Anuncio {
  id: string;
  title?: string;
  advertiserName?: string;
  imageUrl?: string;
  linkUrl?: string;
  status?: string;
  type?: string;
  amount?: number;
  startDate?: any;
  endDate?: any;
  createdAt?: any;
  targetScreen?: string;
  userId?: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-yellow-400 bg-yellow-500/10',
  active: 'text-green-400 bg-green-500/10',
  rejected: 'text-red-400 bg-red-500/10',
  expired: 'text-gray-400 bg-gray-500/10',
  paused: 'text-orange-400 bg-orange-500/10',
};

const Modal: React.FC<{ onClose: () => void; title: string; children: React.ReactNode }> = ({ onClose, title, children }) => (
  <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
    <div className="bg-[#2a2a2a] border border-gray-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between p-5 border-b border-gray-700">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  </div>
);

const Detail: React.FC<{ label: string; value?: any }> = ({ label, value }) => (
  <div className="mb-3">
    <span className="text-xs text-gray-500 uppercase tracking-wide block mb-0.5">{label}</span>
    <span className="text-sm text-gray-200">{value ?? '-'}</span>
  </div>
);

export const AnunciosSection: React.FC = () => {
  const [anuncios, setAnuncios] = useState<Anuncio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewAd, setViewAd] = useState<Anuncio | null>(null);
  const [moderating, setModerating] = useState<string | null>(null);
  const [modAction, setModAction] = useState<{ id: string; status: string; reason?: string } | null>(null);
  const [modReason, setModReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    const q = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
    apiFetch(`/api/admin/anuncios${q}`)
      .then(d => setAnuncios(d.anuncios || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleModerate = async () => {
    if (!modAction) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/admin/anuncios/${modAction.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: modAction.status, reason: modReason }),
      });
      setModAction(null);
      setModReason('');
      load();
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const pending = anuncios.filter(a => a.status === 'pending').length;
  const active = anuncios.filter(a => a.status === 'active').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Anuncios autogestionados</h2>
        <button onClick={load} className="text-gray-400 hover:text-white"><RefreshCw className="w-5 h-5" /></button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-[#222222] border border-gray-800 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-yellow-500/15 flex items-center justify-center"><span className="text-yellow-400 font-bold">{pending}</span></div>
          <span className="text-sm text-gray-400">Pendientes</span>
        </div>
        <div className="bg-[#222222] border border-gray-800 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-500/15 flex items-center justify-center"><span className="text-green-400 font-bold">{active}</span></div>
          <span className="text-sm text-gray-400">Activos</span>
        </div>
      </div>

      {/* Filter */}
      <div className="mb-5">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="bg-[#222222] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#f83758]">
          <option value="all">Todos</option>
          <option value="pending">Pendientes</option>
          <option value="active">Activos</option>
          <option value="rejected">Rechazados</option>
          <option value="expired">Expirados</option>
          <option value="paused">Pausados</option>
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
                <th className="px-4 py-3 font-medium">Título / Anunciante</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Tipo</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">Monto</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">Período</th>
                <th className="px-4 py-3 font-medium text-center">Estado</th>
                <th className="px-4 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {anuncios.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Sin anuncios</td></tr>
              ) : anuncios.map(a => (
                <tr key={a.id} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-white font-medium truncate max-w-[180px]">{a.title || '(sin título)'}</p>
                    <p className="text-xs text-gray-500">{a.advertiserName || a.userId?.slice(0, 10) || '-'}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{a.type || '-'}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {a.amount ? <span className="text-green-400 font-medium">${a.amount.toLocaleString()}</span> : <span className="text-gray-500">-</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">
                    {formatDate(a.startDate)} → {formatDate(a.endDate)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[a.status || ''] || 'text-gray-400 bg-gray-500/10'}`}>
                      {a.status || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setViewAd(a)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded" title="Ver">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setModAction({ id: a.id, status: 'active' }); setModReason(''); }}
                        className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-gray-700 rounded" title="Aprobar">
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setModAction({ id: a.id, status: 'rejected' }); setModReason(''); }}
                        className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded" title="Rechazar">
                        <XCircle className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setModAction({ id: a.id, status: 'paused' }); setModReason(''); }}
                        className="p-1.5 text-gray-400 hover:text-orange-400 hover:bg-gray-700 rounded" title="Pausar">
                        <span className="text-xs font-bold">II</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* View Modal */}
      {viewAd && (
        <Modal onClose={() => setViewAd(null)} title="Detalle del anuncio">
          <Detail label="Título" value={viewAd.title} />
          <Detail label="Anunciante" value={viewAd.advertiserName} />
          <Detail label="Tipo" value={viewAd.type} />
          <Detail label="Estado" value={viewAd.status} />
          <Detail label="Pantalla destino" value={viewAd.targetScreen} />
          <Detail label="Monto" value={viewAd.amount ? `$${viewAd.amount.toLocaleString()} CLP` : undefined} />
          <Detail label="Inicio" value={formatDate(viewAd.startDate)} />
          <Detail label="Fin" value={formatDate(viewAd.endDate)} />
          <Detail label="Creado" value={formatDate(viewAd.createdAt)} />
          {viewAd.imageUrl && (
            <div className="mt-3">
              <span className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Imagen</span>
              <img src={viewAd.imageUrl} alt="ad" className="w-full h-32 object-cover rounded-lg" />
            </div>
          )}
          {viewAd.linkUrl && (
            <a href={viewAd.linkUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-[#f83758] hover:underline block mt-2">
              Ver enlace externo →
            </a>
          )}
        </Modal>
      )}

      {/* Moderate Modal */}
      {modAction && (
        <Modal onClose={() => setModAction(null)} title={`${modAction.status === 'active' ? 'Aprobar' : modAction.status === 'rejected' ? 'Rechazar' : 'Pausar'} anuncio`}>
          <div className="mb-4">
            <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Motivo (opcional)</label>
            <textarea value={modReason} onChange={e => setModReason(e.target.value)} rows={3}
              className="w-full bg-[#1f1f1f] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#f83758] resize-none"
              placeholder="Razón de la acción..." />
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setModAction(null)} className="px-4 py-2 text-sm text-gray-400 bg-gray-800 rounded-lg">Cancelar</button>
            <button onClick={handleModerate} disabled={submitting}
              className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 ${
                modAction.status === 'active' ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-red-600 hover:bg-red-500 text-white'
              }`}>
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />} Confirmar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AnunciosSection;
