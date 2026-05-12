import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { AdminLogin } from './AdminLogin';
import AdminPanel from './AdminPanel';
import { Loader2, ShieldX, LogOut } from 'lucide-react';

const ADMIN_EMAILS = ['drozast@gmail.com', 'seba.hormero@gmail.com'];

const AdminRoute: React.FC = () => {
  const [state, setState] = useState<'loading' | 'unauthenticated' | 'unauthorized' | 'authorized'>('loading');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setState('unauthenticated');
      } else if (ADMIN_EMAILS.includes(user.email || '')) {
        setState('authorized');
      } else {
        setState('unauthorized');
      }
    });
    return unsub;
  }, []);

  const handleLogin = (email: string) => {
    if (ADMIN_EMAILS.includes(email)) {
      setState('authorized');
    } else {
      setState('unauthorized');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setState('unauthenticated');
  };

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-[#1f1f1f] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#f83758] animate-spin" />
      </div>
    );
  }

  if (state === 'unauthenticated') {
    return <AdminLogin onLogin={handleLogin} />;
  }

  if (state === 'unauthorized') {
    return (
      <div className="min-h-screen bg-[#1f1f1f] flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-4">
            <ShieldX className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Sin permisos</h1>
          <p className="text-gray-400 mb-6">
            No tienes permisos de administrador para acceder a este panel.
          </p>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 mx-auto bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  return <AdminPanel />;
};

export default AdminRoute;
