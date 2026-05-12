import React, { useState, useEffect, useCallback, useRef } from 'react';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../lib/firebase';
import { NouusSection } from './NouusSection';
import { SuscripcionesSection } from './SuscripcionesSection';
import { VerificacionesSection } from './VerificacionesSection';
import { BannersSection } from './BannersSection';
import { AnunciosSection } from './AnunciosSection';
import { SoporteSection } from './SoporteSection';
import { MariaSection } from './MariaSection';
import { CalificacionesSection } from './CalificacionesSection';
import { MonetizacionSection } from './MonetizacionSection';
import { collection, query, orderBy, limit, onSnapshot, getCountFromServer, getDocs, where, Timestamp } from 'firebase/firestore';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Bot,
  Settings,
  LogOut,
  Search,
  Plus,
  Eye,
  Trash2,
  Loader2,
  BarChart2,
  MousePointerClick,
  ExternalLink,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  TrendingUp,
  FileText,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  Play,
  Menu,
  Shield,
  Timer,
  ChevronDown,
  Wand2,
  Link,
  MapPin,
  DollarSign,
  Building2,
  Tag,
  Copy,
  Star,
  Crown,
  Megaphone,
  Image,
  Headphones,
  Wallet,
  MessageSquare,
} from 'lucide-react';
import AnalyticsDetailModal from './AnalyticsDetail';
import type { DetailType } from './AnalyticsDetail';

const API_BASE = import.meta.env.VITE_API_URL || '';

/* ─── Helpers ────────────────────────────────────────────────── */

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

function formatDate(d: any) {
  if (!d) return '-';
  let date: Date;
  if (typeof d === 'object' && d._seconds) {
    date = new Date(d._seconds * 1000);
  } else if (typeof d === 'string') {
    date = new Date(d);
  } else {
    return '-';
  }
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/* ─── Types ──────────────────────────────────────────────────── */

interface Stats {
  totalJobs: number;
  totalUsers: number;
  totalApplications: number;
  totalUserJobs: number;
  today: { users: number; jobs: number; applications: number; };
  yesterday: { users: number; jobs: number; applications: number; };
  week: { users: number; jobs: number; applications: number; };
}

interface Oferta {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  time: string;
  tags: string[];
  urgent: boolean;
  active: boolean;
  fuente: string;
  urlOriginal: string;
  contentHash: string;
  descripcion: string;
  descripcionCruda: string;
  sueldoMin: number;
  sueldoMax: number;
  tipoContrato: string;
  region: string;
  direccion: string;
  createdAt: string;
  fechaScraping: string;
}

interface Usuario {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  role: string;
  createdAt: string;
}

interface ScraperLog {
  id: string;
  timestamp: string;
  totalProcessed: number;
  inserted: number;
  duplicates: number;
  errors: number;
  duration: number;
  triggeredBy: string;
}

interface ScraperStatus {
  enabled: boolean;
  frequency: number;
  isRunning: boolean;
  runningBy: string | null;
  lastRun: string;
}

interface ConfigData {
  frequency: number;
  enabled: boolean;
  sources: string[];
  region: string;
  maxPerRun: number;
}

type Section =
  | 'dashboard' | 'analytics' | 'ofertas' | 'usuarios' | 'scraper' | 'config' | 'codes'
  | 'nouus' | 'suscripciones' | 'verificaciones' | 'banners' | 'anuncios'
  | 'soporte' | 'maria' | 'calificaciones' | 'monetizacion';

/* ─── Sidebar ────────────────────────────────────────────────── */

interface NavGroup { label: string; items: { key: Section; label: string; icon: React.ReactNode }[] }

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'General',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
      { key: 'analytics', label: 'Analytics', icon: <BarChart2 className="w-4 h-4" /> },
      { key: 'usuarios', label: 'Usuarios', icon: <Users className="w-4 h-4" /> },
    ],
  },
  {
    label: 'Nouu Work',
    items: [
      { key: 'ofertas', label: 'Ofertas formales', icon: <Briefcase className="w-4 h-4" /> },
      { key: 'scraper', label: 'Scraper', icon: <Bot className="w-4 h-4" /> },
    ],
  },
  {
    label: 'Nouu (App)',
    items: [
      { key: 'nouus', label: 'Nouus', icon: <Tag className="w-4 h-4" /> },
      { key: 'maria', label: 'MarIA Nouus', icon: <MessageSquare className="w-4 h-4" /> },
      { key: 'calificaciones', label: 'Calificaciones', icon: <Star className="w-4 h-4" /> },
    ],
  },
  {
    label: 'Monetización',
    items: [
      { key: 'suscripciones', label: 'Suscripciones', icon: <Crown className="w-4 h-4" /> },
      { key: 'monetizacion', label: 'Transacciones', icon: <Wallet className="w-4 h-4" /> },
      { key: 'anuncios', label: 'Anuncios', icon: <Megaphone className="w-4 h-4" /> },
      { key: 'banners', label: 'Banners', icon: <Image className="w-4 h-4" /> },
    ],
  },
  {
    label: 'Moderación',
    items: [
      { key: 'verificaciones', label: 'Verificaciones', icon: <Shield className="w-4 h-4" /> },
      { key: 'soporte', label: 'Soporte', icon: <Headphones className="w-4 h-4" /> },
    ],
  },
  {
    label: 'Configuración',
    items: [
      { key: 'codes', label: 'Códigos', icon: <Tag className="w-4 h-4" /> },
      { key: 'config', label: 'Config', icon: <Settings className="w-4 h-4" /> },
    ],
  },
];

