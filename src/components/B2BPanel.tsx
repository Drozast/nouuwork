import React, { useState, useMemo, useCallback } from "react";
import {
  Building,
  Briefcase,
  Users,
  Plus,
  Trash2,
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Clock,
  Bot,
  Loader2,
  X,
  Filter,
  GraduationCap,
  RotateCcw,
  Pencil,
  CheckCircle2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Star,
  Zap,
} from "lucide-react";
import { useAuth } from "../lib/auth";

/* ─── Constants ─────────────────────────────────────────────────── */
const API_BASE = "https://us-central1-nouu-work-2026.cloudfunctions.net";

const INDUSTRIES = [
  "Retail",
  "Gastronomía",
  "Construcción",
  "Call Center",
  "Logística",
  "Seguridad",
  "Limpieza",
  "Otro",
];

const JOB_TYPES = [
  "Tiempo completo",
  "Part-time",
  "Por turnos",
  "Contrato indefinido",
];

/* ─── Types ──────────────────────────────────────────────────────── */
type CandidateStatus = "Nuevo" | "Entrevistado" | "Aprobado" | "Rechazado";

interface Candidate {
  id: number;
  name: string;
  role: string;
  score: number;
  status: CandidateStatus;
  date: string;
  tags: string[];
  email: string;
  phone: string;
  location: string;
  experience: string;
  education: string;
  notes: string;
  jobIds: number[];
}

interface JobPosting {
  id: number | string;
  title: string;
  description: string;
  salaryMin: string;
  salaryMax: string;
  location: string;
  type: string;
  tags: string[];
  urgent: boolean;
  active: boolean;
  createdAt: string;
  companyId: string;
  candidateCount: number;
}

interface CompanyProfile {
  id?: string;
  name: string;
  rut: string;
  industry: string;
  email: string;
  phone: string;
  address: string;
  description: string;
  ownerId: string;
  createdAt: string;
}

