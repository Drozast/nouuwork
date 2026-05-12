import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth';
import { UserPlus, Trash2, Loader2, Crown } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface Member {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  joinedAt: any;
}

export function MembersManager({ companyId, isOwner }: { companyId: string; isOwner: boolean }) {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { fetchMembers(); }, [companyId]);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`${API_BASE}/api/companies/${companyId}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setMembers(await res.json());
    } catch {} finally { setLoading(false); }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setError('');
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`${API_BASE}/api/companies/${companyId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setInviteEmail('');
      fetchMembers();
    } catch (err: any) {
      setError(err.message);
    } finally { setInviting(false); }
  };

  const handleRemove = async (uid: string) => {
    try {
      const token = await user?.getIdToken();
      await fetch(`${API_BASE}/api/companies/${companyId}/members/${uid}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchMembers();
    } catch {}
  };

  if (loading) return <Loader2 className="w-5 h-5 animate-spin text-gray-400 mx-auto mt-8" />;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">Miembros</h2>
      
      {isOwner && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input type="email" placeholder="Email del reclutador" value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleInvite(); }}
              className="flex-1 bg-[#181818] border border-gray-700 rounded-xl py-2 px-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0f70b7]" />
            <button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}
              className="bg-[#0f70b7] hover:bg-[#0d5fa0] text-white px-4 rounded-xl font-medium text-sm disabled:opacity-50 flex items-center gap-2">
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Invitar
            </button>
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>
      )}

      <div className="space-y-2">
        {members.map(member => (
          <div key={member.uid} className="flex items-center justify-between bg-[#181818] border border-gray-800 rounded-xl p-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#0f70b7]/20 rounded-full flex items-center justify-center text-[#0f70b7] font-bold text-sm">
                {member.displayName?.charAt(0) || member.email?.charAt(0) || '?'}
              </div>
              <div>
                <p className="text-sm text-white flex items-center gap-2">
                  {member.displayName || 'Sin nombre'}
                  {member.role === 'owner' && <Crown className="w-3.5 h-3.5 text-yellow-400" />}
                </p>
                <p className="text-xs text-gray-500">{member.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 px-2 py-0.5 bg-gray-800 rounded-full">
                {member.role === 'owner' ? 'Dueño' : 'Reclutador'}
              </span>
              {isOwner && member.role !== 'owner' && (
                <button onClick={() => handleRemove(member.uid)}
                  className="text-gray-500 hover:text-red-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
