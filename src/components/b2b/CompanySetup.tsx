import { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { Building2, Loader2 } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

const INDUSTRIES = ['Retail', 'Gastronomía', 'Construcción', 'Call Center', 'Logística', 'Seguridad', 'Limpieza', 'Tecnología', 'Salud', 'Educación', 'Financiero', 'Otro'];
const COMPANY_SIZES = ['small', 'medium', 'large'] as const;
const SIZE_LABELS: Record<string, string> = { small: '1-10 empleados', medium: '11-50 empleados', large: '50+ empleados' };

function validateRut(rut: string): boolean {
  let value = rut.replace(/\./g, '').replace(/-/g, '');
  if (value.length < 2) return false;
  const body = value.slice(0, -1);
  const dv = value.slice(-1).toUpperCase();
  let sum = 0, multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * multiplier;
    multiplier = multiplier < 7 ? multiplier + 1 : 2;
  }
  const expectedDv = 11 - (sum % 11);
  const expected = expectedDv === 11 ? '0' : expectedDv === 10 ? 'K' : String(expectedDv);
  return expected === dv;
}

export function CompanySetup() {
  const { user, profile } = useAuth();
  const [name, setName] = useState('');
  const [rut, setRut] = useState('');
  const [industry, setIndustry] = useState('Otro');
  const [size, setSize] = useState<string>('small');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [email, setEmail] = useState(profile?.email || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name || !rut) { setError('Nombre y RUT son requeridos'); return; }
    if (!validateRut(rut)) { setError('RUT inválido'); return; }
    setLoading(true);
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`${API_BASE}/api/companies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, rut, industry, size, description, email, phone, website, address }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error creando empresa');
      const data = await res.json();
      sessionStorage.removeItem('nouu_show_company_setup');
      sessionStorage.setItem('nouu_company_id', data.id);
      setCreated(true);
      window.location.reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (created) {
    return (
      <div className="text-center py-12">
        <Building2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">¡Empresa creada!</h2>
        <p className="text-gray-400">Redirigiendo al dashboard...</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold text-white mb-2">Crea el perfil de tu empresa</h2>
      <p className="text-gray-400 mb-6">Completa los datos para empezar a publicar ofertas</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input placeholder="Nombre de la empresa *" value={name} onChange={e => setName(e.target.value)} required
          className="w-full bg-[#181818] border border-gray-700 rounded-xl py-2.5 px-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0f70b7]" />
        <input placeholder="RUT (ej: 12345678-9) *" value={rut} onChange={e => setRut(e.target.value)} required
          className="w-full bg-[#181818] border border-gray-700 rounded-xl py-2.5 px-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0f70b7]" />
        <div className="grid grid-cols-2 gap-3">
          <select value={industry} onChange={e => setIndustry(e.target.value)}
            className="w-full bg-[#181818] border border-gray-700 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-[#0f70b7] appearance-none">
            {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
          <select value={size} onChange={e => setSize(e.target.value)}
            className="w-full bg-[#181818] border border-gray-700 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-[#0f70b7] appearance-none">
            {COMPANY_SIZES.map(s => <option key={s} value={s}>{SIZE_LABELS[s]}</option>)}
          </select>
        </div>
        <textarea placeholder="Descripción de la empresa" value={description} onChange={e => setDescription(e.target.value)} rows={3}
          className="w-full bg-[#181818] border border-gray-700 rounded-xl py-2.5 px-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0f70b7] resize-none" />
        <input placeholder="Sitio web" value={website} onChange={e => setWebsite(e.target.value)}
          className="w-full bg-[#181818] border border-gray-700 rounded-xl py-2.5 px-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0f70b7]" />
        <input placeholder="Email de contacto" value={email} onChange={e => setEmail(e.target.value)} type="email"
          className="w-full bg-[#181818] border border-gray-700 rounded-xl py-2.5 px-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0f70b7]" />
        <input placeholder="Teléfono" value={phone} onChange={e => setPhone(e.target.value)}
          className="w-full bg-[#181818] border border-gray-700 rounded-xl py-2.5 px-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0f70b7]" />
        <input placeholder="Dirección" value={address} onChange={e => setAddress(e.target.value)}
          className="w-full bg-[#181818] border border-gray-700 rounded-xl py-2.5 px-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0f70b7]" />
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full bg-[#0f70b7] hover:bg-[#0d5fa0] text-white py-2.5 rounded-xl font-medium text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Crear Empresa
        </button>
      </form>
    </div>
  );
}