/* ─── Static Data ───────────────────────────────────────────────── */
const INITIAL_CANDIDATES: Candidate[] = [
  { id: 1, name: "Juan Pérez", role: "Cajero/a", score: 92, status: "Aprobado", date: "Hoy", tags: ["Atención al cliente", "Caja", "Responsable"], email: "juan.perez@email.cl", phone: "+56 9 1234 5678", location: "Providencia, Santiago", experience: "3 años como cajero en Jumbo. Manejo de caja, cierre de caja, atención al cliente.", education: "Enseñanza media completa", notes: "Disponible para turno mañana y tarde.", jobIds: [1] },
  { id: 2, name: "María González", role: "Reponedor/a", score: 88, status: "Entrevistado", date: "Ayer", tags: ["Orden", "Proactiva", "Fuerza física"], email: "maria.gonzalez@email.cl", phone: "+56 9 8765 4321", location: "Maipú, Santiago", experience: "2 años en reposición en Líder. Inventario y orden de góndolas.", education: "Enseñanza media completa", notes: "Prefiere turno nocturno.", jobIds: [2] },
  { id: 3, name: "Carlos Soto", role: "Bodeguero/a", score: 95, status: "Aprobado", date: "Hace 2 días", tags: ["Inventario", "Licencia D", "Ordenado"], email: "carlos.soto@email.cl", phone: "+56 9 5555 1234", location: "La Florida, Santiago", experience: "5 años en bodega de distribuidora. Manejo de montacargas y control de stock.", education: "Técnico en logística (INACAP)", notes: "Tiene licencia clase D vigente.", jobIds: [3] },
  { id: 4, name: "Ana Reyes", role: "Vendedor/a", score: 78, status: "Nuevo", date: "Hoy", tags: ["Comunicativa", "Ventas", "Retail"], email: "ana.reyes@email.cl", phone: "+56 9 3333 4444", location: "Ñuñoa, Santiago", experience: "1 año como vendedora en tienda de ropa. Atención presencial.", education: "Enseñanza media completa", notes: "Primera experiencia en supermercado.", jobIds: [1] },
  { id: 5, name: "Pedro Muñoz", role: "Guardia", score: 85, status: "Entrevistado", date: "Hace 3 días", tags: ["OS-10", "Responsable", "Nocturno"], email: "pedro.munoz@email.cl", phone: "+56 9 6666 7777", location: "Puente Alto, Santiago", experience: "4 años como guardia de seguridad en mall. Curso OS-10 vigente.", education: "Enseñanza media completa", notes: "Disponible para turno nocturno. Ex carabinero.", jobIds: [4] },
  { id: 6, name: "Camila Torres", role: "Cajero/a", score: 71, status: "Nuevo", date: "Hoy", tags: ["Puntual", "Caja", "Estudiante"], email: "camila.torres@email.cl", phone: "+56 9 2222 8888", location: "San Bernardo, Santiago", experience: "6 meses de práctica en farmacia. Manejo básico de caja.", education: "Estudiante de Administración (2do año)", notes: "Busca trabajo part-time compatible con estudios.", jobIds: [1] },
  { id: 7, name: "Roberto Díaz", role: "Repartidor/a", score: 90, status: "Aprobado", date: "Hace 1 semana", tags: ["Licencia A2", "Moto propia", "Puntual"], email: "roberto.diaz@email.cl", phone: "+56 9 4444 5555", location: "Recoleta, Santiago", experience: "2 años como repartidor en Rappi y Pedidos Ya.", education: "Enseñanza media completa", notes: "Tiene moto propia y licencia A2.", jobIds: [1, 2] },
  { id: 8, name: "Francisca Vera", role: "Mesero/a", score: 82, status: "Entrevistado", date: "Hace 4 días", tags: ["Atención", "Inglés básico", "Flexible"], email: "francisca.vera@email.cl", phone: "+56 9 1111 9999", location: "Vitacura, Santiago", experience: "1 año como mesera en restaurante italiano. Manejo de POS.", education: "Enseñanza media completa, curso de barista", notes: "Habla inglés básico. Disponible fines de semana.", jobIds: [1, 2] },
  { id: 9, name: "Diego Herrera", role: "Ayudante de cocina", score: 67, status: "Rechazado", date: "Hace 5 días", tags: ["Cocina", "Sin experiencia"], email: "diego.herrera@email.cl", phone: "+56 9 7777 3333", location: "El Bosque, Santiago", experience: "Sin experiencia formal. Cocina en casa.", education: "Enseñanza media incompleta", notes: "Rechazado por falta de experiencia mínima requerida.", jobIds: [2] },
  { id: 10, name: "Valentina Rojas", role: "Operador/a", score: 76, status: "Nuevo", date: "Hace 1 día", tags: ["Maquinaria", "Turno rotativo", "Proactiva"], email: "valentina.rojas@email.cl", phone: "+56 9 8888 2222", location: "Quilicura, Santiago", experience: "1 año como operadora de maquinaria liviana en fábrica textil.", education: "Técnico en operaciones industriales (CFT)", notes: "Disponible para turnos rotativos.", jobIds: [3] },
  { id: 11, name: "Ignacio Fuentes", role: "Cajero/a", score: 86, status: "Entrevistado", date: "Hace 2 días", tags: ["Caja", "Turno noche", "Responsable"], email: "ignacio.fuentes@email.cl", phone: "+56 9 3210 4567", location: "Santiago Centro", experience: "2 años en caja de Falabella. Manejo de efectivo y tarjetas.", education: "Enseñanza media completa", notes: "Prefiere turno noche.", jobIds: [1] },
  { id: 12, name: "Sofía Contreras", role: "Reponedor/a", score: 79, status: "Nuevo", date: "Hoy", tags: ["Fuerza física", "Orden", "Rápida"], email: "sofia.contreras@email.cl", phone: "+56 9 6543 2100", location: "La Cisterna, Santiago", experience: "1 año en reposición en Unimarc. Manejo de inventario.", education: "Enseñanza media completa", notes: "Disponible inmediatamente.", jobIds: [2] },
  { id: 13, name: "Matías Álvarez", role: "Guardia", score: 91, status: "Aprobado", date: "Hace 1 día", tags: ["OS-10", "Primeros auxilios", "Líder"], email: "matias.alvarez@email.cl", phone: "+56 9 7890 1234", location: "Las Condes, Santiago", experience: "6 años como guardia en edificio corporativo. Certificado OS-10 y primeros auxilios.", education: "Enseñanza media completa", notes: "Excelentes referencias.", jobIds: [4] },
  { id: 14, name: "Catalina Parra", role: "Cajero/a", score: 74, status: "Nuevo", date: "Hace 3 días", tags: ["Atención", "Puntual", "Caja"], email: "catalina.parra@email.cl", phone: "+56 9 4321 8765", location: "Peñalolén, Santiago", experience: "8 meses como cajera en minimarket. Atención al público.", education: "Estudiante de Contabilidad", notes: "Busca part-time.", jobIds: [1] },
  { id: 15, name: "Tomás Morales", role: "Bodeguero/a", score: 83, status: "Entrevistado", date: "Hace 4 días", tags: ["Inventario", "SAP básico", "Ordenado"], email: "tomas.morales@email.cl", phone: "+56 9 5678 9012", location: "Pudahuel, Santiago", experience: "3 años en bodega de empresa de alimentos. Uso básico de SAP.", education: "Técnico en logística (Duoc UC)", notes: "Conocimiento de SAP básico.", jobIds: [3] },
  { id: 16, name: "Fernanda Ríos", role: "Guardia", score: 72, status: "Nuevo", date: "Hoy", tags: ["OS-10", "Nocturno", "Puntual"], email: "fernanda.rios@email.cl", phone: "+56 9 8901 2345", location: "Independencia, Santiago", experience: "1 año como guardia en supermercado. Curso OS-10.", education: "Enseñanza media completa", notes: "Disponible para turno nocturno.", jobIds: [4] },
];

const STATUS_COLORS: Record<CandidateStatus, string> = {
  Nuevo: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  Entrevistado: "bg-[#0f70b7]/10 text-[#0f70b7] border-[#0f70b7]/20",
  Aprobado: "bg-green-500/10 text-green-500 border-green-500/20",
  Rechazado: "bg-red-500/10 text-red-500 border-red-500/20",
};

/* ─── RUT validation ─────────────────────────────────────────────── */
function validateRut(rut: string): boolean {
  const clean = rut.replace(/[.\-]/g, "").toUpperCase();
  if (clean.length < 2) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  if (!/^\d+$/.test(body)) return false;
  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const remainder = 11 - (sum % 11);
  const expected = remainder === 11 ? "0" : remainder === 10 ? "K" : String(remainder);
  return dv === expected;
}

