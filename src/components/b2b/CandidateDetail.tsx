import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth';
import { ArrowLeft, Loader2, Mail, Phone, Clock, Send } from 'lucide-react';
import { Application, ApplicationNote } from '../../types';

const API_BASE = import.meta.env.VITE_API_URL || '';

const STATUSES = ['nuevo', 'revisado', 'entrevista', 'contratado', 'rechazado'];
const STATUS_COLORS: Record<string, string> = {
  nuevo: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  revisado: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  entrevista: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  contratado: 'bg-green-500/20 text-green-400 border-green-500/30',
  rechazado: 'bg-red-500/20 text-red-400 border-red-500/30',
};

interface CandidateDetailProps {
  application: Application;
  onBack: () => void;
  onStatusChange: () => void;
}

export function CandidateDetail({ application, onBack, onStatusChange }: CandidateDetailProps) {
  const { user, profile } = useAuth();
  const [status, setStatus] = useState(application.status || 'nuevo');
  const [notes, setNotes] = useState<ApplicationNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => { fetchNotes(); }, []);

  const fetchNotes = async () => {
    setLoadingNotes(true);
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`${API_BASE}/api/applications/${application.id}/notes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setNotes(await res.json());
    } catch {} finally { setLoadingNotes(false); }
  };

  const changeStatus = async (newStatus: string) => {
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`${API_BASE}/api/applications/${application.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) { setStatus(newStatus); onStatusChange(); }
    } catch {}
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    setSending(true);
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`${API_BASE}/api/applications/${application.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: newNote.trim() }),
      });
      if (res.ok) { setNewNote(''); fetchNotes(); }
    } catch {} finally { setSending(false); }
  };

  const appliedDate = (() => {
    const ts = application.appliedAt as any;
    if (ts?.seconds) return new Date(ts.seconds * 1000);
    if (ts?.toDate) return ts.toDate();
    return new Date(ts || Date.now());
  })();

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm">
        <ArrowLeft className="w-4 h-4" /> Volver
      </button>

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-[#0f70b7]/20 rounded-full flex items-center justify-center text-[#0f70b7] font-bold text-xl">
            {(application.applicantName || '?').charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{application.applicantName}</h2>
            <p className="text-gray-400">{application.jobTitle}</p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[status] || STATUS_COLORS.nuevo}`}>
          {status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {application.applicantEmail && (
          <a href={`mailto:${application.applicantEmail}`} className="flex items-center gap-2 bg-[#181818] border border-gray-700 rounded-xl p-3 text-sm text-gray-300 hover:border-[#0f70b7]">
            <Mail className="w-4 h-4 text-gray-500" /> {application.applicantEmail}
          </a>
        )}
        {application.applicantPhone && (
          <a href={`tel:${application.applicantPhone}`} className="flex items-center gap-2 bg-[#181818] border border-gray-700 rounded-xl p-3 text-sm text-gray-300 hover:border-[#0f70b7]">
            <Phone className="w-4 h-4 text-gray-500" /> {application.applicantPhone}
          </a>
        )}
      </div>
      <p className="flex items-center gap-1 text-xs text-gray-500">
        <Clock className="w-3 h-3" /> Postuló el {appliedDate.toLocaleDateString('es-CL')}
      </p>

      <div>
        <label className="text-sm font-medium text-gray-400 block mb-2">Cambiar estado</label>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map(s => (
            <button key={s} onClick={() => changeStatus(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${s === status ? STATUS_COLORS[s] : 'bg-[#181818] border-gray-700 text-gray-400 hover:border-gray-600'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-400 mb-3">Notas</h3>
        <div className="space-y-2 mb-3">
          {loadingNotes ? (
            <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
          ) : notes.length === 0 ? (
            <p className="text-xs text-gray-600">Sin notas aún</p>
          ) : (
            notes.map(note => (
              <div key={note.id} className="bg-[#181818] border border-gray-800 rounded-lg p-3">
                <p className="text-sm text-gray-300">{note.text}</p>
                <p className="text-xs text-gray-600 mt-1">{note.authorName} - {(() => {
                  const ts = note.createdAt as any;
                  if (ts?.seconds) return new Date(ts.seconds * 1000);
                  if (ts?.toDate) return ts.toDate();
                  return new Date();
                })().toLocaleString('es-CL')}</p>
              </div>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <input type="text" placeholder="Agregar nota..." value={newNote} onChange={e => setNewNote(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addNote(); }}
            className="flex-1 bg-[#181818] border border-gray-700 rounded-xl py-2 px-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0f70b7]" />
          <button onClick={addNote} disabled={sending || !newNote.trim()}
            className="bg-[#0f70b7] hover:bg-[#0d5fa0] text-white px-4 rounded-xl disabled:opacity-50 flex items-center gap-2">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
