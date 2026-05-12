import React, { useState, useEffect, useCallback } from 'react';
import { auth } from '../../lib/firebase';
import { RefreshCw, Loader2, Star, Trash2, X, AlertCircle } from 'lucide-react';

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

interface Review {
  id: string;
  reviewerId?: string;
  userId?: string;
  nouuId?: string;
  rating?: number;
  comment?: string;
  createdAt?: any;
  reviewType?: string;
  qualityRating?: number;
  punctualityRating?: number;
  communicationRating?: number;
  deleted?: boolean;
  tags?: string[];
}

const Stars: React.FC<{ rating?: number }> = ({ rating = 0 }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map(i => (
      <Star key={i} className={`w-3.5 h-3.5 ${i <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-600'}`} />
    ))}
    <span className="text-xs text-gray-400 ml-1">{rating?.toFixed(1)}</span>
  </div>
);

const Modal: React.FC<{ onClose: () => void; title: string; children: React.ReactNode }> = ({ onClose, title, children }) => (
  <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
    <div className="bg-[#2a2a2a] border border-gray-700 rounded-xl w-full max-w-md">
      <div className="flex items-center justify-between p-5 border-b border-gray-700">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  </div>
);

export const CalificacionesSection: React.FC = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [avgRating, setAvgRating] = useState<string>('0');
  const [lowRatingFilter, setLowRatingFilter] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ limit: '100' });
    if (lowRatingFilter) params.set('minRating', '3');
    apiFetch(`/api/admin/calificaciones?${params}`)
      .then(d => {
        setReviews(d.reviews || []);
        setAvgRating(d.avgRating || '0');
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [lowRatingFilter]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/admin/calificaciones/${deleteId}`, { method: 'DELETE' });
      setDeleteId(null);
      load();
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setDeleting(false);
    }
  };

  const activeReviews = reviews.filter(r => !r.deleted);
  const lowRatings = activeReviews.filter(r => (r.rating || 0) < 3).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Calificaciones y reseñas</h2>
        <button onClick={load} className="text-gray-400 hover:text-white"><RefreshCw className="w-5 h-5" /></button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-[#222222] border border-gray-800 rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-amber-500/15 flex items-center justify-center">
            <Star className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{avgRating}</p>
            <p className="text-sm text-gray-400">Rating promedio</p>
          </div>
        </div>
        <div className="bg-[#222222] border border-gray-800 rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-[#f83758]/15 flex items-center justify-center">
            <span className="text-[#f83758] font-bold text-lg">{activeReviews.length}</span>
          </div>
          <p className="text-sm text-gray-400">Total reseñas</p>
        </div>
        <div className="bg-[#222222] border border-gray-800 rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-red-500/15 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{lowRatings}</p>
            <p className="text-sm text-gray-400">Bajas (&lt; 3★)</p>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="mb-5 flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={lowRatingFilter} onChange={e => setLowRatingFilter(e.target.checked)}
            className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-[#f83758]" />
          <span className="text-sm text-gray-300">Mostrar solo calificaciones bajas (&lt; 3★)</span>
        </label>
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
                <th className="px-4 py-3 font-medium">Rating</th>
                <th className="px-4 py-3 font-medium">Comentario</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Usuario eval.</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">Tipo</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">Fecha</th>
                <th className="px-4 py-3 font-medium text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {activeReviews.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Sin reseñas</td></tr>
              ) : activeReviews.map(r => (
                <tr key={r.id} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                  <td className="px-4 py-3"><Stars rating={r.rating} /></td>
                  <td className="px-4 py-3 text-gray-300 truncate max-w-[200px]">
                    <span className="text-sm">{r.comment || '-'}</span>
                    {r.tags && r.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {r.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="text-xs bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">{tag}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs hidden md:table-cell">{r.userId?.slice(0, 12) || '-'}…</td>
                  <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">{r.reviewType || '-'}</td>
                  <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{formatDate(r.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setDeleteId(r.id)} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded" title="Eliminar">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <Modal onClose={() => setDeleteId(null)} title="Eliminar reseña">
          <p className="text-sm text-gray-300 mb-6">¿Confirmas que deseas eliminar esta reseña? El usuario no recibirá notificación.</p>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm text-gray-400 bg-gray-800 rounded-lg">Cancelar</button>
            <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg flex items-center gap-2">
              {deleting && <Loader2 className="w-4 h-4 animate-spin" />} Eliminar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default CalificacionesSection;
