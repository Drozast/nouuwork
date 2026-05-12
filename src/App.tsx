import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  FileText,
  Map as MapIcon,
  MessageSquare,
  Building,
  Send,
  CheckCircle2,
  MapPin,
  DollarSign,
  Clock,
  Filter,
  Plus,
  Bot,
  Target,
  Lightbulb,
  Briefcase,
  Lock,
  Mail,
  Loader2,
  ArrowLeft,
  X,
  Phone,
  GraduationCap,
  Trash2,
  RotateCcw,
  Sun,
  Moon,
  LogOut,
  User,
  Menu,
  Camera,
  Download,
  Upload,
  Edit3,
  Globe,
  Award,
  Zap,
  Star,
} from "lucide-react";
import Markdown from "react-markdown";
import { extractCVData } from "./lib/gemini";
import { ChatProvider, useChat, setAuthGateCallback } from "./lib/chat-context";
import { generateCVHtml, CVData } from "./lib/cv-template";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { db, trackPageView, trackEvent } from "./lib/firebase";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { LandingPage } from "./components/LandingPage";
import { Footer } from "./components/Footer";
import { NouuLogo } from "./components/NouuLogo";
import { AuthModal } from "./components/AuthModal";
import CodeInputBar from "./components/CodeInputBar";
import { useAuth } from "./lib/auth";
import B2BPanel from "./components/B2BPanel";
import { CompanyDashboard } from "./components/b2b/CompanyDashboard";
import PublishChoice from "./components/PublishChoice";
import NouuForm from "./components/NouuForm";
import { CompanySetup } from "./components/b2b/CompanySetup";
import { lazy, Suspense } from "react";

const AdminRoute = lazy(() => import("./components/admin/AdminRoute"));

