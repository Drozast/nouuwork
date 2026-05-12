import React, { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Search, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { auth } from '../../lib/firebase';

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

/* ─── Helpers ────────────────────────────────────────────────── */

function fmtDate(d: Date) {
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function getDefaultFrom(days = 30) {
  const d = new Date();
  d.setDate(d.getDate() - days + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getDefaultTo() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

/* ─── DateRangePicker ────────────────────────────────────────── */

const DateRangePicker: React.FC<{
  from: Date; to: Date; onChange: (from: Date, to: Date) => void;
}> = ({ from, to, onChange }) => (
  <div className="flex items-center gap-2 text-sm">
    <input
      type="date"
      value={fmtISODate(from)}
      onChange={e => onChange(new Date(e.target.value + 'T00:00:00'), to)}
      className="bg-[#1f1f1f] border border-gray-700 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-[#f83758]"
    />
    <span className="text-gray-500">–</span>
    <input
      type="date"
      value={fmtISODate(to)}
      onChange={e => {
        const d = new Date(e.target.value + 'T23:59:59');
        onChange(from, d);
      }}
      className="bg-[#1f1f1f] border border-gray-700 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-[#f83758]"
    />
  </div>
);

/* ─── Pagination ─────────────────────────────────────────────── */

const Pagination: React.FC<{
  offset: number; limit: number; total: number; onChange: (o: number) => void;
}> = ({ offset, limit, total, onChange }) => {
  const pages = Math.ceil(total / limit);
  const current = Math.floor(offset / limit) + 1;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-gray-500 text-xs">{total} resultados</span>
      <button
        onClick={() => onChange(Math.max(0, offset - limit))}
        disabled={offset === 0}
        className="p-1 rounded hover:bg-gray-700 text-gray-400 disabled:opacity-30"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="text-gray-400 text-xs">{current} / {pages || 1}</span>
      <button
        onClick={() => onChange(offset + limit)}
        disabled={offset + limit >= total}
        className="p-1 rounded hover:bg-gray-700 text-gray-400 disabled:opacity-30"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};

/* ─── Detail Types ───────────────────────────────────────────── */

type DetailType = 'visits' | 'jobs-viewed' | 'jobs-clicked' | 'events' | 'advanced';
export type { DetailType };

interface DetailModalProps {
  type: DetailType;
  onClose: () => void;
}

/* ─── Visits Detail ──────────────────────────────────────────── */

const VisitsDetail: React.FC = () => {
  const [from, setFrom] = useState(() => getDefaultFrom(30));
  const [to, setTo] = useState(() => getDefaultTo());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pageFilter, setPageFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        from: fmtISODate(from), to: fmtISODate(to),
      });
      if (pageFilter) params.set('page', pageFilter);
      const res = await apiFetch(`/api/admin/analytics/visits-detail?${params}`);
      setData(res);
    } catch (e: any) { setData({ error: e.message }); }
    finally { setLoading(false); }
  }, [from, to, pageFilter]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-[#f83758] animate-spin" /></div>;
  if (data?.error) return <p className="text-red-400 text-sm py-8 text-center">{data.error}</p>;

  const maxVisits = Math.max(...(data?.daily || []).map((d: any) => d.total), 1);

  return (
    <div>
      <div className="flex items-center gap-4 mb-5 flex-wrap">
        <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
        <select
          value={pageFilter}
          onChange={e => setPageFilter(e.target.value)}
          className="bg-[#1f1f1f] border border-gray-700 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-[#f83758]"
        >
          <option value="">Todas las páginas</option>
          {(data?.pagesList || []).map((p: string) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <span className="text-xs text-gray-500">{data?.totalRecords || 0} registros</span>
      </div>

      {/* Mini chart */}
      <div className="bg-[#1f1f1f] border border-gray-800 rounded-xl p-4 mb-5">
        <div className="flex items-end gap-1 h-28 overflow-x-auto pt-8 pb-1" style={{ overflowY: 'clip' }}>
          {(data?.daily || []).map((d: any) => (
            <div key={d.date} className="flex-1 min-w-[24px] flex flex-col items-center justify-end h-full group relative cursor-default">
              <div className="w-full rounded-sm bg-[#f83758] transition-all group-hover:ring-1 group-hover:ring-white/30"
                style={{ height: `${Math.max(4, (d.total / maxVisits) * 80)}px`, opacity: d.total === 0 ? 0.2 : 0.85 }} />
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-20 border border-gray-700">
                {d.date.slice(5)}: {d.total}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-1 mt-1">
          {(data?.daily || []).filter((_: any, i: number) => i % 5 === 0).map((d: any) => (
            <span key={d.date} className="text-[8px] text-gray-600 flex-1 text-left">{d.date.slice(5)}</span>
          ))}
        </div>
      </div>

      {/* Daily table */}
      <div className="bg-[#1f1f1f] border border-gray-800 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-[#1f1f1f]">
            <tr className="border-b border-gray-800 text-left text-gray-400">
              <th className="px-4 py-2 font-medium">Fecha</th>
              <th className="px-4 py-2 font-medium text-right">Visitas</th>
              <th className="px-4 py-2 font-medium hidden sm:table-cell">Páginas</th>
            </tr>
          </thead>
          <tbody>
            {(data?.daily || []).map((d: any) => (
              <tr key={d.date} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-4 py-2 text-white">{d.date}</td>
                <td className="px-4 py-2 text-white font-bold text-right">{d.total}</td>
                <td className="px-4 py-2 text-gray-400 text-xs hidden sm:table-cell">
                  {Object.entries(d.pages || {}).map(([p, c]) => (
                    <span key={p} className="mr-2">{p}: <span className="text-white">{c as number}</span></span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ─── Jobs Detail (viewed / clicked) ─────────────────────────── */

const JobsDetail: React.FC<{ type: 'viewed' | 'clicked' }> = ({ type }) => {
  const [from, setFrom] = useState(() => getDefaultFrom(30));
  const [to, setTo] = useState(() => getDefaultTo());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 30;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        from: fmtISODate(from), to: fmtISODate(to), type,
        limit: String(limit), offset: String(offset),
      });
      if (search) params.set('search', search);
      const res = await apiFetch(`/api/admin/analytics/jobs-detail?${params}`);
      setData(res);
    } catch (e: any) { setData({ error: e.message }); }
    finally { setLoading(false); }
  }, [from, to, search, offset, type]);

  useEffect(() => { load(); }, [load]);

  const title = type === 'viewed' ? 'Ofertas más Vistas' : 'Ofertas más Clickeadas';

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-[#f83758] animate-spin" /></div>;
  if (data?.error) return <p className="text-red-400 text-sm py-8 text-center">{data.error}</p>;

  return (
    <div>
      <div className="flex items-center gap-4 mb-5 flex-wrap">
        <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); setOffset(0); }} />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text" placeholder="Buscar oferta..."
            value={search}
            onChange={e => { setSearch(e.target.value); setOffset(0); }}
            className="bg-[#1f1f1f] border border-gray-700 rounded-lg pl-9 pr-4 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#f83758] w-48"
          />
        </div>
        <Pagination offset={offset} limit={limit} total={data?.total || 0} onChange={setOffset} />
      </div>

      <div className="bg-[#1f1f1f] border border-gray-800 rounded-xl overflow-hidden max-h-[500px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-[#1f1f1f]">
            <tr className="border-b border-gray-800 text-left text-gray-400">
              <th className="px-4 py-2 font-medium w-8">#</th>
              <th className="px-4 py-2 font-medium">Título</th>
              <th className="px-4 py-2 font-medium hidden sm:table-cell">Empresa</th>
              <th className="px-4 py-2 font-medium text-right">{type === 'viewed' ? 'Vistas' : 'Clicks'}</th>
              <th className="px-4 py-2 font-medium hidden md:table-cell text-right">Último</th>
            </tr>
          </thead>
          <tbody>
            {(data?.jobs || []).map((j: any, i: number) => (
              <tr key={j.title} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-4 py-2 text-gray-500 text-xs">{offset + i + 1}</td>
                <td className="px-4 py-2 text-white text-xs max-w-xs truncate">{j.title}</td>
                <td className="px-4 py-2 text-gray-400 text-xs hidden sm:table-cell">{j.company}</td>
                <td className="px-4 py-2 text-white font-bold text-xs text-right">{j.count}</td>
                <td className="px-4 py-2 text-gray-500 text-xs hidden md:table-cell text-right">
                  {j.lastEvent ? new Date(j.lastEvent).toLocaleDateString('es-CL') : '-'}
                </td>
              </tr>
            ))}
            {(!data?.jobs || data.jobs.length === 0) && (
              <tr><td colSpan={5} className="text-center text-gray-500 py-8">Sin datos</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ─── Events Detail ──────────────────────────────────────────── */

const EV_LABELS: Record<string, string> = {
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

const EventsDetail: React.FC = () => {
  const [from, setFrom] = useState(() => getDefaultFrom(30));
  const [to, setTo] = useState(() => getDefaultTo());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 30;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        from: fmtISODate(from), to: fmtISODate(to),
        limit: String(limit), offset: String(offset),
      });
      if (typeFilter) params.set('type', typeFilter);
      const res = await apiFetch(`/api/admin/analytics/events-detail?${params}`);
      setData(res);
    } catch (e: any) { setData({ error: e.message }); }
    finally { setLoading(false); }
  }, [from, to, typeFilter, offset]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-[#f83758] animate-spin" /></div>;
  if (data?.error) return <p className="text-red-400 text-sm py-8 text-center">{data.error}</p>;

  return (
    <div>
      <div className="flex items-center gap-4 mb-5 flex-wrap">
        <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); setOffset(0); }} />
        <select
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setOffset(0); }}
          className="bg-[#1f1f1f] border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#f83758]"
        >
          <option value="">Todos los eventos</option>
          {(data?.eventTypes || []).map((t: string) => (
            <option key={t} value={t}>{EV_LABELS[t] || t}</option>
          ))}
        </select>
        <Pagination offset={offset} limit={limit} total={data?.total || 0} onChange={setOffset} />
      </div>

      <div className="bg-[#1f1f1f] border border-gray-800 rounded-xl overflow-hidden max-h-[500px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-[#1f1f1f]">
            <tr className="border-b border-gray-800 text-left text-gray-400">
              <th className="px-4 py-2 font-medium">Evento</th>
              <th className="px-4 py-2 font-medium hidden sm:table-cell">Oferta</th>
              <th className="px-4 py-2 font-medium hidden md:table-cell">Usuario</th>
              <th className="px-4 py-2 font-medium text-right">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {(data?.events || []).map((ev: any) => (
              <tr key={ev.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-4 py-2">
                  <span className="text-xs text-white">{EV_LABELS[ev.type] || ev.type}</span>
                </td>
                <td className="px-4 py-2 text-gray-400 text-xs max-w-[200px] truncate hidden sm:table-cell">
                  {ev.jobTitle || '-'}
                </td>
                <td className="px-4 py-2 text-gray-500 text-xs hidden md:table-cell font-mono">
                  {ev.userId ? ev.userId.slice(0, 12) + '...' : 'Anónimo'}
                </td>
                <td className="px-4 py-2 text-gray-400 text-xs text-right">
                  {ev.createdAt ? new Date(ev.createdAt).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                </td>
              </tr>
            ))}
            {(!data?.events || data.events.length === 0) && (
              <tr><td colSpan={4} className="text-center text-gray-500 py-8">Sin eventos en este período</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ─── KPIs Advanced ──────────────────────────────────────────── */

const KPIsAdvanced: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/admin/analytics/kpi-advanced')
      .then(setData).catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-[#f83758] animate-spin" /></div>;
  if (!data) return <p className="text-gray-500 text-sm py-8 text-center">Sin datos disponibles</p>;

  const maxPeak = Math.max(...(data.peakHours || []).map((h: any) => h.count), 1);
  const maxPage = Math.max(...(data.pageRanking || []).map((p: any) => p.count), 1);

  return (
    <div className="space-y-6">
      {/* DAU */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Usuarios Activos por Día (DAU)</h3>
        <div className="bg-[#1f1f1f] border border-gray-800 rounded-xl p-4">
          <div className="flex items-end gap-1 h-24 overflow-x-auto pt-8 pb-1" style={{ overflowY: 'clip' }}>
            {data.dau.map((d: any) => {
              const maxDAU = Math.max(...data.dau.map((x: any) => x.count), 1);
              return (
                <div key={d.date} className="flex-1 min-w-[20px] flex flex-col items-center justify-end h-full group relative cursor-default">
                  <div className="w-full rounded-sm bg-green-500 group-hover:ring-1 group-hover:ring-white/30"
                    style={{ height: `${Math.max(4, (d.count / maxDAU) * 75)}px`, opacity: d.count === 0 ? 0.2 : 0.85 }} />
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-20 border border-gray-700">
                    {d.date.slice(5)}: {d.count}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Peak Hours */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Horas Pico (últimos 30 días)</h3>
        <div className="bg-[#1f1f1f] border border-gray-800 rounded-xl p-4">
          <div className="flex items-end gap-0.5 h-20">
            {data.peakHours.map((h: any) => (
              <div key={h.hour} className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-default">
                <div className="w-full rounded-sm bg-[#0f70b7] group-hover:ring-1 group-hover:ring-white/30"
                  style={{ height: `${Math.max(4, (h.count / maxPeak) * 60)}px`, opacity: h.count === 0 ? 0.1 : 0.8 }} />
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-20 border border-gray-700">
                  {h.hour}h: {h.count}
                </div>
                <span className="text-[8px] text-gray-600 mt-1">{h.hour}h</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Page Ranking */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Ranking de Páginas (30 días)</h3>
        <div className="bg-[#1f1f1f] border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-gray-400">
                <th className="px-4 py-2 font-medium">Página</th>
                <th className="px-4 py-2 font-medium text-right">Visitas</th>
                <th className="px-4 py-2 font-medium hidden sm:table-cell">Barra</th>
              </tr>
            </thead>
            <tbody>
              {data.pageRanking.map((p: any, i: number) => (
                <tr key={p.page} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-2 text-white text-xs">{p.page}</td>
                  <td className="px-4 py-2 text-white font-bold text-xs text-right">{p.count}</td>
                  <td className="px-4 py-2 hidden sm:table-cell">
                    <div className="bg-gray-800 rounded-full h-2">
                      <div className="h-2 rounded-full bg-[#f83758]" style={{ width: `${(p.count / maxPage) * 100}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* ─── Main Detail Modal ──────────────────────────────────────── */

const TITLES: Record<DetailType, string> = {
  visits: 'Visitas por Día — Detalle',
  'jobs-viewed': 'Ofertas más Vistas — Detalle',
  'jobs-clicked': 'Ofertas más Clickeadas — Detalle',
  events: 'Eventos — Detalle',
  advanced: 'KPIs Avanzados',
};

export const AnalyticsDetailModal: React.FC<DetailModalProps> = ({ type, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm p-4 pt-12 overflow-y-auto" onClick={onClose}>
    <div
      className="bg-[#222222] border border-gray-800 rounded-2xl w-full max-w-5xl shadow-2xl"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 sticky top-0 bg-[#222222] z-10">
        <h2 className="text-lg font-bold text-white">{TITLES[type]}</h2>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-6">
        {type === 'visits' && <VisitsDetail />}
        {(type === 'jobs-viewed' || type === 'jobs-clicked') && (
          <JobsDetail type={type === 'jobs-viewed' ? 'viewed' : 'clicked'} />
        )}
        {type === 'events' && <EventsDetail />}
        {type === 'advanced' && <KPIsAdvanced />}
      </div>
    </div>
  </div>
);

export default AnalyticsDetailModal;
