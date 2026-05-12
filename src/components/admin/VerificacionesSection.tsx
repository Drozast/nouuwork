import React, { useState, useEffect, useCallback } from 'react';
import { auth } from '../../lib/firebase';
import { RefreshCw, Loader2, CheckCircle2, XCircle, X, Shield, Image, User } from 'lucide-react';

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

const StatusBadge: React.FC<{ status?: string }> = ({ status }) => {
  const map: Record<string, string> = {
    pending: 'text-yellow-400 bg-yellow-500/10',
    approved: 'text-green-400 bg-green-500/10',
    rejected: 'text-red-400 bg-red-500/10',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status || ''] || 'text-gray-400 bg-gray-500/10'}`}>
      {status || '-'}
    </span>
  );
};

interface Check { id: string; userId?: string; status?: string; submittedAt?: any; certificateUrl?: string; adminNotes?: string; }
interface ImageReq { id: string; userId?: string; status?: string; requestedAt?: any; newPhotoURL?: string; currentPhotoURL?: string; }

type ActiveTab = 'bg-checks' | 'profile-images';

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

export const VerificacionesSection: React.FC = () => {
  const [tab, setTab] = useState<ActiveTab>('bg-checks');
  const [checks, setChecks] = useState<Check[]>([]);
  const [images, setImages] = useState<ImageReq[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [reviewing, setReviewing] = useState<{ type: 'check' | 'image'; id: string; userId?: string; action: 'approve' | 'reject' } | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    const q = `?status=${statusFilter}`;
    if (tab === 'bg-checks') {
      apiFetch(`/api/admin/verificaciones/background-checks${q}`)
        .then(d => setChecks(d.checks || []))
        .catch(e => setError(e.message))
        .finally(() => setLoading(false));
    } else {
      apiFetch(`/api/admin/verificaciones/profile-images${q}`)
        .then(d => setImages(d.requests || []))
        .catch(e => setError(e.message))
        .finally(() => setLoading(false));
    }
  }, [tab, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleReview = async () => {
    if (!reviewing) return;
    setSubmitting(true);
    try {
      if (reviewing.type === 'check') {
        await apiFetch(`/api/admin/verificaciones/background-checks/${reviewing.id}`, {
          method: 'PUT',
          body: JSON.stringify({ action: reviewing.action, notes: reviewNotes }),
        });
      } else {
        await apiFetch(`/api/admin/verificaciones/profile-images/${reviewing.id}`, {
          method: 'PUT',
          body: JSON.stringify({ action: reviewing.action, reason: reviewNotes }),
        });
      }
      setReviewing(null);
      setReviewNotes('');
      load();
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const tabs = [
    { key: 'bg-checks' as ActiveTab, label: 'Antecedentes', icon: <Shield className="w-4 h-4" /> },
    { key: 'profile-images' as ActiveTab, label: 'Fotos de perfil', icon: <Image className="w-4 h-4" /> },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Verificaciones</h2>
        <button onClick={load} className="text-gray-400 hover:text-white"><RefreshCw className="w-5 h-5" /></button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setStatusFilter('pending'); }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t.key ? 'bg-[#f83758]/15 text-[#f83758]' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="ml-auto bg-[#222222] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#f83758]"
        >
          <option value="pending">Pendientes</option>
          <option value="approved">Aprobados</option>
          <option value="rejected">Rechazados</option>
          <option value="all">Todos</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-[#f83758] animate-spin" /></div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">{error}</div>
      ) : tab === 'bg-checks' ? (
        <div className="bg-[#222222] border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-gray-500 text-xs uppercase">
                <th className="px-4 py-3 font-medium">Usuario</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Enviado</th>
                <th className="px-4 py-3 font-medium text-center">Estado</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">Notas</th>
                <th className="px-4 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {checks.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Sin resultados</td></tr>
              ) : checks.map(c => (
                <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-white font-mono text-xs">{c.userId?.slice(0, 14) || c.id.slice(0, 14)}…</p>
                      {c.certificateUrl && (
                        <button onClick={() => setPreviewUrl(c.certificateUrl!)} className="text-xs text-[#f83758] hover:underline mt-0.5">Ver certificado</button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{formatDate(c.submittedAt)}</td>
                  <td className="px-4 py-3 text-center"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell truncate max-w-[120px]">{c.adminNotes || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => { setReviewing({ type: 'check', id: c.id, userId: c.userId, action: 'approve' }); setReviewNotes(''); }}
                        className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-gray-700 rounded" title="Aprobar">
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setReviewing({ type: 'check', id: c.id, userId: c.userId, action: 'reject' }); setReviewNotes(''); }}
                        className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded" title="Rechazar">
                        <XCircle className="w-4 h-4" />
                      </button>
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
                <th className="px-4 py-3 font-medium">Usuario</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Nueva foto</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Solicitado</th>
                <th className="px-4 py-3 font-medium text-center">Estado</th>
                <th className="px-4 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {images.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Sin resultados</td></tr>
              ) : images.map(img => (
                <tr key={img.id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="px-4 py-3 text-white font-mono text-xs">{img.userId?.slice(0, 14) || img.id.slice(0, 14)}…</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {img.newPhotoURL ? (
                      <img src={img.newPhotoURL} alt="nueva foto" className="w-10 h-10 rounded-full object-cover cursor-pointer hover:opacity-80"
                        onClick={() => setPreviewUrl(img.newPhotoURL!)} />
                    ) : <span className="text-gray-500">-</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{formatDate(img.requestedAt)}</td>
                  <td className="px-4 py-3 text-center"><StatusBadge status={img.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => { setReviewing({ type: 'image', id: img.id, userId: img.userId, action: 'approve' }); setReviewNotes(''); }}
                        className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-gray-700 rounded" title="Aprobar">
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setReviewing({ type: 'image', id: img.id, userId: img.userId, action: 'reject' }); setReviewNotes(''); }}
                        className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded" title="Rechazar">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Review Modal */}
      {reviewing && (
        <Modal onClose={() => setReviewing(null)} title={`${reviewing.action === 'approve' ? 'Aprobar' : 'Rechazar'} ${reviewing.type === 'check' ? 'certificado' : 'foto de perfil'}`}>
          <div className="mb-4">
            <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">
              {reviewing.action === 'approve' ? 'Notas (opcional)' : 'Motivo del rechazo'}
            </label>
            <textarea
              value={reviewNotes}
              onChange={e => setReviewNotes(e.target.value)}
              rows={3}
              className="w-full bg-[#1f1f1f] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#f83758] resize-none"
              placeholder={reviewing.action === 'approve' ? 'Notas adicionales...' : 'Razón del rechazo...'}
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setReviewing(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white bg-gray-800 rounded-lg">Cancelar</button>
            <button
              onClick={handleReview}
              disabled={submitting}
              className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 ${
                reviewing.action === 'approve' ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-red-600 hover:bg-red-500 text-white'
              }`}
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {reviewing.action === 'approve' ? 'Aprobar' : 'Rechazar'}
            </button>
          </div>
        </Modal>
      )}

      {/* Image Preview */}
      {previewUrl && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setPreviewUrl(null)}>
          <div className="relative max-w-lg w-full">
            <img src={previewUrl} alt="preview" className="w-full rounded-xl object-contain max-h-[80vh]" />
            <button onClick={() => setPreviewUrl(null)} className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VerificacionesSection;
