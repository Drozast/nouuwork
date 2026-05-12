import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth';
import { Search, Download, Loader2, ChevronRight, Clock } from 'lucide-react';
import { Application } from '../../types';

const API_BASE = import.meta.env.VITE_API_URL || '';

const STATUS_TABS = [
  { key: '', label: 'Todos' },
  { key: 'nuevo', label: 'Nuevos', color: 'bg-gray-500' },
  { key: 'revisado', label: 'Revisados', color: 'bg-blue-500' },
  { key: 'entrevista', label: 'Entrevista', color: 'bg-yellow-500' },
  { key: 'contratado', label: 'Contratados', color: 'bg-green-500' },
  { key: 'rechazado', label: 'Rechazados', color: 'bg-red-500' },
];

interface CandidateManagerProps {
  companyId: string;
  onViewCandidate: (app: Application) => void;
}

export function CandidateManager({ companyId, onViewCandidate }: CandidateManagerProps) {
  const { user } = useAuth();
  const [candidates, setCandidates] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const token = await user?.getIdToken();
      const params = new URLSearchParams({ limit: String(limit), offset: String(page * limit) });
      if (activeTab) params.set('status', activeTab);
      if (search) params.set('search', search);
      
      const res = await fetch(`${API_BASE}/api/companies/${companyId}/candidates?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCandidates(data.candidates || []);
        setTotalCount(data.totalCount || 0);
      }
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchCandidates(); }, [activeTab, search, page, companyId]);

  const handleExport = async () => {
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`${API_BASE}/api/companies/${companyId}/candidates/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'candidatos_nouu.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Candidatos</h2>
        <button onClick={handleExport} className="flex items-center gap-2 px-3 py-1.5 bg-[#181818] border border-gray-700 rounded-lg text-sm text-gray-300 hover:border-gray-600">
          <Download className="w-3.5 h-3.5" /> Exportar CSV
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text" placeholder="Buscar por nombre, email u oferta..."
          value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
          className="w-full bg-[#181818] border border-gray-700 rounded-xl py-2 pl-10 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0f70b7]"
        />
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setPage(0); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.key ? 'bg-[#0f70b7] text-white' : 'bg-[#181818] text-gray-400 hover:text-white border border-gray-700'
            }`}
          >
            {tab.key && <span className={`w-2 h-2 rounded-full ${tab.color}`} />}
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : candidates.length === 0 ? (
        <p className="text-center py-12 text-gray-500">No se encontraron candidatos</p>
      ) : (
        <div className="space-y-2">
          {candidates.map(app => (
            <div
              key={app.id}
              onClick={() => onViewCandidate(app)}
              className="bg-[#181818] border border-gray-800 rounded-xl p-4 cursor-pointer hover:border-[#0f70b7]/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#0f70b7]/20 rounded-full flex items-center justify-center text-[#0f70b7] font-bold text-sm">
                    {(app.applicantName || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">{app.applicantName}</p>
                    <p className="text-gray-400 text-xs">{app.jobTitle}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    app.status === 'contratado' ? 'bg-green-500/20 text-green-400' :
                    app.status === 'rechazado' ? 'bg-red-500/20 text-red-400' :
                    app.status === 'entrevista' ? 'bg-yellow-500/20 text-yellow-400' :
                    app.status === 'revisado' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {app.status || 'nuevo'}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </div>
              </div>
              {app.appliedAt && (
                <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  {(() => {
                    const ts = app.appliedAt as any;
                    if (ts?.seconds) return new Date(ts.seconds * 1000);
                    if (ts?.toDate) return ts.toDate();
                    return new Date(ts || Date.now());
                  })().toLocaleDateString('es-CL')}
                </div>
              )}
            </div>
          ))}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="px-3 py-1 rounded-lg bg-[#181818] border border-gray-700 text-sm text-gray-300 disabled:opacity-30">Anterior</button>
              <span className="text-sm text-gray-500">{page + 1} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="px-3 py-1 rounded-lg bg-[#181818] border border-gray-700 text-sm text-gray-300 disabled:opacity-30">Siguiente</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
