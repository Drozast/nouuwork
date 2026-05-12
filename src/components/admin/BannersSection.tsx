import React, { useState, useEffect, useCallback } from 'react';
import { auth } from '../../lib/firebase';
import { RefreshCw, Loader2, Plus, Edit3, Trash2, Eye, EyeOff, X, GripVertical, ExternalLink } from 'lucide-react';

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

interface Banner {
  id: string;
  title?: string;
  imageUrl?: string;
  linkUrl?: string;
  active?: boolean;
  order?: number;
  targetScreen?: string;
}

interface BannerForm {
  title: string;
  imageUrl: string;
  linkUrl: string;
  active: boolean;
  order: number;
  targetScreen: string;
}

const EMPTY: BannerForm = { title: '', imageUrl: '', linkUrl: '', active: true, order: 0, targetScreen: '' };

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

export const BannersSection: React.FC = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BannerForm>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    apiFetch('/api/admin/banners')
      .then(d => setBanners(d.banners || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY);
    setFormOpen(true);
  };

  const openEdit = (b: Banner) => {
    setEditingId(b.id);
    setForm({ title: b.title || '', imageUrl: b.imageUrl || '', linkUrl: b.linkUrl || '', active: b.active ?? true, order: b.order ?? 0, targetScreen: b.targetScreen || '' });
    setFormOpen(true);
  };

  const closeForm = () => { setFormOpen(false); setEditingId(null); };

  const f = (k: keyof BannerForm, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async () => {
    if (!form.imageUrl) { alert('La URL de imagen es requerida'); return; }
    setSubmitting(true);
    try {
      if (editingId) {
        await apiFetch(`/api/admin/banners/${editingId}`, { method: 'PUT', body: JSON.stringify(form) });
      } else {
        await apiFetch('/api/admin/banners', { method: 'POST', body: JSON.stringify(form) });
      }
      closeForm();
      load();
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (b: Banner) => {
    try {
      await apiFetch(`/api/admin/banners/${b.id}`, { method: 'PUT', body: JSON.stringify({ active: !b.active }) });
      load();
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/admin/banners/${deleteId}`, { method: 'DELETE' });
      setDeleteId(null);
      load();
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setDeleting(false);
    }
  };

  const inputClass = "w-full bg-[#1f1f1f] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#f83758]";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Banners promocionales</h2>
        <div className="flex gap-2">
          <button onClick={load} className="text-gray-400 hover:text-white p-2"><RefreshCw className="w-5 h-5" /></button>
          <button onClick={openCreate} className="flex items-center gap-2 bg-[#f83758] hover:bg-[#e02d4c] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Nuevo banner
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-[#f83758] animate-spin" /></div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">{error}</div>
      ) : banners.length === 0 ? (
        <div className="bg-[#222222] border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-gray-400 mb-4">No hay banners aún</p>
          <button onClick={openCreate} className="flex items-center gap-2 mx-auto bg-[#f83758] hover:bg-[#e02d4c] text-white px-4 py-2 rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" /> Crear primer banner
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {banners.map(b => (
            <div key={b.id} className={`bg-[#222222] border rounded-xl p-4 flex items-center gap-4 transition-colors ${b.active ? 'border-gray-800' : 'border-gray-800/50 opacity-60'}`}>
              <GripVertical className="w-4 h-4 text-gray-600 shrink-0" />
              {b.imageUrl ? (
                <img src={b.imageUrl} alt={b.title} className="w-20 h-12 rounded-lg object-cover shrink-0 cursor-pointer hover:opacity-80"
                  onClick={() => setPreviewUrl(b.imageUrl!)} />
              ) : (
                <div className="w-20 h-12 rounded-lg bg-gray-800 shrink-0 flex items-center justify-center">
                  <span className="text-gray-600 text-xs">Sin img</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white truncate">{b.title || '(sin título)'}</p>
                  {!b.active && <span className="text-xs bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">Inactivo</span>}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  {b.targetScreen && <span className="text-xs text-gray-500">{b.targetScreen}</span>}
                  {b.linkUrl && (
                    <a href={b.linkUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#f83758] hover:underline flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> Link
                    </a>
                  )}
                  <span className="text-xs text-gray-600">Orden: {b.order ?? 0}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => handleToggle(b)} className={`p-1.5 rounded hover:bg-gray-700 transition-colors ${b.active ? 'text-green-400' : 'text-gray-500'}`} title={b.active ? 'Desactivar' : 'Activar'}>
                  {b.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button onClick={() => openEdit(b)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors">
                  <Edit3 className="w-4 h-4" />
                </button>
                <button onClick={() => setDeleteId(b.id)} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {formOpen && (
        <Modal onClose={closeForm} title={editingId ? 'Editar banner' : 'Nuevo banner'}>
          <div className="mb-4">
            <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Título</label>
            <input value={form.title} onChange={e => f('title', e.target.value)} placeholder="Título del banner" className={inputClass} />
          </div>
          <div className="mb-4">
            <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">URL de imagen *</label>
            <input value={form.imageUrl} onChange={e => f('imageUrl', e.target.value)} placeholder="https://..." className={inputClass} />
            {form.imageUrl && <img src={form.imageUrl} alt="preview" className="mt-2 w-full h-24 object-cover rounded-lg" onError={e => (e.currentTarget.style.display = 'none')} />}
          </div>
          <div className="mb-4">
            <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">URL de enlace</label>
            <input value={form.linkUrl} onChange={e => f('linkUrl', e.target.value)} placeholder="https://..." className={inputClass} />
          </div>
          <div className="mb-4">
            <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Pantalla destino</label>
            <input value={form.targetScreen} onChange={e => f('targetScreen', e.target.value)} placeholder="home, mapa, perfil..." className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Orden</label>
              <input type="number" value={form.order} onChange={e => f('order', parseInt(e.target.value) || 0)} className={inputClass} />
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Estado</label>
              <select value={form.active ? 'active' : 'inactive'} onChange={e => f('active', e.target.value === 'active')}
                className="w-full bg-[#1f1f1f] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#f83758]">
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button onClick={closeForm} className="px-4 py-2 text-sm text-gray-400 hover:text-white bg-gray-800 rounded-lg">Cancelar</button>
            <button onClick={handleSubmit} disabled={submitting} className="px-4 py-2 text-sm font-medium bg-[#f83758] hover:bg-[#e02d4c] text-white rounded-lg flex items-center gap-2">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />} Guardar
            </button>
          </div>
        </Modal>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <Modal onClose={() => setDeleteId(null)} title="Eliminar banner">
          <p className="text-sm text-gray-300 mb-6">¿Confirmas que deseas eliminar este banner? Esta acción no se puede deshacer.</p>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white bg-gray-800 rounded-lg">Cancelar</button>
            <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg flex items-center gap-2">
              {deleting && <Loader2 className="w-4 h-4 animate-spin" />} Eliminar
            </button>
          </div>
        </Modal>
      )}

      {/* Image Preview */}
      {previewUrl && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 cursor-pointer" onClick={() => setPreviewUrl(null)}>
          <img src={previewUrl} alt="preview" className="max-w-2xl w-full rounded-xl mx-4 object-contain max-h-[80vh]" />
        </div>
      )}
    </div>
  );
};

export default BannersSection;
