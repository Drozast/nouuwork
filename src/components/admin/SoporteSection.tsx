import React, { useState, useEffect, useCallback } from 'react';
import { auth } from '../../lib/firebase';
import { RefreshCw, Loader2, MessageSquare, X, Send, ChevronLeft, ChevronRight } from 'lucide-react';

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
  return ts.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

interface Ticket {
  id: string;
  subject?: string;
  message?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  status?: string;
  category?: string;
  priority?: string;
  createdAt?: any;
  adminResponse?: string;
  respondedAt?: any;
}

const STATUS_COLORS: Record<string, string> = {
  open: 'text-yellow-400 bg-yellow-500/10',
  in_progress: 'text-blue-400 bg-blue-500/10',
  resolved: 'text-green-400 bg-green-500/10',
  closed: 'text-gray-400 bg-gray-500/10',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-gray-400',
  medium: 'text-yellow-400',
  high: 'text-orange-400',
  urgent: 'text-red-400',
};

const Modal: React.FC<{ onClose: () => void; title: string; children: React.ReactNode }> = ({ onClose, title, children }) => (
  <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
    <div className="bg-[#2a2a2a] border border-gray-700 rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between p-5 border-b border-gray-700">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  </div>
);

export const SoporteSection: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('open');
  const [page, setPage] = useState(0);
  const [viewTicket, setViewTicket] = useState<Ticket | null>(null);
  const [response, setResponse] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const PAGE_SIZE = 25;

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (statusFilter !== 'all') params.set('status', statusFilter);
    apiFetch(`/api/admin/soporte?${params}`)
      .then(d => setTickets(d.tickets || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [statusFilter, page]);

  useEffect(() => { load(); }, [load]);

  const openTicket = (t: Ticket) => {
    setViewTicket(t);
    setResponse(t.adminResponse || '');
    setNewStatus(t.status || 'open');
  };

  const handleRespond = async () => {
    if (!viewTicket) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/admin/soporte/${viewTicket.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus, response: response || undefined }),
      });
      setViewTicket(null);
      load();
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Soporte / Tickets</h2>
        <button onClick={load} className="text-gray-400 hover:text-white"><RefreshCw className="w-5 h-5" /></button>
      </div>

      {/* Filter */}
      <div className="mb-5">
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
          className="bg-[#222222] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#f83758]">
          <option value="open">Abiertos</option>
          <option value="in_progress">En progreso</option>
          <option value="resolved">Resueltos</option>
          <option value="closed">Cerrados</option>
          <option value="all">Todos</option>
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
                  <th className="px-4 py-3 font-medium">Asunto</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Usuario</th>
                  <th className="px-4 py-3 font-medium hidden lg:table-cell">Categoría</th>
                  <th className="px-4 py-3 font-medium hidden lg:table-cell">Prioridad</th>
                  <th className="px-4 py-3 font-medium text-center">Estado</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Fecha</th>
                  <th className="px-4 py-3 font-medium text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {tickets.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Sin tickets</td></tr>
                ) : tickets.map(t => (
                  <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/20 cursor-pointer transition-colors" onClick={() => openTicket(t)}>
                    <td className="px-4 py-3">
                      <p className="text-white font-medium truncate max-w-[200px]">{t.subject || '(sin asunto)'}</p>
                      {t.adminResponse && <span className="text-xs text-green-400">Respondido</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell">{t.userName || t.userEmail || t.userId?.slice(0, 10) || '-'}</td>
                    <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">{t.category || '-'}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className={`text-xs font-medium ${PRIORITY_COLORS[t.priority || ''] || 'text-gray-400'}`}>{t.priority || '-'}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[t.status || ''] || 'text-gray-400 bg-gray-500/10'}`}>
                        {t.status || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">{formatDate(t.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <button className="text-[#f83758] hover:underline text-xs font-medium">Responder</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
            <span>{tickets.length} tickets</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-1.5 rounded hover:bg-gray-800 disabled:opacity-30">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 py-1">Página {page + 1}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={tickets.length < PAGE_SIZE} className="p-1.5 rounded hover:bg-gray-800 disabled:opacity-30">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* View/Respond Modal */}
      {viewTicket && (
        <Modal onClose={() => setViewTicket(null)} title="Ticket de soporte">
          <div className="space-y-3 mb-5">
            <div>
              <span className="text-xs text-gray-500 block mb-0.5">Asunto</span>
              <p className="text-white font-medium">{viewTicket.subject || '-'}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 block mb-0.5">Mensaje</span>
              <p className="text-sm text-gray-300 bg-gray-800 rounded-lg p-3 whitespace-pre-wrap">{viewTicket.message || '-'}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-xs text-gray-500 block mb-0.5">Usuario</span><p className="text-sm text-gray-300">{viewTicket.userName || viewTicket.userEmail || '-'}</p></div>
              <div><span className="text-xs text-gray-500 block mb-0.5">Categoría</span><p className="text-sm text-gray-300">{viewTicket.category || '-'}</p></div>
              <div><span className="text-xs text-gray-500 block mb-0.5">Prioridad</span><p className={`text-sm font-medium ${PRIORITY_COLORS[viewTicket.priority || ''] || 'text-gray-400'}`}>{viewTicket.priority || '-'}</p></div>
              <div><span className="text-xs text-gray-500 block mb-0.5">Fecha</span><p className="text-sm text-gray-300">{formatDate(viewTicket.createdAt)}</p></div>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-4 space-y-3">
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Cambiar estado</label>
              <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
                className="w-full bg-[#1f1f1f] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#f83758]">
                <option value="open">Abierto</option>
                <option value="in_progress">En progreso</option>
                <option value="resolved">Resuelto</option>
                <option value="closed">Cerrado</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Respuesta al usuario</label>
              <textarea value={response} onChange={e => setResponse(e.target.value)} rows={4}
                className="w-full bg-[#1f1f1f] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#f83758] resize-none"
                placeholder="Escribe tu respuesta..." />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setViewTicket(null)} className="px-4 py-2 text-sm text-gray-400 bg-gray-800 rounded-lg">Cancelar</button>
              <button onClick={handleRespond} disabled={submitting}
                className="px-4 py-2 text-sm font-medium bg-[#f83758] hover:bg-[#e02d4c] text-white rounded-lg flex items-center gap-2">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Guardar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default SoporteSection;
