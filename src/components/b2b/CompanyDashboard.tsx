import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth';
import { Building2, Briefcase, Users, BarChart3, UserPlus, Upload, Settings, Loader2 } from 'lucide-react';
import { JobManager } from './JobManager';
import { CandidateManager } from './CandidateManager';
import { CandidateDetail } from './CandidateDetail';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { MembersManager } from './MembersManager';
import { BulkUpload } from './BulkUpload';
import { Company } from '../../types';

const API_BASE = import.meta.env.VITE_API_URL || '';

type TabId = 'jobs' | 'candidates' | 'analytics' | 'members' | 'settings';

interface CompanyDashboardProps {
  setCurrentView?: (v: string) => void;
}

export function CompanyDashboard({ setCurrentView }: CompanyDashboardProps) {
  const { user, profile } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('jobs');
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);
  const [showBulk, setShowBulk] = useState(false);

  useEffect(() => { loadCompany(); }, [profile]);

  const loadCompany = async () => {
    const storedId = sessionStorage.getItem('nouu_company_id') || profile?.companyId;
    if (!storedId) { setLoading(false); return; }
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`${API_BASE}/api/companies/${storedId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setCompany(await res.json());
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>;
  if (!company) return <div className="text-center py-20 text-gray-400">Empresa no encontrada</div>;

  const isOwner = company.ownerId === user?.uid;
  const isProfessional = company.plan === 'professional';

  const tabs: { id: TabId; icon: any; label: string }[] = [
    { id: 'jobs', icon: Briefcase, label: 'Ofertas' },
    { id: 'candidates', icon: Users, label: 'Candidatos' },
    { id: 'analytics', icon: BarChart3, label: 'Analíticas' },
    { id: 'members', icon: UserPlus, label: 'Miembros' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#0f70b7]/20 rounded-xl flex items-center justify-center">
            <Building2 className="w-6 h-6 text-[#0f70b7]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white">{company.name}</h1>
              {company.verified && <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full text-xs font-medium border border-blue-500/30">Verificado</span>}
            </div>
            <p className="text-gray-400 text-sm">{company.industry} · {company.size === 'small' ? '1-10' : company.size === 'medium' ? '11-50' : '50+'} empleados</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${isProfessional ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
            Plan {isProfessional ? 'Professional' : 'Gratuito'}
          </span>
          {!isProfessional && (
            <button onClick={() => setActiveTab('settings')} className="bg-[#0f70b7] hover:bg-[#0d5fa0] text-white px-3 py-1 rounded-full text-xs font-medium transition-colors">
              Actualizar
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-800 mb-6 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSelectedCandidate(null); setShowBulk(false); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id ? 'border-[#0f70b7] text-[#0f70b7]' : 'border-transparent text-gray-400 hover:text-white'}`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {selectedCandidate ? (
        <CandidateDetail
          application={selectedCandidate}
          onBack={() => setSelectedCandidate(null)}
          onStatusChange={loadCompany}
        />
      ) : (
        <>
          {activeTab === 'jobs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Mis Ofertas</h2>
                <div className="flex gap-2">
                  <button onClick={() => setShowBulk(!showBulk)} className="flex items-center gap-2 px-3 py-1.5 bg-[#181818] border border-gray-700 rounded-lg text-sm text-gray-300 hover:border-gray-600">
                    <Upload className="w-3.5 h-3.5" /> Carga masiva
                  </button>
                </div>
              </div>
              {showBulk ? (
                <BulkUpload companyId={company.id} onComplete={() => { setShowBulk(false); }} />
              ) : (
                <JobManager companyId={company.id} />
              )}
            </div>
          )}
          {activeTab === 'candidates' && (
            <CandidateManager companyId={company.id} onViewCandidate={setSelectedCandidate} />
          )}
          {activeTab === 'analytics' && (
            <AnalyticsDashboard companyId={company.id} />
          )}
          {activeTab === 'members' && (
            <MembersManager companyId={company.id} isOwner={isOwner} />
          )}
        </>
      )}
    </div>
  );
}
