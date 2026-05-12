import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth';
import { Plus, Loader2, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { JobForm } from './JobForm';

const API_BASE = import.meta.env.VITE_API_URL || '';

export function JobManager({ companyId }: { companyId: string }) {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { fetchJobs(); }, [companyId]);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`${API_BASE}/api/companies/${companyId}/jobs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setJobs(await res.json());
    } catch {} finally { setLoading(false); }
  };

  const toggleActive = async (jobId: string, active: boolean) => {
    try {
      const token = await user?.getIdToken();
      await fetch(`${API_BASE}/api/companies/${companyId}/jobs/${jobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ active }),
      });
      fetchJobs();
    } catch {}
  };

  const deleteJob = async (jobId: string) => {
    try {
      const token = await user?.getIdToken();
      await fetch(`${API_BASE}/api/companies/${companyId}/jobs/${jobId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchJobs();
    } catch {}
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-3">
      <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-[#0f70b7] hover:bg-[#0d5fa0] text-white rounded-xl font-medium text-sm transition-colors">
        <Plus className="w-4 h-4" /> Nueva Oferta
      </button>

      {showForm && (
        <JobForm companyId={companyId} onSaved={() => { setShowForm(false); fetchJobs(); }} onCancel={() => setShowForm(false)} />
      )}

      {jobs.length === 0 ? (
        <p className="text-center py-8 text-gray-500">No hay ofertas publicadas</p>
      ) : (
        jobs.map(job => (
          <div key={job.id} className="flex items-center justify-between bg-[#181818] border border-gray-800 rounded-xl p-4">
            <div>
              <p className="text-white font-medium text-sm">{job.title}</p>
              <p className="text-gray-400 text-xs mt-1">{job.location} · {job.type}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-500">{job.candidateCount ?? 0} candidatos</span>
                {job.urgent && <span className="text-xs text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded">Urgente</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => toggleActive(job.id, !job.active)}
                className={job.active ? 'text-green-400' : 'text-gray-600'}>
                {job.active ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
              </button>
              <button onClick={() => deleteJob(job.id)} className="text-gray-600 hover:text-red-400">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