const Sidebar: React.FC<{
  active: Section;
  onChange: (s: Section) => void;
  collapsed: boolean;
  onToggle: () => void;
}> = ({ active, onChange, collapsed, onToggle }) => {
  const handleLogout = async () => {
    await signOut(auth);
    window.location.reload();
  };

  return (
    <aside
      className={`bg-[#222222] border-r border-gray-800 flex flex-col transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-800">
        <button onClick={onToggle} className="text-gray-400 hover:text-white">
          <Menu className="w-5 h-5" />
        </button>
        {!collapsed && <span className="text-lg font-bold text-white whitespace-nowrap">NouuWork Admin</span>}
      </div>

      <nav className="flex-1 py-3 px-2 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-2">
            {!collapsed && (
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 px-3 mb-1 mt-2">{group.label}</p>
            )}
            {group.items.map((item) => (
              <button
                key={item.key}
                onClick={() => onChange(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active === item.key
                    ? 'bg-[#f83758]/15 text-[#f83758]'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
                title={collapsed ? item.label : undefined}
              >
                {item.icon}
                {!collapsed && <span>{item.label}</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="p-2 border-t border-gray-800">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
          title={collapsed ? 'Cerrar sesión' : undefined}
        >
          <LogOut className="w-5 h-5" />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  );
};

/* ─── Stat Card ──────────────────────────────────────────────── */

const StatCard: React.FC<{ label: string; value: number | string; icon: React.ReactNode; color: string }> = ({
  label,
  value,
  icon,
  color,
}) => (
  <div className="bg-[#222222] border border-gray-800 rounded-xl p-5 flex items-center gap-4">
    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>{icon}</div>
    <div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  </div>
);

/* ─── Dashboard Section ─────────────────────────────────────── */

const DashboardSection: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [lastScraper, setLastScraper] = useState<ScraperLog | null>(null);
  const [expiringCount, setExpiringCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      apiFetch('/api/admin/stats'),
      apiFetch('/api/admin/scraper/logs').catch(() => ({ logs: [] })),
      apiFetch('/api/admin/ofertas?limit=200&offset=0').catch(() => ({ jobs: [] })),
    ])
      .then(([statsData, scraperData, ofertasData]) => {
        setStats(statsData);
        const logs: ScraperLog[] = scraperData.logs || [];
        if (logs.length > 0) setLastScraper(logs[0]);
        // Count jobs expiring within 30 days (age > 0 days, created more than 0 days ago)
        const jobs: Oferta[] = ofertasData.jobs || [];
        const now = Date.now();
        const expiring = jobs.filter((j) => {
          const created = j.createdAt
            ? typeof j.createdAt === 'object' && (j.createdAt as any)._seconds
              ? (j.createdAt as any)._seconds * 1000
              : new Date(j.createdAt).getTime()
            : 0;
          if (!created) return false;
          const ageDays = (now - created) / (1000 * 60 * 60 * 24);
          return ageDays >= 23 && ageDays <= 30; // expiring within the next 7 days of the 30-day window
        });
        setExpiringCount(expiring.length);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!stats) return null;

  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-6">Dashboard</h2>

      {/* Totales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Ofertas" value={stats.totalJobs.toLocaleString()} icon={<Briefcase className="w-6 h-6 text-[#0f70b7]" />} color="bg-[#0f70b7]/15" />
        <StatCard label="Usuarios" value={stats.totalUsers.toLocaleString()} icon={<Users className="w-6 h-6 text-green-400" />} color="bg-green-500/15" />
        <StatCard label="Postulaciones" value={stats.totalApplications.toLocaleString()} icon={<FileText className="w-6 h-6 text-[#0f70b7]" />} color="bg-[#0f70b7]/15" />
        <StatCard label="Ofertas de Usuarios" value={stats.totalUserJobs.toLocaleString()} icon={<UserCheck className="w-6 h-6 text-amber-400" />} color="bg-amber-500/15" />
      </div>

      {/* Hoy */}
      <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
        <div className="w-2 h-2 bg-green-400 rounded-full" />
        Hoy
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-[#222222] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Usuarios nuevos</span>
            <Users className="w-4 h-4 text-green-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-1">{stats.today?.users ?? 0}</p>
        </div>
        <div className="bg-[#222222] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Ofertas nuevas</span>
            <Briefcase className="w-4 h-4 text-[#0f70b7]" />
          </div>
          <p className="text-2xl font-bold text-white mt-1">{stats.today?.jobs ?? 0}</p>
        </div>
        <div className="bg-[#222222] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Postulaciones hoy</span>
            <FileText className="w-4 h-4 text-[#0f70b7]" />
          </div>
          <p className="text-2xl font-bold text-white mt-1">{stats.today?.applications ?? 0}</p>
        </div>
      </div>

      {/* Ayer + Semana */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-[#222222] border border-gray-800 rounded-xl p-4">
          <h4 className="text-xs text-gray-500 mb-3">Ayer</h4>
          <div className="flex gap-4 text-sm">
            <div>
              <p className="text-gray-400">Usuarios</p>
              <p className="text-white font-bold">{stats.yesterday?.users ?? 0}</p>
            </div>
            <div>
              <p className="text-gray-400">Ofertas</p>
              <p className="text-white font-bold">{stats.yesterday?.jobs ?? 0}</p>
            </div>
            <div>
              <p className="text-gray-400">Postulaciones</p>
              <p className="text-white font-bold">{stats.yesterday?.applications ?? 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-[#222222] border border-gray-800 rounded-xl p-4">
          <h4 className="text-xs text-gray-500 mb-3">Últimos 7 días</h4>
          <div className="flex gap-4 text-sm">
            <div>
              <p className="text-gray-400">Usuarios</p>
              <p className="text-white font-bold">{stats.week?.users ?? 0}</p>
            </div>
            <div>
              <p className="text-gray-400">Ofertas</p>
              <p className="text-white font-bold">{stats.week?.jobs ?? 0}</p>
            </div>
            <div>
              <p className="text-gray-400">Postulaciones</p>
              <p className="text-white font-bold">{stats.week?.applications ?? 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Extra info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
        {/* Last scraper run */}
        <div className="bg-[#222222] border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <Bot className="w-5 h-5 text-[#0f70b7]" />
            <h3 className="text-sm font-semibold text-white">Ultima ejecucion scraper</h3>
          </div>
          {lastScraper ? (
            <div className="space-y-2">
              <p className="text-sm text-gray-300">
                <span className="text-gray-500">Fecha:</span> {formatDate(lastScraper.timestamp)}
              </p>
              <p className="text-sm text-gray-300">
                <span className="text-gray-500">Resultado:</span>{' '}
                <span className="text-green-400">{lastScraper.inserted} nuevas</span>,{' '}
                <span className="text-yellow-400">{lastScraper.duplicates} duplicadas</span>,{' '}
                <span className="text-red-400">{lastScraper.errors} errores</span>
              </p>
              <p className="text-sm text-gray-300">
                <span className="text-gray-500">Iniciado por:</span> {lastScraper.triggeredBy || 'sistema'}
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Nunca ejecutado</p>
          )}
        </div>

        {/* Expiring jobs reminder */}
        <div className={`border rounded-xl p-5 ${expiringCount > 0 ? 'bg-amber-500/5 border-amber-500/30' : 'bg-[#222222] border-gray-800'}`}>
          <div className="flex items-center gap-3 mb-3">
            <Timer className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Ofertas por expirar</h3>
          </div>
          {expiringCount > 0 ? (
            <div>
              <p className="text-3xl font-bold text-amber-400">{expiringCount}</p>
              <p className="text-sm text-gray-400 mt-1">ofertas expiran en los proximos 7 dias (de 30 dias de vigencia)</p>
            </div>
          ) : (
            <div>
              <p className="text-3xl font-bold text-green-400">0</p>
              <p className="text-sm text-gray-400 mt-1">No hay ofertas proximas a expirar</p>
            </div>
          )}
        </div>
      </div>

      {/* Conversiones */}
      <ConversionesWidget />
    </div>
  );
};

/* ─── Widget Conversiones ────────────────────────────────────── */

interface Conversion {
  id: string;
  jobTitle: string;
  company: string;
  urlOriginal: string;
  platform: string;
  createdAt: any;
}

const ConversionesWidget: React.FC = () => {
  const [conversions, setConversions] = useState<Conversion[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Total count
    getCountFromServer(collection(db, 'analytics_conversions'))
      .then((snap) => setTotal(snap.data().count))
      .catch(() => {});

    // Last 10 conversions, real-time
    const q = query(
      collection(db, 'analytics_conversions'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    const unsub = onSnapshot(q, (snap) => {
      setConversions(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Conversion, 'id'>) }))
      );
      setLoading(false);
    }, () => setLoading(false));

    return () => unsub();
  }, []);

  return (
    <div className="mt-6 bg-[#222222] border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <MousePointerClick className="w-5 h-5 text-[#0f70b7]" />
          <h3 className="text-sm font-semibold text-white">Conversiones — Ver oferta original</h3>
        </div>
        {total !== null && (
          <span className="bg-[#0f70b7]/20 text-[#0f70b7] text-xs font-bold px-3 py-1 rounded-full">
            {total.toLocaleString()} total
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Cargando...</span>
        </div>
      ) : conversions.length === 0 ? (
        <p className="text-sm text-gray-500 py-4">Aún no hay conversiones registradas.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-gray-500">
                <th className="pb-2 pr-4 font-medium">Oferta</th>
                <th className="pb-2 pr-4 font-medium hidden md:table-cell">Empresa</th>
                <th className="pb-2 pr-4 font-medium hidden lg:table-cell">Canal</th>
                <th className="pb-2 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {conversions.map((c) => (
                <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      <ExternalLink className="w-3 h-3 text-[#0f70b7] flex-shrink-0" />
                      <a
                        href={c.urlOriginal}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white hover:text-[#0f70b7] transition-colors truncate max-w-[180px]"
                      >
                        {c.jobTitle || '—'}
                      </a>
                    </div>
                  </td>
                  <td className="py-2 pr-4 text-gray-400 hidden md:table-cell">
                    {c.company || '—'}
                  </td>
                  <td className="py-2 pr-4 hidden lg:table-cell">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      c.platform === 'flutter' ? 'bg-[#0f70b7]/20 text-[#0f70b7]' : 'bg-[#0f70b7]/20 text-[#0f70b7]'
                    }`}>
                      {c.platform === 'flutter' ? 'App' : 'Web'}
                    </span>
                  </td>
                  <td className="py-2 text-gray-500 text-xs">
                    {c.createdAt?._seconds
                      ? new Date(c.createdAt._seconds * 1000).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

/* ─── Analytics Section ─────────────────────────────────────── */

interface PageViewDay { date: string; count: number; }
interface TopItem { label: string; sublabel?: string; count: number; }
interface EventRow { type: string; count: number; }

function formatShortDate(d: Date) {
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
}

function getLastNDays(n: number): Date[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (n - 1 - i));
    return d;
  });
}