const customIcon = new L.DivIcon({
  className: "custom-marker",
  html: `<div style="width: 16px; height: 16px; background-color: #f83758; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 15px rgba(248,55,88,0.5);"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const CITY_COORDS: Record<string, [number, number]> = {
  'santiago': [-33.4489, -70.6693], 'providencia': [-33.4264, -70.6103],
  'las condes': [-33.4036, -70.5670], 'ñuñoa': [-33.4569, -70.5968],
  'vitacura': [-33.3917, -70.5714], 'la florida': [-33.5167, -70.5994],
  'maipú': [-33.5117, -70.7572], 'maipu': [-33.5117, -70.7572],
  'puente alto': [-33.6117, -70.5756], 'san bernardo': [-33.5928, -70.7000],
  'estación central': [-33.4500, -70.6792], 'quilicura': [-33.3500, -70.7333],
  'lo barnechea': [-33.3500, -70.5167], 'lampa': [-33.2833, -70.8833],
  'calera de tango': [-33.6333, -70.8000], 'valparaíso': [-33.0472, -71.6127],
  'valparaiso': [-33.0472, -71.6127], 'viña del mar': [-33.0153, -71.5503],
  'concepción': [-36.8270, -73.0503], 'concepcion': [-36.8270, -73.0503],
  'temuco': [-38.7359, -72.5904], 'antofagasta': [-23.6509, -70.3975],
  'la serena': [-29.9027, -71.2519], 'rancagua': [-34.1708, -70.7406],
  'talca': [-35.4264, -71.6553], 'arica': [-18.4783, -70.3126],
  'iquique': [-20.2141, -70.1524], 'puerto montt': [-41.4689, -72.9411],
  'coquimbo': [-29.9533, -71.3436], 'calama': [-22.4560, -68.9293],
  'chillán': [-36.6063, -72.1034], 'chillan': [-36.6063, -72.1034],
  'los ángeles': [-37.4693, -72.3526], 'copiapó': [-27.3668, -70.3323],
  'punta arenas': [-53.1548, -70.9113], 'valdivia': [-39.8196, -73.2452],
  'osorno': [-40.5744, -73.1339], 'curicó': [-34.9828, -71.2394],
  'renca': [-33.3833, -70.7167], 'recoleta': [-33.4000, -70.6333],
  'peñalolén': [-33.4833, -70.5333], 'macul': [-33.4833, -70.5833],
  'la reina': [-33.4500, -70.5333], 'pudahuel': [-33.4333, -70.7500],
  'santiago centro': [-33.4489, -70.6693], 'melipilla': [-33.6833, -71.2167],
  'maría elena': [-22.3500, -69.6667], 'maria elena': [-22.3500, -69.6667],
};

function getCityCoords(location: string): [number, number] {
  if (!location) return [-33.4489, -70.6693];
  const clean = location.toLowerCase()
    .replace(/r\.metropolitana/gi, '')
    .replace(/región metropolitana/gi, '')
    .replace(/,\s*$/, '')
    .trim();
  // Try exact match
  if (CITY_COORDS[clean]) return CITY_COORDS[clean];
  // Try first part before comma or dash
  const parts = clean.split(/[,\-]/);
  for (const part of parts) {
    const trimmed = part.trim();
    if (CITY_COORDS[trimmed]) return CITY_COORDS[trimmed];
  }
  // Try partial match
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (clean.includes(city) || city.includes(clean)) return coords;
  }
  return [-33.4489, -70.6693]; // Santiago fallback
}

const userIcon = new L.DivIcon({
  className: "user-marker",
  html: `<div style="width: 20px; height: 20px; background-color: #0f70b7; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 15px rgba(15,112,183,0.5);"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const Header = ({
  currentView,
  setCurrentView,
  theme,
  toggleTheme,
  onOpenAuth,
}: {
  currentView: string;
  setCurrentView: (v: string) => void;
  theme: "dark" | "light";
  toggleTheme: () => void;
  onOpenAuth: () => void;
}) => {
  const { user, profile, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: "cv", icon: FileText, label: "Crear CV" },
    { id: "map", icon: MapIcon, label: "Mapa Laboral" },
    { id: "publish", icon: Plus, label: "Publicar" },
    { id: "assistant", icon: MessageSquare, label: "Asistente IA" },
    { id: "b2b", icon: Building, label: "Para Empresas" },
  ];

  return (
    <header className="relative flex items-center justify-between px-4 md:px-8 py-4 border-b border-[var(--border-color)] bg-[var(--bg-primary)] sticky top-0 z-50">
      <div className="cursor-pointer" onClick={() => setCurrentView("landing")}>
        <NouuLogo className="text-2xl" />
      </div>
      <nav className="hidden md:flex space-x-8">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentView(item.id)}
            className={`flex items-center space-x-2 text-sm font-medium transition-colors ${currentView === item.id ? "text-white" : "text-[var(--text-secondary)] hover:text-white"}`}
          >
            <item.icon className="w-4 h-4" />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="hidden md:flex items-center space-x-3">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-white transition-colors"
          title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {user ? (
          <div className="flex items-center space-x-2">
            <div
              className="flex items-center space-x-2 bg-[var(--bg-card)] border border-[var(--border-subtle)] px-3 py-1.5 rounded-lg cursor-pointer hover:border-[var(--border-subtle)] transition-colors"
              onClick={() => {
                if (profile?.accountType === 'business') {
                  if (profile?.companyId) {
                    setCurrentView("company_dashboard");
                  } else {
                    setCurrentView("company_setup");
                  }
                } else {
                  setCurrentView("dashboard");
                }
              }}
              title="Mi Dashboard"
            >
              <div className="w-6 h-6 bg-[#f83758] rounded-full flex items-center justify-center text-white text-xs font-bold">
                {(profile?.displayName || user.email || "U").charAt(0).toUpperCase()}
              </div>
              <span className="text-sm text-[var(--text-body)] max-w-[120px] truncate">
                {profile?.displayName || user.email}
              </span>
            </div>
            <button
              onClick={() => logout()}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-red-400 transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="bg-[#f83758] hover:bg-[#d62847] text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Ingresar
          </button>
        )}
      </div>

      {/* Mobile controls */}
      <div className="flex items-center space-x-2 md:hidden">
        <button onClick={toggleTheme} className="w-9 h-9 flex items-center justify-center rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-white transition-colors">
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <button onClick={() => setMobileMenuOpen(v => !v)} className="w-9 h-9 flex items-center justify-center rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-white transition-colors">
          {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileMenuOpen && (
        <div className="absolute top-full left-0 right-0 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] z-50 md:hidden">
          <nav className="flex flex-col">
            {navItems.map((item) => (
              <button key={item.id} onClick={() => { setCurrentView(item.id); setMobileMenuOpen(false); }}
                className={`flex items-center space-x-3 px-6 py-4 text-sm font-medium border-b border-[var(--border-color)]/50 transition-colors ${currentView === item.id ? "text-white bg-[#f83758]/10" : "text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-card)]"}`}>
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="px-6 py-4 flex items-center justify-between">
            {user ? (
              <div className="flex items-center space-x-3 w-full">
                <div className="flex items-center space-x-2 flex-1 bg-[var(--bg-card)] border border-[var(--border-subtle)] px-3 py-2 rounded-lg cursor-pointer" onClick={() => { 
                if (profile?.accountType === 'business') {
                  if (profile?.companyId) {
                    setCurrentView("company_dashboard");
                  } else {
                    setCurrentView("company_setup");
                  }
                } else {
                  setCurrentView("dashboard");
                }
                setMobileMenuOpen(false); 
              }}>
                  <div className="w-6 h-6 bg-[#f83758] rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {(profile?.displayName || user.email || "U").charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-[var(--text-body)] truncate">{profile?.displayName || user.email}</span>
                </div>
                <button onClick={() => { logout(); setMobileMenuOpen(false); }} className="w-9 h-9 flex items-center justify-center rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-red-400 transition-colors">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button onClick={() => { onOpenAuth(); setMobileMenuOpen(false); }} className="w-full bg-[#f83758] hover:bg-[#d62847] text-white px-6 py-2.5 rounded-lg font-medium transition-colors">
                Ingresar
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

const CVGenerator = () => {
  const { messages, isLoading, sendMessage, setSessionType, clearChat } = useChat();
  const { user } = useAuth();
  const [input, setInput] = useState("");
  const [cvData, setCvData] = useState<CVData | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSessionType('cv');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  useEffect(() => {
    if (messages.length > 2) {
      const chatHistory = messages.map(m => `${m.role}: ${m.text}`).join('\n');
      updateCVPreview(chatHistory);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const saveCVToFirestore = async (data: CVData) => {
    if (!user) return;
    if (!data.name) {
      console.log('[saveCVToFirestore] Skipping save: no name in CV data');
      return;
    }
    try {
      console.log('[saveCVToFirestore] Saving CV data for user:', user.uid);
      const API_BASE = import.meta.env.VITE_API_URL || '';
      const { auth, db } = await import('./lib/firebase');
      const token = await auth.currentUser?.getIdToken().catch(() => null);
      const res = await fetch(`${API_BASE}/api/profile/cv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
      });
      console.log('[saveCVToFirestore] CV save response status:', res.status);

      // Also update the user's Firestore doc with CV metadata
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
      await updateDoc(doc(db, 'users', user.uid), {
        hasCv: true,
        cvUpdatedAt: serverTimestamp(),
      });
      console.log('[saveCVToFirestore] Updated user doc with hasCv flag');
    } catch (err) {
      console.error('[saveCVToFirestore] Error saving CV:', err);
    }
  };

  const updateCVPreview = async (chatHistory: string) => {
    if (!user) {
      console.log('[updateCVPreview] Skipping: user not authenticated');
      return;
    }
    const data = await extractCVData(chatHistory);
    setCvData(data as unknown as CVData);
    saveCVToFirestore(data as unknown as CVData);
    let filled = 0;
    const totalFields = 8;
    if (data.name) filled++;
    if (data.email) filled++;
    if (data.phone) filled++;
    if (data.location) filled++;
    if (data.experience) filled++;
    if (data.education) filled++;
    if (data.skills) filled++;
    if (data.languages) filled++;
    setProgress(Math.round((filled / totalFields) * 100));
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage = input.trim();
    setInput("");
    await sendMessage(userMessage);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setUploadLoading(true);
    try {
      const API_BASE = import.meta.env.VITE_API_URL || '';
      const { auth } = await import('./lib/firebase');
      const token = await auth.currentUser?.getIdToken().catch(() => null);
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_BASE}/api/parse-cv-file`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      if (!res.ok) throw new Error('Error procesando archivo');
      const data = await res.json();

      // Build a natural summary to inject into the chat
      const parts: string[] = [];
      if (data.name) parts.push(`Mi nombre es ${data.name}.`);
      if (data.email) parts.push(`Mi email es ${data.email}.`);
      if (data.phone) parts.push(`Mi teléfono es ${data.phone}.`);
      if (data.location) parts.push(`Vivo en ${data.location}.`);
      if (data.experience) parts.push(`Mi experiencia laboral: ${data.experience}.`);
      if (data.education) parts.push(`Mi educación: ${data.education}.`);
      if (data.skills) parts.push(`Mis habilidades: ${data.skills}.`);
      if (data.languages) parts.push(`Idiomas: ${data.languages}.`);
      if (data.summary) parts.push(`Resumen profesional: ${data.summary}.`);

      const summary = parts.length > 0
        ? `Adjunté mi CV. Aquí está mi información: ${parts.join(' ')}`
        : 'Adjunté mi CV pero no pude extraer la información. ¿Me ayudas completando los datos?';

      await sendMessage(summary);
      // Also update the CV preview panel and save to profile
      if (data.name) {
        setCvData(data as unknown as CVData);
        saveCVToFirestore(data as unknown as CVData);
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'Error procesando archivo';
      console.error('[handleFileUpload] Error:', errorMsg, err);
      await sendMessage(`Hubo un error al subir el CV: ${errorMsg}. ¿Puedes ayudarme a completarlo manualmente?`);
    } finally {
      setUploadLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!cvData) return;
    setDownloadLoading(true);
    try {
      const html = generateCVHtml(cvData);
      const container = document.createElement('div');
      container.innerHTML = html;
      container.style.cssText = 'position:fixed;left:-9999px;top:0;width:800px;background:white;';
      document.body.appendChild(container);

      const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      document.body.removeChild(container);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`CV_${cvData.name?.replace(/\s+/g, '_') || 'NOUU'}.pdf`);
    } catch (err) {
      console.error('PDF error:', err);
    } finally {
      setDownloadLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[var(--bg-primary)] mb-20" style={{ background: "linear-gradient(135deg, rgba(248,55,88,0.05) 0%, transparent 60%)" }}>
      {/* Header */}
      <div className="px-4 md:px-8 py-4 md:py-6 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-primary)]">
        <div className={`flex items-center space-x-4 animate-fadeInUp`}>
          <div className="w-12 h-12 bg-[#f83758] rounded-xl flex items-center justify-center text-white">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Generador de CV</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Crea tu CV profesional conversando con MarIA
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            clearChat();
            setCvData(null);
            setProgress(0);
          }}
          className="flex items-center space-x-2 bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:border-[var(--border-subtle)] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          <span className="hidden sm:inline">Reiniciar</span>
        </button>
      </div>

      {/* Progress Bar */}
      <div className="animate-fadeInUp delay-100 px-4 md:px-8 py-3 border-b border-[var(--border-color)] bg-[var(--bg-primary)] flex items-center justify-between text-sm">
        <span className="text-[var(--text-secondary)]">Progreso de tu CV</span>
        <span className="text-[var(--text-secondary)]">{progress}%</span>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex justify-center p-2 md:p-8 overflow-hidden h-[calc(100vh-200px)]">
        <div className="animate-slideInBlur delay-200 w-full max-w-3xl bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] overflow-hidden shadow-2xl flex flex-col h-full">
          {/* Chat Header */}
          <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-[#f83758] rounded-full flex items-center justify-center animate-float">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-white font-medium">MarIA</h3>
                <div className="flex items-center space-x-1.5">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs text-green-500">En línea</span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {user && cvData?.name && (
                <span className="text-xs text-green-500 font-medium">✓ Guardado en tu perfil</span>
              )}
              <button
                onClick={handleDownload}
                disabled={!cvData || downloadLoading}
                className="text-[#f83758] hover:text-[#d62847] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Descargar CV como PDF"
              >
                {downloadLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                )}
              </button>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="p-6 space-y-6 overflow-y-auto flex-1">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex space-x-3 ${msg.role === "user" ? "flex-row-reverse space-x-reverse" : ""} ${idx === messages.length - 1 ? "animate-fadeInUp" : ""}`}
              >
                {msg.role === "model" && (
                  <div className="w-8 h-8 bg-[#f83758] rounded-full flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}
                <div
                  className={`rounded-2xl p-4 text-sm ${
                    msg.role === "user"
                      ? "bg-[#f83758] text-white rounded-tr-none"
                      : "bg-[var(--bg-bubble)] text-[var(--text-primary)] border border-[var(--border-subtle)]/50 rounded-tl-none"
                  }`}
                >
                  <div className="markdown-body prose prose-invert prose-sm max-w-none">
                    <Markdown>{msg.text}</Markdown>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex space-x-3">
                <div className="w-8 h-8 bg-[#f83758] rounded-full flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-[var(--bg-bubble)] rounded-2xl rounded-tl-none p-4 flex items-center space-x-2 border border-[var(--border-subtle)]/50">
                  <Loader2 className="w-4 h-4 text-[var(--text-secondary)] animate-spin" />
                  <span className="text-sm text-[var(--text-secondary)]">Escribiendo...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <CodeInputBar />
          {/* Chat Input */}
          <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] shrink-0">
            {/* Upload button row */}
            <div className="flex items-center space-x-2 mb-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadLoading || isLoading}
                className="flex items-center space-x-1.5 text-xs text-[var(--text-secondary)] hover:text-white bg-[var(--bg-primary)] border border-[var(--border-subtle)] hover:border-[var(--border-subtle)] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                title="Subir CV existente (PDF o imagen)"
              >
                {uploadLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                )}
                <span>{uploadLoading ? 'Analizando...' : 'Subir CV existente'}</span>
              </button>
              <span className="text-[10px] text-[var(--text-muted)]">PDF, JPG o PNG · máx 10MB</span>
            </div>
            <div className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Escribe tu respuesta..."
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-xl py-3 pl-4 pr-12 text-sm text-white focus:outline-none focus:border-[#f83758] transition-colors"
                disabled={isLoading || uploadLoading}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading || uploadLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-[#f83758]/20 text-[#f83758] rounded-lg hover:bg-[#f83758] hover:text-white transition-colors disabled:opacity-50 disabled:hover:bg-[#f83758]/20 disabled:hover:text-[#f83758]"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ApplyButton = ({ jobId, jobTitle, company, urlOriginal }: { jobId: number | string; jobTitle: string; company: string; urlOriginal?: string }) => {
  const { user } = useAuth();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'no-cv'>('idle');

  const handleApply = async () => {
    if (!user) {
      window.dispatchEvent(new CustomEvent('nouu:need-auth'));
      return;
    }
    setStatus('loading');
    try {
      const API_BASE = import.meta.env.VITE_API_URL || '';
      const { auth } = await import('./lib/firebase');
      const token = await auth.currentUser?.getIdToken().catch(() => null);

      // Check if user has a saved CV first
      const cvResp = await fetch(`${API_BASE}/api/profile/cv`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (cvResp.status === 404 || !cvResp.ok) {
        setStatus('no-cv');
        return;
      }

      const res = await fetch(`${API_BASE}/api/applications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ jobId: String(jobId), jobTitle, company }),
      });
      const data = await res.json();
      if (res.status === 400 && data.error?.includes('CV')) {
        setStatus('no-cv');
      } else if (res.ok) {
        setStatus('success');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  if (status === 'success') return (
    <div className="mt-3 w-full bg-green-500/10 border border-green-500/30 text-green-400 text-xs py-2 px-3 rounded-lg text-center font-medium">
      Postulacion enviada
    </div>
  );

  if (status === 'no-cv') return (
    <div className="mt-3 w-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs py-2 px-3 rounded-lg text-center">
      Crea tu CV primero con MarIA o sube tu PDF
    </div>
  );

  // Scraped job with original URL — show "Ver oferta original" button
  if (urlOriginal) {
    const handleViewOriginal = async () => {
      const { trackOfertaClick } = await import('./lib/firebase');
      trackOfertaClick({ jobId, jobTitle, company, urlOriginal, userId: user?.uid ?? null });
      window.open(urlOriginal, '_blank');
    };
    return (
      <div className="mt-2 flex gap-2">
        <button
          onClick={handleViewOriginal}
          className="flex-1 bg-[#0f70b7] hover:bg-[#0c5a92] text-white text-xs py-1.5 rounded-lg font-medium transition-colors flex items-center justify-center space-x-1"
        >
          <span>Ver oferta original</span>
        </button>
      </div>
    );
  }

  // User-posted job — show "Postular" button
  return (
    <button
      onClick={handleApply}
      disabled={status === 'loading'}
      className="mt-2 w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-xs py-1.5 rounded-lg font-medium transition-colors flex items-center justify-center space-x-1"
    >
      {status === 'loading' ? (
        <><Loader2 className="w-3 h-3 animate-spin" /><span>Enviando...</span></>
      ) : (
        <><span>Postular ahora</span></>
      )}
    </button>
  );
};

/* Helper: recenter map when user location changes */
const MapRecenter = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => { map.setView(center, 13, { animate: true }); }, [center, map]);
  return null;
};

/* Helper: fly to a specific location with animation */
const FlyToLocation = ({ coords, trigger }: { coords: [number, number] | null; trigger: number }) => {
  const map = useMap();
  useEffect(() => {
    if (coords && trigger > 0) {
      map.flyTo(coords, 16, { animate: true, duration: 1 });
    }
  }, [coords, trigger, map]);
  return null;
};

const LaborMap = ({ onNavigate, onViewNouu }: { onNavigate?: (v: string) => void; onViewNouu?: (nouu: any) => void }) => {
  const { messages, isLoading, sendMessage, setSessionType } = useChat();
  const { user } = useAuth();
  const [input, setInput] = useState("");
  const [mobileTab, setMobileTab] = useState<'jobs' | 'map' | 'chat'>('jobs');
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Geolocation state
  const DEFAULT_LOCATION: [number, number] = [-33.437, -70.65];
  const [userLocation, setUserLocation] = useState<[number, number]>(DEFAULT_LOCATION);
  const [locationStatus, setLocationStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [manualAddress, setManualAddress] = useState('');

  /* Geolocation on mount */
  useEffect(() => {
    if (!navigator.geolocation) { setLocationStatus('error'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation([pos.coords.latitude, pos.coords.longitude]);
        setLocationStatus('ok');
      },
      () => setLocationStatus('error'),
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, []);

  const [jobs, setJobs] = useState<{id: number|string; title: string; company: string; location: string; salary: string; time: string; tags: string[]; urgent?: boolean; coords: [number, number]; urlOriginal?: string}[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);

  // Trabajos informales (Nouus clásicos) desde Firestore de la app Nouu
  type InformalJob = { id: string; title: string; description: string; category: string; price: string; address: string; commune: string; coords: [number, number]; ownerName: string; paymentMethod?: string; scheduledDate?: string | null; sourceUrl?: string; sourcePlatform?: string; };
  const [informalJobs, setInformalJobs] = useState<InformalJob[]>([]);
  const [showInformal, setShowInformal] = useState(true);
  const [showFormal, setShowFormal] = useState(true);
  const [selectedNouu, setSelectedNouu] = useState<InformalJob | null>(null);
  const [flyToCoords, setFlyToCoords] = useState<[number, number] | null>(null);
  const [flyToTrigger, setFlyToTrigger] = useState(0);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyMessage, setApplyMessage] = useState('');
  const [applyPrice, setApplyPrice] = useState('');
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyError, setApplyError] = useState('');
  const [applySuccess, setApplySuccess] = useState(false);

  const NOUU_APP_PROJECT = import.meta.env.VITE_NOUU_APP_PROJECT_ID;

  const fetchInformalJobs = useCallback(async () => {
    try {
      const q = query(
        collection(db, 'maria_nouus'),
        where('status', '==', 'active'),
        orderBy('createdAt', 'desc'),
        limit(100)
      );
      const snap = await getDocs(q);
      const mapped: InformalJob[] = snap.docs.map(d => {
        const data = d.data();
        const lat = data.latitude ?? data.location?.lat ?? data.location?._lat ?? data.coords?.[0] ?? -33.437;
        const lng = data.longitude ?? data.location?.lng ?? data.location?._long ?? data.coords?.[1] ?? -70.65;
        const price = data.budget ?? data.suggestedPrice ?? data.price ?? null;
        const address = data.address || data.commune || data.city || data.locationName || '';
        const commune = data.city || data.commune || '';
        const ownerName = data.ownerContact?.name || data.ownerName || data.publisherName || data.originalOwner?.name || data.originalOwner?.contacts?.email || '';
        return {
          id: d.id,
          title: data.title ?? '',
          description: data.description ?? '',
          category: data.category ?? '',
          price: price ? `$${Number(price).toLocaleString('es-CL')}` : 'A convenir',
          address: address,
          commune: commune || address,
          coords: [lat, lng] as [number, number],
          ownerName: ownerName,
          paymentMethod: data.paymentMethod ?? '',
          scheduledDate: data.scheduledDate ?? null,
          sourceUrl: data.source?.url ?? data.sourceUrl,
          sourcePlatform: data.source?.platform ?? data.sourcePlatform,
        };
      }).filter(n => {
        // Excluir Nouus sin datos mínimos: título, descripción o ubicación
        const hasTitle = n.title && n.title.trim().length > 0;
        const hasDescription = n.description && n.description.trim().length > 10;
        const hasLocation = n.address && n.address.trim().length > 0;
        return hasTitle && (hasDescription || hasLocation);
      });
      setInformalJobs(mapped);
    } catch (e) {
      console.error('Error fetching nouus:', e);
    }
  }, []);

  useEffect(() => { fetchInformalJobs(); }, [fetchInformalJobs]);

  useEffect(() => {
    const API_BASE = import.meta.env.VITE_API_URL || '';
    fetch(`${API_BASE}/api/jobs`)
      .then(r => r.json())
      .then(data => {
        const mapped = (Array.isArray(data) ? data : []).map((j: any) => ({
          id: j.id,
          title: j.title || j.titulo || '',
          company: j.company || j.empresa || '',
          location: j.location || j.comuna || j.direccion || '',
          salary: j.salary || (j.sueldoMin && j.sueldoMax ? `$${j.sueldoMin.toLocaleString()} - $${j.sueldoMax.toLocaleString()}` : '') || 'A convenir',
          time: j.time || j.fecha_publicacion || j.fechaPublicacion || 'Reciente',
          tags: j.tags || j.skills || [],
          urgent: j.urgent || j.esUrgente || false,
          coords: (j.coords && Array.isArray(j.coords) && j.coords.length === 2)
            ? j.coords as [number, number]
            : getCityCoords(j.location || j.comuna || ''),
          urlOriginal: j.urlOriginal || j.url_original || undefined,
        }));
        // Sort by distance from user location
        mapped.sort((a, b) => {
          const distA = Math.sqrt(Math.pow(a.coords[0] - userLocation[0], 2) + Math.pow(a.coords[1] - userLocation[1], 2));
          const distB = Math.sqrt(Math.pow(b.coords[0] - userLocation[0], 2) + Math.pow(b.coords[1] - userLocation[1], 2));
          return distA - distB;
        });
        setJobs(mapped);
        setJobsLoading(false);
      })
      .catch(() => setJobsLoading(false));
  }, [userLocation]);

  const filteredJobs = useMemo(() => {
    if (!searchQuery.trim()) return jobs;
    const query = searchQuery.toLowerCase();
    return jobs.filter(j => 
      j.title.toLowerCase().includes(query) || 
      j.company.toLowerCase().includes(query) ||
      j.tags.some(t => t.toLowerCase().includes(query))
    );
  }, [searchQuery, jobs]);

  useEffect(() => {
    if (jobs.length > 0) {
      const jobsSummary = jobs.map(j => `${j.title} en ${j.location} (${j.company}) - ${j.salary}`).join('\n');
      setSessionType('map', `Ofertas disponibles:\n${jobsSummary}`);
    }
  }, [jobs, setSessionType]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage = input.trim();
    setInput("");
    await sendMessage(userMessage);
  };

  // Animated user marker icon
  const animatedUserIcon = new L.DivIcon({
    className: '',
    html: `<div class="user-location-marker"><div class="ring"></div><div class="ring ring2"></div><div class="dot"></div></div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });

  return (
    <div className="flex flex-col h-[calc(100vh-73px)] pb-16 md:pb-0 mb-0 md:mb-20" style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.05) 0%, transparent 60%)" }}>
      {/* Map Header */}
      <div className="px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-primary)]">
        <div className="flex items-center justify-between animate-fadeInUp">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-[#f83758]/20 rounded-xl flex items-center justify-center text-[#f83758]">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Mapa Laboral</h2>
              <p className="text-xs text-[var(--text-secondary)]">
                {locationStatus === 'loading' ? '📍 Detectando tu ubicación...' :
                 locationStatus === 'ok' ? '📍 Ubicación detectada' :
                 '📍 Usando Santiago centro (no se detectó tu ubicación)'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 flex-wrap gap-y-2">
            {/* Filtro por tipo de trabajo en el mapa - se maneja en la barra de búsqueda */}
          </div>
        </div>

        {/* Location error banner + manual input */}
        {locationStatus === 'error' && (
          <div className="mt-3 flex items-center space-x-2">
            <div className="flex-1 relative">
              <input type="text" value={manualAddress}
                onChange={e => setManualAddress(e.target.value)}
                placeholder="Ingresa tu dirección (ej: Av. Providencia 100, Santiago)"
                className="w-full bg-[var(--bg-card)] border border-[#f83758]/30 rounded-lg py-2 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-[#f83758]/60 placeholder-gray-500"
              />
              <MapPin className="w-4 h-4 text-[#f83758] absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
            <button onClick={async () => {
              // Geocode with Nominatim
              try {
                const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(manualAddress + ', Chile')}&limit=1`);
                const d = await r.json();
                if (d[0]) { setUserLocation([parseFloat(d[0].lat), parseFloat(d[0].lon)]); setLocationStatus('ok'); }
              } catch {}
            }} className="bg-[#f83758] hover:bg-[#d62847] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap">
              Buscar
            </button>
          </div>
        )}
      </div>

      {/* Search Bar */}
      <div className="px-6 py-3 border-b border-[var(--border-color)] flex items-center space-x-3 bg-[var(--bg-primary)]">
        <div className="flex-1 relative">
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar por cargo, empresa o habilidad..."
            className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg py-2 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-[var(--border-subtle)]"
          />
          <MapPin className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
        </div>
        {/* Toggles Formal / Informal */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { setShowFormal(true); setShowInformal(true); }}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${showFormal && showInformal ? 'bg-[#f83758]/20 border-[#f83758]/40 text-[#f83758]' : 'bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-muted)]'}`}
          >
            Todos
          </button>
          <button
            onClick={() => setShowFormal(v => !v)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${showFormal ? 'bg-[#0f70b7]/20 border-[#0f70b7]/40 text-[#0f70b7]' : 'bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-muted)]'}`}
            title="Trabajos formales (Nouu Work)"
          >
            <span className="w-2 h-2 rounded-full bg-[#0f70b7] inline-block" />
            Nouu Work
          </button>
          <button
            onClick={() => setShowInformal(v => !v)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${showInformal ? 'bg-[#f83758]/20 border-[#f83758]/40 text-[#f83758]' : 'bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-muted)]'}`}
            title="Nouus (pololos y pegas)"
          >
            <span className="w-2 h-2 rounded-full bg-[#f83758] inline-block" />
            Nouu
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Left Panel */}
        <div className={`animate-fadeInLeft md:w-[400px] w-full border-r border-[var(--border-color)] bg-[var(--bg-primary)] overflow-y-auto flex-col ${mobileTab === 'jobs' ? 'flex' : 'hidden md:flex'}`}>
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between mb-2 px-2">
                <span className="text-sm text-[var(--text-secondary)]">
                  {(showFormal ? filteredJobs.length : 0) + (showInformal ? informalJobs.length : 0)} trabajos disponibles
                </span>
                <span className="text-xs text-[var(--text-muted)] flex items-center gap-2">
                  {showFormal && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#0f70b7] inline-block"/>Formales</span>}
                  {showInformal && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#f83758] inline-block"/>Nouus</span>}
                </span>
              </div>

              {showFormal && filteredJobs.map((job, idx) => (
                <div
                  key={`formal-list-${job.id}`}
                  className="animate-fadeInUp bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-4 hover:border-[var(--border-subtle)] transition-colors cursor-pointer"
                  style={{ animationDelay: `${idx * 60}ms` }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-white font-medium">{job.title}</h3>
                        {job.urgent && (
                          <span className="bg-red-500/10 text-red-500 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                            Urgente
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-[var(--text-secondary)]">{job.company}</p>
                    </div>
                  </div>

                  <div className="space-y-1.5 mb-4">
                    <div className="flex items-center text-xs text-[var(--text-secondary)]">
                      <MapPin className="w-3.5 h-3.5 mr-1.5" />
                      {job.location}
                    </div>
                    <div className="flex items-center text-xs text-[var(--text-secondary)]">
                      <DollarSign className="w-3.5 h-3.5 mr-1.5" />
                      {job.salary}
                    </div>
                    <div className="flex items-center text-xs text-[var(--text-secondary)]">
                      <Clock className="w-3.5 h-3.5 mr-1.5" />
                      {job.time}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {job.tags.map((tag, tIdx) => (
                      <span
                        key={tIdx}
                        className="bg-[var(--bg-primary)] text-[var(--text-secondary)] text-xs px-2 py-1 rounded-md border border-[var(--border-color)]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]/50" onClick={e => e.stopPropagation()}>
                    <ApplyButton jobId={job.id} jobTitle={job.title} company={job.company} urlOriginal={job.urlOriginal} />
                  </div>
                </div>
              ))}

              {/* Nouus */}
              {showInformal && informalJobs.map((nouu, idx) => (
                <div
                  key={`informal-list-${nouu.id}`}
                  className="animate-fadeInUp bg-[var(--bg-card)] border border-[#f83758]/20 rounded-xl p-4 hover:border-[#f83758]/40 transition-colors cursor-pointer"
                  style={{ animationDelay: `${idx * 40}ms` }}
                  onClick={() => { setSelectedNouu(nouu); setFlyToCoords(nouu.coords); setFlyToTrigger(Date.now()); setApplyMessage(''); setApplyError(''); setApplySuccess(false); }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-[#f83758]/20 text-[#f83758] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#f83758]/30">NOUU</span>
                        <h3 className="text-white font-medium text-sm">{nouu.title}</h3>
                      </div>
                      {nouu.category && <p className="text-[var(--text-muted)] text-xs">{nouu.category}</p>}
                    </div>
                    <span className="text-[#f83758] text-sm font-bold whitespace-nowrap">{nouu.price}</span>
                  </div>
                  {nouu.description && (
                    <p className="text-[var(--text-muted)] text-xs leading-relaxed mb-2 line-clamp-2">{nouu.description}</p>
                  )}
                  <p className="text-[var(--text-muted)] text-xs flex items-center gap-1 mb-1">
                    <MapPin className="w-3 h-3 text-[#f83758]/60 shrink-0" />
                    {nouu.commune || nouu.address}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5">
                    {nouu.ownerName && <p className="text-[var(--text-secondary)] text-xs">Por: {nouu.ownerName}</p>}
                    {nouu.paymentMethod && (
                      <span className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">
                        {nouu.paymentMethod === 'transferencia' ? 'Transferencia' : 'Efectivo'}
                      </span>
                    )}
                    {nouu.scheduledDate && (
                      <span className="text-[10px] text-gray-500">{nouu.scheduledDate}</span>
                    )}
                  </div>
                  <div className="flex gap-2 mt-3 pt-2 border-t border-[#f83758]/10">
                    <button
                      onMouseDown={e => { e.stopPropagation(); setSelectedNouu(nouu); }}
                      className="flex-1 bg-[#f83758]/10 hover:bg-[#f83758]/20 text-[#f83758] text-xs py-1.5 rounded-lg font-medium transition-colors"
                    >
                      Ver
                    </button>
                    <button
                      onMouseDown={e => { e.stopPropagation(); if (!user) { window.dispatchEvent(new CustomEvent('nouu:need-auth')); } else { setSelectedNouu(nouu); setShowApplyModal(true); setApplyPrice(nouu.price === 'A convenir' ? '' : nouu.price.replace(/[^0-9]/g, '')); setApplyMessage(''); setApplyError(''); setApplySuccess(false); } }}
                      className="flex-1 bg-[#f83758]/10 hover:bg-[#f83758]/20 text-[#f83758] text-xs py-1.5 rounded-lg font-medium transition-colors"
                    >
                      Postular
                    </button>
                  </div>
                </div>
              ))}
            </div>
        </div>

        {/* Map Area */}
        <div className={`animate-scaleIn delay-100 flex-1 bg-[#0f0f0f] relative overflow-hidden z-0 ${mobileTab === 'map' ? 'block' : 'hidden md:block'}`} style={{minHeight: mobileTab === 'map' ? '100%' : undefined}}>
          <MapContainer
            center={userLocation}
            zoom={13}
            style={{ height: "100%", width: "100%" }}
            zoomControl={false}
          >
            <MapRecenter center={userLocation} />
            <FlyToLocation coords={flyToCoords} trigger={flyToTrigger} />
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; OpenStreetMap contributors &copy; CARTO'
            />

            {/* Animated user location marker */}
            <Marker position={userLocation} icon={animatedUserIcon}>
              <Popup className="custom-popup">
                <div className="p-4">
                  <p className="font-bold text-white mb-1">📍 Tu ubicación</p>
                  <p className="text-[var(--text-secondary)] text-xs">Estás aquí</p>
                </div>
              </Popup>
            </Marker>

            {showFormal && filteredJobs.map((job) => {
              const icon = customIcon;

              return (
                <Marker key={`formal-${job.id}`} position={job.coords} icon={icon}
                  eventHandlers={{
                    popupopen: () => trackEvent({ type: 'view_job_popup', jobId: String(job.id), jobTitle: job.title, company: job.company }),
                  }}>
                  <Popup className="custom-popup" maxWidth={280} minWidth={240}>
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-[#0f70b7]/20 text-[#0f70b7] text-[11px] font-bold px-2 py-0.5 rounded-full border border-[#0f70b7]/30">NOUU WORK</span>
                        <span className="bg-gray-800 text-gray-400 text-[10px] px-1.5 py-0.5 rounded">{job.time || 'Reciente'}</span>
                      </div>
                      <h3 className="font-bold text-white text-[15px] mb-1">{job.title}</h3>
                      <p className="text-[var(--text-secondary)] text-xs mb-1">{job.company}</p>
                      <p className="text-green-400 text-lg font-bold mb-2">{job.salary}</p>
                      <p className="text-[var(--text-muted)] text-xs flex items-center gap-1 mb-3">
                        <MapPin className="w-3 h-3 text-[#0f70b7]/60 shrink-0" />
                        {job.location}
                      </p>
                      <ApplyButton jobId={job.id} jobTitle={job.title} company={job.company} urlOriginal={job.urlOriginal} />
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* Pins de Nouus — isologo */}
            {showInformal && informalJobs.map((nouu) => {
              const informalIcon = new L.DivIcon({
                className: '',
                html: `<div style="width:36px;height:36px;background:url('/isologo3dnouu.png') center/contain no-repeat;filter:drop-shadow(0 3px 8px rgba(249,115,22,0.6));"></div>`,
                iconSize: [36, 36], iconAnchor: [18, 18],
              });
              const catEmoji: Record<string, string> = {
                'Hogar y Jardín': '🏠', 'Limpieza': '🧹', 'Tecnología': '💻', 'Transporte': '🚗',
                'Educación': '📚', 'Mascotas': '🐕', 'Eventos': '🎉', 'Salud y Bienestar': '💆',
                'Arte y Creatividad': '🎨', 'Deportes': '⚽', 'Cocina': '🍳', 'Reparaciones': '🔧', 'Otros': '📌',
              };
              return (
                <Marker key={`informal-${nouu.id}`} position={nouu.coords} icon={informalIcon}>
                  <Popup className="custom-popup" maxWidth={350} minWidth={300} closeButton={false}>
                    <div className="p-5 animate-fadeInUp" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="bg-[#f83758]/25 text-[#f83758] text-[11px] font-bold px-2.5 py-1 rounded-full border border-[#f83758]/40">NOUU</span>
                          <span className="bg-gray-800 text-gray-300 text-[11px] px-2 py-0.5 rounded flex items-center gap-1">
                            {catEmoji[nouu.category] || '📌'} {nouu.category}
                          </span>
                        </div>
                        <button
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          className="text-gray-500 hover:text-white p-0.5"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <h3 className="font-bold text-white text-[15px] leading-tight mb-2">{nouu.title}</h3>
                      <p className="text-[#f83758] text-xl font-bold mb-3">{nouu.price}</p>
                      {nouu.description && (
                        <p className="text-gray-300 text-sm leading-relaxed mb-3 max-h-20 overflow-y-auto">{nouu.description}</p>
                      )}
                      <div className="flex items-start gap-2 mb-2">
                        <MapPin className="w-3.5 h-3.5 text-[#f83758]/60 shrink-0 mt-0.5" />
                        <p className="text-[var(--text-muted)] text-xs leading-relaxed">{nouu.address || nouu.commune || 'Sin ubicación'}</p>
                      </div>
                      {nouu.ownerName && (
                        <p className="text-[var(--text-secondary)] text-xs mb-1.5">Por: <span className="text-white">{nouu.ownerName}</span></p>
                      )}
                      <div className="flex items-center gap-3 mb-4">
                        {nouu.paymentMethod && (
                          <span className="text-[11px] bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full">
                            {nouu.paymentMethod === 'transferencia' ? '💳 Transferencia' : '💵 Efectivo'}
                          </span>
                        )}
                        {nouu.scheduledDate && (
                          <span className="text-[11px] text-gray-500">📅 {nouu.scheduledDate}</span>
                        )}
                      </div>
                      <div className="flex gap-2 pt-3 border-t border-[#f83758]/30">
                        <button
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onViewNouu?.(nouu); }}
                          className="flex-1 bg-[#f83758] hover:bg-[#d62847] text-white text-sm py-2.5 rounded-lg font-medium transition-all hover:scale-105 shadow-lg shadow-[#f83758]/20"
                        >
                          Ver
                        </button>
                        <button
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); if (!user) { window.dispatchEvent(new CustomEvent('nouu:need-auth')); } else { setSelectedNouu(nouu); setShowApplyModal(true); setApplyPrice(nouu.price === 'A convenir' ? '' : nouu.price.replace(/[^0-9]/g, '')); setApplyMessage(''); setApplyError(''); setApplySuccess(false); } }}
                          className="flex-1 bg-gradient-to-r from-[#f83758] to-[#d62847] hover:from-[#f83758] hover:to-[#f83758] text-white text-sm py-2.5 rounded-lg font-medium transition-all hover:scale-105 shadow-lg shadow-[#f83758]/20"
                        >
                          Postular
                        </button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>

        {/* Chat Area */}
        <div className={`animate-fadeInRight delay-150 md:w-[350px] w-full border-l border-[var(--border-color)] bg-[var(--bg-primary)] flex-col ${mobileTab === 'chat' ? 'flex' : 'hidden md:flex'}`}>
          {/* Chat Header */}
          <div className="p-4 border-b border-[var(--border-color)] flex items-center space-x-3 shrink-0">
            <div className="w-8 h-8 bg-[#f83758] rounded-full flex items-center justify-center animate-float">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-white font-medium text-sm">
                Asistente de Mapa
              </h3>
              <div className="flex items-center space-x-1.5">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                <span className="text-[10px] text-green-500">En línea</span>
              </div>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="p-4 space-y-4 overflow-y-auto flex-1">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex space-x-2 ${msg.role === "user" ? "flex-row-reverse space-x-reverse" : ""}`}
              >
                {msg.role === "model" && (
                  <div className="w-6 h-6 bg-[#f83758] rounded-full flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-3 h-3 text-white" />
                  </div>
                )}
                <div
                  className={`rounded-2xl p-3 text-xs ${
                    msg.role === "user"
                      ? "bg-[#f83758] text-white rounded-tr-none"
                      : "bg-[var(--bg-bubble)] text-[var(--text-primary)] border border-[var(--border-subtle)]/50 rounded-tl-none"
                  }`}
                >
                  <div className="markdown-body prose prose-invert prose-sm max-w-none text-xs">
                    <Markdown>{msg.text}</Markdown>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex space-x-2">
                <div className="w-6 h-6 bg-[#f83758] rounded-full flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-3 h-3 text-white" />
                </div>
                <div className="bg-[var(--bg-bubble)] rounded-2xl rounded-tl-none p-3 flex items-center space-x-2 border border-[var(--border-subtle)]/50">
                  <Loader2 className="w-3 h-3 text-[var(--text-secondary)] animate-spin" />
                  <span className="text-xs text-[var(--text-secondary)]">Escribiendo...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <CodeInputBar />
          {/* Chat Input */}
          <div className="p-3 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] shrink-0">
            <div className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Pregunta por trabajos..."
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-xl py-2 pl-3 pr-10 text-xs text-white focus:outline-none focus:border-[#f83758] transition-colors"
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 bg-[#f83758]/20 text-[#f83758] rounded-lg hover:bg-[#f83758] hover:text-white transition-colors disabled:opacity-50 disabled:hover:bg-[#f83758]/20 disabled:hover:text-[#f83758]"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile tab bar — visible only on small screens */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--bg-secondary)] border-t border-[var(--border-color)] flex z-50">
          {[
            { id: 'jobs' as const, icon: Filter, label: 'Trabajos' },
            { id: 'map' as const, icon: MapIcon, label: 'Mapa' },
            { id: 'chat' as const, icon: MessageSquare, label: 'MarIA' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setMobileTab(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center py-3 space-y-1 transition-colors ${mobileTab === tab.id ? 'text-[#f83758]' : 'text-[var(--text-muted)]'}`}>
              <tab.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const Assistant = () => {
  const { messages, isLoading, sendMessage, setSessionType } = useChat();
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSessionType('interview');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage = input.trim();
    setInput("");
    await sendMessage(userMessage);
  };

  const handleSelectTopic = (topic: string) => {
    setSessionType('interview', `El usuario quiere practicar: "${topic}"`);
    sendMessage(`Quiero prepararme para: "${topic}". ¿Por dónde empezamos?`);
    setActiveTopic(topic);
  };

  if (activeTopic) {
    return (
      <div className="flex-1 flex flex-col items-center py-4 md:py-8 px-4 md:px-8 max-w-3xl mx-auto w-full h-[calc(100vh-73px)] mb-20">
        <div className="w-full flex items-center justify-between mb-6">
          <button
            onClick={() => setActiveTopic(null)}
            className="flex items-center space-x-2 text-[var(--text-secondary)] hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a temas</span>
          </button>
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] px-4 py-2 rounded-lg text-sm text-white font-medium">
            {activeTopic}
          </div>
        </div>

        <div className="animate-slideInBlur w-full bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] overflow-hidden shadow-2xl flex flex-col flex-1 min-h-0">
          {/* Chat Header */}
          <div className="p-4 border-b border-[var(--border-color)] flex items-center space-x-3 shrink-0">
            <div className="w-10 h-10 bg-[#f83758] rounded-full flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-white font-medium">
                MarIA - Coach de Entrevistas
              </h3>
              <div className="flex items-center space-x-1.5">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs text-green-500">En línea</span>
              </div>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="p-6 space-y-6 overflow-y-auto flex-1">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex space-x-3 ${msg.role === "user" ? "flex-row-reverse space-x-reverse" : ""} ${idx === messages.length - 1 ? "animate-fadeInUp" : ""}`}
              >
                {msg.role === "model" && (
                  <div className="w-8 h-8 bg-[#f83758] rounded-full flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}
                <div
                  className={`rounded-2xl p-4 text-sm ${
                    msg.role === "user"
                      ? "bg-[#f83758] text-white rounded-tr-none"
                      : "bg-[var(--bg-bubble)] text-[var(--text-primary)] border border-[var(--border-subtle)]/50 rounded-tl-none"
                  }`}
                >
                  <div className="markdown-body prose prose-invert prose-sm max-w-none">
                    <Markdown>{msg.text}</Markdown>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex space-x-3">
                <div className="w-8 h-8 bg-[#f83758] rounded-full flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-[var(--bg-bubble)] rounded-2xl rounded-tl-none p-4 flex items-center space-x-2 border border-[var(--border-subtle)]/50">
                  <Loader2 className="w-4 h-4 text-[var(--text-secondary)] animate-spin" />
                  <span className="text-sm text-[var(--text-secondary)]">Escribiendo...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <CodeInputBar />
          {/* Chat Input */}
          <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] shrink-0">
            <div className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Escribe tu respuesta..."
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-xl py-3 pl-4 pr-12 text-sm text-white focus:outline-none focus:border-[#f83758] transition-colors"
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-[#f83758]/20 text-[#f83758] rounded-lg hover:bg-[#f83758] hover:text-white transition-colors disabled:opacity-50 disabled:hover:bg-[#f83758]/20 disabled:hover:text-[#f83758]"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
        </div>
      </div>

      {/* Nouu Detail Modal */}
      {selectedNouu && !showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setSelectedNouu(null)}>
          <div className="bg-[#222222] border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl animate-fadeInUp" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <img src="/isologo3dnouu.png" alt="Nouu" className="w-7 h-7 object-contain" />
                <h2 className="text-lg font-bold text-white">Nouu</h2>
              </div>
              <button onClick={() => setSelectedNouu(null)} className="p-1 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="bg-[#f83758]/20 text-[#f83758] text-[11px] font-bold px-2 py-0.5 rounded-full border border-[#f83758]/30">NOUU</span>
                {selectedNouu.category && (() => {
                  const e: Record<string, string> = {'Hogar y Jardín':'🏠','Limpieza':'🧹','Tecnología':'💻','Transporte':'🚗','Educación':'📚','Mascotas':'🐕','Eventos':'🎉','Salud y Bienestar':'💆','Arte y Creatividad':'🎨','Deportes':'⚽','Cocina':'🍳','Reparaciones':'🔧'};
                  return (
                    <span className="bg-gray-800 text-gray-300 text-[11px] px-2 py-0.5 rounded">{e[selectedNouu.category] || '📌'} {selectedNouu.category}</span>
                  );
                })()}
              </div>
              <h3 className="text-xl font-bold text-white">{selectedNouu.title}</h3>
              <p className="text-[#f83758] text-2xl font-bold">{selectedNouu.price}</p>
              {selectedNouu.description && (
                <div>
                  <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-1">Descripción</h4>
                  <p className="text-gray-300 text-sm leading-relaxed">{selectedNouu.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-1">Ubicación</h4>
                  <p className="text-gray-300 flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-[#f83758]/60" />{selectedNouu.address || selectedNouu.commune}</p>
                </div>
                {selectedNouu.paymentMethod && (
                  <div>
                    <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-1">Pago</h4>
                    <p className="text-gray-300">{selectedNouu.paymentMethod === 'transferencia' ? '💳 Transferencia' : '💵 Efectivo'}</p>
                  </div>
                )}
                {selectedNouu.scheduledDate && (
                  <div>
                    <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-1">Fecha</h4>
                    <p className="text-gray-300">📅 {selectedNouu.scheduledDate}</p>
                  </div>
                )}
                {selectedNouu.ownerName && (
                  <div>
                    <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-1">Publicado por</h4>
                    <p className="text-gray-300">{selectedNouu.ownerName}</p>
                  </div>
                )}
              </div>
              <div className="flex gap-3 pt-3 border-t border-gray-800">
                <button
                  onClick={() => {
                    if (!user) { window.dispatchEvent(new CustomEvent('nouu:need-auth')); setSelectedNouu(null); return; }
                    setShowApplyModal(true);
                    setApplyPrice(selectedNouu.price === 'A convenir' ? '' : selectedNouu.price.replace(/[^0-9]/g, ''));
                    setApplyMessage('');
                    setApplyError('');
                    setApplySuccess(false);
                  }}
                  className="flex-1 bg-gradient-to-r from-[#f83758] to-[#d62847] hover:from-[#f83758] hover:to-[#f83758] text-white py-2.5 rounded-xl font-medium text-sm transition-all hover:scale-105"
                >
                  Postular
                </button>
                <button
                  onClick={() => setSelectedNouu(null)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2.5 rounded-xl font-medium text-sm transition-all"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Apply Modal */}
      {showApplyModal && selectedNouu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => { if (!applyLoading) setShowApplyModal(false); }}>
          <div className="bg-[#222222] border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl animate-fadeInUp" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h2 className="text-lg font-bold text-white">Postular a Nouu</h2>
              <button onClick={() => { if (!applyLoading) setShowApplyModal(false); }} className="p-1 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white" disabled={applyLoading}>
                <X className="w-5 h-5" />
              </button>
            </div>
            {applySuccess ? (
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">¡Postulación enviada!</h3>
                <p className="text-gray-400 text-sm mb-4">El publicador recibirá tu postulación y podrá contactarte por chat.</p>
                <button onClick={() => { setShowApplyModal(false); setSelectedNouu(null); }} className="bg-[#f83758] hover:bg-[#d62847] text-white px-6 py-2.5 rounded-xl font-medium text-sm transition-colors">
                  Entendido
                </button>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <p className="text-sm text-gray-400">
                  Te estás postulando a: <span className="text-white font-medium">{selectedNouu.title}</span>
                </p>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Mensaje de presentación (mín. 20 caracteres)</label>
                  <textarea
                    value={applyMessage}
                    onChange={e => setApplyMessage(e.target.value)}
                    placeholder="Hola! Me interesa tu Nouu. Tengo experiencia en..."
                    rows={4}
                    className="w-full bg-[#1f1f1f] border border-gray-700 rounded-xl py-2.5 px-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#f83758] resize-none"
                    disabled={applyLoading}
                  />
                  <p className="text-[10px] text-gray-500 mt-1">{applyMessage.length}/20 mínimo</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Precio propuesto (CLP)</label>
                  <input
                    type="number"
                    value={applyPrice}
                    onChange={e => setApplyPrice(e.target.value)}
                    placeholder="Ej: 25000"
                    className="w-full bg-[#1f1f1f] border border-gray-700 rounded-xl py-2.5 px-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#f83758]"
                    disabled={applyLoading}
                  />
                </div>
                {applyError && <p className="text-red-400 text-xs">{applyError}</p>}
                <button
                  onClick={async () => {
                    if (applyMessage.trim().length < 20) { setApplyError('El mensaje debe tener al menos 20 caracteres'); return; }
                    setApplyLoading(true); setApplyError('');
                    try {
                      const { auth } = await import('./lib/firebase');
                      const token = await auth.currentUser?.getIdToken();
                      if (!token) { setApplyError('Debes iniciar sesión'); setApplyLoading(false); return; }
                      const API_BASE = import.meta.env.VITE_API_URL || '';
                      const res = await fetch(`${API_BASE}/api/nouu/${selectedNouu.id}/apply`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ message: applyMessage, proposedPrice: Number(applyPrice) || null }),
                      });
                      if (!res.ok) { const err = await res.json(); setApplyError(err.error || 'Error al postular'); }
                      else setApplySuccess(true);
                    } catch { setApplyError('Error de conexión'); }
                    finally { setApplyLoading(false); }
                  }}
                  disabled={applyLoading || applyMessage.trim().length < 20}
                  className="w-full bg-gradient-to-r from-[#f83758] to-[#d62847] hover:from-[#f83758] hover:to-[#f83758] disabled:opacity-50 text-white py-2.5 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2"
                >
                  {applyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {applyLoading ? 'Enviando...' : 'Enviar postulación'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
  }

  return (
    <div className="flex-1 flex flex-col items-center py-6 md:py-12 px-4 md:px-8 max-w-4xl mx-auto w-full mb-20" style={{ background: "linear-gradient(135deg, rgba(15,112,183,0.05) 0%, transparent 60%)" }}>
      {/* Header */}
      <div className="w-full flex items-center space-x-4 mb-8 md:mb-16 bg-[var(--bg-card)] p-4 rounded-2xl border border-[var(--border-color)] animate-fadeInUp">
        <div className="w-12 h-12 bg-[#0f70b7]/20 rounded-xl flex items-center justify-center text-[#0f70b7] shrink-0">
          <MessageSquare className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">
            Asistente de Entrevista
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            MarIA te prepara para tu próxima entrevista
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="text-center mb-12">
        <div className="animate-scaleIn delay-100 w-16 h-16 bg-[#f83758] rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(248,55,88,0.3)]">
          <Bot className="w-8 h-8 text-white animate-float delay-300" />
        </div>
        <h1 className="animate-fadeInUp delay-200 text-3xl font-bold text-white mb-3">
          ¿En qué te ayudo hoy?
        </h1>
        <p className="animate-fadeInUp delay-200 text-[var(--text-secondary)]">
          Elige un tema y MarIA te guiará paso a paso para que llegues preparado
          a tu entrevista.
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 w-full mb-8 md:mb-12">
        <div
          onClick={() => handleSelectTopic("Preparar entrevista")}
          className="animate-fadeInUp delay-300 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 hover:border-[var(--border-subtle)] transition-colors cursor-pointer group"
        >
          <div className="w-10 h-10 bg-[#f83758]/20 rounded-lg flex items-center justify-center text-[#f83758] mb-4 group-hover:bg-[#f83758] group-hover:text-white transition-colors">
            <Target className="w-5 h-5" />
          </div>
          <h3 className="text-white font-semibold mb-2">Preparar entrevista</h3>
          <p className="text-sm text-[var(--text-secondary)]">
            Te ayudo a prepararte para una entrevista específica
          </p>
        </div>

        <div
          onClick={() => handleSelectTopic("Preguntas frecuentes")}
          className="animate-fadeInUp delay-400 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 hover:border-[var(--border-subtle)] transition-colors cursor-pointer group"
        >
          <div className="w-10 h-10 bg-[#f83758]/20 rounded-lg flex items-center justify-center text-[#f83758] mb-4 group-hover:bg-[#f83758] group-hover:text-white transition-colors">
            <MessageSquare className="w-5 h-5" />
          </div>
          <h3 className="text-white font-semibold mb-2">
            Preguntas frecuentes
          </h3>
          <p className="text-sm text-[var(--text-secondary)]">
            Practica respondiendo preguntas típicas de entrevista
          </p>
        </div>

        <div
          onClick={() => handleSelectTopic("Destacar habilidades")}
          className="animate-fadeInUp delay-500 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 hover:border-[var(--border-subtle)] transition-colors cursor-pointer group"
        >
          <div className="w-10 h-10 bg-[#f83758]/20 rounded-lg flex items-center justify-center text-[#f83758] mb-4 group-hover:bg-[#f83758] group-hover:text-white transition-colors">
            <Lightbulb className="w-5 h-5" />
          </div>
          <h3 className="text-white font-semibold mb-2">
            Destacar habilidades
          </h3>
          <p className="text-sm text-[var(--text-secondary)]">
            Aprende a presentar tus fortalezas
          </p>
        </div>

        <div
          onClick={() => handleSelectTopic("Simulación completa")}
          className="animate-fadeInUp delay-600 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 hover:border-[var(--border-subtle)] transition-colors cursor-pointer group"
        >
          <div className="w-10 h-10 bg-[#f83758]/20 rounded-lg flex items-center justify-center text-[#f83758] mb-4 group-hover:bg-[#f83758] group-hover:text-white transition-colors">
            <Briefcase className="w-5 h-5" />
          </div>
          <h3 className="text-white font-semibold mb-2">Simulación completa</h3>
          <p className="text-sm text-[var(--text-secondary)]">
            Simula una entrevista real de principio a fin
          </p>
        </div>
      </div>

      {/* Tips */}
      <div className="animate-fadeInUp delay-700 w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6">
        <div className="flex items-center space-x-2 mb-4">
          <CheckCircle2 className="w-5 h-5 text-green-500" />
          <h3 className="text-white font-semibold">Tips rápidos</h3>
        </div>
        <ul className="space-y-3 text-sm text-[var(--text-secondary)]">
          <li>
            <span className="text-[#f83758] font-bold mr-2">1.</span> Investiga
            la empresa antes de ir — mira su página web o redes sociales
          </li>
          <li>
            <span className="text-[#f83758] font-bold mr-2">2.</span> Prepara
            2-3 preguntas para hacer al entrevistador al final
          </li>
          <li>
            <span className="text-[#f83758] font-bold mr-2">3.</span> Practica
            tu presentación personal (30 segundos sobre ti)
          </li>
          <li>
            <span className="text-[#f83758] font-bold mr-2">4.</span> Lleva
            copias de tu CV y cualquier certificado relevante
          </li>
        </ul>
      </div>
    </div>
  );
};

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
  id: number;
  title: string;
  location: string;
  type: string;
  createdAt: string;
  candidateCount: number;
}

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

const INITIAL_JOB_POSTINGS: JobPosting[] = [
  { id: 1, title: "Cajero/a Part-time", location: "Providencia, Santiago", type: "Part-time", createdAt: "Hace 3 días", candidateCount: 0 },
  { id: 2, title: "Reponedor/a Turno Noche", location: "Maipú, Santiago", type: "Turno", createdAt: "Hace 1 semana", candidateCount: 0 },
  { id: 3, title: "Bodeguero/a con Licencia", location: "La Florida, Santiago", type: "Tiempo completo", createdAt: "Hace 2 semanas", candidateCount: 0 },
  { id: 4, title: "Guardia de Seguridad", location: "Las Condes, Santiago", type: "Tiempo completo", createdAt: "Hoy", candidateCount: 0 },
];

const STATUS_COLORS: Record<CandidateStatus, string> = {
  Nuevo: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  Entrevistado: "bg-[#0f70b7]/10 text-[#0f70b7] border-[#0f70b7]/20",
  Aprobado: "bg-green-500/10 text-green-500 border-green-500/20",
  Rechazado: "bg-red-500/10 text-red-500 border-red-500/20",
};

const B2BLogin = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>(INITIAL_CANDIDATES);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [jobPostings, setJobPostings] = useState<JobPosting[]>(INITIAL_JOB_POSTINGS);
  const [showNewJobForm, setShowNewJobForm] = useState(false);
  const [newJob, setNewJob] = useState({ title: "", location: "", type: "Tiempo completo" });
  const [activeTab, setActiveTab] = useState<"candidates" | "jobs">("candidates");
  const [trashedJobs, setTrashedJobs] = useState<JobPosting[]>([]);
  const [showTrash, setShowTrash] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);
  const [aiSummaries, setAiSummaries] = useState<Record<number, string>>({});
  const [loadingSummary, setLoadingSummary] = useState<number | null>(null);

  const jobCandidates = useMemo(() => {
    if (!selectedJob) return [];
    return candidates.filter(c => c.jobIds.includes(selectedJob.id));
  }, [selectedJob, candidates]);

  const getJobCandidateCount = (jobId: number) => {
    return candidates.filter(c => c.jobIds.includes(jobId)).length;
  };

  const generateAiSummary = async (candidate: Candidate, jobTitle: string) => {
    if (aiSummaries[candidate.id]) return;
    setLoadingSummary(candidate.id);
    try {
      const { auth } = await import('./lib/firebase');
      const token = await auth.currentUser?.getIdToken().catch(() => null);
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiUrl}/api/ai-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ candidate, jobTitle }),
      });
      const data = await res.json();
      setAiSummaries(prev => ({ ...prev, [candidate.id]: data.summary || "No se pudo generar el resumen." }));
    } catch {
      setAiSummaries(prev => ({ ...prev, [candidate.id]: "Error al generar resumen." }));
    }
    setLoadingSummary(null);
  };

  const filteredCandidates = useMemo(() => {
    return candidates.filter(c => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        c.name.toLowerCase().includes(q) ||
        c.role.toLowerCase().includes(q) ||
        c.tags.some(t => t.toLowerCase().includes(q));
      const matchesStatus = statusFilter === "Todos" || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [candidates, searchQuery, statusFilter]);

  const metrics = useMemo(() => {
    const total = candidates.length;
    const interviewed = candidates.filter(c => c.status === "Entrevistado" || c.status === "Aprobado").length;
    const approved = candidates.filter(c => c.status === "Aprobado").length;
    const rejected = candidates.filter(c => c.status === "Rechazado").length;
    const avgScore = total > 0 ? Math.round(candidates.reduce((sum, c) => sum + c.score, 0) / total) : 0;
    return { total, interviewed, approved, rejected, avgScore };
  }, [candidates]);

  const handleStatusChange = (candidateId: number, newStatus: CandidateStatus) => {
    setCandidates(prev => prev.map(c => c.id === candidateId ? { ...c, status: newStatus } : c));
    if (selectedCandidate?.id === candidateId) {
      setSelectedCandidate(prev => prev ? { ...prev, status: newStatus } : null);
    }
  };

  const handleAddJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJob.title.trim()) return;
    setJobPostings(prev => [{ id: Date.now(), title: newJob.title, location: newJob.location || "Santiago, Chile", type: newJob.type, createdAt: "Hoy", candidateCount: 0 }, ...prev]);
    setNewJob({ title: "", location: "", type: "Tiempo completo" });
    setShowNewJobForm(false);
  };

  const handleDeleteJob = (jobId: number) => {
    const job = jobPostings.find(j => j.id === jobId);
    if (!job) return;
    setJobPostings(prev => prev.filter(j => j.id !== jobId));
    setTrashedJobs(prev => [job, ...prev]);
  };

  const handleRestoreJob = (jobId: number) => {
    const job = trashedJobs.find(j => j.id === jobId);
    if (!job) return;
    setTrashedJobs(prev => prev.filter(j => j.id !== jobId));
    setJobPostings(prev => [job, ...prev]);
  };

  const handlePermanentDelete = (jobId: number) => {
    setTrashedJobs(prev => prev.filter(j => j.id !== jobId));
  };

  const handleEmptyTrash = () => {
    setTrashedJobs([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setTimeout(() => {
      setIsLoading(false);
      setIsLoggedIn(true);
    }, 1500);
  };

  if (isLoggedIn) {
    return (
      <div className="flex-1 flex flex-col p-4 md:p-8 bg-[var(--bg-primary)] overflow-y-auto">
        <div className="flex justify-between items-center mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard de Reclutamiento</h1>
            <p className="text-[var(--text-secondary)] text-sm">Gestiona tus candidatos pre-filtrados por IA</p>
          </div>
          <button
            onClick={() => setIsLoggedIn(false)}
            className="text-sm text-[var(--text-secondary)] hover:text-white transition-colors"
          >
            Cerrar sesión
          </button>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-4 rounded-xl">
            <div className="text-[var(--text-secondary)] text-sm mb-1">Candidatos totales</div>
            <div className="text-2xl font-bold text-white">{metrics.total}</div>
          </div>
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-4 rounded-xl">
            <div className="text-[var(--text-secondary)] text-sm mb-1">Entrevistados por IA</div>
            <div className="text-2xl font-bold text-white">{metrics.interviewed}</div>
          </div>
          <div className="bg-[var(--bg-card)] border border-green-500/30 p-4 rounded-xl">
            <div className="text-green-500 text-sm mb-1">Aprobados</div>
            <div className="text-2xl font-bold text-green-500">{metrics.approved}</div>
          </div>
          <div className="bg-[var(--bg-card)] border border-red-500/30 p-4 rounded-xl">
            <div className="text-red-500 text-sm mb-1">Rechazados</div>
            <div className="text-2xl font-bold text-red-500">{metrics.rejected}</div>
          </div>
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-4 rounded-xl">
            <div className="text-[var(--text-secondary)] text-sm mb-1">Score promedio</div>
            <div className="text-2xl font-bold text-white">{metrics.avgScore}%</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 mb-6 bg-[var(--bg-card)] p-1 rounded-lg w-fit border border-[var(--border-color)]">
          <button onClick={() => setActiveTab("candidates")} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "candidates" ? "bg-[#f83758] text-white" : "text-[var(--text-secondary)] hover:text-white"}`}>
            Candidatos
          </button>
          <button onClick={() => setActiveTab("jobs")} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "jobs" ? "bg-[#f83758] text-white" : "text-[var(--text-secondary)] hover:text-white"}`}>
            Publicaciones
          </button>
        </div>

        {activeTab === "candidates" ? (
          <>
            {/* Filters */}
            <div className="flex space-x-4 mb-6">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Buscar candidato o cargo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-[var(--border-subtle)]"
                />
                <Filter className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[var(--border-subtle)]"
              >
                <option value="Todos">Todos los estados</option>
                <option value="Nuevo">Nuevo</option>
                <option value="Entrevistado">Entrevistado</option>
                <option value="Aprobado">Aprobado</option>
                <option value="Rechazado">Rechazado</option>
              </select>
              <span className="flex items-center text-sm text-[var(--text-muted)]">{filteredCandidates.length} de {candidates.length}</span>
            </div>

            {/* Candidates List */}
            <div className="space-y-4">
              {filteredCandidates.length === 0 ? (
                <div className="text-center py-12 text-[var(--text-muted)]">No se encontraron candidatos con esos filtros.</div>
              ) : (
                filteredCandidates.map((candidate) => (
                  <div key={candidate.id} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-6 flex items-center justify-between hover:border-[var(--border-subtle)] transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-[var(--border-color)] rounded-full flex items-center justify-center text-[var(--text-secondary)] font-bold">
                        {candidate.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-white font-medium">{candidate.name}</h3>
                        <div className="text-sm text-[var(--text-secondary)]">{candidate.role} • {candidate.date}</div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {candidate.tags.map((tag, tIdx) => (
                            <span key={tIdx} className="bg-[var(--bg-primary)] text-[var(--text-secondary)] text-xs px-2 py-1 rounded-md border border-[var(--border-color)]">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-6">
                      <div className="text-center">
                        <div className={`text-2xl font-bold ${candidate.score >= 80 ? "text-green-500" : candidate.score >= 70 ? "text-yellow-500" : "text-red-500"}`}>{candidate.score}%</div>
                        <div className="text-[10px] text-[var(--text-muted)] uppercase">Match</div>
                      </div>
                      <select
                        value={candidate.status}
                        onChange={(e) => handleStatusChange(candidate.id, e.target.value as CandidateStatus)}
                        className={`text-xs px-3 py-1.5 rounded-full border bg-transparent cursor-pointer focus:outline-none ${STATUS_COLORS[candidate.status]}`}
                      >
                        <option value="Nuevo">Nuevo</option>
                        <option value="Entrevistado">Entrevistado</option>
                        <option value="Aprobado">Aprobado</option>
                        <option value="Rechazado">Rechazado</option>
                      </select>
                      <button
                        onClick={() => setSelectedCandidate(candidate)}
                        className="bg-[#f83758] hover:bg-[#d62847] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        Ver detalle
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            {/* Job Postings */}
            {selectedJob ? (
              <>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="flex items-center space-x-2 text-[var(--text-secondary)] hover:text-white transition-colors mb-6"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-sm">Volver a publicaciones</span>
                </button>

                <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-6 mb-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-bold text-white">{selectedJob.title}</h2>
                      <div className="flex items-center space-x-4 mt-1 text-sm text-[var(--text-secondary)]">
                        <span className="flex items-center space-x-1"><MapPin className="w-3.5 h-3.5" /><span>{selectedJob.location}</span></span>
                        <span className="flex items-center space-x-1"><Clock className="w-3.5 h-3.5" /><span>{selectedJob.type}</span></span>
                        <span>{selectedJob.createdAt}</span>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-[#f83758]">{jobCandidates.length}</div>
                      <div className="text-[10px] text-[var(--text-muted)] uppercase">Candidatos</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {jobCandidates.length === 0 ? (
                    <div className="text-center py-12 text-[var(--text-muted)]">No hay candidatos para esta publicación aún.</div>
                  ) : (
                    jobCandidates.map(candidate => (
                      <div key={candidate.id} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-6 hover:border-[var(--border-subtle)] transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-[var(--border-color)] rounded-full flex items-center justify-center text-[var(--text-secondary)] font-bold">
                              {candidate.name.charAt(0)}
                            </div>
                            <div>
                              <h3 className="text-white font-medium">{candidate.name}</h3>
                              <div className="text-sm text-[var(--text-secondary)]">{candidate.role} • {candidate.location}</div>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {candidate.tags.map((tag, tIdx) => (
                                  <span key={tIdx} className="bg-[var(--bg-primary)] text-[var(--text-secondary)] text-xs px-2 py-1 rounded-md border border-[var(--border-color)]">{tag}</span>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-6">
                            <div className="text-center">
                              <div className={`text-2xl font-bold ${candidate.score >= 80 ? "text-green-500" : candidate.score >= 70 ? "text-yellow-500" : "text-red-500"}`}>{candidate.score}%</div>
                              <div className="text-[10px] text-[var(--text-muted)] uppercase">Match</div>
                            </div>
                            <span className={`text-xs px-3 py-1.5 rounded-full border ${STATUS_COLORS[candidate.status]}`}>{candidate.status}</span>
                            <button
                              onClick={() => setSelectedCandidate(candidate)}
                              className="bg-[#f83758] hover:bg-[#d62847] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                            >
                              Ver detalle
                            </button>
                          </div>
                        </div>

                        {/* AI Summary */}
                        <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
                          {aiSummaries[candidate.id] ? (
                            <div className="flex items-start space-x-3">
                              <Bot className="w-5 h-5 text-[#f83758] mt-0.5 flex-shrink-0" />
                              <div>
                                <span className="text-xs text-[#f83758] font-medium uppercase">Resumen IA</span>
                                <p className="text-sm text-[var(--text-body)] mt-1">{aiSummaries[candidate.id]}</p>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => generateAiSummary(candidate, selectedJob.title)}
                              disabled={loadingSummary === candidate.id}
                              className="flex items-center space-x-2 text-sm text-[#f83758] hover:text-[#d62847] transition-colors disabled:opacity-50"
                            >
                              {loadingSummary === candidate.id ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /><span>Generando resumen...</span></>
                              ) : (
                                <><Bot className="w-4 h-4" /><span>Generar resumen con IA</span></>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-bold text-white">
                    {showTrash ? "Papelera" : "Publicaciones activas"}
                  </h2>
                  <div className="flex items-center space-x-3">
                    {showTrash ? (
                      <>
                        <button
                          onClick={() => setShowTrash(false)}
                          className="text-[var(--text-secondary)] hover:text-white text-sm transition-colors flex items-center space-x-2"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          <span>Volver</span>
                        </button>
                        {trashedJobs.length > 0 && (
                          <button
                            onClick={handleEmptyTrash}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 border border-red-500/20"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Vaciar papelera</span>
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setShowTrash(true)}
                          className="relative text-[var(--text-secondary)] hover:text-white transition-colors flex items-center space-x-2 bg-[var(--bg-card)] border border-[var(--border-color)] px-4 py-2 rounded-lg text-sm"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Papelera</span>
                          {trashedJobs.length > 0 && (
                            <span className="bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                              {trashedJobs.length}
                            </span>
                          )}
                        </button>
                        <button
                          onClick={() => setShowNewJobForm(true)}
                          className="bg-[#f83758] hover:bg-[#d62847] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Nueva publicación</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {showTrash ? (
                  <div className="space-y-4">
                    {trashedJobs.length === 0 ? (
                      <div className="text-center py-16">
                        <Trash2 className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
                        <p className="text-[var(--text-muted)]">La papelera está vacía</p>
                      </div>
                    ) : (
                      trashedJobs.map(job => (
                        <div key={job.id} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-6 flex items-center justify-between opacity-70">
                          <div>
                            <h3 className="text-white font-medium">{job.title}</h3>
                            <div className="flex items-center space-x-4 mt-1 text-sm text-[var(--text-secondary)]">
                              <span className="flex items-center space-x-1"><MapPin className="w-3.5 h-3.5" /><span>{job.location}</span></span>
                              <span className="flex items-center space-x-1"><Clock className="w-3.5 h-3.5" /><span>{job.type}</span></span>
                              <span>{job.createdAt}</span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => handleRestoreJob(job.id)}
                              className="flex items-center space-x-2 text-sm text-green-500 hover:text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-2 rounded-lg transition-colors"
                            >
                              <RotateCcw className="w-4 h-4" />
                              <span>Restaurar</span>
                            </button>
                            <button
                              onClick={() => handlePermanentDelete(job.id)}
                              className="flex items-center space-x-2 text-sm text-red-500 hover:text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>Eliminar</span>
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <>
                    {showNewJobForm && (
                      <form onSubmit={handleAddJob} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-6 mb-6 space-y-4">
                        <h3 className="font-medium text-white">Nueva publicación de empleo</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <input
                            type="text"
                            placeholder="Título del cargo"
                            value={newJob.title}
                            onChange={(e) => setNewJob(prev => ({ ...prev, title: e.target.value }))}
                            required
                            className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-lg py-2.5 px-4 text-sm text-white focus:outline-none focus:border-[var(--border-subtle)]"
                          />
                          <input
                            type="text"
                            placeholder="Ubicación"
                            value={newJob.location}
                            onChange={(e) => setNewJob(prev => ({ ...prev, location: e.target.value }))}
                            className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-lg py-2.5 px-4 text-sm text-white focus:outline-none focus:border-[var(--border-subtle)]"
                          />
                          <select
                            value={newJob.type}
                            onChange={(e) => setNewJob(prev => ({ ...prev, type: e.target.value }))}
                            className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-lg py-2.5 px-4 text-sm text-white focus:outline-none focus:border-[var(--border-subtle)]"
                          >
                            <option>Tiempo completo</option>
                            <option>Part-time</option>
                            <option>Turno</option>
                          </select>
                        </div>
                        <div className="flex space-x-3">
                          <button type="submit" className="bg-[#f83758] hover:bg-[#d62847] text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors">Publicar</button>
                          <button type="button" onClick={() => { setShowNewJobForm(false); setNewJob({ title: "", location: "", type: "Tiempo completo" }); }} className="bg-[var(--border-color)] hover:bg-[var(--border-subtle)] text-[var(--text-body)] px-6 py-2 rounded-lg text-sm font-medium transition-colors">Cancelar</button>
                        </div>
                      </form>
                    )}

                    <div className="space-y-4">
                      {jobPostings.map(job => (
                        <div
                          key={job.id}
                          onClick={() => setSelectedJob(job)}
                          className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-6 flex items-center justify-between hover:border-[var(--border-subtle)] transition-colors cursor-pointer"
                        >
                          <div>
                            <h3 className="text-white font-medium">{job.title}</h3>
                            <div className="flex items-center space-x-4 mt-1 text-sm text-[var(--text-secondary)]">
                              <span className="flex items-center space-x-1"><MapPin className="w-3.5 h-3.5" /><span>{job.location}</span></span>
                              <span className="flex items-center space-x-1"><Clock className="w-3.5 h-3.5" /><span>{job.type}</span></span>
                              <span>{job.createdAt}</span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-6">
                            <div className="text-center">
                              <div className="text-xl font-bold text-white">{getJobCandidateCount(job.id)}</div>
                              <div className="text-[10px] text-[var(--text-muted)] uppercase">Candidatos</div>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteJob(job.id); }}
                              className="text-[var(--text-muted)] hover:text-red-500 transition-colors p-2"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* Candidate Detail Modal */}
        {selectedCandidate && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setSelectedCandidate(null)}>
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)]">
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 bg-[#f83758]/20 text-[#f83758] rounded-full flex items-center justify-center text-xl font-bold">
                    {selectedCandidate.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">{selectedCandidate.name}</h2>
                    <p className="text-[var(--text-secondary)]">{selectedCandidate.role} • {selectedCandidate.date}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-center">
                    <div className={`text-3xl font-bold ${selectedCandidate.score >= 80 ? "text-green-500" : selectedCandidate.score >= 70 ? "text-yellow-500" : "text-red-500"}`}>{selectedCandidate.score}%</div>
                    <div className="text-[10px] text-[var(--text-muted)] uppercase">Match</div>
                  </div>
                  <button onClick={() => setSelectedCandidate(null)} className="text-[var(--text-secondary)] hover:text-white transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Contact */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center space-x-3 text-sm">
                    <Mail className="w-4 h-4 text-[var(--text-muted)]" />
                    <span className="text-[var(--text-body)]">{selectedCandidate.email}</span>
                  </div>
                  <div className="flex items-center space-x-3 text-sm">
                    <Phone className="w-4 h-4 text-[var(--text-muted)]" />
                    <span className="text-[var(--text-body)]">{selectedCandidate.phone}</span>
                  </div>
                  <div className="flex items-center space-x-3 text-sm">
                    <MapPin className="w-4 h-4 text-[var(--text-muted)]" />
                    <span className="text-[var(--text-body)]">{selectedCandidate.location}</span>
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-2">Habilidades</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedCandidate.tags.map((tag, i) => (
                      <span key={i} className="bg-[var(--bg-primary)] text-[var(--text-body)] text-sm px-3 py-1 rounded-full border border-[var(--border-subtle)]">{tag}</span>
                    ))}
                  </div>
                </div>

                {/* Experience */}
                <div>
                  <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-2 flex items-center space-x-2"><Briefcase className="w-4 h-4" /><span>Experiencia</span></h4>
                  <p className="text-[var(--text-body)] text-sm bg-[var(--bg-primary)] p-4 rounded-xl border border-[var(--border-color)]">{selectedCandidate.experience}</p>
                </div>

                {/* Education */}
                <div>
                  <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-2 flex items-center space-x-2"><GraduationCap className="w-4 h-4" /><span>Educación</span></h4>
                  <p className="text-[var(--text-body)] text-sm bg-[var(--bg-primary)] p-4 rounded-xl border border-[var(--border-color)]">{selectedCandidate.education}</p>
                </div>

                {/* Notes */}
                <div>
                  <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-2">Notas</h4>
                  <p className="text-[var(--text-body)] text-sm bg-[var(--bg-primary)] p-4 rounded-xl border border-[var(--border-color)]">{selectedCandidate.notes}</p>
                </div>

                {/* Status Change */}
                <div>
                  <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Cambiar estado</h4>
                  <div className="flex flex-wrap gap-2">
                    {(["Nuevo", "Entrevistado", "Aprobado", "Rechazado"] as CandidateStatus[]).map(status => (
                      <button
                        key={status}
                        onClick={() => handleStatusChange(selectedCandidate.id, status)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          selectedCandidate.status === status
                            ? STATUS_COLORS[status].replace('/10', '/30') + " ring-1 ring-current"
                            : "bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--border-subtle)]"
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
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center py-12 px-8">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
          <Building className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">
          Panel de Empresas
        </h1>
        <p className="text-[var(--text-secondary)]">
          Inicia sesión para gestionar candidatos filtrados por IA
        </p>
      </div>

      <div className="w-full max-w-md bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-8">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-[var(--text-body)] mb-2">
              Email corporativo
            </label>
            <div className="relative">
              <input
                type="email"
                required
                placeholder="tu@empresa.cl"
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-green-500 transition-colors"
              />
              <Mail className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-body)] mb-2">
              Contraseña
            </label>
            <div className="relative">
              <input
                type="password"
                required
                placeholder="Tu contraseña"
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-green-500 transition-colors"
              />
              <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center bg-red-500/10 py-2 rounded-lg border border-red-500/20">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#f83758] hover:bg-[#d62847] text-white py-3 rounded-xl font-medium transition-colors flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              "Iniciar sesión"
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <a href="#" className="text-sm text-[#f83758] hover:underline">
            ¿Olvidaste tu contraseña?
          </a>
        </div>

        <div className="mt-8 pt-6 border-t border-[var(--border-color)] text-center">
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            ¿Tu empresa aún no tiene cuenta?
          </p>
          <button className="w-full bg-[var(--bg-primary)] border border-[var(--border-subtle)] hover:border-[var(--border-subtle)] text-white py-3 rounded-xl text-sm font-medium transition-colors flex items-center justify-center space-x-2">
            <Briefcase className="w-4 h-4" />
            <span>Solicitar acceso</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── Legal Pages ─────────────────────────────────────────────── */
const LegalPage = ({ title, children, onBack }: { title: string; children: React.ReactNode; onBack: () => void }) => (
  <div className="max-w-3xl mx-auto px-8 py-16 animate-fadeInUp">
    <button onClick={onBack} className="flex items-center space-x-2 text-[var(--text-secondary)] hover:text-white mb-8 transition-colors text-sm">
      <ArrowLeft className="w-4 h-4" />
      <span>Volver</span>
    </button>
    <h1 className="text-3xl font-bold mb-2">{title}</h1>
    <p className="text-[var(--text-muted)] text-sm mb-10">Última actualización: abril 2026 · NOUU SpA · Santiago, Chile</p>
    <div className="prose prose-invert prose-sm max-w-none space-y-6 text-[var(--text-body)] leading-relaxed">
      {children}
    </div>
  </div>
);

const TerminosView = ({ onBack }: { onBack: () => void }) => (
  <LegalPage title="Términos de uso" onBack={onBack}>
    <section>
      <h2 className="text-white font-bold text-lg mb-3">1. Objeto</h2>
      <p>NOUU SpA (en adelante "NOUU" o "NouuWork") es una plataforma tecnológica de intermediación laboral que conecta a personas que buscan empleo formal con empresas que ofrecen vacantes. Al usar NouuWork aceptas estos Términos en su totalidad.</p>
    </section>
    <section>
      <h2 className="text-white font-bold text-lg mb-3">2. Descripción del servicio</h2>
      <p>NouuWork ofrece: (a) generación de CV mediante asistente de IA conversacional; (b) mapa interactivo de ofertas laborales; (c) entrenamiento para entrevistas; (d) panel de reclutamiento para empresas. Los servicios se prestan en territorio chileno y se rigen por la legislación vigente.</p>
    </section>
    <section>
      <h2 className="text-white font-bold text-lg mb-3">3. Requisitos de uso</h2>
      <p>El servicio está disponible para personas naturales mayores de 15 años. Si eres menor de 18 años, debes contar con la autorización de tu padre, madre o tutor legal. Al registrarte declaras que la información proporcionada es veraz y actualizada.</p>
    </section>
    <section>
      <h2 className="text-white font-bold text-lg mb-3">4. Propiedad intelectual</h2>
      <p>Todo el contenido de NouuWork (marca, diseño, código, algoritmos de IA, textos y datos) es propiedad exclusiva de NOUU SpA. Los CVs generados son propiedad del usuario que los creó. Está prohibida la reproducción sin autorización expresa.</p>
    </section>
    <section>
      <h2 className="text-white font-bold text-lg mb-3">5. Conducta del usuario</h2>
      <p>El usuario se compromete a: no publicar información falsa; no usar la plataforma para actividades ilícitas; no intentar acceder a datos de otros usuarios; no hacer uso abusivo del asistente de IA. NOUU se reserva el derecho de suspender cuentas que infrinjan estas normas.</p>
    </section>
    <section>
      <h2 className="text-white font-bold text-lg mb-3">6. Limitación de responsabilidad</h2>
      <p>NOUU actúa como intermediario tecnológico. No garantiza la contratación ni la veracidad de las ofertas publicadas por empresas. El usuario es responsable de verificar las condiciones laborales antes de aceptar una oferta. NOUU no es parte del contrato laboral entre el trabajador y la empresa.</p>
    </section>
    <section>
      <h2 className="text-white font-bold text-lg mb-3">7. Modificaciones</h2>
      <p>NOUU puede modificar estos Términos con previo aviso de 30 días mediante correo electrónico o notificación en la plataforma. El uso continuado del servicio implica la aceptación de los nuevos términos.</p>
    </section>
    <section>
      <h2 className="text-white font-bold text-lg mb-3">8. Jurisdicción</h2>
      <p>Estos términos se rigen por las leyes de la República de Chile. Cualquier controversia será sometida a los tribunales ordinarios de justicia de Santiago de Chile.</p>
    </section>
  </LegalPage>
);

const PrivacidadView = ({ onBack }: { onBack: () => void }) => (
  <LegalPage title="Política de privacidad y protección de datos" onBack={onBack}>
    <section>
      <h2 className="text-white font-bold text-lg mb-3">1. Responsable del tratamiento</h2>
      <p>NOUU SpA, RUT en proceso de inscripción, con domicilio en Santiago, Chile, es responsable del tratamiento de tus datos personales, conforme a la <strong className="text-white">Ley N° 21.719 de Protección de Datos Personales</strong> (vigente desde diciembre 2026) y la Ley N° 19.628.</p>
    </section>
    <section>
      <h2 className="text-white font-bold text-lg mb-3">2. Datos que recopilamos</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong className="text-white">Datos de registro:</strong> nombre, correo electrónico, número de teléfono.</li>
        <li><strong className="text-white">Datos del CV:</strong> experiencia laboral, educación, habilidades, idiomas (solo los que tú proporcionas).</li>
        <li><strong className="text-white">Datos de uso:</strong> páginas visitadas, interacciones con el asistente IA, búsquedas en el mapa.</li>
        <li><strong className="text-white">Datos técnicos:</strong> dirección IP, tipo de dispositivo, navegador.</li>
      </ul>
      <p className="mt-3">No recopilamos datos sensibles (salud, religión, orientación sexual, afiliación política) sin consentimiento explícito.</p>
    </section>
    <section>
      <h2 className="text-white font-bold text-lg mb-3">3. Finalidad del tratamiento</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li>Prestación del servicio de intermediación laboral.</li>
        <li>Generación de CV y matching con ofertas de trabajo.</li>
        <li>Mejora del asistente de IA (de forma anonimizada).</li>
        <li>Comunicaciones sobre ofertas laborales relevantes (con tu consentimiento).</li>
        <li>Cumplimiento de obligaciones legales.</li>
      </ul>
    </section>
    <section>
      <h2 className="text-white font-bold text-lg mb-3">4. Base legal del tratamiento</h2>
      <p>Tratamos tus datos con base en: (a) ejecución del contrato de servicio; (b) consentimiento informado para comunicaciones de marketing; (c) interés legítimo para seguridad y mejora del servicio; (d) cumplimiento de obligaciones legales.</p>
    </section>
    <section>
      <h2 className="text-white font-bold text-lg mb-3">5. Transferencia de datos</h2>
      <p>Tus datos pueden ser compartidos con: (a) empresas que publicaron ofertas de trabajo a las que postulaste; (b) proveedores de infraestructura (Google Cloud/Firebase) bajo acuerdos de confidencialidad; (c) autoridades competentes cuando la ley lo exija. No vendemos ni cedemos tus datos personales a terceros con fines comerciales.</p>
    </section>
    <section>
      <h2 className="text-white font-bold text-lg mb-3">6. Tus derechos (ARCO+)</h2>
      <p>Conforme a la Ley N° 21.719 tienes derecho a:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong className="text-white">Acceso:</strong> conocer qué datos tenemos sobre ti.</li>
        <li><strong className="text-white">Rectificación:</strong> corregir datos inexactos.</li>
        <li><strong className="text-white">Cancelación/Supresión:</strong> solicitar la eliminación de tus datos.</li>
        <li><strong className="text-white">Oposición:</strong> oponerte al tratamiento para fines específicos.</li>
        <li><strong className="text-white">Portabilidad:</strong> recibir tus datos en formato estructurado.</li>
        <li><strong className="text-white">Revocación del consentimiento</strong> en cualquier momento.</li>
      </ul>
      <p className="mt-3">Para ejercer tus derechos escríbenos a: <strong className="text-white">privacidad@nouu.cl</strong></p>
    </section>
    <section>
      <h2 className="text-white font-bold text-lg mb-3">7. Cookies y tecnologías similares</h2>
      <p>Usamos cookies esenciales para el funcionamiento del servicio (autenticación, sesión) y cookies analíticas para mejorar la experiencia. Puedes gestionar tus preferencias en la configuración de tu navegador.</p>
    </section>
    <section>
      <h2 className="text-white font-bold text-lg mb-3">8. Retención de datos</h2>
      <p>Conservamos tus datos mientras mantengas una cuenta activa, y hasta 5 años después de la cancelación para cumplir obligaciones legales, salvo que solicites su eliminación antes.</p>
    </section>
    <section>
      <h2 className="text-white font-bold text-lg mb-3">9. Seguridad</h2>
      <p>Implementamos medidas técnicas y organizativas para proteger tus datos: cifrado TLS en tránsito, acceso restringido por roles, autenticación segura vía Firebase Auth, y respaldo periódico en Google Cloud (región us-central1).</p>
    </section>
    <section>
      <h2 className="text-white font-bold text-lg mb-3">10. Contacto y reclamaciones</h2>
      <p>Para consultas sobre privacidad: <strong className="text-white">privacidad@nouu.cl</strong>. Si no estás satisfecho con nuestra respuesta, puedes reclamar ante la Agencia de Protección de Datos Personales de Chile una vez que esté operativa.</p>
    </section>
  </LegalPage>
);

/* ─── Dashboard ──────────────────────────────────────────────── */

const Dashboard = ({ setCurrentView }: { setCurrentView: (v: string) => void }) => {
  const { user, profile } = useAuth();
  const displayName = profile?.displayName || user?.email || "Usuario";
  const initial = displayName.charAt(0).toUpperCase();

  // Tab state
  type DashTab = 'resumen' | 'cv' | 'postulaciones' | 'perfil';
  const [activeTab, setActiveTab] = useState<DashTab>('resumen');

  // Stats
  const [userStats, setUserStats] = useState({ cvs: 0, interviews: 0, days: 0, applications: 0 });
  const [lastCvUpdate, setLastCvUpdate] = useState<string | null>(null);

  // CV tab state
  const [cvData, setCvData] = useState<CVData | null>(null);
  const [cvLoading, setCvLoading] = useState(false);
  const [cvSource, setCvSource] = useState<string | null>(null);
  const [cvEditField, setCvEditField] = useState<string | null>(null);
  const [cvEditValues, setCvEditValues] = useState<Partial<CVData>>({});
  const [cvSaving, setCvSaving] = useState(false);
  const [cvDownloading, setCvDownloading] = useState(false);

  // Applications tab state
  const [applications, setApplications] = useState<any[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [selectedApp, setSelectedApp] = useState<any>(null);

  // Profile tab state
  const [profileData, setProfileData] = useState<{
    displayName: string;
    phone: string;
    location: string;
    bio: string;
    profession: string;
    specialty: string;
    experience: string;
    education: string;
    availability: string;
    rut: string;
    jobTypes: string[];
    regions: string[];
    services: string[];
  }>({ displayName: '', phone: '', location: '', bio: '', profession: '', specialty: '', experience: '', education: '', availability: '', rut: '', jobTypes: [], regions: [], services: [] });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Profile photo state
  const [profilePhotoURL, setProfilePhotoURL] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Subscription state
  const [subscription, setSubscription] = useState<{
    plan: string;
    startDate: string;
    endDate: string;
    status: string;
    discountCode?: string;
  } | null>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [discountCodeInput, setDiscountCodeInput] = useState('');
  const [discountCodeMsg, setDiscountCodeMsg] = useState('');
  const [applyingDiscount, setApplyingDiscount] = useState(false);

  // CV chat state (embedded MarIA for CV tab)
  const { messages: cvChatMessages, isLoading: cvChatLoading, sendMessage: cvChatSend, setSessionType: cvChatSetSession } = useChat();
  const [cvChatInput, setCvChatInput] = useState('');
  const cvChatEndRef = useRef<HTMLDivElement>(null);

  const API_BASE = import.meta.env.VITE_API_URL || '';

  const getToken = async () => {
    const { auth } = await import('./lib/firebase');
    return auth.currentUser?.getIdToken().catch(() => null) || null;
  };

  // Fetch stats on mount
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { db } = await import('./lib/firebase');
        const token = await getToken();
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

        const cvRes = await fetch(`${API_BASE}/api/profile/cv`, { headers }).catch(() => null);
        const hasCv = cvRes?.status === 200 ? 1 : 0;
        let cvDate: string | null = null;
        if (hasCv && cvRes) {
          try {
            const cvJson = await cvRes.clone().json();
            if (cvJson.updatedAt) cvDate = new Date(cvJson.updatedAt).toLocaleDateString('es-CL');
          } catch { /* ignore */ }
        }
        setLastCvUpdate(cvDate);

        const appsRes = await fetch(`${API_BASE}/api/applications`, { headers }).catch(() => null);
        const apps = appsRes?.ok ? await appsRes.json().catch(() => []) : [];

        const { doc, getDoc } = await import('firebase/firestore');
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        let days = 0;
        if (userDoc.exists()) {
          const created = userDoc.data().createdAt?.toDate?.() || new Date();
          days = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
        }

        setUserStats({ cvs: hasCv, interviews: 0, days, applications: Array.isArray(apps) ? apps.length : 0 });
      } catch { /* silent */ }
    })();
  }, [user]);

  // Fetch subscription on mount
  useEffect(() => {
    if (!user) return;
    (async () => {
      setSubLoading(true);
      try {
        const token = await getToken();
        if (!token) return;
        const res = await fetch(`${API_BASE}/api/subscription`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setSubscription(data.subscription);
        }
      } catch { /* silent */ }
      finally { setSubLoading(false); }
    })();
  }, [user]);

  const handleApplyDiscount = async () => {
    const code = discountCodeInput.trim();
    if (!code) return;
    setApplyingDiscount(true);
    setDiscountCodeMsg('');
    try {
      const token = await getToken();
      if (!token) { setDiscountCodeMsg('Debes iniciar sesión'); return; }
      const res = await fetch(`${API_BASE}/api/subscription/apply-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (res.ok) {
        setSubscription(data.subscription);
        setDiscountCodeInput('');
        setDiscountCodeMsg(`¡${data.message}`);
      } else {
        setDiscountCodeMsg(data.error || 'Código no válido');
      }
    } catch {
      setDiscountCodeMsg('Error de conexión');
    } finally {
      setApplyingDiscount(false);
    }
  };

  // Fetch CV when tab opens
  useEffect(() => {
    if (activeTab !== 'cv' || !user) return;
    (async () => {
      setCvLoading(true);
      try {
        const token = await getToken();
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`${API_BASE}/api/profile/cv`, { headers });
        if (res.ok) {
          const data = await res.json();
          const cv: CVData = {
            name: data.name || '',
            email: data.email || '',
            phone: data.phone || '',
            location: data.location || '',
            experience: data.experience || '',
            education: data.education || '',
            skills: data.skills || '',
            languages: data.languages || '',
          };
          setCvData(cv);
          setCvEditValues(cv);
          setCvSource(data.source || null);
          if (data.updatedAt) setLastCvUpdate(new Date(data.updatedAt).toLocaleDateString('es-CL'));
        } else {
          setCvData(null);
        }
      } catch {
        setCvData(null);
      } finally {
        setCvLoading(false);
      }
    })();
  }, [activeTab, user]);

  // Fetch applications when tab opens
  useEffect(() => {
    if (activeTab !== 'postulaciones' || !user) return;
    (async () => {
      setAppsLoading(true);
      try {
        const token = await getToken();
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`${API_BASE}/api/applications`, { headers });
        if (res.ok) {
          const data = await res.json();
          setApplications(Array.isArray(data) ? data : []);
        }
      } catch { /* silent */ }
      finally { setAppsLoading(false); }
    })();
  }, [activeTab, user]);

  // Fetch profile when tab opens
  useEffect(() => {
    if (activeTab !== 'perfil' || !user) return;
    (async () => {
      setProfileLoading(true);
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('./lib/firebase');
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const d = snap.data();
          setProfileData({
            displayName: d.displayName || '',
            phone: d.phone || '',
            location: d.location || '',
            bio: d.bio || '',
            profession: d.profession || '',
            specialty: d.specialty || '',
            experience: d.experience || '',
            education: d.education || '',
            availability: d.availability || '',
            rut: d.rut || '',
            jobTypes: d.jobTypes || [],
            regions: d.regions || [],
            services: d.services || [],
          });
        }
      } catch { /* silent */ }
      finally { setProfileLoading(false); }
    })();
  }, [activeTab, user]);

  // CV actions
  const handleCvSave = async () => {
    setCvSaving(true);
    try {
      const token = await getToken();
      await fetch(`${API_BASE}/api/profile/cv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ ...cvEditValues, source: 'manual' }),
      });
      setCvData(cvEditValues as CVData);
      setCvEditField(null);
    } catch { /* silent */ }
    finally { setCvSaving(false); }
  };

  const handleCvDownload = async () => {
    const data = cvEditValues as CVData;
    if (!data.name) return;
    setCvDownloading(true);
    try {
      const html = generateCVHtml(data);
      const container = document.createElement('div');
      container.innerHTML = html;
      container.style.cssText = 'position:fixed;left:-9999px;top:0;width:800px;background:white;';
      document.body.appendChild(container);
      const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      document.body.removeChild(container);
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`CV_${data.name?.replace(/\s+/g, '_') || 'NOUU'}.pdf`);
    } catch (err) {
      console.error('PDF error:', err);
    } finally {
      setCvDownloading(false);
    }
  };

  const handleCvUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.doc,.docx';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setCvLoading(true);
      try {
        const text = await file.text();
        const extracted = await extractCVData(text);
        if (extracted) {
          setCvData(extracted);
          setCvEditValues(extracted);
          const token = await getToken();
          await fetch(`${API_BASE}/api/profile/cv`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ ...extracted, source: 'pdf_upload' }),
          });
        }
      } catch { /* silent */ }
      finally { setCvLoading(false); }
    };
    input.click();
  };

  // Profile save
  const handleProfileSave = async () => {
    if (!user) return;
    setProfileSaving(true);
    try {
      const token = await getToken();
      if (token) {
        const res = await fetch(`${API_BASE}/api/profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            displayName: profileData.displayName,
            phone: profileData.phone,
            location: profileData.location,
            bio: profileData.bio,
            profession: profileData.profession,
            specialty: profileData.specialty,
            experience: profileData.experience,
            education: profileData.education,
            availability: profileData.availability,
            jobTypes: profileData.jobTypes,
            regions: profileData.regions,
            services: profileData.services,
          }),
        });
        if (res.ok) {
          setProfileSaved(true);
          setTimeout(() => setProfileSaved(false), 3000);
        }
      }
    } catch { /* silent */ }
    finally { setProfileSaving(false); }
  };

  const handleRutSave = async () => {
    if (!profileData.rut.trim()) return;
    setProfileSaving(true);
    try {
      const token = await getToken();
      if (token) {
        const res = await fetch(`${API_BASE}/api/profile/rut`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ rut: profileData.rut }),
        });
        if (!res.ok) {
          const err = await res.json();
          alert(err.error || 'Error al guardar RUT');
        } else {
          setProfileSaved(true);
          setTimeout(() => setProfileSaved(false), 3000);
        }
      }
    } catch { /* silent */ }
    finally { setProfileSaving(false); }
  };

  // Photo upload handler
  const handlePhotoUpload = async (file: File) => {
    if (!user) return;
    setPhotoUploading(true);
    try {
      // Compress image to base64 (max 500KB)
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();
      const url = URL.createObjectURL(file);
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.src = url;
      });
      URL.revokeObjectURL(url);
      const maxDim = 400;
      let w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = (h * maxDim) / w; w = maxDim; }
        else { w = (w * maxDim) / h; h = maxDim; }
      }
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);
      let quality = 0.8;
      let base64 = canvas.toDataURL('image/jpeg', quality);
      while (base64.length > 500 * 1024 && quality > 0.3) {
        quality -= 0.1;
        base64 = canvas.toDataURL('image/jpeg', quality);
      }
      // Save to Firestore
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('./lib/firebase');
      await updateDoc(doc(db, 'users', user.uid), { photoBase64: base64 });
      setProfilePhotoURL(base64);
    } catch (err) {
      console.error('Photo upload error:', err);
    } finally {
      setPhotoUploading(false);
    }
  };

  // Load profile photo
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('./lib/firebase');
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const d = snap.data();
          if (d.photoBase64) setProfilePhotoURL(d.photoBase64);
          else if (d.photoURL) setProfilePhotoURL(d.photoURL);
        }
      } catch { /* silent */ }
    })();
  }, [user]);

  // CV chat: set session type when cv tab is active
  useEffect(() => {
    if (activeTab === 'cv') {
      const ctx = cvData
        ? `El usuario ya tiene CV con estos datos: Nombre: ${cvData.name || 'sin completar'}, Email: ${cvData.email || 'sin completar'}, Telefono: ${cvData.phone || 'sin completar'}, Ubicacion: ${cvData.location || 'sin completar'}, Experiencia: ${cvData.experience || 'sin completar'}, Educacion: ${cvData.education || 'sin completar'}, Habilidades: ${cvData.skills || 'sin completar'}, Idiomas: ${cvData.languages || 'sin completar'}. Ayuda a completar los campos faltantes.`
        : 'El usuario aun no tiene CV. Ayudalo a crear uno desde cero.';
      cvChatSetSession('cv', ctx);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, cvData]);

  // CV chat: scroll to bottom on new messages
  useEffect(() => {
    cvChatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [cvChatMessages]);

  // CV chat: extract CV data from conversation after AI responses
  useEffect(() => {
    if (cvChatMessages.length > 2 && activeTab === 'cv') {
      const chatHistory = cvChatMessages.map(m => `${m.role}: ${m.text}`).join('\n');
      (async () => {
        try {
          const data = await extractCVData(chatHistory);
          if (data && (data as any).name) {
            const extracted = data as unknown as CVData;
            setCvData(extracted);
            setCvEditValues(extracted);
            // Save to backend
            const token = await getToken();
            await fetch(`${API_BASE}/api/profile/cv`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({ ...extracted, source: 'maria' }),
            });
          }
        } catch { /* silent */ }
      })();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cvChatMessages]);

  const handleCvChatSend = async () => {
    if (!cvChatInput.trim() || cvChatLoading) return;
    const msg = cvChatInput.trim();
    setCvChatInput('');
    await cvChatSend(msg);
  };

  // Helpers
  const jobTypeOptions = ['retail', 'gastronomia', 'construccion', 'call center', 'seguridad', 'limpieza', 'administrativo', 'otro'];
  const regionOptions = [
    'Arica y Parinacota', 'Tarapaca', 'Antofagasta', 'Atacama', 'Coquimbo',
    'Valparaiso', 'Metropolitana', "O'Higgins", 'Maule', 'Nuble', 'Biobio',
    'Araucania', 'Los Rios', 'Los Lagos', 'Aysen', 'Magallanes',
  ];

  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    sent: { label: 'Enviada', color: 'text-[#0f70b7]', bg: 'bg-[#0f70b7]/10' },
    viewed: { label: 'Vista', color: 'text-amber-400', bg: 'bg-amber-400/10' },
    approved: { label: 'Aprobado', color: 'text-green-400', bg: 'bg-green-400/10' },
    rejected: { label: 'Rechazado', color: 'text-red-400', bg: 'bg-red-400/10' },
  };

  const cvFields: { key: keyof CVData; label: string; multiline?: boolean }[] = [
    { key: 'name', label: 'Nombre completo' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Telefono' },
    { key: 'location', label: 'Ubicacion' },
    { key: 'experience', label: 'Experiencia laboral', multiline: true },
    { key: 'education', label: 'Educacion', multiline: true },
    { key: 'skills', label: 'Habilidades', multiline: true },
    { key: 'languages', label: 'Idiomas' },
  ];

  const tabs: { key: DashTab; label: string }[] = [
    { key: 'resumen', label: 'Resumen' },
    { key: 'cv', label: 'Mi CV' },
    { key: 'postulaciones', label: 'Postulaciones' },
    { key: 'perfil', label: 'Perfil' },
  ];

  return (
    <div className="flex-1 flex flex-col px-4 md:px-8 py-6 md:py-10 max-w-5xl mx-auto w-full mb-20">
      {/* Welcome */}
      <div className="animate-fadeInUp mb-6">
        <div className="flex items-center space-x-5">
          <div className="w-16 h-16 bg-[#f83758] rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-[#f83758]/25 animate-pulseGlow">
            {initial}
          </div>
          <div>
            <p className="text-sm text-[var(--text-secondary)] mb-1">Bienvenido de vuelta</p>
            <h1 className="text-2xl font-bold text-white">{displayName}</h1>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="animate-fadeInUp mb-8 border-b border-[var(--border-color)] flex space-x-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-3 text-sm font-semibold whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? 'border-b-2 border-[#f83758] text-[#f83758]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Resumen ── */}
      {activeTab === 'resumen' && (
        <>
          {/* Stats */}
          <div className="animate-fadeInUp grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            {[
              { label: "CVs creados", value: userStats.cvs },
              { label: "Entrevistas practicadas", value: userStats.interviews },
              { label: "Dias activo", value: userStats.days },
              { label: "Postulaciones enviadas", value: userStats.applications },
            ].map((stat) => (
              <div key={stat.label} className="card-hover bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 text-center">
                <div className="text-3xl font-bold gradient-text mb-1">{stat.value}</div>
                <div className="text-sm text-[var(--text-secondary)]">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Subscription Card */}
          <div className="animate-fadeInUp mb-6 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5">
            {subLoading ? (
              <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <Loader2 className="w-4 h-4 animate-spin" />
                Cargando...
              </div>
            ) : subscription && subscription.status === 'active' ? (
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-center justify-center">
                    <Star className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">MarIA Premium</p>
                    <p className="text-gray-400 text-xs">
                      Vence: {new Date(subscription.endDate).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {subscription.discountCode && (
                        <span className="text-yellow-500/70 ml-2">({subscription.discountCode})</span>
                      )}
                    </p>
                  </div>
                </div>
                <span className="bg-yellow-500/15 text-yellow-400 text-xs font-bold px-3 py-1 rounded-full border border-yellow-500/30">
                  Acceso ilimitado a MarIA
                </span>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-700 rounded-xl flex items-center justify-center">
                      <Zap className="w-5 h-5 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">Plan Gratuito</p>
                      <p className="text-gray-400 text-xs">5 prompts cada 5 horas con MarIA</p>
                    </div>
                  </div>
                  <span className="bg-gray-500/15 text-gray-400 text-xs font-bold px-3 py-1 rounded-full border border-gray-500/30">
                    Limitado
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={discountCodeInput}
                    onChange={(e) => setDiscountCodeInput(e.target.value.toUpperCase())}
                    placeholder="Código de descuento"
                    className="bg-[var(--bg-primary)] border border-gray-700 rounded-lg py-2 px-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400 uppercase w-44"
                    onKeyDown={(e) => e.key === 'Enter' && handleApplyDiscount()}
                  />
                  <button
                    onClick={handleApplyDiscount}
                    disabled={applyingDiscount || !discountCodeInput.trim()}
                    className="bg-yellow-500/15 hover:bg-yellow-500/25 border border-yellow-500/30 text-yellow-400 px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {applyingDiscount ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Star className="w-3 h-3" />
                    )}
                    <span>Activar Premium</span>
                  </button>
                </div>
                {discountCodeMsg && (
                  <p className={`text-xs mt-2 ${
                    discountCodeMsg.startsWith('¡') ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {discountCodeMsg}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Perfil Progress */}
          <div className="animate-fadeInUp mb-6 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Completitud de Perfil</h3>
            {(() => {
              const items = [
                { label: 'Foto de perfil', done: !!profilePhotoURL },
                { label: 'Nombre completo', done: !!(profile?.displayName) },
                { label: 'Email', done: !!(user?.email) },
                { label: 'Teléfono', done: !!(profile?.phone) },
                { label: 'Biografía', done: !!(profile?.bio) },
                { label: 'Ubicación', done: !!(profile?.location) },
                { label: 'RUT', done: !!(profile?.rut) },
                { label: 'Suscripción Premium', done: subscription?.status === 'active' },
              ];
              const done = items.filter(i => i.done).length;
              const pct = Math.round((done / items.length) * 100);
              return (
                <>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1 bg-gray-800 rounded-full h-2.5 overflow-hidden">
                      <div className="h-2.5 rounded-full bg-gradient-to-r from-[#f83758] to-[#f83758] transition-all duration-700" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-white text-sm font-bold">{pct}%</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {items.map(item => (
                      <div key={item.label} className="flex items-center gap-1.5 text-xs">
                        <span className={item.done ? 'text-green-400' : 'text-gray-600'}>{item.done ? '●' : '○'}</span>
                        <span className={item.done ? 'text-green-400' : 'text-gray-500'}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                  {pct < 100 && (
                    <button onClick={() => setActiveTab('perfil')} className="mt-3 text-xs text-[#f83758] hover:underline">
                      Completar perfil →
                    </button>
                  )}
                </>
              );
            })()}
          </div>

          {lastCvUpdate && (
            <div className="animate-fadeInUp mb-6 flex items-center space-x-2 text-sm text-[var(--text-secondary)]">
              <FileText className="w-4 h-4 text-[#f83758]" />
              <span>Ultimo CV actualizado: {lastCvUpdate}</span>
            </div>
          )}

          {/* Quick Actions */}
          <div className="animate-fadeInUp">
            <h2 className="text-lg font-bold text-white mb-4">Acciones rapidas</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                { icon: FileText, label: "Crear CV", desc: "Conversa con MarIA y crea tu CV profesional", color: "#f83758", bg: "bg-[#f83758]/10", view: "cv" },
                { icon: MapIcon, label: "Ver Mapa", desc: "Encuentra empresas y vacantes cerca de ti", color: "#f83758", bg: "bg-[#f83758]/10", view: "map" },
                { icon: MessageSquare, label: "Practicar Entrevista", desc: "MarIA te prepara para tu proxima entrevista", color: "#0f70b7", bg: "bg-[#0f70b7]/10", view: "assistant" },
              ].map(({ icon: Icon, label, desc, color, bg, view }) => (
                <div key={view} onClick={() => setCurrentView(view)} className="card-hover bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 cursor-pointer">
                  <div className={`w-12 h-12 ${bg} rounded-xl flex items-center justify-center mb-4`} style={{ color }}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-white mb-1">{label}</h3>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{desc}</p>
                  <div className="mt-4 flex items-center space-x-1 text-xs font-medium" style={{ color }}>
                    <span>Ir ahora</span>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Encouragement */}
          <div className="animate-fadeInUp mt-10 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-8 text-center">
            <div className="w-14 h-14 bg-[#f83758]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Bot className="w-7 h-7 text-[#f83758]" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Tu viaje comienza aqui</h3>
            <p className="text-sm text-[var(--text-secondary)] max-w-sm mx-auto leading-relaxed">
              Crea tu primer CV con MarIA y da el primer paso hacia tu proximo trabajo. Solo conversando, sin formularios complicados.
            </p>
            <button onClick={() => setCurrentView("cv")} className="mt-6 btn-shimmer text-white px-8 py-3 rounded-xl font-bold text-sm hover:scale-105 transition-transform inline-flex items-center space-x-2">
              <Bot className="w-4 h-4" />
              <span>Hablar con MarIA</span>
            </button>
          </div>
        </>
      )}

      {/* ── Tab: Mi CV ── */}
      {activeTab === 'cv' && (
        <div className="animate-fadeInUp">
          {cvLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-[#f83758] animate-spin" />
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row gap-6">
              {/* ── Left Column: CV Preview ── */}
              <div className="w-full lg:w-[58%] flex flex-col gap-4">
                <div className="bg-white rounded-xl shadow-lg p-8 text-gray-900 min-h-[500px]">
                  {cvData ? (
                    <>
                      {/* CV Header */}
                      <div className="border-b-2 border-gray-200 pb-5 mb-6">
                        <h2
                          className="text-2xl font-bold text-gray-900 cursor-pointer hover:text-[#f83758] transition-colors"
                          onClick={() => setCvEditField('name')}
                        >
                          {cvEditField === 'name' ? (
                            <input
                              className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-1 text-2xl font-bold text-gray-900 focus:outline-none focus:border-[#f83758]"
                              value={cvEditValues.name || ''}
                              onChange={(e) => setCvEditValues({ ...cvEditValues, name: e.target.value })}
                              onBlur={() => { setCvEditField(null); handleCvSave(); }}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { setCvEditField(null); handleCvSave(); } }}
                              autoFocus
                            />
                          ) : (
                            cvEditValues.name || <span className="text-gray-400 italic">Tu nombre completo</span>
                          )}
                        </h2>
                        <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-600">
                          {/* Email */}
                          <div
                            className="flex items-center gap-1.5 cursor-pointer hover:text-[#f83758] transition-colors"
                            onClick={() => setCvEditField('email')}
                          >
                            <Mail className="w-3.5 h-3.5" />
                            {cvEditField === 'email' ? (
                              <input
                                className="bg-gray-50 border border-gray-300 rounded px-2 py-0.5 text-sm text-gray-900 focus:outline-none focus:border-[#f83758] w-48"
                                value={cvEditValues.email || ''}
                                onChange={(e) => setCvEditValues({ ...cvEditValues, email: e.target.value })}
                                onBlur={() => { setCvEditField(null); handleCvSave(); }}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { setCvEditField(null); handleCvSave(); } }}
                                autoFocus
                              />
                            ) : (
                              <span>{cvEditValues.email || <span className="text-gray-400 italic">email</span>}</span>
                            )}
                          </div>
                          {/* Phone */}
                          <div
                            className="flex items-center gap-1.5 cursor-pointer hover:text-[#f83758] transition-colors"
                            onClick={() => setCvEditField('phone')}
                          >
                            <Phone className="w-3.5 h-3.5" />
                            {cvEditField === 'phone' ? (
                              <input
                                className="bg-gray-50 border border-gray-300 rounded px-2 py-0.5 text-sm text-gray-900 focus:outline-none focus:border-[#f83758] w-36"
                                value={cvEditValues.phone || ''}
                                onChange={(e) => setCvEditValues({ ...cvEditValues, phone: e.target.value })}
                                onBlur={() => { setCvEditField(null); handleCvSave(); }}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { setCvEditField(null); handleCvSave(); } }}
                                autoFocus
                              />
                            ) : (
                              <span>{cvEditValues.phone || <span className="text-gray-400 italic">telefono</span>}</span>
                            )}
                          </div>
                          {/* Location */}
                          <div
                            className="flex items-center gap-1.5 cursor-pointer hover:text-[#f83758] transition-colors"
                            onClick={() => setCvEditField('location')}
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            {cvEditField === 'location' ? (
                              <input
                                className="bg-gray-50 border border-gray-300 rounded px-2 py-0.5 text-sm text-gray-900 focus:outline-none focus:border-[#f83758] w-40"
                                value={cvEditValues.location || ''}
                                onChange={(e) => setCvEditValues({ ...cvEditValues, location: e.target.value })}
                                onBlur={() => { setCvEditField(null); handleCvSave(); }}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { setCvEditField(null); handleCvSave(); } }}
                                autoFocus
                              />
                            ) : (
                              <span>{cvEditValues.location || <span className="text-gray-400 italic">ubicacion</span>}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Experiencia Laboral */}
                      <div className="mb-5">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                          <Briefcase className="w-3.5 h-3.5" />
                          Experiencia Laboral
                        </h3>
                        <div
                          className="cursor-pointer hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors"
                          onClick={() => setCvEditField('experience')}
                        >
                          {cvEditField === 'experience' ? (
                            <textarea
                              className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#f83758] resize-y min-h-[80px]"
                              value={cvEditValues.experience || ''}
                              onChange={(e) => setCvEditValues({ ...cvEditValues, experience: e.target.value })}
                              onBlur={() => { setCvEditField(null); handleCvSave(); }}
                              onKeyDown={(e) => { if (e.key === 'Escape') { setCvEditField(null); handleCvSave(); } }}
                              autoFocus
                              rows={4}
                            />
                          ) : (
                            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                              {cvEditValues.experience || <span className="text-gray-400 italic">Haz clic para agregar tu experiencia laboral</span>}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Educacion */}
                      <div className="mb-5">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                          <GraduationCap className="w-3.5 h-3.5" />
                          Educacion
                        </h3>
                        <div
                          className="cursor-pointer hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors"
                          onClick={() => setCvEditField('education')}
                        >
                          {cvEditField === 'education' ? (
                            <textarea
                              className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#f83758] resize-y min-h-[60px]"
                              value={cvEditValues.education || ''}
                              onChange={(e) => setCvEditValues({ ...cvEditValues, education: e.target.value })}
                              onBlur={() => { setCvEditField(null); handleCvSave(); }}
                              onKeyDown={(e) => { if (e.key === 'Escape') { setCvEditField(null); handleCvSave(); } }}
                              autoFocus
                              rows={3}
                            />
                          ) : (
                            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                              {cvEditValues.education || <span className="text-gray-400 italic">Haz clic para agregar tu educacion</span>}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Habilidades */}
                      <div className="mb-5">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5" />
                          Habilidades
                        </h3>
                        <div
                          className="cursor-pointer hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors"
                          onClick={() => setCvEditField('skills')}
                        >
                          {cvEditField === 'skills' ? (
                            <textarea
                              className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#f83758] resize-y min-h-[40px]"
                              value={cvEditValues.skills || ''}
                              onChange={(e) => setCvEditValues({ ...cvEditValues, skills: e.target.value })}
                              onBlur={() => { setCvEditField(null); handleCvSave(); }}
                              onKeyDown={(e) => { if (e.key === 'Escape') { setCvEditField(null); handleCvSave(); } }}
                              autoFocus
                              rows={2}
                              placeholder="Separa las habilidades con comas"
                            />
                          ) : cvEditValues.skills ? (
                            <div className="flex flex-wrap gap-1.5">
                              {cvEditValues.skills.split(/[,;\n]+/).filter(Boolean).map((skill, i) => (
                                <span key={i} className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium border border-gray-200">
                                  {skill.trim()}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-400 italic">Haz clic para agregar tus habilidades</p>
                          )}
                        </div>
                      </div>

                      {/* Idiomas */}
                      <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5" />
                          Idiomas
                        </h3>
                        <div
                          className="cursor-pointer hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors"
                          onClick={() => setCvEditField('languages')}
                        >
                          {cvEditField === 'languages' ? (
                            <input
                              className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#f83758]"
                              value={cvEditValues.languages || ''}
                              onChange={(e) => setCvEditValues({ ...cvEditValues, languages: e.target.value })}
                              onBlur={() => { setCvEditField(null); handleCvSave(); }}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { setCvEditField(null); handleCvSave(); } }}
                              autoFocus
                              placeholder="Ej: Espanol (nativo), Ingles (intermedio)"
                            />
                          ) : cvEditValues.languages ? (
                            <div className="flex flex-wrap gap-1.5">
                              {cvEditValues.languages.split(/[,;\n]+/).filter(Boolean).map((lang, i) => (
                                <span key={i} className="px-2.5 py-1 bg-[#0f70b7] text-[#0c5a92] rounded-full text-xs font-medium border border-[#0f70b7]">
                                  {lang.trim()}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-400 italic">Haz clic para agregar idiomas</p>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Empty CV document placeholder */
                    <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                        <FileText className="w-8 h-8 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-bold text-gray-700 mb-2">Tu CV aparecera aqui</h3>
                      <p className="text-sm text-gray-500 max-w-xs">
                        Conversa con MarIA a la derecha para crear tu CV, o sube uno existente.
                      </p>
                    </div>
                  )}
                </div>

                {/* Action buttons below CV card */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleCvDownload}
                    disabled={cvDownloading || !cvData}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#f83758]/10 text-[#f83758] hover:bg-[#f83758]/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
                  >
                    {cvDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    <span>Descargar PDF</span>
                  </button>
                  <button
                    onClick={handleCvUpload}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] hover:border-[#f83758] transition-colors flex items-center justify-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Subir CV existente</span>
                  </button>
                </div>
              </div>

              {/* ── Right Column: MarIA Chat ── */}
              <div className="w-full lg:w-[42%] flex flex-col bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl overflow-hidden" style={{ minHeight: 500, maxHeight: 700 }}>
                {/* Chat header */}
                <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-center gap-3 shrink-0">
                  <div className="w-9 h-9 bg-[#0f70b7]/10 rounded-xl flex items-center justify-center">
                    <Bot className="w-5 h-5 text-[#0f70b7]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">MarIA te ayuda a completar tu CV</h3>
                    <p className="text-xs text-[var(--text-muted)]">Conversemos sobre tu experiencia</p>
                  </div>
                </div>

                {/* Chat messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                  {cvChatMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-[#f83758] text-white rounded-br-md'
                          : 'bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-bl-md'
                      }`}>
                        {msg.role === 'model' ? (
                          <Markdown>{msg.text}</Markdown>
                        ) : (
                          <span>{msg.text}</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {cvChatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] px-4 py-3 rounded-2xl rounded-bl-md">
                        <div className="flex space-x-1.5">
                          <div className="w-2 h-2 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={cvChatEndRef} />
                </div>

                {/* Chat input */}
                <div className="px-4 py-3 border-t border-[var(--border-color)] shrink-0">
                  <div className="flex items-center gap-2">
                    <input
                      className="flex-1 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[#f83758]"
                      value={cvChatInput}
                      onChange={(e) => setCvChatInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCvChatSend(); } }}
                      placeholder="Escribe tu mensaje..."
                      disabled={cvChatLoading}
                    />
                    <button
                      onClick={handleCvChatSend}
                      disabled={!cvChatInput.trim() || cvChatLoading}
                      className="p-2.5 rounded-xl bg-[#f83758] text-white hover:bg-[#e54e52] transition-colors disabled:opacity-40 shrink-0"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Postulaciones ── */}
      {activeTab === 'postulaciones' && (
        <div className="animate-fadeInUp">
          {appsLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-[#f83758] animate-spin" />
            </div>
          ) : applications.length > 0 ? (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white mb-2">Historial de postulaciones</h2>

              {/* Selected application detail */}
              {selectedApp && (
                <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 mb-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white">{selectedApp.jobTitle || 'Sin titulo'}</h3>
                    <button onClick={() => setSelectedApp(null)} className="text-[var(--text-muted)] hover:text-white">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div><span className="text-[var(--text-muted)]">Empresa: </span><span className="text-[var(--text-primary)]">{selectedApp.company || '-'}</span></div>
                    <div><span className="text-[var(--text-muted)]">Fecha: </span><span className="text-[var(--text-primary)]">{selectedApp.appliedAt ? new Date(selectedApp.appliedAt).toLocaleDateString('es-CL') : '-'}</span></div>
                    <div><span className="text-[var(--text-muted)]">Estado: </span>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${(statusConfig[selectedApp.status] || statusConfig.sent).bg} ${(statusConfig[selectedApp.status] || statusConfig.sent).color}`}>
                        {(statusConfig[selectedApp.status] || statusConfig.sent).label}
                      </span>
                    </div>
                    {selectedApp.notes && <div className="sm:col-span-2"><span className="text-[var(--text-muted)]">Notas: </span><span className="text-[var(--text-primary)]">{selectedApp.notes}</span></div>}
                  </div>
                </div>
              )}

              {/* Applications list */}
              <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl overflow-hidden">
                {/* Desktop header */}
                <div className="hidden md:grid grid-cols-4 gap-4 px-5 py-3 bg-[var(--bg-primary)] border-b border-[var(--border-color)] text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  <span>Cargo</span>
                  <span>Empresa</span>
                  <span>Fecha</span>
                  <span>Estado</span>
                </div>
                {applications.map((app: any, i: number) => {
                  const sc = statusConfig[app.status] || statusConfig.sent;
                  return (
                    <div
                      key={app.id || i}
                      onClick={() => setSelectedApp(app)}
                      className={`grid grid-cols-1 md:grid-cols-4 gap-2 md:gap-4 px-5 py-4 cursor-pointer hover:bg-[var(--bg-primary)] transition-colors ${
                        i < applications.length - 1 ? 'border-b border-[var(--border-color)]' : ''
                      }`}
                    >
                      <div>
                        <span className="md:hidden text-xs text-[var(--text-muted)]">Cargo: </span>
                        <span className="text-sm font-semibold text-white">{app.jobTitle || 'Sin titulo'}</span>
                      </div>
                      <div>
                        <span className="md:hidden text-xs text-[var(--text-muted)]">Empresa: </span>
                        <span className="text-sm text-[var(--text-secondary)]">{app.company || '-'}</span>
                      </div>
                      <div>
                        <span className="md:hidden text-xs text-[var(--text-muted)]">Fecha: </span>
                        <span className="text-sm text-[var(--text-secondary)]">{app.appliedAt ? (app.appliedAt._seconds ? new Date(app.appliedAt._seconds * 1000) : new Date(app.appliedAt)).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</span>
                      </div>
                      <div>
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${sc.bg} ${sc.color}`}>{sc.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Empty applications */
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-10 text-center">
              <div className="w-16 h-16 bg-[#f83758]/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <Briefcase className="w-8 h-8 text-[#f83758]" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">No has postulado a ningun trabajo aun</h3>
              <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto mb-8">
                Explora el mapa laboral y encuentra oportunidades cerca de ti.
              </p>
              <button onClick={() => setCurrentView('map')} className="btn-shimmer text-white px-8 py-3 rounded-xl font-bold text-sm hover:scale-105 transition-transform inline-flex items-center space-x-2">
                <MapIcon className="w-4 h-4" />
                <span>Ver mapa laboral</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Perfil ── */}
      {activeTab === 'perfil' && (
        <div className="animate-fadeInUp">
          {profileLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-[#f83758] animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-white">Configuracion de perfil</h2>

              {/* Profile Photo */}
              <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 flex items-center gap-5">
                <div className="relative group shrink-0">
                  <div
                    className="w-20 h-20 rounded-full border-4 border-[var(--bg-card)] shadow-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => photoInputRef.current?.click()}
                  >
                    {profilePhotoURL ? (
                      <img src={profilePhotoURL} alt="Foto de perfil" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#f83758] to-[#ff8a8e] flex items-center justify-center text-white text-2xl font-bold">
                        {initial}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => photoInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-7 h-7 bg-[#f83758] rounded-full flex items-center justify-center text-white shadow-md hover:bg-[#e54e52] transition-colors"
                    disabled={photoUploading}
                  >
                    {photoUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                  </button>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePhotoUpload(file);
                      e.target.value = '';
                    }}
                  />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">Foto de perfil</h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">Haz clic en la imagen para cambiarla</p>
                  {photoUploading && <p className="text-xs text-[#f83758] mt-1">Subiendo foto...</p>}
                </div>
              </div>

              <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 space-y-5">
                {/* Display Name */}
                <div>
                  <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Nombre completo</label>
                  <input
                    className="mt-1 w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#f83758]"
                    value={profileData.displayName}
                    onChange={(e) => setProfileData({ ...profileData, displayName: e.target.value })}
                    placeholder="Tu nombre completo"
                  />
                </div>

                {/* Email (read-only) */}
                <div>
                  <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Email</label>
                  <input
                    className="mt-1 w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-4 py-2.5 text-sm text-[var(--text-muted)] cursor-not-allowed"
                    value={user?.email || ''}
                    readOnly
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Telefono</label>
                  <input
                    className="mt-1 w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#f83758]"
                    value={profileData.phone}
                    onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                    placeholder="+56 9 1234 5678"
                  />
                </div>

                {/* Location */}
                <div>
                  <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Ubicacion / Comuna</label>
                  <input
                    className="mt-1 w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#f83758]"
                    value={profileData.location}
                    onChange={(e) => setProfileData({ ...profileData, location: e.target.value })}
                    placeholder="Ej: Santiago, Providencia"
                  />
                </div>

                {/* Bio */}
                <div>
                  <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Biografía</label>
                  <textarea
                    className="mt-1 w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#f83758] resize-none"
                    rows={3} maxLength={300}
                    value={profileData.bio}
                    onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                    placeholder="Cuéntanos algo sobre ti..."
                  />
                  <p className="text-xs text-[var(--text-muted)] mt-1">{profileData.bio.length}/300</p>
                </div>

                {/* Profession */}
                <div>
                  <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Profesión u Oficio</label>
                  <input
                    className="mt-1 w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#f83758]"
                    value={profileData.profession}
                    onChange={(e) => setProfileData({ ...profileData, profession: e.target.value })}
                    placeholder="Ej: Maestro Electricista, Cajera, Diseñador..."
                  />
                </div>

                {/* Specialty */}
                <div>
                  <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Especialidad</label>
                  <input
                    className="mt-1 w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#f83758]"
                    value={profileData.specialty}
                    onChange={(e) => setProfileData({ ...profileData, specialty: e.target.value })}
                    placeholder="Cuéntanos en lo que eres mejor..."
                  />
                </div>

                {/* Experience + Education */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Experiencia</label>
                    <input
                      className="mt-1 w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#f83758]"
                      value={profileData.experience}
                      onChange={(e) => setProfileData({ ...profileData, experience: e.target.value })}
                      placeholder="Años de experiencia, proyectos..."
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Estudios</label>
                    <input
                      className="mt-1 w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#f83758]"
                      value={profileData.education}
                      onChange={(e) => setProfileData({ ...profileData, education: e.target.value })}
                      placeholder="Títulos, certificaciones, cursos..."
                    />
                  </div>
                </div>

                {/* Availability */}
                <div>
                  <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Disponibilidad</label>
                  <input
                    className="mt-1 w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#f83758]"
                    value={profileData.availability}
                    onChange={(e) => setProfileData({ ...profileData, availability: e.target.value })}
                    placeholder="Lun-Vie, Fines de semana, Full-time..."
                  />
                </div>

                {/* RUT */}
                <div>
                  <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">RUT</label>
                  <div className="flex gap-2">
                    <input
                      className={`mt-1 w-full bg-[var(--bg-primary)] border rounded-lg px-4 py-2.5 text-sm focus:outline-none ${profileData.rut && profileData.rut !== '' ? 'border-gray-700 text-[var(--text-muted)] cursor-not-allowed' : 'border-[var(--border-color)] text-[var(--text-primary)] focus:border-[#f83758]'}`}
                      value={profileData.rut}
                      onChange={(e) => setProfileData({ ...profileData, rut: e.target.value })}
                      placeholder="12.345.678-9"
                      readOnly={!!profileData.rut}
                      title={profileData.rut ? 'El RUT no puede modificarse una vez guardado' : ''}
                    />
                    {!profileData.rut && (
                      <button onClick={handleRutSave} disabled={profileSaving || !profileData.rut.trim()}
                        className="mt-1 bg-[#f83758] hover:bg-[#d62847] disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap">
                        Guardar RUT
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-600 mt-1">Tu RUT es privado. Una vez guardado no podrá modificarse.</p>
                </div>

                {/* Services/Nouus offered */}
                <div>
                  <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2 block">Nouus que ofreces</label>
                  <div className="flex flex-wrap gap-2">
                    {['Limpieza', 'Reparaciones', 'Jardinería', 'Transporte', 'Cocina', 'Cuidado personal', 'Educación', 'Tecnología', 'Fotografía', 'Diseño', 'Otros'].map((s) => {
                      const selected = profileData.services.includes(s);
                      return (
                        <button key={s}
                          onClick={() => setProfileData({
                            ...profileData,
                            services: selected ? profileData.services.filter(t => t !== s) : [...profileData.services, s]
                          })}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${selected ? 'bg-[#f83758]/20 border-[#f83758]/40 text-[#f83758]' : 'bg-[var(--bg-primary)] border-[var(--border-color)] text-[var(--text-muted)] hover:border-gray-600'}`}>
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Job Types (chips) */}
                <div>
                  <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2 block">Tipo de trabajo que buscas</label>
                  <div className="flex flex-wrap gap-2">
                    {jobTypeOptions.map((jt) => {
                      const selected = profileData.jobTypes.includes(jt);
                      return (
                        <button
                          key={jt}
                          onClick={() => {
                            setProfileData({
                              ...profileData,
                              jobTypes: selected
                                ? profileData.jobTypes.filter((t) => t !== jt)
                                : [...profileData.jobTypes, jt],
                            });
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                            selected
                              ? 'bg-[#f83758] text-white'
                              : 'bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[#f83758]'
                          }`}
                        >
                          {jt.charAt(0).toUpperCase() + jt.slice(1)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Regions (checkboxes) */}
                <div>
                  <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2 block">Regiones de interes</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {regionOptions.map((region) => {
                      const selected = profileData.regions.includes(region);
                      return (
                        <label key={region} className="flex items-center space-x-2 cursor-pointer group">
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                              selected ? 'bg-[#f83758] border-[#f83758]' : 'border-[var(--border-color)] group-hover:border-[#f83758]'
                            }`}
                            onClick={() => {
                              setProfileData({
                                ...profileData,
                                regions: selected
                                  ? profileData.regions.filter((r) => r !== region)
                                  : [...profileData.regions, region],
                              });
                            }}
                          >
                            {selected && (
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span
                            className="text-xs text-[var(--text-secondary)]"
                            onClick={() => {
                              setProfileData({
                                ...profileData,
                                regions: selected
                                  ? profileData.regions.filter((r) => r !== region)
                                  : [...profileData.regions, region],
                              });
                            }}
                          >
                            {region}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Save */}
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleProfileSave}
                  disabled={profileSaving}
                  className="px-8 py-3 rounded-xl text-sm font-bold btn-shimmer text-white hover:scale-105 transition-transform disabled:opacity-50 flex items-center space-x-2"
                >
                  {profileSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Guardar perfil</span>
                </button>
                {profileSaved && (
                  <span className="text-sm text-green-400 flex items-center space-x-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Perfil guardado</span>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────── */

const PostJob = ({ onOpenAuth }: { onOpenAuth: () => void }) => {
  const { messages, isLoading, sendMessage, setSessionType, clearChat } = useChat();
  const { user } = useAuth();
  const [input, setInput] = useState("");
  const [started, setStarted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSessionType('post_job');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  const handleStart = () => {
    if (!user) {
      onOpenAuth();
      return;
    }
    clearChat();
    setSessionType('post_job');
    setStarted(true);
    sendMessage("Quiero publicar un Nouu Work");
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage = input.trim();
    setInput("");
    await sendMessage(userMessage);
  };

  if (!started) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 max-w-2xl mx-auto w-full mb-20">
        <div className="animate-fadeInUp text-center space-y-6">
          <div className="w-20 h-20 bg-[#f83758]/20 rounded-2xl flex items-center justify-center mx-auto">
            <Plus className="w-10 h-10 text-[#f83758]" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-white">Publicar Nouu Work</h2>
          <p className="text-[var(--text-secondary)] max-w-md mx-auto">
            Conversa con <strong className="text-[#f83758]">MarIA</strong> y ella te ayuda a crear tu oferta de trabajo formal paso a paso. Sin formularios complicados.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left max-w-lg mx-auto">
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-4">
              <MessageSquare className="w-5 h-5 text-[#f83758] mb-2" />
              <p className="text-sm text-[var(--text-body)]">Conversacional</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">Como chatear por WhatsApp</p>
            </div>
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-4">
              <Briefcase className="w-5 h-5 text-[#f83758] mb-2" />
              <p className="text-sm text-[var(--text-body)]">Rápido</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">En minutos tu pega está lista</p>
            </div>
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-4">
              <MapPin className="w-5 h-5 text-[#f83758] mb-2" />
              <p className="text-sm text-[var(--text-body)]">Visible</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">Aparece en el Mapa Laboral</p>
            </div>
          </div>
          <button
            onClick={handleStart}
            className="btn-shimmer text-white px-8 py-3 rounded-xl font-bold text-sm hover:scale-105 transition-transform inline-flex items-center space-x-2"
          >
            <Bot className="w-4 h-4" />
            <span>{user ? "Comenzar con MarIA" : "Ingresa para publicar"}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center py-4 md:py-8 px-4 md:px-8 max-w-3xl mx-auto w-full h-[calc(100vh-73px)] mb-20">
      <div className="w-full flex items-center justify-between mb-6">
        <button
          onClick={() => setStarted(false)}
          className="flex items-center space-x-2 text-[var(--text-secondary)] hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver</span>
        </button>
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] px-4 py-2 rounded-lg text-sm text-white font-medium flex items-center space-x-2">
          <Plus className="w-4 h-4 text-[#f83758]" />
          <span>Publicar Pega</span>
        </div>
      </div>

      <div className="animate-slideInBlur w-full bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] overflow-hidden shadow-2xl flex flex-col flex-1 min-h-0">
        {/* Chat Header */}
        <div className="p-4 border-b border-[var(--border-color)] flex items-center space-x-3 shrink-0">
          <div className="w-10 h-10 bg-[#f83758] rounded-full flex items-center justify-center">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-white font-medium">
              MarIA - Publicar Pega
            </h3>
            <div className="flex items-center space-x-1.5">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-xs text-green-500">En línea</span>
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex space-x-3 ${msg.role === "user" ? "flex-row-reverse space-x-reverse" : ""} ${idx === messages.length - 1 ? "animate-fadeInUp" : ""}`}
            >
              {msg.role === "model" && (
                <div className="w-8 h-8 bg-[#f83758] rounded-full flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}
              <div
                className={`rounded-2xl p-4 text-sm ${
                  msg.role === "user"
                    ? "bg-[#f83758] text-white rounded-tr-none"
                    : "bg-[var(--bg-bubble)] text-[var(--text-primary)] border border-[var(--border-subtle)]/50 rounded-tl-none"
                }`}
              >
                <div className="markdown-body prose prose-invert prose-sm max-w-none">
                  <Markdown>{msg.text}</Markdown>
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex space-x-3">
              <div className="w-8 h-8 bg-[#f83758] rounded-full flex items-center justify-center shrink-0 mt-1">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-[var(--bg-bubble)] rounded-2xl rounded-tl-none p-4 flex items-center space-x-2 border border-[var(--border-subtle)]/50">
                <Loader2 className="w-4 h-4 text-[var(--text-secondary)] animate-spin" />
                <span className="text-sm text-[var(--text-secondary)]">Escribiendo...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <CodeInputBar />
        {/* Chat Input */}
        <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] shrink-0">
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Escribe tu respuesta..."
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-xl py-3 pl-4 pr-12 text-sm text-white focus:outline-none focus:border-[#f83758] transition-colors"
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-[#f83758]/20 text-[#f83758] rounded-lg hover:bg-[#f83758] hover:text-white transition-colors disabled:opacity-50 disabled:hover:bg-[#f83758]/20 disabled:hover:text-[#f83758]"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const NouuDetailView = ({ nouu, onBack, onApply }: { nouu: any; onBack: () => void; onApply: (nouu: any) => void }) => {
  const { user } = useAuth();
  const [showApply, setShowApply] = useState(false);
  const [applyMessage, setApplyMessage] = useState('');
  const [applyPrice, setApplyPrice] = useState('');
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyError, setApplyError] = useState('');
  const [applySuccess, setApplySuccess] = useState(false);
  const catEmoji: Record<string, string> = {'Hogar y Jardín':'🏠','Limpieza':'🧹','Tecnología':'💻','Transporte':'🚗','Educación':'📚','Mascotas':'🐕','Eventos':'🎉','Salud y Bienestar':'💆','Arte y Creatividad':'🎨','Deportes':'⚽','Cocina':'🍳','Reparaciones':'🔧'};

  const handleApply = async () => {
    if (!user) { window.dispatchEvent(new CustomEvent('nouu:need-auth')); return; }
    setShowApply(true);
    setApplyPrice(nouu.price === 'A convenir' ? '' : (nouu.price || '').replace(/[^0-9]/g, ''));
    setApplyMessage('');
    setApplyError('');
    setApplySuccess(false);
  };

  const submitApply = async () => {
    if (applyMessage.trim().length < 20) { setApplyError('El mensaje debe tener al menos 20 caracteres'); return; }
    setApplyLoading(true); setApplyError('');
    try {
      const { auth } = await import('./lib/firebase');
      const token = await auth.currentUser?.getIdToken();
      if (!token) { setApplyError('Debes iniciar sesión'); setApplyLoading(false); return; }
      const API_BASE = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${API_BASE}/api/nouu/${nouu.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: applyMessage, proposedPrice: Number(applyPrice) || null }),
      });
      if (!res.ok) { const err = await res.json(); setApplyError(err.error || 'Error al postular'); }
      else setApplySuccess(true);
    } catch { setApplyError('Error de conexión'); }
    finally { setApplyLoading(false); }
  };

  return (
    <div className="flex-1 flex flex-col px-4 md:px-8 py-6 max-w-3xl mx-auto w-full mb-20">
      <button onClick={onBack} className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-white mb-6 transition-colors">
        <ArrowLeft className="w-5 h-5" />
        <span>Volver al mapa</span>
      </button>

      <div className="bg-[var(--bg-card)] border border-[#f83758]/20 rounded-2xl p-6 md:p-8 shadow-xl shadow-[#f83758]/5">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <img src="/isologo3dnouu.png" alt="Nouu" className="w-10 h-10 object-contain" />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-[#f83758]/20 text-[#f83758] text-[11px] font-bold px-2 py-0.5 rounded-full border border-[#f83758]/30">NOUU</span>
              {nouu.category && (
                <span className="bg-gray-800 text-gray-300 text-[11px] px-2 py-0.5 rounded flex items-center gap-1">
                  {catEmoji[nouu.category] || '📌'} {nouu.category}
                </span>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">{nouu.title}</h1>
          </div>
        </div>

        <p className="text-[#f83758] text-3xl font-bold mb-6">{nouu.price}</p>

        {nouu.description && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-white mb-2">Descripción</h3>
            <p className="text-gray-300 text-base leading-relaxed bg-[#181818] rounded-xl p-5 border border-gray-800">{nouu.description}</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-[#181818] rounded-xl p-4 border border-gray-800">
            <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-1">Ubicación</h4>
            <p className="text-gray-200 text-sm flex items-center gap-2"><MapPin className="w-4 h-4 text-[#f83758]/60" />{nouu.address || nouu.commune || 'Sin ubicación especificada'}</p>
          </div>
          {nouu.paymentMethod && (
            <div className="bg-[#181818] rounded-xl p-4 border border-gray-800">
              <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-1">Método de pago</h4>
              <p className="text-gray-200 text-sm">{nouu.paymentMethod === 'transferencia' ? '💳 Transferencia' : '💵 Efectivo'}</p>
            </div>
          )}
          {nouu.scheduledDate && (
            <div className="bg-[#181818] rounded-xl p-4 border border-gray-800">
              <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-1">Fecha</h4>
              <p className="text-gray-200 text-sm">📅 {nouu.scheduledDate}</p>
            </div>
          )}
          {nouu.ownerName && (
            <div className="bg-[#181818] rounded-xl p-4 border border-gray-800">
              <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-1">Publicado por</h4>
              <p className="text-gray-200 text-sm">{nouu.ownerName}</p>
            </div>
          )}
        </div>

        <button
          onClick={handleApply}
          className="w-full bg-gradient-to-r from-[#f83758] to-[#d62847] hover:from-[#f83758] hover:to-[#f83758] text-white py-3.5 rounded-xl font-bold text-base transition-all hover:scale-[1.01] shadow-lg shadow-[#f83758]/20"
        >
          Postular a este Nouu
        </button>
      </div>

      {/* Apply Modal */}
      {showApply && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => { if (!applyLoading && !applySuccess) setShowApply(false); }}>
          <div className="bg-[#222222] border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl animate-fadeInUp" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h2 className="text-lg font-bold text-white">Postular a este Nouu</h2>
              <button onClick={() => { if (!applyLoading) setShowApply(false); }} className="p-1 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white" disabled={applyLoading}>
                <X className="w-5 h-5" />
              </button>
            </div>
            {applySuccess ? (
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">¡Postulación enviada!</h3>
                <p className="text-gray-400 text-sm mb-4">El publicador recibirá tu postulación y podrá contactarte por chat.</p>
                <button onClick={() => { setShowApply(false); }} className="bg-[#f83758] hover:bg-[#d62847] text-white px-6 py-2.5 rounded-xl font-medium text-sm transition-colors">
                  Entendido
                </button>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <p className="text-sm text-gray-400">Te estás postulando a: <span className="text-white font-medium">{nouu.title}</span></p>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Mensaje de presentación (mín. 20 caracteres)</label>
                  <textarea value={applyMessage} onChange={e => setApplyMessage(e.target.value)} placeholder="Hola! Me interesa tu Nouu. Tengo experiencia en..." rows={4}
                    className="w-full bg-[#1f1f1f] border border-gray-700 rounded-xl py-2.5 px-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#f83758] resize-none" disabled={applyLoading} />
                  <p className="text-[10px] text-gray-500 mt-1">{applyMessage.length}/20 mínimo</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Precio propuesto (CLP)</label>
                  <input type="number" value={applyPrice} onChange={e => setApplyPrice(e.target.value)} placeholder="Ej: 25000"
                    className="w-full bg-[#1f1f1f] border border-gray-700 rounded-xl py-2.5 px-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#f83758]" disabled={applyLoading} />
                </div>
                {applyError && <p className="text-red-400 text-xs">{applyError}</p>}
                <button onClick={submitApply} disabled={applyLoading || applyMessage.trim().length < 20}
                  className="w-full bg-gradient-to-r from-[#f83758] to-[#d62847] hover:from-[#f83758] hover:to-[#f83758] disabled:opacity-50 text-white py-2.5 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2">
                  {applyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {applyLoading ? 'Enviando...' : 'Enviar postulación'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [currentView, setCurrentView] = useState("landing");
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem("nouu-theme") as "dark" | "light") || "dark";
  });
  const [showAuth, setShowAuth] = useState(false);
  const [selectedNouuDetail, setSelectedNouuDetail] = useState<any>(null);
  const { user, profile } = useAuth();

  // Admin route — completely separate from the main app
  if (window.location.pathname === "/admin") {
    return (
      <Suspense fallback={<div className="min-h-screen bg-[#1f1f1f] flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#f83758] border-t-transparent rounded-full animate-spin" /></div>}>
        <AdminRoute />
      </Suspense>
    );
  }

  // Wire auth gate so ChatContext can open the modal when user hits the limit
  useEffect(() => {
    setAuthGateCallback(() => setShowAuth(true));
    const handler = () => setShowAuth(true);
    window.addEventListener('nouu:need-auth', handler);
    return () => window.removeEventListener('nouu:need-auth', handler);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("nouu-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");

  // Track initial landing view once on mount
  useEffect(() => {
    trackPageView('landing', user?.uid ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (profile && profile.accountType === 'business' && !profile.companyId) {
      if (sessionStorage.getItem('nouu_show_company_setup') === 'true') {
        handleSetCurrentView('company_setup');
      }
    }
  }, [profile]);

  const handleSetCurrentView = (view: string) => {
    setCurrentView(view);
    window.scrollTo(0, 0);
    trackPageView(view, user?.uid ?? null);
  };

  const renderView = () => {
    switch (currentView) {
      case "landing":
        return <LandingPage setCurrentView={handleSetCurrentView} onOpenAuth={() => setShowAuth(true)} />;
      case "cv":
        return <CVGenerator />;
      case "map":
        return <LaborMap onNavigate={handleSetCurrentView} onViewNouu={(nouu) => { setSelectedNouuDetail(nouu); handleSetCurrentView('nouu_detail'); }} />;
      case "post_job":
        return <PostJob onOpenAuth={() => setShowAuth(true)} />;
      case "publish":
        return <PublishChoice onSelect={(type) => handleSetCurrentView(type === 'nouu' ? 'nouu' : 'post_job')} />;
      case "nouu":
        return <NouuForm onBack={() => handleSetCurrentView('publish')} />;
      case "assistant":
        return <Assistant />;
      case "b2b":
        if (profile?.accountType === 'business' && profile?.companyId) {
          return <CompanyDashboard setCurrentView={handleSetCurrentView} />;
        }
        return <B2BPanel setCurrentView={handleSetCurrentView} onOpenAuth={() => setShowAuth(true)} />;
      case "dashboard":
        return <Dashboard setCurrentView={handleSetCurrentView} />;
      case "terminos":
        return <TerminosView onBack={() => handleSetCurrentView("landing")} />;
      case "privacidad":
        return <PrivacidadView onBack={() => handleSetCurrentView("landing")} />;
      case "nouu_detail":
        return selectedNouuDetail ? (
          <NouuDetailView
            nouu={selectedNouuDetail}
            onBack={() => { setSelectedNouuDetail(null); handleSetCurrentView("map"); }}
            onApply={(nouu) => { setSelectedNouuDetail(nouu); /* mantiene el nouu para el modal */ }}
          />
        ) : <LaborMap onNavigate={handleSetCurrentView} />;
      case "company_dashboard":
        return <CompanyDashboard setCurrentView={handleSetCurrentView} />;
      case "company_setup":
        return <CompanySetup />;
      default:
        return <LandingPage setCurrentView={handleSetCurrentView} onOpenAuth={() => setShowAuth(true)} />;
    }
  };

  return (
    <ChatProvider>
      <div className={`min-h-screen font-sans flex flex-col ${theme === "dark" ? "dark-theme bg-[var(--bg-primary)] text-[var(--text-primary)]" : "light-theme bg-[var(--bg-primary)] text-[var(--text-primary)]"}`}>
        <Header
          currentView={currentView}
          setCurrentView={handleSetCurrentView}
          theme={theme}
          toggleTheme={toggleTheme}
          onOpenAuth={() => setShowAuth(true)}
        />
        <main className="flex-1 flex flex-col">
          <div key={currentView} style={{ animation: "fadeInUp 0.4s cubic-bezier(.22,1,.36,1) both" }}>
            {renderView()}
          </div>
        </main>
        <Footer setCurrentView={handleSetCurrentView} />
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      </div>
    </ChatProvider>
  );
}
