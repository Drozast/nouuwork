import React, { useState, useEffect, useCallback } from 'react';
import { auth } from '../../lib/firebase';
import { RefreshCw, Loader2, Bot, X, Clock, CheckCircle2, Users } from 'lucide-react';

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

interface MariaNouus {
  id: string;
  title?: string; titulo?: string;
  description?: string; descripcion?: string;
  category?: string; categoria?: string;
  status?: string;
  phoneNumber?: string;
  location?: string;
  createdAt?: any;
  expiresAt?: any;
  applicationCount?: number;
}

interface MariaApplication {
  id: string;
  mariaNouuId?: string;
  applicantName?: string;
  applicantPhone?: string;
  message?: string;
  status?: string;
  createdAt?: any;
  notified?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'text-green-400 bg-green-500/10',
  resolved: 'text-gray-400 bg-gray-500/10',
  expired: 'text-red-400 bg-red-500/10',
  pending: 'text-yellow-400 bg-yellow-500/10',
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

type ActiveTab = 'nouus' | 'applications';

export const MariaSection: React.FC = () => {
  const [tab, setTab] = useState<ActiveTab>('nouus');
  const [mariaNouus, setMariaNouus] = useState<MariaNouus[]>([]);
  const [applications, setApplications] = useState<MariaApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewItem, setViewItem] = useState<MariaNouus | null>(null);
  const [actionId, setActionId] = useState<{ id: string; action: string } | null>(null);
  const [extendDate, setExtendDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    const q = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
    apiFetch(`/api/admin/maria-nouus${q}`)
      .then(d => {
        setMariaNouus(d.mariaNouus || []);
        setApplications(d.applications || []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async () => {
    if (!actionId) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/admin/maria-nouus/${actionId.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          action: actionId.action,
          ...(actionId.action === 'extend' && extendDate ? { expiresAt: extendDate } : {}),
        }),
      });
      setActionId(null);
      setExtendDate('');
      load();
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const activeCount = mariaNouus.filter(m => m.status === 'active').length;
  const totalApps = applications.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#f83758]/15 flex items-center justify-center">
            <Bot className="w-5 h-5 text-[#f83758]" />
          </div>
          <h2 className="text-xl font-bold text-white">MarIA Nouus</h2>
        </div>
        <button onClick={load} className="text-gray-400 hover:text-white"><RefreshCw className="w-5 h-5" /></button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-[#222222] border border-gray-800 rounded-xl p-4 flex items-center gap-3">
          <Bot className="w-8 h-8 text-[#f83758]" />
          <div><p className="text-xl font-bold text-white">{activeCount}</p><p className="text-sm text-gray-400">Activos</p></div>
        </div>
        <div className="bg-[#222222] border border-gray-800 rounded-xl p-4 flex items-center gap-3">
          <Users className="w-8 h-8 text-blue-400" />
          <div><p className="text-xl font-bold text-white">{totalApps}</p><p className="text-sm text-gray-400">Postulaciones</p></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {[{ key: 'nouus' as ActiveTab, label: 'MarIA Nouus' }, { key: 'applications' as ActiveTab, label: 'Postulaciones' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === t.key ? 'bg-[#f83758]/15 text-[#f83758]' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
        {tab === 'nouus' && (
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="ml-auto bg-[#222222] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#f83758]">
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="resolved">Resueltos</option>
            <option value="expired">Expirados</option>
          </select>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-[#f83758] animate-spin" /></div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">{error}</div>
      ) : tab === 'nouus' ? (
        <div className="bg-[#222222] border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-gray-500 text-xs uppercase">
                <th className="px-4 py-3 font-medium">Título</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Categoría</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">Expira</th>
                <th className="px-4 py-3 font-medium text-center">Estado</th>
                <th className="px-4 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {mariaNouus.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Sin MarIA Nouus</td></tr>
              ) : mariaNouus.map(m => (
                <tr key={m.id} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-white truncate max-w-[200px]">{m.title || m.titulo || '(sin título)'}</p>
                    {m.applicationCount ? <p className="text-xs text-gray-500">{m.applicationCount} postulaciones</p> : null}
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{m.category || m.categoria || '-'}</td>
                  <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">{formatDate(m.expiresAt)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[m.status || ''] || 'text-gray-400 bg-gray-500/10'}`}>{m.status || '-'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setViewItem(m)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded text-xs">Ver</button>
                      <button onClick={() => setActionId({ id: m.id, action: 'activate' })} className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-gray-700 rounded" title="Activar">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setActionId({ id: m.id, action: 'extend' })} className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-700 rounded" title="Extender">
                        <Clock className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setActionId({ id: m.id, action: 'resolve' })} className="p-1.5 text-gray-400 hover:text-gray-300 hover:bg-gray-700 rounded text-xs">Resolver</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-[#222222] border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-gray-500 text-xs uppercase">
                <th className="px-4 py-3 font-medium">Postulante</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">MarIA Nouu ID</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">Mensaje</th>
                <th className="px-4 py-3 font-medium text-center">Estado</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {applications.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Sin postulaciones</td></tr>
              ) : applications.map(a => (
                <tr key={a.id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="px-4 py-3">
                    <p className="text-white">{a.applicantName || '-'}</p>
                    {a.applicantPhone && <p className="text-xs text-gray-500">{a.applicantPhone}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs hidden md:table-cell">{a.mariaNouuId?.slice(0, 12) || '-'}…</td>
                  <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell truncate max-w-[160px]">{a.message || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[a.status || ''] || 'text-gray-400 bg-gray-500/10'}`}>{a.status || '-'}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">{formatDate(a.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* View Modal */}
      {viewItem && (
        <Modal onClose={() => setViewItem(null)} title="Detalle MarIA Nouu">
          <div className="space-y-3">
            <div><span className="text-xs text-gray-500 block mb-0.5">Título</span><p className="text-white">{viewItem.title || viewItem.titulo || '-'}</p></div>
            <div><span className="text-xs text-gray-500 block mb-0.5">Descripción</span><p className="text-sm text-gray-300">{viewItem.description || viewItem.descripcion || '-'}</p></div>
            <div><span className="text-xs text-gray-500 block mb-0.5">Categoría</span><p className="text-sm text-gray-300">{viewItem.category || viewItem.categoria || '-'}</p></div>
            <div><span className="text-xs text-gray-500 block mb-0.5">Teléfono</span><p className="text-sm text-gray-300">{viewItem.phoneNumber || '-'}</p></div>
            <div><span className="text-xs text-gray-500 block mb-0.5">Ubicación</span><p className="text-sm text-gray-300">{viewItem.location || '-'}</p></div>
            <div><span className="text-xs text-gray-500 block mb-0.5">Estado</span><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[viewItem.status || ''] || 'text-gray-400 bg-gray-500/10'}`}>{viewItem.status || '-'}</span></div>
            <div><span className="text-xs text-gray-500 block mb-0.5">Creado</span><p className="text-sm text-gray-300">{formatDate(viewItem.createdAt)}</p></div>
            <div><span className="text-xs text-gray-500 block mb-0.5">Expira</span><p className="text-sm text-gray-300">{formatDate(viewItem.expiresAt)}</p></div>
          </div>
        </Modal>
      )}

      {/* Action Modal */}
      {actionId && (
        <Modal onClose={() => { setActionId(null); setExtendDate(''); }} title={actionId.action === 'resolve' ? 'Resolver MarIA Nouu' : actionId.action === 'extend' ? 'Extender vigencia' : 'Activar MarIA Nouu'}>
          {actionId.action === 'extend' && (
            <div className="mb-4">
              <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Nueva fecha de expiración</label>
              <input type="date" value={extendDate} onChange={e => setExtendDate(e.target.value)}
                className="w-full bg-[#1f1f1f] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#f83758]" />
            </div>
          )}
          {actionId.action !== 'extend' && (
            <p className="text-sm text-gray-300 mb-4">
              {actionId.action === 'resolve' ? '¿Marcar este MarIA Nouu como resuelto?' : '¿Activar este MarIA Nouu?'}
            </p>
          )}
          <div className="flex gap-3 justify-end">
            <button onClick={() => { setActionId(null); setExtendDate(''); }} className="px-4 py-2 text-sm text-gray-400 bg-gray-800 rounded-lg">Cancelar</button>
            <button onClick={handleAction} disabled={submitting || (actionId.action === 'extend' && !extendDate)}
              className="px-4 py-2 text-sm font-medium bg-[#f83758] hover:bg-[#e02d4c] text-white rounded-lg flex items-center gap-2">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />} Confirmar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default MariaSection;