const MiniBarChart: React.FC<{ data: PageViewDay[]; color?: string }> = ({ data, color = '#f83758' }) => {
  const max = Math.max(...data.map(d => d.count), 1);
  const isCompact = data.length > 14;
  return (
    <div className={`${isCompact ? '-mx-1' : ''}`}>
      <div className="overflow-x-auto pt-7 pb-1" style={{ overflowY: 'clip' }}>
        <div className={`flex items-end ${isCompact ? 'gap-px min-w-[600px]' : 'gap-1'} h-20`}>
          {data.map((d, i) => (
            <div key={i} className={`flex-1 flex flex-col items-center justify-end ${isCompact ? 'gap-0.5 min-w-[16px]' : 'gap-1'} h-full group relative cursor-default`}>
              <div
                className="w-full rounded-sm transition-all group-hover:opacity-100 group-hover:ring-1 group-hover:ring-white/30"
                style={{ height: `${Math.max(4, (d.count / max) * 64)}px`, backgroundColor: color, opacity: d.count === 0 ? 0.2 : 0.85 }}
              />
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none shadow-lg border border-gray-700 z-20">
                {d.date}: {d.count}
              </div>
              {!isCompact && (
                <span className="text-[9px] text-gray-600 whitespace-nowrap">{d.date.slice(0, 5)}</span>
              )}
            </div>
          ))}
        </div>
        {isCompact && (
          <div className="flex items-end gap-px min-w-[600px]">
            {data.filter((_, i) => i % 5 === 0).map((d, i) => (
              <span key={i} className="text-[8px] text-gray-600 whitespace-nowrap" style={{ width: `${(100 / data.length) * 5}%`, textAlign: 'left' }}>
                {d.date.slice(0, 5)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const AnalyticsSection: React.FC = () => {
  const [range, setRange] = useState<7 | 30>(7);
  const [loading, setLoading] = useState(true);
  const [totalViews, setTotalViews] = useState(0);
  const [totalEvents, setTotalEvents] = useState(0);
  const [totalConversions, setTotalConversions] = useState(0);
  const [viewsByDay, setViewsByDay] = useState<PageViewDay[]>([]);
  const [viewsByPage, setViewsByPage] = useState<TopItem[]>([]);
  const [topViewedJobs, setTopViewedJobs] = useState<TopItem[]>([]);
  const [topClickedJobs, setTopClickedJobs] = useState<TopItem[]>([]);
  const [eventBreakdown, setEventBreakdown] = useState<EventRow[]>([]);
  const [platformBreakdown, setPlatformBreakdown] = useState<{ web: number; flutter: number }>({ web: 0, flutter: 0 });
  const [error, setError] = useState('');
  const [detailType, setDetailType] = useState<DetailType | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch(`/api/admin/analytics?days=${range}`);
      setTotalViews(data.totalViews ?? 0);
      setTotalEvents(data.totalEvents ?? 0);
      setTotalConversions(data.totalConversions ?? 0);
      setViewsByDay(data.viewsByDay ?? []);
      setViewsByPage(data.viewsByPage ?? []);
      setTopViewedJobs(data.topViewedJobs ?? []);
      setTopClickedJobs(data.topClickedJobs ?? []);
      setEventBreakdown(data.eventBreakdown ?? []);
      setPlatformBreakdown(data.platformBreakdown ?? { web: 0, flutter: 0 });
    } catch (e: any) {
      setError(e.message);
      console.error('Analytics load error', e);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { loadData(); }, [loadData]);

  const convRate = totalViews > 0 ? ((totalConversions / totalViews) * 100).toFixed(1) : '0.0';

  const EVENT_LABELS: Record<string, string> = {
    view_job_popup: 'Ver popup de oferta',
    click_ver_oferta: 'Click "Ver oferta original"',
    click_add_itinerario: 'Agregar al itinerario',
    click_postular: 'Postular',
    open_chat_maria: 'Abrir chat MarIA',
    open_cv_generator: 'Abrir generador CV',
    open_map: 'Abrir mapa',
    open_assistant: 'Abrir asistente',
    open_b2b: 'Abrir Para Empresas',
    open_post_job: 'Publicar pega',
  };

  const PAGE_LABELS: Record<string, string> = {
    landing: 'Landing', map: 'Mapa', cv: 'CV', assistant: 'Asistente',
    b2b: 'Para Empresas', post_job: 'Publicar pega', dashboard: 'Dashboard',
  };

  const maxPageCount = Math.max(...viewsByPage.map(p => p.count), 1);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Analytics</h2>
        <div className="flex items-center gap-2">
          {([7, 30] as const).map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${range === r ? 'bg-[#f83758] text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
              {r === 7 ? 'Últimos 7 días' : 'Últimos 30 días'}
            </button>
          ))}
          <button onClick={loadData} className="p-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-white transition-colors" title="Actualizar">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? <LoadingState /> : error ? <ErrorState message={error} /> : (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div onClick={() => setDetailType('visits')} className="bg-[#222222] border border-gray-800 rounded-xl p-5 cursor-pointer hover:border-gray-600 transition-colors">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 bg-[#0f70b7]/15 rounded-lg flex items-center justify-center">
                  <Eye className="w-5 h-5 text-[#0f70b7]" />
                </div>
                <span className="text-xs text-gray-400">Visitas totales</span>
              </div>
              <p className="text-3xl font-bold text-white">{totalViews.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">Visitas en {range === 7 ? '7' : '30'} días</p>
            </div>
            <div onClick={() => setDetailType('events')} className="bg-[#222222] border border-gray-800 rounded-xl p-5 cursor-pointer hover:border-gray-600 transition-colors">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 bg-[#0f70b7]/15 rounded-lg flex items-center justify-center">
                  <MousePointerClick className="w-5 h-5 text-[#0f70b7]" />
                </div>
                <span className="text-xs text-gray-400">Clicks totales</span>
              </div>
              <p className="text-3xl font-bold text-white">{totalEvents.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">Interacciones en {range === 7 ? '7' : '30'} días</p>
            </div>
            <div onClick={() => setDetailType('jobs-clicked')} className="bg-[#222222] border border-gray-800 rounded-xl p-5 cursor-pointer hover:border-gray-600 transition-colors">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 bg-green-500/15 rounded-lg flex items-center justify-center">
                  <ExternalLink className="w-5 h-5 text-green-400" />
                </div>
                <span className="text-xs text-gray-400">Conversiones</span>
              </div>
              <p className="text-3xl font-bold text-white">{totalConversions.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">En {range === 7 ? '7' : '30'} días</p>
            </div>
            <div onClick={() => setDetailType('advanced')} className="bg-[#222222] border border-gray-800 rounded-xl p-5 cursor-pointer hover:border-gray-600 transition-colors">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 bg-amber-500/15 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-amber-400" />
                </div>
                <span className="text-xs text-gray-400">Tasa de conv.</span>
              </div>
              <p className="text-3xl font-bold text-white">{convRate}%</p>
              <p className="text-xs text-gray-500 mt-1">Conv / visitas (período)</p>
            </div>
          </div>

          {/* Visits chart + Page breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div onClick={() => setDetailType('visits')} className="bg-[#222222] border border-gray-800 rounded-xl p-5 cursor-pointer hover:border-gray-600 transition-colors">
              <h3 className="text-sm font-semibold text-white mb-4">Visitas por día</h3>
              {viewsByDay.every(d => d.count === 0) ? (
                <p className="text-sm text-gray-500 py-6 text-center">Sin datos para este período</p>
              ) : (
                <MiniBarChart data={viewsByDay} />
              )}
            </div>
            <div onClick={() => setDetailType('visits')} className="bg-[#222222] border border-gray-800 rounded-xl p-5 cursor-pointer hover:border-gray-600 transition-colors">
              <h3 className="text-sm font-semibold text-white mb-4">Páginas más visitadas</h3>
              {viewsByPage.length === 0 ? (
                <p className="text-sm text-gray-500 py-6 text-center">Sin datos para este período</p>
              ) : (
                <div className="space-y-3">
                  {viewsByPage.map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-20 truncate">{PAGE_LABELS[item.label] ?? item.label}</span>
                      <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                        <div className="h-2 rounded-full bg-[#f83758]" style={{ width: `${(item.count / maxPageCount) * 100}%` }} />
                      </div>
                      <span className="text-xs text-white font-medium w-8 text-right">{item.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Top viewed + top clicked jobs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div onClick={() => setDetailType('jobs-viewed')} className="bg-[#222222] border border-gray-800 rounded-xl p-5 cursor-pointer hover:border-gray-600 transition-colors">
              <div className="flex items-center gap-2 mb-4">
                <Eye className="w-4 h-4 text-[#0f70b7]" />
                <h3 className="text-sm font-semibold text-white">Publicaciones más vistas</h3>
              </div>
              {topViewedJobs.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">Sin datos para este período</p>
              ) : (
                <div className="space-y-2">
                  {topViewedJobs.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 py-1.5 border-b border-gray-800/50 last:border-0">
                      <span className="text-xs text-gray-600 w-5 text-right">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{item.label}</p>
                        {item.sublabel && <p className="text-xs text-gray-500 truncate">{item.sublabel}</p>}
                      </div>
                      <span className="text-xs font-bold text-[#0f70b7] bg-[#0f70b7]/15 px-2 py-0.5 rounded-full">{item.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div onClick={() => setDetailType('jobs-clicked')} className="bg-[#222222] border border-gray-800 rounded-xl p-5 cursor-pointer hover:border-gray-600 transition-colors">
              <div className="flex items-center gap-2 mb-4">
                <ExternalLink className="w-4 h-4 text-green-400" />
                <h3 className="text-sm font-semibold text-white">Publicaciones más clickeadas</h3>
              </div>
              {topClickedJobs.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">Sin datos para este período</p>
              ) : (
                <div className="space-y-2">
                  {topClickedJobs.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 py-1.5 border-b border-gray-800/50 last:border-0">
                      <span className="text-xs text-gray-600 w-5 text-right">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{item.label}</p>
                        {item.sublabel && <p className="text-xs text-gray-500 truncate">{item.sublabel}</p>}
                      </div>
                      <span className="text-xs font-bold text-green-400 bg-green-500/15 px-2 py-0.5 rounded-full">{item.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Event breakdown + Platform */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div onClick={() => setDetailType('events')} className="lg:col-span-2 bg-[#222222] border border-gray-800 rounded-xl p-5 cursor-pointer hover:border-gray-600 transition-colors">
              <div className="flex items-center gap-2 mb-4">
                <MousePointerClick className="w-4 h-4 text-[#0f70b7]" />
                <h3 className="text-sm font-semibold text-white">Clicks por tipo de evento</h3>
              </div>
              {eventBreakdown.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">Sin datos para este período</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-left">
                      <th className="pb-2 text-gray-500 font-medium">Evento</th>
                      <th className="pb-2 text-gray-500 font-medium text-right">Total</th>
                      <th className="pb-2 text-gray-500 font-medium text-right w-24 hidden sm:table-cell">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventBreakdown.map((ev, i) => {
                      const total = eventBreakdown.reduce((s, e) => s + e.count, 0);
                      const pct = total > 0 ? ((ev.count / total) * 100).toFixed(1) : '0.0';
                      return (
                        <tr key={i} className="border-b border-gray-800/40 hover:bg-gray-800/20">
                          <td className="py-2 text-gray-300">{EVENT_LABELS[ev.type] ?? ev.type}</td>
                          <td className="py-2 text-white font-medium text-right">{ev.count}</td>
                          <td className="py-2 text-gray-500 text-right hidden sm:table-cell">{pct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div onClick={() => setDetailType('advanced')} className="bg-[#222222] border border-gray-800 rounded-xl p-5 cursor-pointer hover:border-gray-600 transition-colors">
              <h3 className="text-sm font-semibold text-white mb-4">Canal de conversiones</h3>
              <div className="space-y-4">
                {[
                  { label: 'Web', value: platformBreakdown.web, color: 'bg-[#0f70b7]' },
                  { label: 'App iOS/Android', value: platformBreakdown.flutter, color: 'bg-[#0f70b7]' },
                ].map((item) => {
                  const total = platformBreakdown.web + platformBreakdown.flutter;
                  const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
                  return (
                    <div key={item.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-300">{item.label}</span>
                        <span className="text-white font-medium">{item.value} <span className="text-gray-500 font-normal">({pct}%)</span></span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2">
                        <div className={`h-2 rounded-full ${item.color}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                <div className="pt-2 border-t border-gray-800">
                  <p className="text-xs text-gray-500">Total conversiones (histórico)</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {(platformBreakdown.web + platformBreakdown.flutter).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {detailType && <AnalyticsDetailModal type={detailType} onClose={() => setDetailType(null)} />}
    </div>
  );
};

/* ─── Ofertas Section ────────────────────────────────────────── */

const OfertasSection: React.FC = () => {
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [viewOferta, setViewOferta] = useState<Oferta | null>(null);
  const perPage = 15;

  const fetchOfertas = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const offset = (page - 1) * perPage;
      const params = new URLSearchParams({
        limit: String(perPage),
        offset: String(offset),
        ...(search && { search }),
        ...(sourceFilter !== 'all' && { source: sourceFilter }),
      });
      const data = await apiFetch(`/api/admin/ofertas?${params}`);
      setOfertas(data.jobs || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, sourceFilter]);

  useEffect(() => {
    fetchOfertas();
  }, [fetchOfertas]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const handleToggleActive = async (id: string, active: boolean) => {
    try {
      await apiFetch(`/api/admin/ofertas/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !active }),
      });
      setOfertas((prev) => prev.map((o) => (o.id === id ? { ...o, active: !active } : o)));
    } catch (e: any) {
      alert('Error al actualizar: ' + e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta oferta?')) return;
    try {
      await apiFetch(`/api/admin/ofertas/${id}`, { method: 'DELETE' });
      setOfertas((prev) => prev.filter((o) => o.id !== id));
      setTotal((t) => t - 1);
    } catch (e: any) {
      alert('Error al eliminar: ' + e.message);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h2 className="text-xl font-bold text-white">Ofertas</h2>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-[#f83758] hover:bg-[#d62847] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva oferta
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por título, empresa o ubicación..."
            className="w-full bg-[#1f1f1f] border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#f83758]"
          />
        </div>
        <select
          value={sourceFilter}
          onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
          className="bg-[#1f1f1f] border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-[#f83758]"
        >
          <option value="all">Todas las fuentes</option>
          <option value="computrabajo">Computrabajo</option>
          <option value="usuario">Usuario</option>
        </select>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <>
          <div className="bg-[#222222] border border-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-left text-gray-400">
                    <th className="px-4 py-3 font-medium">Título</th>
                    <th className="px-4 py-3 font-medium">Empresa</th>
                    <th className="px-4 py-3 font-medium hidden md:table-cell">Ubicación</th>
                    <th className="px-4 py-3 font-medium hidden lg:table-cell">Fuente</th>
                    <th className="px-4 py-3 font-medium hidden lg:table-cell">Fecha</th>
                    <th className="px-4 py-3 font-medium hidden lg:table-cell text-center">Expira en</th>
                    <th className="px-4 py-3 font-medium text-center">Activa</th>
                    <th className="px-4 py-3 font-medium text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {ofertas.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center text-gray-500 py-8">
                        No se encontraron ofertas
                      </td>
                    </tr>
                  ) : (
                    ofertas.map((o) => (
                      <tr key={o.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 text-white font-medium max-w-[200px] truncate">{o.title}</td>
                        <td className="px-4 py-3 text-gray-300 max-w-[150px] truncate">{o.company}</td>
                        <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{o.location}</td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              o.fuente === 'usuario'
                                ? 'bg-[#0f70b7]/15 text-[#0f70b7]'
                                : 'bg-[#0f70b7]/15 text-[#0f70b7]'
                            }`}
                          >
                            {o.fuente}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">{formatDate(o.createdAt || o.fechaScraping)}</td>
                        <td className="px-4 py-3 hidden lg:table-cell text-center">
                          {(() => {
                            const created = o.createdAt
                              ? typeof o.createdAt === 'object' && (o.createdAt as any)._seconds
                                ? (o.createdAt as any)._seconds * 1000
                                : new Date(o.createdAt).getTime()
                              : o.fechaScraping
                              ? typeof o.fechaScraping === 'object' && (o.fechaScraping as any)._seconds
                                ? (o.fechaScraping as any)._seconds * 1000
                                : new Date(o.fechaScraping).getTime()
                              : 0;
                            if (!created || isNaN(created)) return <span className="text-gray-500">-</span>;
                            const ageDays = Math.floor((Date.now() - created) / (1000 * 60 * 60 * 24));
                            const remaining = Math.max(0, 30 - ageDays);
                            return (
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                remaining <= 3 ? 'bg-red-500/15 text-red-400' :
                                remaining <= 7 ? 'bg-amber-500/15 text-amber-400' :
                                'bg-gray-700 text-gray-300'
                              }`}>
                                {remaining}d
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleToggleActive(o.id, o.active)}
                            className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer ${
                              o.active ? 'bg-green-500' : 'bg-gray-600'
                            }`}
                            title={o.active ? 'Desactivar oferta' : 'Activar oferta'}
                          >
                            <span
                              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200 ${
                                o.active ? 'left-5' : 'left-0.5'
                              }`}
                            />
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setViewOferta(o)}
                              className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                              title="Ver"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(o.id)}
                              className="p-1.5 rounded hover:bg-red-500/15 text-gray-400 hover:text-red-400 transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-400">
              {total} oferta{total !== 1 ? 's' : ''} encontrada{total !== 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded bg-[#222222] border border-gray-800 text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-400">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded bg-[#222222] border border-gray-800 text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* View Oferta Modal */}
      {viewOferta && (
        <Modal onClose={() => setViewOferta(null)} title="Detalle de Oferta">
          <div className="space-y-3 text-sm">
            <Detail label="Título" value={viewOferta.title} />
            <Detail label="Empresa" value={viewOferta.company} />
            <Detail label="Ubicación" value={viewOferta.location} />
            {viewOferta.direccion && <Detail label="Dirección" value={viewOferta.direccion} />}
            {viewOferta.region && <Detail label="Región" value={viewOferta.region} />}
            <Detail label="Salario" value={viewOferta.salary || '-'} />
            {(viewOferta.sueldoMin || viewOferta.sueldoMax) && (
              <Detail label="Rango sueldo" value={`$${viewOferta.sueldoMin || 0} - $${viewOferta.sueldoMax || 0}`} />
            )}
            {viewOferta.tipoContrato && <Detail label="Tipo contrato" value={viewOferta.tipoContrato} />}
            <Detail label="Fuente" value={viewOferta.fuente} />
            <Detail label="Activa" value={viewOferta.active ? 'Sí' : 'No'} />
            <Detail label="Fecha creación" value={formatDate(viewOferta.createdAt)} />
            {viewOferta.fechaScraping && <Detail label="Fecha scraping" value={formatDate(viewOferta.fechaScraping)} />}
            {viewOferta.tags && viewOferta.tags.length > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-400">Tags</span>
                <div className="flex flex-wrap gap-1 justify-end max-w-[60%]">
                  {viewOferta.tags.map((tag, i) => (
                    <span key={i} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">{tag}</span>
                  ))}
                </div>
              </div>
            )}
            {viewOferta.urlOriginal && (
              <div className="flex justify-between">
                <span className="text-gray-400">URL Original</span>
                <a href={viewOferta.urlOriginal} target="_blank" rel="noopener noreferrer" className="text-[#0f70b7] hover:underline text-xs truncate max-w-[60%]">
                  Ver oferta original
                </a>
              </div>
            )}
            {viewOferta.descripcion && (
              <div className="pt-2 border-t border-gray-700">
                <p className="text-gray-400 mb-1">Descripción</p>
                <p className="text-gray-300 text-xs whitespace-pre-wrap max-h-40 overflow-y-auto">{viewOferta.descripcion}</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* New Oferta Modal */}
      {showModal && <NewOfertaModal onClose={() => setShowModal(false)} onCreated={fetchOfertas} />}
    </div>
  );
};

/* ─── New Oferta Modal ───────────────────────────────────────── */

const NewOfertaModal: React.FC<{ onClose: () => void; onCreated: () => void }> = ({ onClose, onCreated }) => {
  const [form, setForm] = useState({ title: '', company: '', location: '', descripcion: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/api/admin/ofertas', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      onCreated();
      onClose();
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} title="Nueva Oferta">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Título" value={form.title} onChange={(v) => setForm((f) => ({ ...f, title: v }))} required />
        <FormField label="Empresa" value={form.company} onChange={(v) => setForm((f) => ({ ...f, company: v }))} required />
        <FormField label="Ubicación" value={form.location} onChange={(v) => setForm((f) => ({ ...f, location: v }))} />
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Descripción</label>
          <textarea
            value={form.descripcion}
            onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
            rows={4}
            className="w-full bg-[#1f1f1f] border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#f83758] resize-none"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#f83758] hover:bg-[#d62847] disabled:opacity-50 transition-colors flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Crear oferta
          </button>
        </div>
      </form>
    </Modal>
  );
};

/* ─── Usuarios Section ───────────────────────────────────────── */

const ADMIN_EMAILS = ['drozast@gmail.com', 'seba.hormero@gmail.com'];
const ROLE_OPTIONS = ['admin', 'worker', 'company'];

function getRoleBadge(email: string | undefined, role: string) {
  const isAdmin = email ? ADMIN_EMAILS.includes(email.toLowerCase()) : false;
  if (isAdmin || role === 'admin') {
    return { label: 'Admin', classes: 'bg-green-500/15 text-green-400' };
  }
  if (role === 'company' || role === 'empresa') {
    return { label: 'Company', classes: 'bg-[#0f70b7]/15 text-[#0f70b7]' };
  }
  return { label: 'Worker', classes: 'bg-[#0f70b7]/15 text-[#0f70b7]' };
}

const UsuariosSection: React.FC = () => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (roleFilter && roleFilter !== 'all') params.set('role', roleFilter);
      const qs = params.toString();
      const data = await apiFetch(`/api/admin/users${qs ? `?${qs}` : ''}`);
      setUsuarios(Array.isArray(data) ? data : data.users || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    setChangingRole(userId);
    try {
      await apiFetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role: newRole }),
      });
      setUsuarios((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
    } catch (e: any) {
      alert('Error al cambiar rol: ' + e.message);
    } finally {
      setChangingRole(null);
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-6">Usuarios</h2>

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#1f1f1f] border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#f83758]"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="bg-[#1f1f1f] border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-[#f83758] cursor-pointer"
        >
          <option value="all">Todos los roles</option>
          <option value="admin">Admin</option>
          <option value="worker">Worker</option>
          <option value="company">Company</option>
        </select>
        <span className="text-sm text-gray-500 self-center whitespace-nowrap">
          {usuarios.length} usuario{usuarios.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="bg-[#222222] border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-gray-400">
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Rol</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Cambiar rol</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">
                  <span className="flex items-center gap-1">
                    Fecha Registro
                    <ChevronDown className="w-3 h-3 text-gray-400 rotate-180" />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {usuarios.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-gray-500 py-8">No hay usuarios registrados</td>
                </tr>
              ) : (
                usuarios.map((u) => {
                  const badge = getRoleBadge(u.email, u.role);
                  return (
                    <tr key={u.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 text-white font-medium">
                        <div className="flex items-center gap-2">
                          {u.displayName || '-'}
                          {ADMIN_EMAILS.includes((u.email || '').toLowerCase()) && (
                            <Shield className="w-3.5 h-3.5 text-green-400" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{u.email}</td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.classes}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="relative">
                          <select
                            value={u.role || 'worker'}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            disabled={changingRole === u.id}
                            className="bg-[#1f1f1f] border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#f83758] cursor-pointer disabled:opacity-50 appearance-none pr-7"
                          >
                            {ROLE_OPTIONS.map((r) => (
                              <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{formatDate(u.createdAt)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* ─── Manual Scrape Card ─────────────────────────────────────── */

interface ScrapedJob {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  region: string;
}

const ManualScrapeCard: React.FC = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ScrapedJob | null>(null);

  const handleScrape = async () => {
    if (!url.trim()) return;

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      setError('Ingresa una URL valida (https://...)');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const resp = await apiFetch('/api/admin/scrape-url', {
        method: 'POST',
        body: JSON.stringify({ url: url.trim() }),
      });
      setResult({
        id: resp.id,
        title: resp.title || '',
        company: resp.company || '',
        location: resp.location || '',
        salary: resp.salary || 'No especificado',
        region: resp.region || '',
      });
      setUrl('');
      // Auto-dismiss after 5 seconds
      setTimeout(() => setResult(null), 5000);
    } catch (e: any) {
      const msg = e.message || 'Error extrayendo oferta';
      // Try to parse JSON error from response
      if (msg.includes('409')) {
        setError('Esta oferta ya existe en la base de datos');
      } else if (msg.includes('422')) {
        setError('No se pudo extraer informacion de esta pagina. Intenta con otra URL.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleScrape();
    }
  };

  return (
    <div className="bg-[#222222] border border-gray-800 rounded-xl p-5 mb-6">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-8 h-8 rounded-lg bg-[#0f70b7]/15 flex items-center justify-center">
          <Wand2 className="w-4 h-4 text-[#0f70b7]" />
        </div>
        <h3 className="text-white font-semibold">Scraping Manual</h3>
      </div>
      <p className="text-sm text-gray-400 mb-4 ml-11">
        Pega el link de una oferta de trabajo y la extraeremos automaticamente
      </p>

      {/* Input + Button */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="url"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(''); }}
            onKeyDown={handleKeyDown}
            placeholder="https://www.computrabajo.cl/oferta/..."
            disabled={loading}
            className="w-full bg-[#1f1f1f] border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0f70b7] disabled:opacity-50 transition-colors"
          />
        </div>
        <button
          onClick={handleScrape}
          disabled={loading || !url.trim()}
          className="flex items-center gap-2 bg-[#0f70b7] hover:bg-[#0f70b7] disabled:opacity-40 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Extrayendo...
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4" />
              Extraer oferta
            </>
          )}
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="mt-4 flex items-center gap-3 text-sm text-[#0f70b7]">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Descargando pagina, extrayendo informacion con IA y guardando...</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Success state */}
      {result && (
        <div className="mt-4 bg-green-500/10 border border-green-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            <span className="text-sm font-medium text-green-300">Oferta extraida y guardada</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2 text-gray-300">
              <Briefcase className="w-3.5 h-3.5 text-gray-500 shrink-0" />
              <span className="truncate">{result.title}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-300">
              <Building2 className="w-3.5 h-3.5 text-gray-500 shrink-0" />
              <span className="truncate">{result.company || 'No especificada'}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-300">
              <MapPin className="w-3.5 h-3.5 text-gray-500 shrink-0" />
              <span className="truncate">{result.location || 'No especificada'}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-300">
              <DollarSign className="w-3.5 h-3.5 text-gray-500 shrink-0" />
              <span className="truncate">{result.salary}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Scraper Section ────────────────────────────────────────── */

const SCRAPER_PHASES = [
  { key: 'searching', label: 'Buscando ofertas en Computrabajo...', icon: Search },
  { key: 'normalizing', label: 'Normalizando con IA...', icon: Bot },
  { key: 'inserting', label: 'Insertando ofertas nuevas...', icon: Plus },
];

interface ScraperResult {
  inserted: number;
  duplicates: number;
}

const ScraperSection: React.FC = () => {
  const [status, setStatus] = useState<ScraperStatus | null>(null);
  const [logs, setLogs] = useState<ScraperLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runMessage, setRunMessage] = useState('');
  const [error, setError] = useState('');
  const [scraperPhase, setScraperPhase] = useState(0);
  const [completedResult, setCompletedResult] = useState<ScraperResult | null>(null);
  const [lockError, setLockError] = useState<string | null>(null);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const data = await apiFetch('/api/admin/scraper/logs');
      setStatus(data.status || null);
      setLogs(data.logs || []);
      setLoading(false);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    return () => {
      if (refreshRef.current) clearInterval(refreshRef.current);
      if (phaseRef.current) clearInterval(phaseRef.current);
    };
  }, [fetchData]);

  const handleRun = async () => {
    setRunning(true);
    setRunMessage('');
    setCompletedResult(null);
    setScraperPhase(0);

    // Cycle through phases to show progress
    if (phaseRef.current) clearInterval(phaseRef.current);
    let currentPhase = 0;
    phaseRef.current = setInterval(() => {
      currentPhase = Math.min(currentPhase + 1, SCRAPER_PHASES.length - 1);
      setScraperPhase(currentPhase);
    }, 15000); // Advance phase every 15s

    try {
      const resp = await apiFetch('/api/admin/scraper/run', { method: 'POST' });
      setRunMessage(resp.message || 'Scraper iniciado');
      // Auto-refresh cada 8s para mostrar progreso
      if (refreshRef.current) clearInterval(refreshRef.current);
      refreshRef.current = setInterval(async () => {
        try {
          await fetchData();
          // Stop refreshing when scraper finishes
          if (!status?.isRunning) {
            if (refreshRef.current) clearInterval(refreshRef.current);
            if (phaseRef.current) clearInterval(phaseRef.current);
            setRunning(false);
            setRunMessage('');
            // Show completion summary from latest log
            const latestData = await apiFetch('/api/admin/scraper/logs');
            const latestLogs: ScraperLog[] = latestData.logs || [];
            if (latestLogs.length > 0) {
              setLogs(latestLogs);
              setCompletedResult({
                inserted: latestLogs[0].inserted ?? 0,
                duplicates: latestLogs[0].duplicates ?? 0,
              });
            }
          }
        } catch {}
      }, 8000);
      // Safety: stop after 10 min
      setTimeout(() => {
        if (refreshRef.current) clearInterval(refreshRef.current);
        if (phaseRef.current) clearInterval(phaseRef.current);
        setRunning(false);
        setRunMessage('');
        fetchData();
      }, 600000);
    } catch (e: any) {
      if (phaseRef.current) clearInterval(phaseRef.current);
      setRunMessage('');
      setRunning(false);
      // If 409 (lock conflict), show force option
      if (e.message?.includes('409') || e.message?.includes('ejecutándose')) {
        setLockError(e.message);
      } else {
        alert(e.message || 'Error ejecutando scraper');
      }
    }
  };

  const handleForceRun = async () => {
    setLockError(null);
    try {
      await apiFetch('/api/admin/scraper/stop', { method: 'POST' });
      await handleRun();
    } catch (e: any) {
      alert(e.message || 'Error forzando ejecución');
    }
  };

  const handleToggle = async () => {
    try {
      const newEnabled = !status?.enabled;
      await apiFetch('/api/admin/config', {
        method: 'PUT',
        body: JSON.stringify({ enabled: newEnabled }),
      });
      // If disabling, also clear the lock
      if (!newEnabled) {
        await apiFetch('/api/admin/scraper/stop', { method: 'POST' }).catch(() => {});
      }
      await fetchData();
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-6">Scraper</h2>

      {/* Running Banner with live phase */}
      {(status?.isRunning || running) && (
        <div className="bg-[#0f70b7]/10 border border-[#0f70b7]/30 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 className="w-5 h-5 text-[#0f70b7] animate-spin shrink-0" />
            <div>
              <p className="text-[#0f70b7] font-medium">Scraper ejecutándose ahora</p>
              <p className="text-[#0f70b7]/70 text-sm">Iniciado por {status?.runningBy || 'tu'}. Los resultados aparecerán aquí automáticamente.</p>
            </div>
          </div>
          {/* Phase indicators */}
          <div className="flex flex-col gap-2 mt-3 ml-8">
            {SCRAPER_PHASES.map((phase, idx) => {
              const PhaseIcon = phase.icon;
              const isActive = idx === scraperPhase;
              const isDone = idx < scraperPhase;
              return (
                <div key={phase.key} className={`flex items-center gap-2 text-sm transition-opacity ${
                  isActive ? 'opacity-100' : isDone ? 'opacity-50' : 'opacity-30'
                }`}>
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                  ) : isActive ? (
                    <Loader2 className="w-4 h-4 text-[#0f70b7] animate-spin shrink-0" />
                  ) : (
                    <PhaseIcon className="w-4 h-4 text-gray-500 shrink-0" />
                  )}
                  <span className={isActive ? 'text-[#0f70b7]' : isDone ? 'text-green-400' : 'text-gray-500'}>
                    {phase.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Completion Summary */}
      {completedResult && !running && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-4 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-green-400 shrink-0" />
          <div>
            <p className="text-green-300 font-medium">Scraper completado</p>
            <p className="text-green-400/80 text-sm">
              {completedResult.inserted} nuevas ofertas publicadas, {completedResult.duplicates} duplicadas evitadas
            </p>
          </div>
          <button
            onClick={() => setCompletedResult(null)}
            className="ml-auto p-1 text-green-400/50 hover:text-green-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Status Banner */}
      <div className={`rounded-xl p-5 mb-6 border ${status?.enabled ? 'bg-green-500/10 border-green-500/30' : 'bg-gray-800/50 border-gray-700'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-4 h-4 rounded-full ${status?.isRunning ? 'bg-[#0f70b7] animate-pulse' : status?.enabled ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
            <div>
              <p className="text-white font-semibold text-lg">
                {status?.isRunning ? 'Ejecutando scraper...' : status?.enabled ? 'Scraper ACTIVO' : 'Scraper DETENIDO'}
              </p>
              <p className="text-sm text-gray-400">
                {status?.isRunning
                  ? 'Buscando ofertas en Computrabajo, normalizando con IA y guardando...'
                  : status?.enabled
                  ? `Ejecuta automáticamente cada ${status?.frequency || 30} min`
                  : 'No se ejecutará automáticamente. Puedes ejecutar manualmente.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggle}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                status?.enabled
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                  : 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30'
              }`}
            >
              {status?.enabled ? 'Detener automático' : 'Activar automático'}
            </button>
            <button
              onClick={handleRun}
              disabled={running}
              className="flex items-center gap-2 bg-[#f83758] hover:bg-[#d62847] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {running ? 'Ejecutando...' : 'Ejecutar ahora'}
            </button>
          </div>
        </div>
      </div>

      {/* Manual Scrape */}
      <ManualScrapeCard />

      {/* Lock Error */}
      {lockError && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6">
          <p className="text-amber-300 font-medium mb-2">Scraper bloqueado</p>
          <p className="text-amber-400/70 text-sm mb-3">Hay una ejecución anterior que no terminó correctamente.</p>
          <button
            onClick={handleForceRun}
            className="bg-amber-500 hover:bg-amber-600 text-black font-medium px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Forzar nueva ejecución
          </button>
        </div>
      )}

      {/* Run Message */}
      {runMessage && (
        <div className="bg-[#0f70b7]/10 border border-[#0f70b7]/30 rounded-xl p-4 mb-6 flex items-start gap-3">
          <Loader2 className="w-5 h-5 text-[#0f70b7] animate-spin shrink-0 mt-0.5" />
          <div>
            <p className="text-[#0f70b7] font-medium">{runMessage}</p>
            <p className="text-[#0f70b7]/70 text-sm mt-1">El scraper busca ofertas en los portales, normaliza con IA y las guarda. Puede tomar 5-10 minutos.</p>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      {logs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-[#222222] border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{logs.length}</p>
            <p className="text-xs text-gray-400">Ejecuciones</p>
          </div>
          <div className="bg-[#222222] border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-400">{logs.reduce((s, l) => s + (l.inserted || 0), 0)}</p>
            <p className="text-xs text-gray-400">Total insertadas</p>
          </div>
          <div className="bg-[#222222] border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-yellow-400">{logs.reduce((s, l) => s + (l.duplicates || 0), 0)}</p>
            <p className="text-xs text-gray-400">Duplicadas evitadas</p>
          </div>
          <div className="bg-[#222222] border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-gray-300">
              {logs[0] ? formatDate(logs[0].timestamp) : 'Nunca'}
            </p>
            <p className="text-xs text-gray-400">Última ejecución</p>
          </div>
        </div>
      )}

      {/* Logs Table */}
      <div className="bg-[#222222] border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-300">Historial de ejecuciones</h3>
          <button onClick={fetchData} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
            Actualizar
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-gray-400">
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Iniciado por</th>
                <th className="px-4 py-3 font-medium">Procesadas</th>
                <th className="px-4 py-3 font-medium">Nuevas</th>
                <th className="px-4 py-3 font-medium">Duplicadas</th>
                <th className="px-4 py-3 font-medium">Errores</th>
                <th className="px-4 py-3 font-medium">Duración</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-gray-500 py-12">
                    <div className="flex flex-col items-center gap-2">
                      <Play className="w-8 h-8 text-gray-600" />
                      <p>Aún no se ha ejecutado el scraper</p>
                      <p className="text-xs text-gray-600">Presiona "Ejecutar ahora" para iniciar</p>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 text-white">{formatDate(log.timestamp)}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{log.triggeredBy || 'manual'}</td>
                    <td className="px-4 py-3 text-gray-300">{log.totalProcessed ?? 0}</td>
                    <td className="px-4 py-3 text-green-400 font-medium">{log.inserted ?? 0}</td>
                    <td className="px-4 py-3 text-yellow-400">{log.duplicates ?? 0}</td>
                    <td className="px-4 py-3 text-red-400">{log.errors ?? 0}</td>
                    <td className="px-4 py-3 text-gray-400">{log.duration ? `${Math.round(log.duration / 1000)}s` : '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        (log.errors ?? 0) > 0
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-green-500/20 text-green-400'
                      }`}>
                        {(log.errors ?? 0) > 0 ? 'Con errores' : 'OK'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* ─── Config Section ─────────────────────────────────────────── */

const ALL_SOURCES = ['computrabajo', 'chiletrabajos', 'jooble', 'empleospublicos'];
const REGIONS = [
  'Todo Chile',
  'Metropolitana', 'Valparaíso', 'Biobío', 'Araucanía', 'Maule',
  "O'Higgins", 'Los Lagos', 'Coquimbo', 'Antofagasta', 'Tarapacá',
  'Atacama', 'Ñuble', 'Los Ríos', 'Arica y Parinacota', 'Aysén', 'Magallanes',
];

const ConfigSection: React.FC = () => {
  const [config, setConfig] = useState<ConfigData>({
    frequency: 60,
    enabled: true,
    sources: ['computrabajo'],
    region: 'Metropolitana',
    maxPerRun: 100,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiFetch('/api/admin/config')
      .then((data) => setConfig(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await apiFetch('/api/admin/config', {
        method: 'PUT',
        body: JSON.stringify(config),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleSource = (src: string) => {
    setConfig((c) => ({
      ...c,
      sources: c.sources.includes(src) ? c.sources.filter((s) => s !== src) : [...c.sources, src],
    }));
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-6">Configuración</h2>
      <div className="bg-[#222222] border border-gray-800 rounded-xl p-6 space-y-6 max-w-2xl">
        {/* Enabled Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-medium">Scraper habilitado</p>
            <p className="text-sm text-gray-400">Activar o desactivar el scraper automático</p>
          </div>
          <button
            onClick={() => setConfig((c) => ({ ...c, enabled: !c.enabled }))}
            className={`w-12 h-6 rounded-full relative transition-colors ${config.enabled ? 'bg-green-500' : 'bg-gray-600'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${config.enabled ? 'left-6' : 'left-0.5'}`} />
          </button>
        </div>

        {/* Frequency */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Frecuencia de ejecución</label>
          <select
            value={config.frequency}
            onChange={(e) => setConfig((c) => ({ ...c, frequency: Number(e.target.value) }))}
            className="w-full bg-[#1f1f1f] border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-[#f83758]"
          >
            <option value={15}>Cada 15 minutos</option>
            <option value={30}>Cada 30 minutos</option>
            <option value={60}>Cada 1 hora</option>
            <option value={120}>Cada 2 horas</option>
          </select>
        </div>

        {/* Sources */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Fuentes</label>
          <div className="flex flex-wrap gap-3">
            {ALL_SOURCES.map((src) => (
              <label key={src} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.sources.includes(src)}
                  onChange={() => toggleSource(src)}
                  className="w-4 h-4 rounded border-gray-600 bg-[#1f1f1f] text-[#f83758] focus:ring-[#f83758] focus:ring-offset-0"
                />
                <span className="text-sm text-gray-300 capitalize">{src}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Region */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Región</label>
          <select
            value={config.region}
            onChange={(e) => setConfig((c) => ({ ...c, region: e.target.value }))}
            className="w-full bg-[#1f1f1f] border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-[#f83758]"
          >
            {REGIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* Max per run */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Máximo por ejecución</label>
          <input
            type="number"
            min={1}
            max={1000}
            value={config.maxPerRun}
            onChange={(e) => setConfig((c) => ({ ...c, maxPerRun: Number(e.target.value) }))}
            className="w-full bg-[#1f1f1f] border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-[#f83758]"
          />
        </div>

        {/* Save */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-[#f83758] hover:bg-[#d62847] disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Guardar cambios
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-green-400 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              Guardado
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

/* ─── Discount Codes Section ─────────────────────────────────── */

interface DiscountCode {
  id: string;
  code: string;
  monthsFree: number;
  maxUses: number;
  currentUses: number;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
}

const CodesSection: React.FC = () => {
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newMonths, setNewMonths] = useState(3);
  const [newMaxUses, setNewMaxUses] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const fetchCodes = useCallback(async () => {
    try {
      setError('');
      const data = await apiFetch('/api/admin/discount-codes');
      setCodes(data.codes || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCodes(); }, [fetchCodes]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) return;
    setSaving(true);
    setMessage('');
    try {
      await apiFetch('/api/admin/discount-codes', {
        method: 'POST',
        body: JSON.stringify({
          code: newCode.trim().toUpperCase(),
          monthsFree: newMonths,
          maxUses: newMaxUses || -1,
        }),
      });
      setNewCode('');
      setNewMonths(3);
      setNewMaxUses(0);
      setCreating(false);
      setMessage('Código creado exitosamente');
      fetchCodes();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, currentActive: boolean) => {
    try {
      await apiFetch(`/api/admin/discount-codes/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !currentActive }),
      });
      setCodes(prev => prev.map(c => c.id === id ? { ...c, isActive: !currentActive } : c));
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este código de descuento?')) return;
    try {
      await apiFetch(`/api/admin/discount-codes/${id}`, { method: 'DELETE' });
      setCodes(prev => prev.filter(c => c.id !== id));
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (loading) return <LoadingState />;
  if (error && codes.length === 0) return <ErrorState message={error} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Códigos de Descuento</h2>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 bg-[#f83758] hover:bg-[#d62847] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo código
        </button>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${message.includes('error') || message.includes('Error') ? 'bg-red-500/10 text-red-400 border border-red-500/30' : 'bg-green-500/10 text-green-400 border border-green-500/30'}`}>
          {message}
        </div>
      )}

      {/* Create modal inline */}
      {creating && (
        <form onSubmit={handleCreate} className="mb-6 bg-[#222222] border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Crear nuevo código de descuento</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Código</label>
              <input
                type="text"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="Ej: FABULOSO"
                required
                className="w-full bg-[#1f1f1f] border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#f83758] uppercase"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Meses gratis</label>
              <input
                type="number"
                min={1}
                max={12}
                value={newMonths}
                onChange={(e) => setNewMonths(Number(e.target.value))}
                className="w-full bg-[#1f1f1f] border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-[#f83758]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Usos máximos (0 = ilimitado)</label>
              <input
                type="number"
                min={0}
                value={newMaxUses}
                onChange={(e) => setNewMaxUses(Number(e.target.value))}
                className="w-full bg-[#1f1f1f] border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-[#f83758]"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button
              type="submit"
              disabled={saving || !newCode.trim()}
              className="flex items-center gap-2 bg-[#f83758] hover:bg-[#d62847] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Crear código
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="text-gray-400 hover:text-white text-sm px-4 py-2"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Codes table */}
      {codes.length === 0 ? (
        <div className="bg-[#222222] border border-gray-800 rounded-xl p-12 text-center">
          <Tag className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No hay códigos de descuento creados.</p>
          <p className="text-gray-500 text-xs mt-1">Crea uno para ofrecer meses gratis de MarIA Premium.</p>
        </div>
      ) : (
        <div className="bg-[#222222] border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-gray-400 font-medium px-6 py-3">Código</th>
                <th className="text-left text-gray-400 font-medium px-6 py-3">Meses gratis</th>
                <th className="text-left text-gray-400 font-medium px-6 py-3">Usos</th>
                <th className="text-left text-gray-400 font-medium px-6 py-3">Estado</th>
                <th className="text-left text-gray-400 font-medium px-6 py-3">Creado por</th>
                <th className="text-left text-gray-400 font-medium px-6 py-3">Fecha</th>
                <th className="text-right text-gray-400 font-medium px-6 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="px-6 py-3">
                    <span className="font-mono text-white font-semibold bg-gray-800 px-2 py-0.5 rounded text-xs">{c.code}</span>
                  </td>
                  <td className="px-6 py-3 text-gray-300">{c.monthsFree}</td>
                  <td className="px-6 py-3 text-gray-300">
                    {c.maxUses === -1 || c.maxUses === 0 ? (
                      <span>{c.currentUses} / ∞</span>
                    ) : (
                      <span>{c.currentUses} / {c.maxUses}</span>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    <button
                      onClick={() => handleToggle(c.id, c.isActive)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                        c.isActive
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                      }`}
                    >
                      {c.isActive ? <CheckCircle2 className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      {c.isActive ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td className="px-6 py-3 text-gray-400 text-xs">{c.createdBy}</td>
                  <td className="px-6 py-3 text-gray-400 text-xs">{formatDate(c.createdAt)}</td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => { navigator.clipboard.writeText(c.code); }}
                        className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                        title="Copiar código"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="p-1.5 rounded hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

/* ─── Shared UI Components ───────────────────────────────────── */

const LoadingState = () => (
  <div className="flex items-center justify-center py-20">
    <Loader2 className="w-6 h-6 text-[#f83758] animate-spin" />
  </div>
);

const ErrorState: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex items-center justify-center py-20">
    <div className="flex items-center gap-2 text-red-400 text-sm">
      <AlertCircle className="w-5 h-5" />
      <span>{message}</span>
    </div>
  </div>
);

const Modal: React.FC<{ onClose: () => void; title: string; children: React.ReactNode }> = ({ onClose, title, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
    <div
      className="bg-[#222222] border border-gray-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="px-6 py-4">{children}</div>
    </div>
  </div>
);

const Detail: React.FC<{ label: string; value: string | number | undefined }> = ({ label, value }) => (
  <div className="flex justify-between">
    <span className="text-gray-400">{label}</span>
    <span className="text-white font-medium">{value ?? '-'}</span>
  </div>
);

const FormField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}> = ({ label, value, onChange, required }) => (
  <div>
    <label className="block text-sm font-medium text-gray-300 mb-1.5">{label}</label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className="w-full bg-[#1f1f1f] border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#f83758]"
    />
  </div>
);

/* ─── Main AdminPanel ────────────────────────────────────────── */

const AdminPanel: React.FC = () => {
  const [section, setSection] = useState<Section>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const renderSection = () => {
    switch (section) {
      case 'dashboard':    return <DashboardSection />;
      case 'analytics':   return <AnalyticsSection />;
      case 'ofertas':     return <OfertasSection />;
      case 'usuarios':    return <UsuariosSection />;
      case 'scraper':     return <ScraperSection />;
      case 'config':      return <ConfigSection />;
      case 'codes':       return <CodesSection />;
      case 'nouus':       return <NouusSection />;
      case 'suscripciones': return <SuscripcionesSection />;
      case 'verificaciones': return <VerificacionesSection />;
      case 'banners':     return <BannersSection />;
      case 'anuncios':    return <AnunciosSection />;
      case 'soporte':     return <SoporteSection />;
      case 'maria':       return <MariaSection />;
      case 'calificaciones': return <CalificacionesSection />;
      case 'monetizacion': return <MonetizacionSection />;
      default:            return <DashboardSection />;
    }
  };

  return (
    <div className="min-h-screen bg-[#1f1f1f] flex">
      <Sidebar
        active={section}
        onChange={setSection}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
      />
      <main className="flex-1 p-6 lg:p-8 overflow-y-auto">{renderSection()}</main>
    </div>
  );
};

export default AdminPanel;
