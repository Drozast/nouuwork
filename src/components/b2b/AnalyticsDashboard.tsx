import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth';
import { Loader2, TrendingUp, Eye, MousePointerClick, Users, Briefcase } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface AnalyticsData {
  summary: {
    totalViews: number;
    totalClicks: number;
    totalApplications: number;
    conversionRate: number;
    activeJobs: number;
    avgApplicationsPerJob: number;
  };
  topJobs: { id: string; title: string; views: number; clicks: number; candidateCount: number }[];
  dailyTrend: { date: string; views: number; clicks: number }[];
  period: { from: string; to: string };
}

export function AnalyticsDashboard({ companyId }: { companyId: string }) {
  const { user } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => { fetchData(); }, [days, companyId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`${API_BASE}/api/companies/${companyId}/analytics?days=${days}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setData(await res.json());
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  if (!data) return <p className="text-center py-12 text-gray-500">No se pudieron cargar las analíticas</p>;

  const { summary } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Analíticas</h2>
        <div className="flex gap-1">
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1 rounded-lg text-xs font-medium ${days === d ? 'bg-[#0f70b7] text-white' : 'bg-[#181818] text-gray-400 border border-gray-700'}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#181818] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><Eye className="w-4 h-4 text-[#0f70b7]" /><span className="text-xs text-gray-400">Vistas</span></div>
          <p className="text-2xl font-bold text-white">{summary.totalViews}</p>
        </div>
        <div className="bg-[#181818] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><MousePointerClick className="w-4 h-4 text-green-400" /><span className="text-xs text-gray-400">Clics</span></div>
          <p className="text-2xl font-bold text-white">{summary.totalClicks}</p>
        </div>
        <div className="bg-[#181818] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-yellow-400" /><span className="text-xs text-gray-400">Postulaciones</span></div>
          <p className="text-2xl font-bold text-white">{summary.totalApplications}</p>
        </div>
        <div className="bg-[#181818] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-purple-400" /><span className="text-xs text-gray-400">Conversión</span></div>
          <p className="text-2xl font-bold text-white">{summary.conversionRate}%</p>
        </div>
      </div>

      {/* Top Jobs */}
      {data.topJobs.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-3">Top ofertas</h3>
          <div className="space-y-2">
            {data.topJobs.map((job, i) => (
              <div key={job.id} className="flex items-center justify-between bg-[#181818] border border-gray-800 rounded-xl p-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-500">#{i + 1}</span>
                  <span className="text-sm text-white">{job.title}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span>{job.views} vistas</span>
                  <span>{job.clicks} clics</span>
                  <span>{job.candidateCount} candidatos</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily trend */}
      {data.dailyTrend.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-3">Tendencia diaria</h3>
          <div className="bg-[#181818] border border-gray-800 rounded-xl p-4 overflow-x-auto">
            <div className="flex gap-3" style={{ minWidth: data.dailyTrend.length * 60 }}>
              {data.dailyTrend.map(day => (
                <div key={day.date} className="flex flex-col items-center gap-1">
                  <div className="flex flex-col items-end gap-0.5">
                    <div className="w-5 bg-[#0f70b7] rounded-t" style={{ height: Math.max(2, day.views / 2) }} />
                    <div className="w-5 bg-green-500 rounded-t" style={{ height: Math.max(2, day.clicks / 2) }} />
                  </div>
                  <span className="text-[10px] text-gray-500">{day.date.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