/* ─── LocalStorage helpers ───────────────────────────────────────── */
function getStoredCompany(uid: string): CompanyProfile | null {
  try {
    const raw = localStorage.getItem(`nouu_company_${uid}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setStoredCompany(uid: string, company: CompanyProfile) {
  localStorage.setItem(`nouu_company_${uid}`, JSON.stringify(company));
}

function getStoredJobs(companyId: string): JobPosting[] {
  try {
    const raw = localStorage.getItem(`nouu_jobs_${companyId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setStoredJobs(companyId: string, jobs: JobPosting[]) {
  localStorage.setItem(`nouu_jobs_${companyId}`, JSON.stringify(jobs));
}

/* ─── CreateCompanyForm ──────────────────────────────────────────── */
interface CreateCompanyFormProps {
  onCreated: (company: CompanyProfile) => void;
  uid: string;
}

const CreateCompanyForm: React.FC<CreateCompanyFormProps> = ({ onCreated, uid }) => {
  const [form, setForm] = useState({
    name: "",
    rut: "",
    industry: "",
    email: "",
    phone: "",
    address: "",
    description: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rutError, setRutError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    if (e.target.name === "rut") setRutError("");
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateRut(form.rut)) {
      setRutError("RUT inválido. Ejemplo: 76.123.456-7");
      return;
    }
    setLoading(true);
    setError("");

    const companyData: CompanyProfile = {
      ...form,
      ownerId: uid,
      createdAt: new Date().toISOString(),
    };

    // Persist locally immediately
    setStoredCompany(uid, companyData);

    // Attempt API call
    try {
      const { auth } = await import("../lib/firebase");
      const token = await auth.currentUser?.getIdToken().catch(() => null);
      const res = await fetch(`${API_BASE}/api/company`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(companyData),
      });
      if (res.ok) {
        const data = await res.json();
        const saved = { ...companyData, id: data.id || uid };
        setStoredCompany(uid, saved);
        onCreated(saved);
        return;
      }
    } catch {
      // Backend not ready, use localStorage data
    }

    setLoading(false);
    onCreated(companyData);
  };

  return (
    <div className="flex-1 flex items-start justify-center py-12 px-8 overflow-y-auto">
      <div className="w-full max-w-2xl animate-fadeInUp">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-green-500/10 border border-green-500/30 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-[0_0_30px_rgba(34,197,94,0.15)]">
            <Building className="w-8 h-8 text-green-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Crea el perfil de tu empresa</h1>
          <p className="text-gray-400">Completa los datos para comenzar a publicar empleos y gestionar candidatos</p>
        </div>

        <div className="animate-slideInBlur bg-[#222222] border border-gray-800 rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Nombre de la empresa <span className="text-[#f83758]">*</span></label>
              <input
                name="name"
                required
                value={form.name}
                onChange={handleChange}
                placeholder="Ej: Supermercados La Plaza SpA"
                className="w-full bg-[#181818] border border-gray-700 rounded-xl py-3 px-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-500/50 transition-colors"
              />
            </div>

            {/* RUT + Industry */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">RUT empresa <span className="text-[#f83758]">*</span></label>
                <input
                  name="rut"
                  required
                  value={form.rut}
                  onChange={handleChange}
                  placeholder="76.123.456-7"
                  className={`w-full bg-[#181818] border rounded-xl py-3 px-4 text-sm text-white placeholder-gray-600 focus:outline-none transition-colors ${rutError ? "border-red-500/60 focus:border-red-500" : "border-gray-700 focus:border-green-500/50"}`}
                />
                {rutError && <p className="mt-1.5 text-xs text-red-400">{rutError}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Industria <span className="text-[#f83758]">*</span></label>
                <select
                  name="industry"
                  required
                  value={form.industry}
                  onChange={handleChange}
                  className="w-full bg-[#181818] border border-gray-700 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-green-500/50 transition-colors appearance-none"
                >
                  <option value="" disabled>Selecciona una industria</option>
                  {INDUSTRIES.map(ind => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Email + Phone */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email empresa</label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="contacto@empresa.cl"
                  className="w-full bg-[#181818] border border-gray-700 rounded-xl py-3 px-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Teléfono</label>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="+56 2 2345 6789"
                  className="w-full bg-[#181818] border border-gray-700 rounded-xl py-3 px-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-500/50 transition-colors"
                />
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Dirección</label>
              <input
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder="Av. Providencia 1234, Providencia, Santiago"
                className="w-full bg-[#181818] border border-gray-700 rounded-xl py-3 px-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-500/50 transition-colors"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Descripción <span className="text-gray-600 text-xs">(opcional)</span></label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={3}
                placeholder="Breve descripción de tu empresa..."
                className="w-full bg-[#181818] border border-gray-700 rounded-xl py-3 px-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-500/50 transition-colors resize-none"
              />
            </div>

            {error && (
              <div className="flex items-center space-x-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#f83758] hover:bg-[#d62847] disabled:opacity-60 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center space-x-2"
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /><span>Creando perfil...</span></>
              ) : (
                <><Building className="w-5 h-5" /><span>Crear perfil de empresa</span></>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

/* ─── CreateJobForm ──────────────────────────────────────────────── */
interface CreateJobFormProps {
  companyId: string;
  onSaved: (job: JobPosting) => void;
  onClose: () => void;
}

const CreateJobForm: React.FC<CreateJobFormProps> = ({ companyId, onSaved, onClose }) => {
  const [form, setForm] = useState({
    title: "",
    description: "",
    salaryMin: "",
    salaryMax: "",
    location: "",
    type: "Tiempo completo",
    tags: "",
    urgent: false,
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const job: JobPosting = {
      id: Date.now(),
      title: form.title,
      description: form.description,
      salaryMin: form.salaryMin,
      salaryMax: form.salaryMax,
      location: form.location || "Santiago, Chile",
      type: form.type,
      tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      urgent: form.urgent,
      active: true,
      createdAt: new Date().toISOString(),
      companyId,
      candidateCount: 0,
    };
    setTimeout(() => {
      setSaving(false);
      onSaved(job);
    }, 400);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end md:items-center justify-center z-50 p-0 md:p-4" onClick={onClose}>
      <div
        className="bg-[#222222] border border-gray-800 rounded-t-3xl md:rounded-2xl w-full md:max-w-2xl max-h-[92vh] overflow-y-auto animate-slideInBlur"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800 sticky top-0 bg-[#222222] z-10">
          <div>
            <h2 className="text-lg font-bold text-white">Publicar nuevo empleo</h2>
            <p className="text-gray-400 text-sm">Los candidatos filtrados por IA verán esta oferta</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-gray-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Cargo <span className="text-[#f83758]">*</span></label>
            <input
              name="title"
              required
              value={form.title}
              onChange={handleChange}
              placeholder="Ej: Cajero/a Part-time"
              className="w-full bg-[#181818] border border-gray-700 rounded-xl py-3 px-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#f83758]/50 transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Descripción del cargo <span className="text-[#f83758]">*</span></label>
            <textarea
              name="description"
              required
              value={form.description}
              onChange={handleChange}
              rows={4}
              placeholder="Describe las funciones, requisitos y condiciones del cargo..."
              className="w-full bg-[#181818] border border-gray-700 rounded-xl py-3 px-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#f83758]/50 transition-colors resize-none"
            />
          </div>

          {/* Salary */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Sueldo mínimo</label>
              <input
                name="salaryMin"
                value={form.salaryMin}
                onChange={handleChange}
                placeholder="$400.000"
                className="w-full bg-[#181818] border border-gray-700 rounded-xl py-3 px-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#f83758]/50 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Sueldo máximo</label>
              <input
                name="salaryMax"
                value={form.salaryMax}
                onChange={handleChange}
                placeholder="$600.000"
                className="w-full bg-[#181818] border border-gray-700 rounded-xl py-3 px-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#f83758]/50 transition-colors"
              />
            </div>
          </div>

          {/* Location + Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Ubicación</label>
              <input
                name="location"
                value={form.location}
                onChange={handleChange}
                placeholder="Providencia, Santiago"
                className="w-full bg-[#181818] border border-gray-700 rounded-xl py-3 px-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#f83758]/50 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Tipo de contrato</label>
              <select
                name="type"
                value={form.type}
                onChange={handleChange}
                className="w-full bg-[#181818] border border-gray-700 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-[#f83758]/50 transition-colors appearance-none"
              >
                {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Etiquetas <span className="text-gray-600 text-xs">(separadas por coma)</span></label>
            <input
              name="tags"
              value={form.tags}
              onChange={handleChange}
              placeholder="Atención al cliente, Caja, Turno mañana"
              className="w-full bg-[#181818] border border-gray-700 rounded-xl py-3 px-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#f83758]/50 transition-colors"
            />
          </div>

          {/* Urgent toggle */}
          <div className="flex items-center justify-between p-4 bg-[#181818] border border-gray-800 rounded-xl">
            <div>
              <p className="text-sm font-medium text-white">Contratación urgente</p>
              <p className="text-xs text-gray-500 mt-0.5">Destacará con badge naranja en los resultados</p>
            </div>
            <button
              type="button"
              onClick={() => setForm(prev => ({ ...prev, urgent: !prev.urgent }))}
              className={`transition-colors ${form.urgent ? "text-[#f83758]" : "text-gray-600"}`}
            >
              {form.urgent ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
            </button>
          </div>

          {/* Actions */}
          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-3 rounded-xl text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-[#f83758] hover:bg-[#d62847] disabled:opacity-60 text-white py-3 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center space-x-2"
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /><span>Publicando...</span></>
              ) : (
                <><Plus className="w-4 h-4" /><span>Publicar empleo</span></>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ─── CandidateDetailModal ───────────────────────────────────────── */
interface CandidateDetailModalProps {
  candidate: Candidate;
  onClose: () => void;
  onStatusChange: (id: number, status: CandidateStatus) => void;
  selectedJobTitle?: string;
  aiSummaries: Record<number, string>;
  loadingSummary: number | null;
  onGenerateSummary: (candidate: Candidate, jobTitle: string) => void;
}

const CandidateDetailModal: React.FC<CandidateDetailModalProps> = ({
  candidate,
  onClose,
  onStatusChange,
  selectedJobTitle,
  aiSummaries,
  loadingSummary,
  onGenerateSummary,
}) => (
  <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
    <div
      className="bg-[#222222] border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[88vh] overflow-y-auto animate-scaleIn"
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-800 sticky top-0 bg-[#222222] z-10">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 bg-[#f83758]/20 text-[#f83758] rounded-full flex items-center justify-center text-xl font-bold">
            {candidate.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{candidate.name}</h2>
            <p className="text-gray-400 text-sm">{candidate.role} · {candidate.date}</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-center">
            <div className={`text-3xl font-bold ${candidate.score >= 80 ? "text-green-500" : candidate.score >= 70 ? "text-yellow-500" : "text-red-500"}`}>
              {candidate.score}%
            </div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide">Match</div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-gray-800">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Contact */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center space-x-3 text-sm bg-[#181818] rounded-xl p-3 border border-gray-800">
            <Mail className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <span className="text-gray-300 truncate">{candidate.email}</span>
          </div>
          <div className="flex items-center space-x-3 text-sm bg-[#181818] rounded-xl p-3 border border-gray-800">
            <Phone className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <span className="text-gray-300">{candidate.phone}</span>
          </div>
          <div className="flex items-center space-x-3 text-sm bg-[#181818] rounded-xl p-3 border border-gray-800">
            <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <span className="text-gray-300 truncate">{candidate.location}</span>
          </div>
        </div>

        {/* Tags */}
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-3">Habilidades</h4>
          <div className="flex flex-wrap gap-2">
            {candidate.tags.map((tag, i) => (
              <span key={i} className="bg-[#181818] text-gray-300 text-sm px-3 py-1.5 rounded-full border border-gray-700">
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Experience */}
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-2 flex items-center space-x-2">
            <Briefcase className="w-4 h-4" /><span>Experiencia</span>
          </h4>
          <p className="text-gray-300 text-sm bg-[#181818] p-4 rounded-xl border border-gray-800 leading-relaxed">
            {candidate.experience}
          </p>
        </div>

        {/* Education */}
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-2 flex items-center space-x-2">
            <GraduationCap className="w-4 h-4" /><span>Educación</span>
          </h4>
          <p className="text-gray-300 text-sm bg-[#181818] p-4 rounded-xl border border-gray-800">
            {candidate.education}
          </p>
        </div>

        {/* Notes */}
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-2">Notas</h4>
          <p className="text-gray-300 text-sm bg-[#181818] p-4 rounded-xl border border-gray-800">
            {candidate.notes}
          </p>
        </div>

        {/* AI Summary */}
        {selectedJobTitle && (
          <div className="bg-[#181818] border border-gray-800 rounded-xl p-4">
            {aiSummaries[candidate.id] ? (
              <div className="flex items-start space-x-3">
                <Bot className="w-5 h-5 text-[#f83758] mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-xs text-[#f83758] font-semibold uppercase tracking-wide">Resumen IA</span>
                  <p className="text-sm text-gray-300 mt-1.5 leading-relaxed">{aiSummaries[candidate.id]}</p>
                </div>
              </div>
            ) : (
              <button
                onClick={() => onGenerateSummary(candidate, selectedJobTitle)}
                disabled={loadingSummary === candidate.id}
                className="flex items-center space-x-2 text-sm text-[#f83758] hover:text-[#d62847] transition-colors disabled:opacity-50 w-full"
              >
                {loadingSummary === candidate.id ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /><span>Generando resumen con IA...</span></>
                ) : (
                  <><Bot className="w-4 h-4" /><span>Generar resumen con IA para esta vacante</span></>
                )}
              </button>
            )}
          </div>
        )}

        {/* Status Change */}
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-3">Cambiar estado</h4>
          <div className="flex flex-wrap gap-2">
            {(["Nuevo", "Entrevistado", "Aprobado", "Rechazado"] as CandidateStatus[]).map(status => (
              <button
                key={status}
                onClick={() => onStatusChange(candidate.id, status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  candidate.status === status
                    ? STATUS_COLORS[status].replace("/10", "/30") + " ring-1 ring-current"
                    : "bg-[#181818] text-gray-400 border-gray-700 hover:border-gray-500"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

/* ─── CompanyDashboard ───────────────────────────────────────────── */
interface CompanyDashboardProps {
  company: CompanyProfile;
  uid: string;
  onCompanyUpdated: (c: CompanyProfile) => void;
}

const CompanyDashboard: React.FC<CompanyDashboardProps> = ({ company, uid, onCompanyUpdated }) => {
  const companyId = company.id || uid;

  // Tab state
  const [activeTab, setActiveTab] = useState<"empresa" | "empleos" | "candidatos">("empresa");

  // Company edit
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ ...company });

  // Jobs
  const [jobs, setJobs] = useState<JobPosting[]>(() => getStoredJobs(companyId));
  const [showJobForm, setShowJobForm] = useState(false);

  // Candidates
  const [candidates, setCandidates] = useState<Candidate[]>(INITIAL_CANDIDATES);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [aiSummaries, setAiSummaries] = useState<Record<number, string>>({});
  const [loadingSummary, setLoadingSummary] = useState<number | null>(null);

  // Persist jobs
  const persistJobs = useCallback((newJobs: JobPosting[]) => {
    setJobs(newJobs);
    setStoredJobs(companyId, newJobs);
  }, [companyId]);

  // Stats
  const stats = useMemo(() => ({
    total: jobs.length,
    active: jobs.filter(j => j.active).length,
    candidates: candidates.length,
  }), [jobs, candidates]);

  // Filtered candidates
  const filteredCandidates = useMemo(() => {
    return candidates.filter(c => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || c.name.toLowerCase().includes(q) || c.role.toLowerCase().includes(q) || c.tags.some(t => t.toLowerCase().includes(q));
      const matchStatus = statusFilter === "Todos" || c.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [candidates, searchQuery, statusFilter]);

  const handleStatusChange = useCallback((id: number, status: CandidateStatus) => {
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, status } : c));
    setSelectedCandidate(prev => prev && prev.id === id ? { ...prev, status } : prev);
  }, []);

  const generateAiSummary = useCallback(async (candidate: Candidate, jobTitle: string) => {
    if (aiSummaries[candidate.id]) return;
    setLoadingSummary(candidate.id);
    try {
      const { auth } = await import("../lib/firebase");
      const token = await auth.currentUser?.getIdToken().catch(() => null);
      const apiUrl = import.meta.env.VITE_API_URL || "";
      const res = await fetch(`${apiUrl}/api/ai-summary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ candidate, jobTitle }),
      });
      const data = await res.json();
      setAiSummaries(prev => ({ ...prev, [candidate.id]: data.summary || "No se pudo generar el resumen." }));
    } catch {
      setAiSummaries(prev => ({ ...prev, [candidate.id]: "Error al generar resumen IA." }));
    }
    setLoadingSummary(null);
  }, [aiSummaries]);

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = { ...editForm };
    setStoredCompany(uid, updated);
    onCompanyUpdated(updated);
    setEditing(false);
  };

  const handleToggleJob = (jobId: number | string) => {
    persistJobs(jobs.map(j => j.id === jobId ? { ...j, active: !j.active } : j));
  };

  const handleDeleteJob = (jobId: number | string) => {
    persistJobs(jobs.filter(j => j.id !== jobId));
  };

  const handleJobSaved = (job: JobPosting) => {
    const updated = [job, ...jobs];
    persistJobs(updated);
    setShowJobForm(false);
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return iso;
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Dashboard Header — green glow section */}
      <div className="bg-gradient-to-r from-[#181818] via-[#1a1f1a] to-[#181818] border-b border-gray-800 px-8 py-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-24 bg-green-500/5 blur-3xl rounded-full" />
        </div>
        <div className="animate-fadeInUp relative flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center justify-center">
              <Building className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{company.name}</h1>
              <div className="flex items-center space-x-3 mt-0.5">
                <span className="text-gray-400 text-sm">{company.industry}</span>
                <span className="text-gray-700">·</span>
                <span className="text-gray-400 text-sm">{company.rut}</span>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center space-x-6">
            <div className="text-center">
              <div className="text-xl font-bold text-white">{stats.total}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wide">Empleos</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-green-400">{stats.active}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wide">Activos</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-[#f83758]">{stats.candidates}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wide">Candidatos</div>
            </div>
            <div className="flex items-center space-x-1.5 bg-gray-800/60 border border-gray-700 px-3 py-1.5 rounded-full">
              <Star className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-xs text-gray-300 font-medium">Plan Gratuito</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="animate-fadeInLeft px-8 pt-5 pb-0 border-b border-gray-800">
        <div className="flex space-x-1 bg-[#222222] p-1 rounded-xl w-fit border border-gray-800">
          {(["empresa", "empleos", "candidatos"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${activeTab === tab ? "bg-[#f83758] text-white" : "text-gray-400 hover:text-white"}`}
            >
              {tab === "empresa" ? "Mi Empresa" : tab === "empleos" ? "Empleos" : "Candidatos"}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-8">

        {/* ── Tab: Mi Empresa ── */}
        {activeTab === "empresa" && (
          <div className="max-w-3xl animate-fadeInUp">
            {editing ? (
              <form onSubmit={handleSaveEdit} className="bg-[#222222] border border-gray-800 rounded-2xl p-6 space-y-5">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-bold text-white">Editar perfil de empresa</h2>
                  <button type="button" onClick={() => setEditing(false)} className="text-gray-500 hover:text-white transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Nombre</label>
                    <input name="name" value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} required className="w-full bg-[#181818] border border-gray-700 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-[#f83758]/50 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">RUT</label>
                    <input name="rut" value={editForm.rut} onChange={e => setEditForm(p => ({ ...p, rut: e.target.value }))} className="w-full bg-[#181818] border border-gray-700 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-[#f83758]/50 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Industria</label>
                    <select name="industry" value={editForm.industry} onChange={e => setEditForm(p => ({ ...p, industry: e.target.value }))} className="w-full bg-[#181818] border border-gray-700 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-[#f83758]/50 transition-colors appearance-none">
                      {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
                    <input name="email" type="email" value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} className="w-full bg-[#181818] border border-gray-700 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-[#f83758]/50 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Teléfono</label>
                    <input name="phone" value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} className="w-full bg-[#181818] border border-gray-700 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-[#f83758]/50 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Dirección</label>
                    <input name="address" value={editForm.address} onChange={e => setEditForm(p => ({ ...p, address: e.target.value }))} className="w-full bg-[#181818] border border-gray-700 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-[#f83758]/50 transition-colors" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Descripción</label>
                  <textarea name="description" value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} rows={3} className="w-full bg-[#181818] border border-gray-700 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-[#f83758]/50 transition-colors resize-none" />
                </div>
                <div className="flex space-x-3 pt-2">
                  <button type="button" onClick={() => setEditing(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2.5 rounded-xl text-sm font-medium transition-colors">Cancelar</button>
                  <button type="submit" className="flex-1 bg-[#f83758] hover:bg-[#d62847] text-white py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center space-x-2">
                    <CheckCircle2 className="w-4 h-4" /><span>Guardar cambios</span>
                  </button>
                </div>
              </form>
            ) : (
              <>
                {/* Profile card */}
                <div className="bg-[#222222] border border-gray-800 rounded-2xl p-6 card-hover mb-6">
                  <div className="flex items-start justify-between mb-5">
                    <div className="flex items-center space-x-4">
                      <div className="w-14 h-14 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center justify-center">
                        <Building className="w-7 h-7 text-green-400" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white">{company.name}</h2>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-2.5 py-1 rounded-full font-medium">
                            {company.industry}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setEditing(true)}
                      className="flex items-center space-x-2 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3 py-2 rounded-lg transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" /><span>Editar</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Briefcase className="w-4 h-4 text-gray-500" />
                      </div>
                      <div>
                        <div className="text-gray-500 text-xs">RUT</div>
                        <div className="text-gray-200">{company.rut || "—"}</div>
                      </div>
                    </div>
                    {company.email && (
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Mail className="w-4 h-4 text-gray-500" />
                        </div>
                        <div>
                          <div className="text-gray-500 text-xs">Email</div>
                          <div className="text-gray-200 truncate">{company.email}</div>
                        </div>
                      </div>
                    )}
                    {company.phone && (
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Phone className="w-4 h-4 text-gray-500" />
                        </div>
                        <div>
                          <div className="text-gray-500 text-xs">Teléfono</div>
                          <div className="text-gray-200">{company.phone}</div>
                        </div>
                      </div>
                    )}
                    {company.address && (
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
                          <MapPin className="w-4 h-4 text-gray-500" />
                        </div>
                        <div>
                          <div className="text-gray-500 text-xs">Dirección</div>
                          <div className="text-gray-200">{company.address}</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {company.description && (
                    <div className="mt-5 pt-5 border-t border-gray-800">
                      <p className="text-gray-400 text-sm leading-relaxed">{company.description}</p>
                    </div>
                  )}
                </div>

                {/* Plan card */}
                <div className="bg-[#222222] border border-gray-800 rounded-2xl p-6 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-center justify-center">
                      <Star className="w-5 h-5 text-yellow-400" />
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">Plan Gratuito</p>
                      <p className="text-gray-500 text-xs mt-0.5">5 publicaciones · candidatos ilimitados</p>
                    </div>
                  </div>
                  <button className="flex items-center space-x-2 bg-gradient-to-r from-yellow-500/20 to-[#f83758]/20 border border-yellow-500/30 text-yellow-400 hover:text-yellow-300 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:border-yellow-500/50">
                    <Zap className="w-4 h-4" /><span>Actualizar plan</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Tab: Empleos ── */}
        {activeTab === "empleos" && (
          <div className="animate-fadeInUp">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-white">Tus publicaciones</h2>
                <p className="text-gray-500 text-sm mt-0.5">{jobs.length} empleo{jobs.length !== 1 ? "s" : ""} publicado{jobs.length !== 1 ? "s" : ""}</p>
              </div>
              <button
                onClick={() => setShowJobForm(true)}
                className="flex items-center space-x-2 bg-[#f83758] hover:bg-[#d62847] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" /><span>Publicar nuevo empleo</span>
              </button>
            </div>

            {jobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mb-5">
                  <Briefcase className="w-8 h-8 text-gray-600" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">Aún no has publicado empleos</h3>
                <p className="text-gray-500 text-sm mb-6 max-w-sm">Publica tu primera oferta y conecta con candidatos pre-filtrados por IA</p>
                <button
                  onClick={() => setShowJobForm(true)}
                  className="flex items-center space-x-2 bg-[#f83758] hover:bg-[#d62847] text-white px-6 py-3 rounded-xl text-sm font-semibold transition-colors"
                >
                  <Plus className="w-4 h-4" /><span>Publicar primera oferta</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {jobs.map(job => (
                  <div key={job.id} className="bg-[#222222] border border-gray-800 rounded-2xl p-6 card-hover">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3 flex-wrap gap-y-2">
                          <h3 className="text-white font-semibold">{job.title}</h3>
                          {job.urgent && (
                            <span className="text-[10px] bg-[#f83758]/15 text-[#f83758] border border-[#f83758]/25 px-2 py-0.5 rounded-full font-medium uppercase tracking-wide">
                              Urgente
                            </span>
                          )}
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wide border ${job.active ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-gray-700/40 text-gray-500 border-gray-700"}`}>
                            {job.active ? "Activo" : "Pausado"}
                          </span>
                        </div>
                        <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500 flex-wrap gap-y-1">
                          <span className="flex items-center space-x-1.5"><MapPin className="w-3.5 h-3.5" /><span>{job.location}</span></span>
                          <span className="flex items-center space-x-1.5"><Clock className="w-3.5 h-3.5" /><span>{job.type}</span></span>
                          <span>{formatDate(job.createdAt)}</span>
                          {(job.salaryMin || job.salaryMax) && (
                            <span className="text-green-400/80">
                              {job.salaryMin && job.salaryMax ? `${job.salaryMin} – ${job.salaryMax}` : job.salaryMin || job.salaryMax}
                            </span>
                          )}
                        </div>
                        {job.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {job.tags.map((tag, i) => (
                              <span key={i} className="text-xs bg-[#181818] text-gray-400 border border-gray-800 px-2 py-1 rounded-md">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <div className="text-center px-3">
                          <div className="text-lg font-bold text-white">{job.candidateCount}</div>
                          <div className="text-[10px] text-gray-600 uppercase">Candidatos</div>
                        </div>
                        <button
                          onClick={() => handleToggleJob(job.id)}
                          className={`p-2 rounded-lg transition-colors ${job.active ? "text-green-400 hover:bg-green-500/10" : "text-gray-600 hover:bg-gray-800"}`}
                          title={job.active ? "Pausar" : "Activar"}
                        >
                          {job.active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                        </button>
                        <button
                          onClick={() => handleDeleteJob(job.id)}
                          className="p-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Candidatos ── */}
        {activeTab === "candidatos" && (
          <div className="animate-fadeInUp">
            {/* Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: "Total", value: candidates.length, color: "text-white" },
                { label: "Aprobados", value: candidates.filter(c => c.status === "Aprobado").length, color: "text-green-400" },
                { label: "Entrevistados", value: candidates.filter(c => c.status === "Entrevistado").length, color: "text-[#0f70b7]" },
                { label: "Score prom.", value: `${Math.round(candidates.reduce((s, c) => s + c.score, 0) / candidates.length)}%`, color: "text-[#f83758]" },
              ].map(m => (
                <div key={m.label} className="card-hover bg-[#222222] border border-gray-800 rounded-xl p-4">
                  <div className="text-gray-500 text-xs mb-1">{m.label}</div>
                  <div className={`text-2xl font-bold ${m.color}`}>{m.value}</div>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div className="flex space-x-3 mb-6 flex-wrap gap-y-3">
              <div className="flex-1 min-w-48 relative">
                <input
                  type="text"
                  placeholder="Buscar candidato, cargo o habilidad..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-[#222222] border border-gray-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-600 transition-colors"
                />
                <Filter className="w-4 h-4 text-gray-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="bg-[#222222] border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-gray-600 transition-colors appearance-none"
              >
                <option value="Todos">Todos los estados</option>
                <option value="Nuevo">Nuevo</option>
                <option value="Entrevistado">Entrevistado</option>
                <option value="Aprobado">Aprobado</option>
                <option value="Rechazado">Rechazado</option>
              </select>
              <span className="flex items-center text-sm text-gray-600">{filteredCandidates.length} de {candidates.length}</span>
            </div>

            {/* Candidates list */}
            <div className="space-y-3">
              {filteredCandidates.length === 0 ? (
                <div className="text-center py-16">
                  <Users className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                  <p className="text-gray-500">No se encontraron candidatos con esos filtros.</p>
                </div>
              ) : (
                filteredCandidates.map(candidate => (
                  <div key={candidate.id} className="bg-[#222222] border border-gray-800 rounded-xl p-5 flex items-center justify-between hover:border-gray-700 transition-colors card-hover">
                    <div className="flex items-center space-x-4 min-w-0">
                      <div className="w-11 h-11 bg-gray-800 rounded-full flex items-center justify-center text-gray-400 font-bold flex-shrink-0">
                        {candidate.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-white font-medium text-sm">{candidate.name}</h3>
                        <div className="text-xs text-gray-500 mt-0.5">{candidate.role} · {candidate.date}</div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {candidate.tags.slice(0, 3).map((tag, i) => (
                            <span key={i} className="bg-[#181818] text-gray-500 text-[11px] px-2 py-0.5 rounded-md border border-gray-800">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4 flex-shrink-0">
                      <div className="text-center hidden md:block">
                        <div className={`text-xl font-bold ${candidate.score >= 80 ? "text-green-500" : candidate.score >= 70 ? "text-yellow-500" : "text-red-500"}`}>
                          {candidate.score}%
                        </div>
                        <div className="text-[10px] text-gray-600 uppercase">Match</div>
                      </div>
                      <select
                        value={candidate.status}
                        onChange={e => handleStatusChange(candidate.id, e.target.value as CandidateStatus)}
                        className={`text-xs px-3 py-1.5 rounded-full border bg-transparent cursor-pointer focus:outline-none hidden md:block ${STATUS_COLORS[candidate.status]}`}
                      >
                        <option value="Nuevo">Nuevo</option>
                        <option value="Entrevistado">Entrevistado</option>
                        <option value="Aprobado">Aprobado</option>
                        <option value="Rechazado">Rechazado</option>
                      </select>
                      <button
                        onClick={() => setSelectedCandidate(candidate)}
                        className="bg-[#f83758] hover:bg-[#d62847] text-white px-4 py-2 rounded-lg text-xs font-medium transition-colors"
                      >
                        Ver detalle
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showJobForm && (
        <CreateJobForm
          companyId={companyId}
          onSaved={handleJobSaved}
          onClose={() => setShowJobForm(false)}
        />
      )}

      {selectedCandidate && (
        <CandidateDetailModal
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
          onStatusChange={handleStatusChange}
          selectedJobTitle={jobs[0]?.title}
          aiSummaries={aiSummaries}
          loadingSummary={loadingSummary}
          onGenerateSummary={generateAiSummary}
        />
      )}
    </div>
  );
};

/* ─── B2BPanel (main export) ─────────────────────────────────────── */
interface B2BPanelProps {
  setCurrentView: (view: string) => void;
  onOpenAuth: () => void;
}

const B2BPanel: React.FC<B2BPanelProps> = ({ onOpenAuth }) => {
  const { user, loading } = useAuth();
  const [company, setCompany] = useState<CompanyProfile | null>(() => {
    // Will be set properly once user loads
    return null;
  });
  const [companyChecked, setCompanyChecked] = useState(false);

  // Once auth resolves, check for stored company
  React.useEffect(() => {
    if (!loading && user) {
      const stored = getStoredCompany(user.uid);
      setCompany(stored);
      setCompanyChecked(true);
    } else if (!loading && !user) {
      setCompanyChecked(true);
    }
  }, [user, loading]);

  if (loading || !companyChecked) {
    return (
      <div className="flex-1 flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-[#f83758] animate-spin" />
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-16 px-8">
        <div className="animate-scaleIn text-center max-w-md">
          <div className="w-20 h-20 bg-green-500/10 border border-green-500/25 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_rgba(34,197,94,0.1)]">
            <Building className="w-10 h-10 text-green-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Panel de Empresas</h1>
          <p className="text-gray-400 mb-8 leading-relaxed">
            Necesitas una cuenta de empresa para continuar. Publica empleos y gestiona candidatos pre-filtrados por IA.
          </p>
          <button
            onClick={onOpenAuth}
            className="w-full bg-[#f83758] hover:bg-[#d62847] text-white py-3.5 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center space-x-2"
          >
            <Building className="w-5 h-5" />
            <span>Iniciar sesión o crear cuenta</span>
          </button>
          <div className="mt-6 grid grid-cols-3 gap-4 text-center">
            {[
              { icon: <Briefcase className="w-5 h-5" />, label: "Publica empleos" },
              { icon: <Bot className="w-5 h-5" />, label: "IA pre-filtra candidatos" },
              { icon: <Users className="w-5 h-5" />, label: "Gestiona postulantes" },
            ].map((f, i) => (
              <div key={i} className="bg-[#222222] border border-gray-800 rounded-xl p-4 text-gray-500">
                <div className="flex justify-center mb-2">{f.icon}</div>
                <p className="text-xs">{f.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Logged in but no company profile yet
  if (!company) {
    return (
      <CreateCompanyForm
        uid={user.uid}
        onCreated={(newCompany) => setCompany(newCompany)}
      />
    );
  }

  // Logged in + has company
  return (
    <CompanyDashboard
      company={company}
      uid={user.uid}
      onCompanyUpdated={(updated) => setCompany(updated)}
    />
  );
};

export default B2BPanel;
