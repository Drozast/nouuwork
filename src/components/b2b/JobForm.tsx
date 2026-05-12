import { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { Loader2 } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

const CATEGORIES = ['tecnologia', 'administracion', 'ventas', 'salud', 'educacion', 'construccion', 'manufactura', 'gastronomia', 'transporte', 'comercio', 'finanzas', 'marketing', 'juridico', 'otro'];
const CONTRACT_TYPES = ['full_time', 'part_time', 'internship', 'contract', 'freelance'];
const MODALITIES = ['presencial', 'remoto', 'hibrido'];
const CONTRACT_LABELS: Record<string, string> = { full_time: 'Tiempo completo', part_time: 'Part-time', internship: 'Práctica', contract: 'Contrato', freelance: 'Freelance' };
const MODALITY_LABELS: Record<string, string> = { presencial: 'Presencial', remoto: 'Remoto', hibrido: 'Híbrido' };

interface JobFormProps {
  companyId: string;
  onSaved: () => void;
  onCancel: () => void;
  initialData?: any;
}

export function JobForm({ companyId, onSaved, onCancel, initialData }: JobFormProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [category, setCategory] = useState(initialData?.category || 'otro');
  const [contractType, setContractType] = useState(initialData?.contractType || 'full_time');
  const [modality, setModality] = useState(initialData?.modality || 'presencial');
  const [location, setLocation] = useState(initialData?.location || '');
  const [salaryMin, setSalaryMin] = useState(initialData?.salaryMin || '');
  const [salaryMax, setSalaryMax] = useState(initialData?.salaryMax || '');
  const [urgent, setUrgent] = useState(initialData?.urgent || false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !location) { setError('Título y ubicación son requeridos'); return; }
    setLoading(true);
    setError('');
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`${API_BASE}/api/companies/${companyId}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title, description, category, contractType, modality, location,
          salaryMin, salaryMax, type: CONTRACT_LABELS[contractType],
          tags: [category], urgent,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error creando oferta');
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-[#181818] border border-gray-800 rounded-xl p-6 space-y-4">
      <h3 className="text-lg font-bold text-white">Nueva Oferta</h3>
      <input placeholder="Título *" value={title} onChange={e => setTitle(e.target.value)} required
        className="w-full bg-[#121212] border border-gray-700 rounded-xl py-2.5 px-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0f70b7]" />
      <textarea placeholder="Descripción" value={description} onChange={e => setDescription(e.target.value)} rows={3}
        className="w-full bg-[#121212] border border-gray-700 rounded-xl py-2.5 px-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0f70b7] resize-none" />
      <div className="grid grid-cols-3 gap-3">
        <select value={category} onChange={e => setCategory(e.target.value)}
          className="bg-[#121212] border border-gray-700 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-[#0f70b7]">
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={contractType} onChange={e => setContractType(e.target.value)}
          className="bg-[#121212] border border-gray-700 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-[#0f70b7]">
          {CONTRACT_TYPES.map(c => <option key={c} value={c}>{CONTRACT_LABELS[c]}</option>)}
        </select>
        <select value={modality} onChange={e => setModality(e.target.value)}
          className="bg-[#121212] border border-gray-700 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-[#0f70b7]">
          {MODALITIES.map(m => <option key={m} value={m}>{MODALITY_LABELS[m]}</option>)}
        </select>
      </div>
      <input placeholder="Ubicación * (ej: Santiago, RM)" value={location} onChange={e => setLocation(e.target.value)}
        className="w-full bg-[#121212] border border-gray-700 rounded-xl py-2.5 px-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0f70b7]" />
      <div className="grid grid-cols-2 gap-3">
        <input type="number" placeholder="Sueldo mínimo" value={salaryMin} onChange={e => setSalaryMin(e.target.value)}
          className="w-full bg-[#121212] border border-gray-700 rounded-xl py-2.5 px-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0f70b7]" />
        <input type="number" placeholder="Sueldo máximo" value={salaryMax} onChange={e => setSalaryMax(e.target.value)}
          className="w-full bg-[#121212] border border-gray-700 rounded-xl py-2.5 px-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0f70b7]" />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-400">
        <input type="checkbox" checked={urgent} onChange={e => setUrgent(e.target.checked)} className="rounded" />
        Urgente
      </label>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 py-2 rounded-xl border border-gray-700 text-gray-300 text-sm font-medium hover:bg-gray-800">Cancelar</button>
        <button type="submit" disabled={loading} className="flex-1 bg-[#0f70b7] hover:bg-[#0d5fa0] text-white py-2 rounded-xl font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {initialData ? 'Guardar' : 'Publicar'}
        </button>
      </div>
    </form>
  );
}
