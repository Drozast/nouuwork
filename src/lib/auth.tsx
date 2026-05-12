import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

export type UserRole = 'worker' | 'company';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  phone?: string;
  photoURL?: string;
  bio?: string;
  location?: string;
  rut?: string;
  role: UserRole;
  accountType?: 'individual' | 'business';
  companyId?: string;
  createdAt: any;
  subscription?: {
    plan: 'free' | 'premium';
    startDate: string;
    endDate: string;
    status: 'active' | 'expired' | 'cancelled';
    discountCode?: string;
  } | null;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, role: UserRole) => Promise<void>;
  loginWithGoogle: (role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const googleProvider = new GoogleAuthProvider();

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (uid: string) => {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      const profileData: UserProfile = {
        uid: data.uid || uid,
        email: data.email || '',
        displayName: data.displayName || '',
        phone: data.phone || '',
        photoURL: data.photoURL || data.photoBase64 || '',
        bio: data.bio || '',
        location: data.location || '',
        rut: data.rut || '',
        role: data.role || 'worker',
        accountType: data.accountType || 'individual',
        companyId: data.companyId || null,
        createdAt: data.createdAt,
      };
      // Fetch subscription status from API
      try {
        const token = await auth.currentUser?.getIdToken();
        if (token) {
          const API_BASE = import.meta.env.VITE_API_URL || '';
          const subRes = await fetch(`${API_BASE}/api/subscription`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (subRes.ok) {
            const subData = await subRes.json();
            profileData.subscription = subData.subscription;
          }
        }
      } catch { /* ignore subscription fetch errors */ }
      setProfile(profileData);
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        await fetchProfile(u.uid);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const createProfile = async (u: User, role: UserRole, name?: string) => {
    const ref = doc(db, 'users', u.uid);
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      const data: any = {
        uid: u.uid,
        email: u.email!,
        displayName: name || u.displayName || '',
        role,
        accountType: role === 'company' ? 'business' : 'individual',
        createdAt: serverTimestamp(),
        profileCompletionScore: 25, // email + name
      };
      await setDoc(ref, data);
      setProfile({ uid: u.uid, email: u.email!, displayName: data.displayName, role, accountType: role === 'company' ? 'business' : 'individual', createdAt: new Date() });
    } else {
      const d = existing.data();
      setProfile({
        uid: d.uid || u.uid,
        email: d.email || u.email!,
        displayName: d.displayName || '',
        phone: d.phone || '',
        photoURL: d.photoURL || d.photoBase64 || '',
        bio: d.bio || '',
        location: d.location || '',
        rut: d.rut || '',
        role: d.role || 'worker',
        accountType: d.accountType || 'individual',
        createdAt: d.createdAt,
      });
    }
  };

  const login = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await fetchProfile(cred.user.uid);
  };

  const register = async (email: string, password: string, name: string, role: UserRole) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    await createProfile(cred.user, role, name);
  };

  const loginWithGoogle = async (role: UserRole) => {
    const result = await signInWithPopup(auth, googleProvider);
    await createProfile(result.user, role);
  };

  const logout = async () => {
    await signOut(auth);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, register, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
