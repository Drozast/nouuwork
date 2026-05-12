import React, { useState, useEffect, useCallback } from 'react';
import { auth } from '../../lib/firebase';
import {
  Search, RefreshCw, Eye, Trash2, Loader2, CheckCircle2, XCircle,
  AlertCircle, EyeOff, MapPin, Clock, Tag, ChevronLeft, ChevronRight, X,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
  });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

function formatDate(d: any) {
  if (!d) return '-';
  const ts = typeof d === 'object' && d._seconds ? new Date(d._seconds * 1000) : new Date(d);
  if (isNaN(ts.getTime())) return '-';
  return ts.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface Nouu {
  id: string;
  title?: string; titulo?: string;
  category?: string; categoria?: string;
  status?: string;
  publisherName?: string;
  location?: string; ubicacion?: string;
  price?: number; precio?: number;
  createdAt?: any;
  description?: string; descripcion?: string;
  imageUrl?: string;
  publisherId?: string;
  isGold?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'text-green-400 bg-green-500/10',
  suspended: 'text-yellow-400 bg-yellow-500/10',
  cancelled: 'text-red-400 bg-red-500/10',
  hidden: 'text-gray-400 bg-gray-500/10',
  open: 'text-green-400 bg-green-500/10',
  closed: 'text-gray-400 bg-gray-500/10',
};

const StatusBadge: React.FC<{ status?: string }> = ({ status }) => (
  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[status || ''] || 'text-gray-400 bg-gray-500/10'}`}>
    {status || 'sin estado'}
  </span>
);

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
  <div className="flex flex-col gap-0.5 mb-3">
    <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
    <span className="text-sm text-gray-200">{value ?? '-'}</span>
  </div>
);

export const NouusSection: React.FC = () => {
  const [nouus, setNouus] = useState<Nouu[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [viewNouu, setViewNouu] = useState<Nouu | null>(null);
  const [moderateNouu, setModerateNouu] = useState<{ nouu: Nouu; action: string } | null>(null);
  const [moderateReason, setModerateReason] = useState('');
  const [moderating, setModerating] = useState(false);

  const PAGE_SIZE = 25;

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (search) params.set('search', search);
    apiFetch(`/api/admin/nouus?${params}`)
      .then(d => setNouus(d.nouus || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [page, statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  const handleModerate = async () => {
    if (!moderateNouu) return;
    setModerating(true);
    try {
      if (moderateNouu.action === 'delete') {
        await apiFetch(`/api/admin/nouus/${moderateNouu.nouu.id}`, {
          method: 'DELETE',
          body: JSON.stringify({ reason: moderateReason }),
        });
      } else {
        await apiFetch(`/api/admin/nouus/${moderateNouu.nouu.id}/status`, {
          method: 'PUT',
          body: JSON.stringify({ status: moderateNouu.action, reason: moderateReason }),
        });
      }
      setModerateNouu(null);
      setModerateReason('');
      load();
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setModerating(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Nouus (informales)</h2>
        <button onClick={load} className="text-gray-400 hover:text-white"><RefreshCw className="w-5 h-5" /></button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Buscar por título, categoría, publicador..."
            className="w-full bg-[#222222] border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#f83758]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
          className="bg-[#222222] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#f83758]"
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="open">Abiertos</option>
          <option value="suspended">Suspendidos</option>
          <option value="cancelled">Cancelados</option>
          <option value="hidden">Ocultos</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-[#f83758] animate-spin" /></div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">{error}</div>
      ) : (
        <>
          <div className="bg-[#222222] border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left text-gray-500 text-xs uppercase">
                  <th className="px-4 py-3 font-medium">Título</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Categoría</th>
                  <th className="px-4 py-3 font-medium hidden lg:table-cell">Publicador</th>
                  <th className="px-4 py-3 font-medium hidden lg:table-cell">Fecha</th>
                  <th className="px-4 py-3 font-medium text-center">Estado</th>
                  <th className="px-4 py-3 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {nouus.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Sin resultados</td></tr>
                ) : nouus.map(n => (
                  <tr key={n.id} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {n.isGold && <span className="text-xs bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded font-medium">GOLD</span>}
                        <span className="text-white font-medium truncate max-w-[200px]">{n.title || n.titulo || '(sin título)'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400 hidden md:table-cell">
                      <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{n.category || n.categoria || '-'}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">{n.publisherName || '-'}</td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{formatDate(n.createdAt)}</td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={n.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setViewNouu(n)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded" title="Ver">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => { setModerateNouu({ nouu: n, action: 'active' }); setModerateReason(''); }} className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-gray-700 rounded" title="Activar">
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => { setModerateNouu({ nouu: n, action: 'suspended' }); setModerateReason(''); }} className="p-1.5 text-gray-400 hover:text-yellow-400 hover:bg-gray-700 rounded" title="Suspender">
                          <AlertCircle className="w-4 h-4" />
                        </button>
                        <button onClick={() => { setModerateNouu({ nouu: n, action: 'hidden' }); setModerateReason(''); }} className="p-1.5 text-gray-400 hover:text-gray-300 hover:bg-gray-700 rounded" title="Ocultar">
                          <EyeOff className="w-4 h-4" />
                        </button>
                        <button onClick={() => { setModerateNouu({ nouu: n, action: 'delete' }); setModerateReason(''); }} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded" title="Eliminar">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
            <span>{nouus.length} Nouus</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-1.5 rounded hover:bg-gray-800 disabled:opacity-30">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 py-1">Página {page + 1}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={nouus.length < PAGE_SIZE} className="p-1.5 rounded hover:bg-gray-800 disabled:opacity-30">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* View Modal */}
      {viewNouu && (
        <Modal onClose={() => setViewNouu(null)} title="Detalle de Nouu">
          <Detail label="Título" value={viewNouu.title || viewNouu.titulo} />
          <Detail label="Categoría" value={viewNouu.category || viewNouu.categoria} />
          <Detail label="Estado" value={viewNouu.status} />
          <Detail label="Publicador" value={viewNouu.publisherName} />
          <Detail label="Ubicación" value={viewNouu.location || viewNouu.ubicacion} />
          <Detail label="Precio" value={viewNouu.price || viewNouu.precio ? `$${(viewNouu.price || viewNouu.precio || 0).toLocaleString()} CLP` : undefined} />
          <Detail label="Creado" value={formatDate(viewNouu.createdAt)} />
          <Detail label="Descripción" value={viewNouu.description || viewNouu.descripcion} />
          <Detail label="Gold" value={viewNouu.isGold ? 'Sí' : 'No'} />
          <Detail label="ID" value={viewNouu.id} />
        </Modal>
      )}

      {/* Moderate Modal */}
      {moderateNouu && (
        <Modal onClose={() => setModerateNouu(null)} title={`${moderateNouu.action === 'delete' ? 'Eliminar' : moderateNouu.action === 'active' ? 'Activar' : moderateNouu.action === 'suspended' ? 'Suspender' : 'Ocultar'} Nouu`}>
          <p className="text-sm text-gray-300 mb-4">
            Nouu: <strong className="text-white">{moderateNouu.nouu.title || moderateNouu.nouu.titulo}</strong>
          </p>
          <div className="mb-4">
            <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Razón {moderateNouu.action !== 'active' && '(opcional)'}</label>
            <textarea
              value={moderateReason}
              onChange={e => setModerateReason(e.target.value)}
              rows={3}
              className="w-full bg-[#1f1f1f] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#f83758] resize-none"
              placeholder="Motivo de la acción..."
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setModerateNouu(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white bg-gray-800 rounded-lg transition-colors">Cancelar</button>
            <button
              onClick={handleModerate}
              disabled={moderating}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                moderateNouu.action === 'delete' ? 'bg-red-600 hover:bg-red-500 text-white' :
                moderateNouu.action === 'active' ? 'bg-green-600 hover:bg-green-500 text-white' :
                'bg-yellow-600 hover:bg-yellow-500 text-white'
              }`}
            >
              {moderating && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirmar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default NouusSection;
