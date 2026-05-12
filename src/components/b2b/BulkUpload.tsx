import { useState, useRef } from 'react';
import { Upload, Loader2, CheckCircle, Download, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../lib/auth';

const API_BASE = import.meta.env.VITE_API_URL || '';

function parseCSV(text: string): any[] {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; continue; }
      if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; continue; }
      current += char;
    }
    values.push(current.trim());
    const obj: any = {};
    headers.forEach((h, i) => {
      let val = (values[i] || '').replace(/^"|"$/g, '');
      if (h === 'requirements' || h === 'benefits') {
        obj[h] = val ? val.split(';').map((s: string) => s.trim()).filter(Boolean) : [];
      } else if (h === 'salaryMin' || h === 'salaryMax') {
        obj[h] = val ? parseInt(val, 10) || null : null;
      } else if (h === 'urgent') {
        obj[h] = val.toLowerCase() === 'true' || val === '1' || val.toLowerCase() === 'sí' || val.toLowerCase() === 'si';
      } else {
        obj[h] = val || null;
      }
    });
    return obj;
  }).filter(obj => obj.title);
}

interface BulkResult {
  success: { id: string; title: string }[];
  errors: { row: number; errors: { field: string; message: string }[] }[];
  totalProcessed: number;
  created: number;
  failed: number;
}

export function BulkUpload({ companyId, onComplete }: { companyId: string; onComplete: () => void }) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [error, setError] = useState('');

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    setResult(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length === 0) {
        setError('No se encontraron ofertas válidas en el archivo');
        return;
      }
      setJobs(parsed);
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (jobs.length === 0) return;
    setLoading(true);
    setError('');
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`${API_BASE}/api/companies/${companyId}/jobs/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ jobs }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error en carga masiva');
      const data = await res.json();
      setResult(data);
      if (data.created > 0) onComplete();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`${API_BASE}/api/companies/${companyId}/jobs/template`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'plantilla_ofertas_nouu.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  if (result) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-10 h-10 text-green-400" />
          <div>
            <h3 className="text-lg font-bold text-white">Carga completada</h3>
            <p className="text-gray-400 text-sm">{result.created} ofertas creadas, {result.failed} errores</p>
          </div>
        </div>
        {result.success.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-green-400">Ofertas creadas ({result.success.length})</p>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {result.success.map((j, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-300">
                  <CheckCircle className="w-3 h-3 text-green-400" />
                  {j.title}
                </div>
              ))}
            </div>
          </div>
        )}
        {result.errors.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-red-400">Errores ({result.errors.length})</p>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {result.errors.map((err, i) => (
                <div key={i} className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm">
                  <p className="text-red-300 font-medium mb-1">Fila {err.row + 2}</p>
                  {err.errors.map((e, j) => (
                    <p key={j} className="text-red-400 text-xs">- {e.field}: {e.message}</p>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
        <button onClick={() => { setResult(null); setJobs([]); }} className="w-full bg-[#0f70b7]/20 text-[#0f70b7] py-2 rounded-xl font-medium text-sm hover:bg-[#0f70b7]/30">
          Cargar otro archivo
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Carga masiva de ofertas</h2>
      <p className="text-gray-400 text-sm">Sube un archivo CSV con tus ofertas de trabajo</p>

      {jobs.length === 0 ? (
        <div className="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center space-y-4">
          <Upload className="w-10 h-10 text-gray-500 mx-auto" />
          <div>
            <p className="text-gray-300 font-medium">Arrastra tu archivo CSV aquí</p>
            <p className="text-gray-500 text-sm">o haz clic para seleccionar</p>
          </div>
          <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="bg-[#0f70b7] hover:bg-[#0d5fa0] text-white px-6 py-2 rounded-xl font-medium text-sm">
            Seleccionar archivo
          </button>
          <button onClick={downloadTemplate} className="block mx-auto text-sm text-[#0f70b7] hover:underline flex items-center gap-1">
            <Download className="w-3 h-3" />
            Descargar plantilla CSV
          </button>
          <div className="text-xs text-gray-600 text-left max-w-md mx-auto space-y-1">
            <p className="font-medium text-gray-500">Columnas esperadas:</p>
            <p>title, description, category, contractType, modality, location, salaryMin, salaryMax, requirements, benefits, urgent</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-400">{jobs.length} ofertas encontradas</p>
          <div className="max-h-80 overflow-y-auto border border-gray-700 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-[#181818] sticky top-0">
                <tr>
                  <th className="text-left p-3 text-gray-400 font-medium">#</th>
                  <th className="text-left p-3 text-gray-400 font-medium">Título</th>
                  <th className="text-left p-3 text-gray-400 font-medium">Categoría</th>
                  <th className="text-left p-3 text-gray-400 font-medium">Ubicación</th>
                  <th className="text-left p-3 text-gray-400 font-medium">Contrato</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job, i) => (
                  <tr key={i} className="border-t border-gray-800">
                    <td className="p-3 text-gray-500">{i + 1}</td>
                    <td className="p-3 text-white">{job.title}</td>
                    <td className="p-3 text-gray-400">{job.category}</td>
                    <td className="p-3 text-gray-400">{job.location}</td>
                    <td className="p-3 text-gray-400">{job.contractType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {error && <p className="text-red-400 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</p>}
          <div className="flex gap-3">
            <button onClick={() => { setJobs([]); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="flex-1 py-2 rounded-xl border border-gray-700 text-gray-300 text-sm font-medium hover:bg-gray-800">
              Cancelar
            </button>
            <button onClick={handleUpload} disabled={loading} className="flex-1 bg-[#0f70b7] hover:bg-[#0d5fa0] text-white py-2 rounded-xl font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Publicar {jobs.length} ofertas
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
