import React, { useState, useEffect, useRef, useMemo } from "react";
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
} from "lucide-react";
import Markdown from "react-markdown";
import { extractCVData } from "./lib/gemini";
import { ChatProvider, useChat, setAuthGateCallback } from "./lib/chat-context";
import { generateCVHtml, CVData } from "./lib/cv-template";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { optimizeRoute, calculateTripMetrics } from "./lib/route-optimizer";
import { LandingPage } from "./components/LandingPage";
import { Footer } from "./components/Footer";
import { NouuLogo } from "./components/NouuLogo";
import { AuthModal } from "./components/AuthModal";
import { useAuth } from "./lib/auth";
import B2BPanel from "./components/B2BPanel";

const customIcon = new L.DivIcon({
  className: "custom-marker",
  html: `<div style="width: 16px; height: 16px; background-color: #ff5a5f; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 15px rgba(255,90,95,0.5);"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const userIcon = new L.DivIcon({
  className: "user-marker",
  html: `<div style="width: 20px; height: 20px; background-color: #3b82f6; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 15px rgba(59,130,246,0.5);"></div>`,
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

  const navItems = [
    { id: "cv", icon: FileText, label: "Crear CV" },
    { id: "map", icon: MapIcon, label: "Mapa Laboral" },
    { id: "assistant", icon: MessageSquare, label: "Asistente IA" },
    { id: "b2b", icon: Building, label: "Para Empresas" },
  ];

  return (
    <header className="flex items-center justify-between px-8 py-4 border-b border-gray-800 bg-[#16171a] dark:bg-[#16171a] light:bg-white sticky top-0 z-50">
      <div className="cursor-pointer" onClick={() => setCurrentView("landing")}>
        <NouuLogo className="text-2xl" />
      </div>
      <nav className="flex space-x-8">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentView(item.id)}
            className={`flex items-center space-x-2 text-sm font-medium transition-colors ${currentView === item.id ? "text-white" : "text-gray-400 hover:text-white"}`}
          >
            <item.icon className="w-4 h-4" />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="flex items-center space-x-3">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#222327] border border-gray-700 text-gray-400 hover:text-white transition-colors"
          title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {user ? (
          <div className="flex items-center space-x-2">
            <div
              className="flex items-center space-x-2 bg-[#222327] border border-gray-700 px-3 py-1.5 rounded-lg cursor-pointer hover:border-gray-500 transition-colors"
              onClick={() => setCurrentView("dashboard")}
              title="Mi Dashboard"
            >
              <div className="w-6 h-6 bg-[#ff5a5f] rounded-full flex items-center justify-center text-white text-xs font-bold">
                {(profile?.displayName || user.email || "U").charAt(0).toUpperCase()}
              </div>
              <span className="text-sm text-gray-300 max-w-[120px] truncate">
                {profile?.displayName || user.email}
              </span>
            </div>
            <button
              onClick={() => logout()}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#222327] border border-gray-700 text-gray-400 hover:text-red-400 transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="bg-[#ff5a5f] hover:bg-[#ff444a] text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Ingresar
          </button>
        )}
      </div>
    </header>
  );
};

const CVGenerator = () => {
  const { messages, isLoading, sendMessage, setSessionType, clearChat } = useChat();
  const [input, setInput] = useState("");
  const [cvData, setCvData] = useState<CVData | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploadLoading, setUploadLoading] = useState(false);
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

  const updateCVPreview = async (chatHistory: string) => {
    const data = await extractCVData(chatHistory);
    setCvData(data as unknown as CVData);
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
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_BASE}/api/parse-cv-file`, {
        method: 'POST',
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
      // Also update the CV preview panel
      if (data.name) setCvData(data as unknown as CVData);
    } catch {
      await sendMessage('Intenté subir mi CV pero hubo un error. ¿Puedes ayudarme a completarlo manualmente?');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleDownload = () => {
    if (!cvData) return;
    const html = generateCVHtml(cvData);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CV_${cvData.name?.replace(/\s+/g, '_') || 'NOUU'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#16171a] mb-20" style={{ background: "linear-gradient(135deg, rgba(255,90,95,0.05) 0%, transparent 60%)" }}>
      {/* Header */}
      <div className="px-8 py-6 border-b border-gray-800 flex items-center justify-between bg-[#16171a]">
        <div className={`flex items-center space-x-4 animate-fadeInUp`}>
          <div className="w-12 h-12 bg-[#ff5a5f] rounded-xl flex items-center justify-center text-white">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Generador de CV</h2>
            <p className="text-sm text-gray-400">
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
          className="flex items-center space-x-2 bg-[#222327] border border-gray-700 hover:border-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          <span>Reiniciar</span>
        </button>
      </div>

      {/* Progress Bar */}
      <div className="animate-fadeInUp delay-100 px-8 py-3 border-b border-gray-800 bg-[#16171a] flex items-center justify-between text-sm">
        <span className="text-gray-400">Progreso de tu CV</span>
        <span className="text-gray-400">{progress}%</span>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex justify-center p-8 overflow-hidden h-[calc(100vh-200px)]">
        <div className="animate-slideInBlur delay-200 w-full max-w-3xl bg-[#222327] rounded-2xl border border-gray-800 overflow-hidden shadow-2xl flex flex-col h-full">
          {/* Chat Header */}
          <div className="p-4 border-b border-gray-800 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-[#ff5a5f] rounded-full flex items-center justify-center animate-float">
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
            <button 
              onClick={handleDownload}
              disabled={!cvData}
              className="text-[#ff5a5f] hover:text-[#ff444a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Descargar CV"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
            </button>
          </div>

          {/* Chat Messages */}
          <div className="p-6 space-y-6 overflow-y-auto flex-1">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex space-x-3 ${msg.role === "user" ? "flex-row-reverse space-x-reverse" : ""} ${idx === messages.length - 1 ? "animate-fadeInUp" : ""}`}
              >
                {msg.role === "model" && (
                  <div className="w-8 h-8 bg-[#ff5a5f] rounded-full flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}
                <div
                  className={`rounded-2xl p-4 text-sm ${
                    msg.role === "user"
                      ? "bg-[#ff5a5f] text-white rounded-tr-none"
                      : "bg-[#2a2b30] text-gray-200 border border-gray-700/50 rounded-tl-none"
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
                <div className="w-8 h-8 bg-[#ff5a5f] rounded-full flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-[#2a2b30] rounded-2xl rounded-tl-none p-4 flex items-center space-x-2 border border-gray-700/50">
                  <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                  <span className="text-sm text-gray-400">Escribiendo...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <div className="p-4 border-t border-gray-800 bg-[#1e1f23] shrink-0">
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
                className="flex items-center space-x-1.5 text-xs text-gray-400 hover:text-white bg-[#16171a] border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                title="Subir CV existente (PDF o imagen)"
              >
                {uploadLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                )}
                <span>{uploadLoading ? 'Analizando...' : 'Subir CV existente'}</span>
              </button>
              <span className="text-[10px] text-gray-600">PDF, JPG o PNG · máx 10MB</span>
            </div>
            <div className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Escribe tu respuesta..."
                className="w-full bg-[#16171a] border border-gray-700 rounded-xl py-3 pl-4 pr-12 text-sm text-white focus:outline-none focus:border-[#ff5a5f] transition-colors"
                disabled={isLoading || uploadLoading}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading || uploadLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-[#ff5a5f]/20 text-[#ff5a5f] rounded-lg hover:bg-[#ff5a5f] hover:text-white transition-colors disabled:opacity-50 disabled:hover:bg-[#ff5a5f]/20 disabled:hover:text-[#ff5a5f]"
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

/* Helper: recenter map when user location changes */
const MapRecenter = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => { map.setView(center, 13, { animate: true }); }, [center, map]);
  return null;
};

const LaborMap = () => {
  const { messages, isLoading, sendMessage, setSessionType } = useChat();
  const [itinerary, setItinerary] = useState<number[]>([]);
  const [showItinerary, setShowItinerary] = useState(false);
  const [input, setInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Geolocation state
  const DEFAULT_LOCATION: [number, number] = [-33.437, -70.65];
  const [userLocation, setUserLocation] = useState<[number, number]>(DEFAULT_LOCATION);
  const [locationStatus, setLocationStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [manualAddress, setManualAddress] = useState('');
  const [travelMode, setTravelMode] = useState<'walking' | 'driving'>('walking');
  const [osrmRoute, setOsrmRoute] = useState<[number, number][] | null>(null);
  const [osrmDistance, setOsrmDistance] = useState<number | null>(null);
  const [osrmDuration, setOsrmDuration] = useState<number | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

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

  /* OSRM real route */
  const fetchOsrmRoute = async (waypoints: [number, number][], mode: 'walking' | 'driving') => {
    if (waypoints.length < 2) return;
    setRouteLoading(true);
    try {
      const profile = mode === 'driving' ? 'driving' : 'foot';
      const coords = waypoints.map(([lat, lng]) => `${lng},${lat}`).join(';');
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/${profile}/${coords}?overview=full&geometries=geojson`
      );
      const data = await res.json();
      if (data.routes?.[0]) {
        const r = data.routes[0];
        setOsrmRoute(r.geometry.coordinates.map(([lng, lat]: number[]) => [lat, lng] as [number, number]));
        setOsrmDistance(r.distance / 1000);
        setOsrmDuration(Math.round(r.duration / 60));
      }
    } catch { setOsrmRoute(null); }
    finally { setRouteLoading(false); }
  };

  const jobs = [
    { id: 1, title: "Cajero/a", company: "Supermercado Lider", location: "Av. Providencia 2653, Providencia", salary: "$450.000 - $550.000", time: "Hace 2 horas", tags: ["Atención al cliente", "Manejo de dinero"], urgent: true, coords: [-33.418, -70.605] as [number, number] },
    { id: 2, title: "Reponedor/a", company: "Jumbo", location: "Av. Kennedy 9001, Las Condes", salary: "$420.000 - $480.000", time: "Hace 5 horas", tags: ["Orden", "Fuerza física"], coords: [-33.39, -70.546] as [number, number] },
    { id: 3, title: "Mesero/a", company: "Restaurant El Huerto", location: "Orrego Luco 054, Providencia", salary: "$350.000 + propinas", time: "Hace 1 día", tags: ["Atención al cliente", "Buena presencia"], coords: [-33.423, -70.611] as [number, number] },
    { id: 4, title: "Bodeguero/a", company: "Distribuidora Central", location: "Av. Vicuña Mackenna 1290, Ñuñoa", salary: "$480.000 - $550.000", time: "Hace 3 horas", tags: ["Orden", "Inventario"], urgent: true, coords: [-33.456, -70.625] as [number, number] },
    { id: 5, title: "Guardia de Seguridad", company: "Securitas", location: "Av. Los Leones 1200, Providencia", salary: "$500.000 - $600.000", time: "Hace 4 horas", tags: ["Seguridad", "Turnos rotativos"], coords: [-33.435, -70.600] as [number, number] },
    { id: 6, title: "Auxiliar de Aseo", company: "ISS Chile", location: "Rosario Norte 532, Las Condes", salary: "$400.000 - $450.000", time: "Hace 1 día", tags: ["Limpieza", "Responsabilidad"], coords: [-33.405, -70.570] as [number, number] },
    { id: 7, title: "Operador/a Call Center", company: "Teleperformance", location: "Av. Apoquindo 4501, Las Condes", salary: "$450.000 + bonos", time: "Hace 6 horas", tags: ["Atención al cliente", "Computación"], coords: [-33.415, -70.585] as [number, number] },
    { id: 8, title: "Repartidor/a", company: "Correos de Chile", location: "Exposición 221, Estación Central", salary: "$480.000 - $520.000", time: "Hace 2 días", tags: ["Licencia B", "Rutas"], urgent: true, coords: [-33.450, -70.680] as [number, number] },
    { id: 9, title: "Ayudante de Cocina", company: "Starbucks", location: "Pedro de Valdivia 100, Providencia", salary: "$380.000 - $420.000", time: "Hace 1 hora", tags: ["Cocina", "Rapidez"], coords: [-33.425, -70.615] as [number, number] },
    { id: 10, title: "Vendedor/a Retail", company: "Falabella", location: "Costanera Center, Providencia", salary: "$400.000 + comisiones", time: "Hace 3 días", tags: ["Ventas", "Atención al cliente"], coords: [-33.417, -70.606] as [number, number] },
    { id: 11, title: "Reponedor/a", company: "Santa Isabel", location: "Av. Irarrázaval 2800, Ñuñoa", salary: "$400.000 - $450.000", time: "Hace 1 hora", tags: ["Orden", "Fuerza física"], coords: [-33.453, -70.598] as [number, number] },
    { id: 12, title: "Reponedor/a Nocturno", company: "Tottus", location: "Av. Vitacura 6200, Vitacura", salary: "$450.000 - $500.000", time: "Hace 4 horas", tags: ["Orden", "Nocturno"], coords: [-33.395, -70.575] as [number, number] },
  ];

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
    setSessionType('map', JSON.stringify(jobs));
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

  const toggleItinerary = (id: number) => {
    setItinerary((prev) =>
      prev.includes(id) ? prev.filter((jobId) => jobId !== id) : [...prev, id],
    );
  };

  const optimizedRouteIds = useMemo(() => {
    const selectedJobs = jobs.filter(j => itinerary.includes(j.id));
    return optimizeRoute(userLocation, selectedJobs);
  }, [itinerary, jobs, userLocation]);

  const optimizedJobs = useMemo(() => {
    return optimizedRouteIds.map(id => jobs.find(j => j.id === id)!);
  }, [optimizedRouteIds, jobs]);

  const polylinePositions = useMemo(() => {
    return [userLocation, ...optimizedJobs.map(j => j.coords)];
  }, [userLocation, optimizedJobs]);

  const totalDistance = useMemo(() => {
    let dist = 0;
    for (let i = 0; i < polylinePositions.length - 1; i++) {
      const p1 = polylinePositions[i];
      const p2 = polylinePositions[i+1];
      // simple distance calculation for display
      const R = 6371;
      const dLat = (p2[0] - p1[0]) * (Math.PI/180);
      const dLon = (p2[1] - p1[1]) * (Math.PI/180);
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(p1[0]*(Math.PI/180)) * Math.cos(p2[0]*(Math.PI/180)) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      dist += R * c;
    }
    return dist;
  }, [polylinePositions]);

  const metrics = calculateTripMetrics(totalDistance);

  const addAllFilteredToItinerary = () => {
    const newIds = filteredJobs.map(j => j.id);
    setItinerary(prev => {
      const combined = new Set([...prev, ...newIds]);
      return Array.from(combined);
    });
    setShowItinerary(true);
  };

  // When itinerary changes, fetch OSRM route
  useEffect(() => {
    if (optimizedJobs.length === 0) { setOsrmRoute(null); setOsrmDistance(null); setOsrmDuration(null); return; }
    const waypoints: [number, number][] = [userLocation, ...optimizedJobs.map(j => j.coords)];
    fetchOsrmRoute(waypoints, travelMode);
  }, [optimizedJobs, travelMode, userLocation]);

  const openInGoogleMaps = () => {
    if (optimizedJobs.length === 0) return;
    const origin = `${userLocation[0]},${userLocation[1]}`;
    const last = optimizedJobs[optimizedJobs.length - 1];
    const destination = `${last.coords[0]},${last.coords[1]}`;
    const gmMode = travelMode === 'driving' ? 'driving' : 'walking';
    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=${gmMode}`;
    if (optimizedJobs.length > 1) {
      const waypoints = optimizedJobs.slice(0, -1).map(j => `${j.coords[0]},${j.coords[1]}`).join('|');
      url += `&waypoints=${waypoints}`;
    }
    window.open(url, '_blank');
  };

  // Animated user marker icon
  const animatedUserIcon = new L.DivIcon({
    className: '',
    html: `<div class="user-location-marker"><div class="ring"></div><div class="ring ring2"></div><div class="dot"></div></div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });

  return (
    <div className="flex flex-col h-[calc(100vh-73px)] mb-20" style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.05) 0%, transparent 60%)" }}>
      {/* Map Header */}
      <div className="px-6 py-4 border-b border-gray-800 bg-[#16171a]">
        <div className="flex items-center justify-between animate-fadeInUp">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center text-orange-500">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Mapa Laboral</h2>
              <p className="text-xs text-gray-400">
                {locationStatus === 'loading' ? '📍 Detectando tu ubicación...' :
                 locationStatus === 'ok' ? '📍 Ubicación detectada' :
                 '📍 Usando Santiago centro (no se detectó tu ubicación)'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {/* Travel mode */}
            <div className="flex bg-[#222327] border border-gray-800 rounded-lg p-0.5">
              <button onClick={() => setTravelMode('walking')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center space-x-1 ${travelMode === 'walking' ? 'bg-[#ff5a5f] text-white' : 'text-gray-400 hover:text-white'}`}>
                <span>🚶</span><span>Caminando</span>
              </button>
              <button onClick={() => setTravelMode('driving')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center space-x-1 ${travelMode === 'driving' ? 'bg-[#ff5a5f] text-white' : 'text-gray-400 hover:text-white'}`}>
                <span>🚗</span><span>Auto</span>
              </button>
            </div>
            <button
              onClick={() => setShowItinerary(!showItinerary)}
              className={`flex items-center space-x-2 border px-3 py-2 rounded-lg text-xs font-medium transition-colors ${showItinerary ? 'bg-[#ff5a5f] text-white border-[#ff5a5f]' : 'bg-[#222327] border-gray-700 hover:border-gray-600 text-white'}`}
            >
              <MapIcon className="w-4 h-4" />
              <span>Itinerario {itinerary.length > 0 && `(${itinerary.length})`}</span>
            </button>
          </div>
        </div>

        {/* Location error banner + manual input */}
        {locationStatus === 'error' && (
          <div className="mt-3 flex items-center space-x-2">
            <div className="flex-1 relative">
              <input type="text" value={manualAddress}
                onChange={e => setManualAddress(e.target.value)}
                placeholder="Ingresa tu dirección (ej: Av. Providencia 100, Santiago)"
                className="w-full bg-[#222327] border border-orange-500/30 rounded-lg py-2 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-orange-500/60 placeholder-gray-500"
              />
              <MapPin className="w-4 h-4 text-orange-500 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
            <button onClick={async () => {
              // Geocode with Nominatim
              try {
                const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(manualAddress + ', Chile')}&limit=1`);
                const d = await r.json();
                if (d[0]) { setUserLocation([parseFloat(d[0].lat), parseFloat(d[0].lon)]); setLocationStatus('ok'); }
              } catch {}
            }} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap">
              Buscar
            </button>
          </div>
        )}
      </div>

      {/* Search Bar */}
      <div className="px-6 py-3 border-b border-gray-800 flex items-center space-x-3 bg-[#16171a]">
        <div className="flex-1 relative">
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar por cargo, empresa o habilidad..."
            className="w-full bg-[#222327] border border-gray-800 rounded-lg py-2 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-gray-600"
          />
          <MapPin className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>
        {searchQuery.trim() && filteredJobs.length > 0 && (
          <button onClick={addAllFilteredToItinerary}
            className="flex items-center space-x-1.5 bg-[#ff5a5f] hover:bg-[#e62545] text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors">
            <Plus className="w-3.5 h-3.5" /><span>Agregar {filteredJobs.length}</span>
          </button>
        )}
        <button className="flex items-center space-x-1.5 bg-[#222327] border border-gray-800 text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-gray-800 transition-colors">
          <Filter className="w-3.5 h-3.5" /><span>Filtros</span>
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <div className="animate-fadeInLeft w-[400px] border-r border-gray-800 bg-[#16171a] overflow-y-auto flex flex-col">
          {showItinerary ? (
            <div className="p-4 flex-1 flex flex-col">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-bold text-white">Ruta Optimizada</h3>
                  <span className="text-xs text-gray-500">{travelMode === 'walking' ? '🚶 Caminando' : '🚗 En auto'}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-[#222327] border border-gray-800 p-3 rounded-lg text-center">
                    <div className="text-xs text-gray-400 mb-1">Distancia</div>
                    <div className="font-bold text-white text-sm">
                      {osrmDistance != null ? `${osrmDistance.toFixed(1)} km` : `${totalDistance.toFixed(1)} km`}
                    </div>
                  </div>
                  <div className="bg-[#222327] border border-gray-800 p-3 rounded-lg text-center">
                    <div className="text-xs text-gray-400 mb-1">Tiempo</div>
                    <div className="font-bold text-white text-sm">
                      {osrmDuration != null ? `${osrmDuration} min` : `${metrics.timeMinutes} min`}
                    </div>
                  </div>
                  <div className="bg-[#222327] border border-gray-800 p-3 rounded-lg text-center">
                    <div className="text-xs text-gray-400 mb-1">Paradas</div>
                    <div className="font-bold text-[#ff5a5f] text-sm">{optimizedJobs.length}</div>
                  </div>
                </div>
              </div>

              <div className="flex-1 relative">
                <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-gray-800"></div>
                
                <div className="relative pl-10 mb-6">
                  <div className="absolute left-0 top-1 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center border-4 border-[#16171a] z-10">
                    <MapPin className="w-4 h-4 text-white" />
                  </div>
                  <h4 className="text-white font-medium">Tu ubicación</h4>
                  <p className="text-sm text-gray-400">Punto de partida</p>
                </div>

                {optimizedJobs.map((job, idx) => (
                  <div key={job.id} className="relative pl-10 mb-6 group">
                    <div className="absolute left-0 top-1 w-8 h-8 bg-[#ff5a5f] rounded-full flex items-center justify-center border-4 border-[#16171a] z-10 text-white font-bold text-xs">
                      {idx + 1}
                    </div>
                    <div className="bg-[#222327] border border-gray-800 rounded-xl p-4">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="text-white font-medium">{job.title}</h4>
                        <button 
                          onClick={() => toggleItinerary(job.id)}
                          className="text-gray-500 hover:text-red-500 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        </button>
                      </div>
                      <p className="text-sm text-gray-400 mb-2">{job.company}</p>
                      <div className="flex items-center text-xs text-gray-500">
                        <MapPin className="w-3 h-3 mr-1" />
                        {job.location}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-2">
                <button 
                  onClick={openInGoogleMaps}
                  className="w-full bg-[#ff5a5f] hover:bg-[#e62545] text-white py-3 rounded-xl font-medium transition-colors"
                >
                  Abrir ruta en Google Maps
                </button>
                <button 
                  onClick={() => setItinerary([])}
                  className="w-full bg-[#222327] border border-gray-800 hover:border-gray-700 text-white py-3 rounded-xl font-medium transition-colors"
                >
                  Limpiar itinerario
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between mb-2 px-2">
                <span className="text-sm text-gray-400">
                  {filteredJobs.length} trabajos disponibles
                </span>
                <span className="text-xs text-gray-500">
                  Haz clic en un trabajo para agregarlo a tu itinerario
                </span>
              </div>

              {filteredJobs.map((job, idx) => (
                <div
                  key={job.id}
                  className={`animate-fadeInUp bg-[#222327] border ${itinerary.includes(job.id) ? "border-[#ff5a5f]" : "border-gray-800"} rounded-xl p-4 hover:border-gray-600 transition-colors cursor-pointer group`}
                  style={{ animationDelay: `${idx * 60}ms` }}
                  onClick={() => toggleItinerary(job.id)}
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
                      <p className="text-sm text-gray-400">{job.company}</p>
                    </div>
                    <button
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${itinerary.includes(job.id) ? "bg-[#ff5a5f] text-white border-[#ff5a5f]" : "bg-[#16171a] border border-gray-800 text-gray-400 group-hover:text-white group-hover:border-gray-600"}`}
                    >
                      {itinerary.includes(job.id) ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  <div className="space-y-1.5 mb-4">
                    <div className="flex items-center text-xs text-gray-400">
                      <MapPin className="w-3.5 h-3.5 mr-1.5" />
                      {job.location}
                    </div>
                    <div className="flex items-center text-xs text-gray-400">
                      <DollarSign className="w-3.5 h-3.5 mr-1.5" />
                      {job.salary}
                    </div>
                    <div className="flex items-center text-xs text-gray-400">
                      <Clock className="w-3.5 h-3.5 mr-1.5" />
                      {job.time}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {job.tags.map((tag, tIdx) => (
                      <span
                        key={tIdx}
                        className="bg-[#16171a] text-gray-400 text-xs px-2 py-1 rounded-md border border-gray-800"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Map Area */}
        <div className="animate-scaleIn delay-100 flex-1 bg-[#0a0a0c] relative overflow-hidden z-0">
          {routeLoading && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-[#222327]/90 backdrop-blur border border-gray-700 text-white text-xs px-4 py-2 rounded-full flex items-center space-x-2">
              <Loader2 className="w-3 h-3 animate-spin text-orange-400" />
              <span>Calculando ruta real...</span>
            </div>
          )}
          <MapContainer
            center={userLocation}
            zoom={13}
            style={{ height: "100%", width: "100%" }}
            zoomControl={false}
          >
            <MapRecenter center={userLocation} />
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; OpenStreetMap contributors &copy; CARTO'
            />

            {/* Animated user location marker */}
            <Marker position={userLocation} icon={animatedUserIcon}>
              <Popup className="custom-popup">
                <div className="p-4">
                  <p className="font-bold text-white mb-1">📍 Tu ubicación</p>
                  <p className="text-gray-400 text-xs">Punto de partida de tu ruta</p>
                </div>
              </Popup>
            </Marker>

            {/* Real road route from OSRM */}
            {osrmRoute && osrmRoute.length > 1 && (
              <Polyline
                positions={osrmRoute}
                pathOptions={{ color: '#ff5a5f', weight: 4, opacity: 0.85 }}
              />
            )}
            {/* Fallback straight-line if no OSRM */}
            {!osrmRoute && itinerary.length > 0 && (
              <Polyline
                positions={polylinePositions}
                pathOptions={{ color: '#ff5a5f', dashArray: '6, 10', weight: 3, opacity: 0.6 }}
              />
            )}

            {filteredJobs.map((job) => {
              const orderIdx = optimizedRouteIds.indexOf(job.id);
              const isSelected = orderIdx !== -1;
              const icon = isSelected ? new L.DivIcon({
                className: '',
                html: `<div style="width:28px;height:28px;background:linear-gradient(135deg,#ff3c59,#ffaa02);border-radius:50%;border:2px solid white;box-shadow:0 0 20px rgba(255,90,95,0.6);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:13px;">${orderIdx + 1}</div>`,
                iconSize: [28, 28], iconAnchor: [14, 14],
              }) : customIcon;

              return (
                <Marker key={job.id} position={job.coords} icon={icon}
                  eventHandlers={{ click: () => { if (!isSelected) toggleItinerary(job.id); } }}>
                  <Popup className="custom-popup">
                    <div className="p-4 min-w-[220px]">
                      <h3 className="font-bold text-white mb-1">
                        {isSelected ? `#${orderIdx + 1} — ` : ''}{job.title}
                      </h3>
                      <p className="text-gray-400 text-sm">{job.company}</p>
                      <p className="text-green-400 text-sm font-medium mt-1">{job.salary}</p>
                      <p className="text-gray-500 text-xs mt-1">{job.location}</p>
                      {!isSelected && (
                        <button onClick={() => toggleItinerary(job.id)}
                          className="mt-3 w-full bg-[#ff5a5f] hover:bg-[#e62545] text-white text-xs py-1.5 rounded-lg font-medium transition-colors">
                          + Agregar al itinerario
                        </button>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>

        {/* Chat Area */}
        <div className="animate-fadeInRight delay-150 w-[350px] border-l border-gray-800 bg-[#16171a] flex flex-col">
          {/* Chat Header */}
          <div className="p-4 border-b border-gray-800 flex items-center space-x-3 shrink-0">
            <div className="w-8 h-8 bg-[#ff5a5f] rounded-full flex items-center justify-center animate-float">
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
                  <div className="w-6 h-6 bg-[#ff5a5f] rounded-full flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-3 h-3 text-white" />
                  </div>
                )}
                <div
                  className={`rounded-2xl p-3 text-xs ${
                    msg.role === "user"
                      ? "bg-[#ff5a5f] text-white rounded-tr-none"
                      : "bg-[#2a2b30] text-gray-200 border border-gray-700/50 rounded-tl-none"
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
                <div className="w-6 h-6 bg-[#ff5a5f] rounded-full flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-3 h-3 text-white" />
                </div>
                <div className="bg-[#2a2b30] rounded-2xl rounded-tl-none p-3 flex items-center space-x-2 border border-gray-700/50">
                  <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />
                  <span className="text-xs text-gray-400">Escribiendo...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <div className="p-3 border-t border-gray-800 bg-[#1e1f23] shrink-0">
            <div className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Pregunta por trabajos..."
                className="w-full bg-[#16171a] border border-gray-700 rounded-xl py-2 pl-3 pr-10 text-xs text-white focus:outline-none focus:border-[#ff5a5f] transition-colors"
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 bg-[#ff5a5f]/20 text-[#ff5a5f] rounded-lg hover:bg-[#ff5a5f] hover:text-white transition-colors disabled:opacity-50 disabled:hover:bg-[#ff5a5f]/20 disabled:hover:text-[#ff5a5f]"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
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
      <div className="flex-1 flex flex-col items-center py-8 px-8 max-w-3xl mx-auto w-full h-[calc(100vh-73px)] mb-20">
        <div className="w-full flex items-center justify-between mb-6">
          <button
            onClick={() => setActiveTopic(null)}
            className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a temas</span>
          </button>
          <div className="bg-[#222327] border border-gray-800 px-4 py-2 rounded-lg text-sm text-white font-medium">
            {activeTopic}
          </div>
        </div>

        <div className="animate-slideInBlur w-full bg-[#222327] rounded-2xl border border-gray-800 overflow-hidden shadow-2xl flex flex-col flex-1 min-h-0">
          {/* Chat Header */}
          <div className="p-4 border-b border-gray-800 flex items-center space-x-3 shrink-0">
            <div className="w-10 h-10 bg-[#ff5a5f] rounded-full flex items-center justify-center">
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
                  <div className="w-8 h-8 bg-[#ff5a5f] rounded-full flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}
                <div
                  className={`rounded-2xl p-4 text-sm ${
                    msg.role === "user"
                      ? "bg-[#ff5a5f] text-white rounded-tr-none"
                      : "bg-[#2a2b30] text-gray-200 border border-gray-700/50 rounded-tl-none"
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
                <div className="w-8 h-8 bg-[#ff5a5f] rounded-full flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-[#2a2b30] rounded-2xl rounded-tl-none p-4 flex items-center space-x-2 border border-gray-700/50">
                  <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                  <span className="text-sm text-gray-400">Escribiendo...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <div className="p-4 border-t border-gray-800 bg-[#1e1f23] shrink-0">
            <div className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Escribe tu respuesta..."
                className="w-full bg-[#16171a] border border-gray-700 rounded-xl py-3 pl-4 pr-12 text-sm text-white focus:outline-none focus:border-[#ff5a5f] transition-colors"
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-[#ff5a5f]/20 text-[#ff5a5f] rounded-lg hover:bg-[#ff5a5f] hover:text-white transition-colors disabled:opacity-50 disabled:hover:bg-[#ff5a5f]/20 disabled:hover:text-[#ff5a5f]"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center py-12 px-8 max-w-4xl mx-auto w-full mb-20" style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.05) 0%, transparent 60%)" }}>
      {/* Header */}
      <div className="w-full flex items-center space-x-4 mb-16 bg-[#222327] p-4 rounded-2xl border border-gray-800 animate-fadeInUp">
        <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-500 shrink-0">
          <MessageSquare className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">
            Asistente de Entrevista
          </h2>
          <p className="text-sm text-gray-400">
            MarIA te prepara para tu próxima entrevista
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="text-center mb-12">
        <div className="animate-scaleIn delay-100 w-16 h-16 bg-[#ff5a5f] rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(255,90,95,0.3)]">
          <Bot className="w-8 h-8 text-white animate-float delay-300" />
        </div>
        <h1 className="animate-fadeInUp delay-200 text-3xl font-bold text-white mb-3">
          ¿En qué te ayudo hoy?
        </h1>
        <p className="animate-fadeInUp delay-200 text-gray-400">
          Elige un tema y MarIA te guiará paso a paso para que llegues preparado
          a tu entrevista.
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-6 w-full mb-12">
        <div
          onClick={() => handleSelectTopic("Preparar entrevista")}
          className="animate-fadeInUp delay-300 bg-[#222327] border border-gray-800 rounded-2xl p-6 hover:border-gray-600 transition-colors cursor-pointer group"
        >
          <div className="w-10 h-10 bg-[#ff5a5f]/20 rounded-lg flex items-center justify-center text-[#ff5a5f] mb-4 group-hover:bg-[#ff5a5f] group-hover:text-white transition-colors">
            <Target className="w-5 h-5" />
          </div>
          <h3 className="text-white font-semibold mb-2">Preparar entrevista</h3>
          <p className="text-sm text-gray-400">
            Te ayudo a prepararte para una entrevista específica
          </p>
        </div>

        <div
          onClick={() => handleSelectTopic("Preguntas frecuentes")}
          className="animate-fadeInUp delay-400 bg-[#222327] border border-gray-800 rounded-2xl p-6 hover:border-gray-600 transition-colors cursor-pointer group"
        >
          <div className="w-10 h-10 bg-[#ff5a5f]/20 rounded-lg flex items-center justify-center text-[#ff5a5f] mb-4 group-hover:bg-[#ff5a5f] group-hover:text-white transition-colors">
            <MessageSquare className="w-5 h-5" />
          </div>
          <h3 className="text-white font-semibold mb-2">
            Preguntas frecuentes
          </h3>
          <p className="text-sm text-gray-400">
            Practica respondiendo preguntas típicas de entrevista
          </p>
        </div>

        <div
          onClick={() => handleSelectTopic("Destacar habilidades")}
          className="animate-fadeInUp delay-500 bg-[#222327] border border-gray-800 rounded-2xl p-6 hover:border-gray-600 transition-colors cursor-pointer group"
        >
          <div className="w-10 h-10 bg-[#ff5a5f]/20 rounded-lg flex items-center justify-center text-[#ff5a5f] mb-4 group-hover:bg-[#ff5a5f] group-hover:text-white transition-colors">
            <Lightbulb className="w-5 h-5" />
          </div>
          <h3 className="text-white font-semibold mb-2">
            Destacar habilidades
          </h3>
          <p className="text-sm text-gray-400">
            Aprende a presentar tus fortalezas
          </p>
        </div>

        <div
          onClick={() => handleSelectTopic("Simulación completa")}
          className="animate-fadeInUp delay-600 bg-[#222327] border border-gray-800 rounded-2xl p-6 hover:border-gray-600 transition-colors cursor-pointer group"
        >
          <div className="w-10 h-10 bg-[#ff5a5f]/20 rounded-lg flex items-center justify-center text-[#ff5a5f] mb-4 group-hover:bg-[#ff5a5f] group-hover:text-white transition-colors">
            <Briefcase className="w-5 h-5" />
          </div>
          <h3 className="text-white font-semibold mb-2">Simulación completa</h3>
          <p className="text-sm text-gray-400">
            Simula una entrevista real de principio a fin
          </p>
        </div>
      </div>

      {/* Tips */}
      <div className="animate-fadeInUp delay-700 w-full bg-[#222327] border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center space-x-2 mb-4">
          <CheckCircle2 className="w-5 h-5 text-green-500" />
          <h3 className="text-white font-semibold">Tips rápidos</h3>
        </div>
        <ul className="space-y-3 text-sm text-gray-400">
          <li>
            <span className="text-[#ff5a5f] font-bold mr-2">1.</span> Investiga
            la empresa antes de ir — mira su página web o redes sociales
          </li>
          <li>
            <span className="text-[#ff5a5f] font-bold mr-2">2.</span> Prepara
            2-3 preguntas para hacer al entrevistador al final
          </li>
          <li>
            <span className="text-[#ff5a5f] font-bold mr-2">3.</span> Practica
            tu presentación personal (30 segundos sobre ti)
          </li>
          <li>
            <span className="text-[#ff5a5f] font-bold mr-2">4.</span> Lleva
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
  Entrevistado: "bg-blue-500/10 text-blue-500 border-blue-500/20",
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
      <div className="flex-1 flex flex-col p-8 bg-[#16171a] overflow-y-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard de Reclutamiento</h1>
            <p className="text-gray-400 text-sm">Gestiona tus candidatos pre-filtrados por IA</p>
          </div>
          <button
            onClick={() => setIsLoggedIn(false)}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cerrar sesión
          </button>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-[#222327] border border-gray-800 p-4 rounded-xl">
            <div className="text-gray-400 text-sm mb-1">Candidatos totales</div>
            <div className="text-2xl font-bold text-white">{metrics.total}</div>
          </div>
          <div className="bg-[#222327] border border-gray-800 p-4 rounded-xl">
            <div className="text-gray-400 text-sm mb-1">Entrevistados por IA</div>
            <div className="text-2xl font-bold text-white">{metrics.interviewed}</div>
          </div>
          <div className="bg-[#222327] border border-green-500/30 p-4 rounded-xl">
            <div className="text-green-500 text-sm mb-1">Aprobados</div>
            <div className="text-2xl font-bold text-green-500">{metrics.approved}</div>
          </div>
          <div className="bg-[#222327] border border-red-500/30 p-4 rounded-xl">
            <div className="text-red-500 text-sm mb-1">Rechazados</div>
            <div className="text-2xl font-bold text-red-500">{metrics.rejected}</div>
          </div>
          <div className="bg-[#222327] border border-gray-800 p-4 rounded-xl">
            <div className="text-gray-400 text-sm mb-1">Score promedio</div>
            <div className="text-2xl font-bold text-white">{metrics.avgScore}%</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 mb-6 bg-[#222327] p-1 rounded-lg w-fit border border-gray-800">
          <button onClick={() => setActiveTab("candidates")} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "candidates" ? "bg-[#ff5a5f] text-white" : "text-gray-400 hover:text-white"}`}>
            Candidatos
          </button>
          <button onClick={() => setActiveTab("jobs")} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "jobs" ? "bg-[#ff5a5f] text-white" : "text-gray-400 hover:text-white"}`}>
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
                  className="w-full bg-[#222327] border border-gray-800 rounded-lg py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-gray-600"
                />
                <Filter className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-[#222327] border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-gray-600"
              >
                <option value="Todos">Todos los estados</option>
                <option value="Nuevo">Nuevo</option>
                <option value="Entrevistado">Entrevistado</option>
                <option value="Aprobado">Aprobado</option>
                <option value="Rechazado">Rechazado</option>
              </select>
              <span className="flex items-center text-sm text-gray-500">{filteredCandidates.length} de {candidates.length}</span>
            </div>

            {/* Candidates List */}
            <div className="space-y-4">
              {filteredCandidates.length === 0 ? (
                <div className="text-center py-12 text-gray-500">No se encontraron candidatos con esos filtros.</div>
              ) : (
                filteredCandidates.map((candidate) => (
                  <div key={candidate.id} className="bg-[#222327] border border-gray-800 rounded-xl p-6 flex items-center justify-between hover:border-gray-600 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center text-gray-400 font-bold">
                        {candidate.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-white font-medium">{candidate.name}</h3>
                        <div className="text-sm text-gray-400">{candidate.role} • {candidate.date}</div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {candidate.tags.map((tag, tIdx) => (
                            <span key={tIdx} className="bg-[#16171a] text-gray-400 text-xs px-2 py-1 rounded-md border border-gray-800">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-6">
                      <div className="text-center">
                        <div className={`text-2xl font-bold ${candidate.score >= 80 ? "text-green-500" : candidate.score >= 70 ? "text-yellow-500" : "text-red-500"}`}>{candidate.score}%</div>
                        <div className="text-[10px] text-gray-500 uppercase">Match</div>
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
                        className="bg-[#ff5a5f] hover:bg-[#ff444a] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
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
                  className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors mb-6"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-sm">Volver a publicaciones</span>
                </button>

                <div className="bg-[#222327] border border-gray-800 rounded-xl p-6 mb-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-bold text-white">{selectedJob.title}</h2>
                      <div className="flex items-center space-x-4 mt-1 text-sm text-gray-400">
                        <span className="flex items-center space-x-1"><MapPin className="w-3.5 h-3.5" /><span>{selectedJob.location}</span></span>
                        <span className="flex items-center space-x-1"><Clock className="w-3.5 h-3.5" /><span>{selectedJob.type}</span></span>
                        <span>{selectedJob.createdAt}</span>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-[#ff5a5f]">{jobCandidates.length}</div>
                      <div className="text-[10px] text-gray-500 uppercase">Candidatos</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {jobCandidates.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">No hay candidatos para esta publicación aún.</div>
                  ) : (
                    jobCandidates.map(candidate => (
                      <div key={candidate.id} className="bg-[#222327] border border-gray-800 rounded-xl p-6 hover:border-gray-600 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center text-gray-400 font-bold">
                              {candidate.name.charAt(0)}
                            </div>
                            <div>
                              <h3 className="text-white font-medium">{candidate.name}</h3>
                              <div className="text-sm text-gray-400">{candidate.role} • {candidate.location}</div>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {candidate.tags.map((tag, tIdx) => (
                                  <span key={tIdx} className="bg-[#16171a] text-gray-400 text-xs px-2 py-1 rounded-md border border-gray-800">{tag}</span>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-6">
                            <div className="text-center">
                              <div className={`text-2xl font-bold ${candidate.score >= 80 ? "text-green-500" : candidate.score >= 70 ? "text-yellow-500" : "text-red-500"}`}>{candidate.score}%</div>
                              <div className="text-[10px] text-gray-500 uppercase">Match</div>
                            </div>
                            <span className={`text-xs px-3 py-1.5 rounded-full border ${STATUS_COLORS[candidate.status]}`}>{candidate.status}</span>
                            <button
                              onClick={() => setSelectedCandidate(candidate)}
                              className="bg-[#ff5a5f] hover:bg-[#ff444a] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                            >
                              Ver detalle
                            </button>
                          </div>
                        </div>

                        {/* AI Summary */}
                        <div className="mt-4 pt-4 border-t border-gray-800">
                          {aiSummaries[candidate.id] ? (
                            <div className="flex items-start space-x-3">
                              <Bot className="w-5 h-5 text-[#ff5a5f] mt-0.5 flex-shrink-0" />
                              <div>
                                <span className="text-xs text-[#ff5a5f] font-medium uppercase">Resumen IA</span>
                                <p className="text-sm text-gray-300 mt-1">{aiSummaries[candidate.id]}</p>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => generateAiSummary(candidate, selectedJob.title)}
                              disabled={loadingSummary === candidate.id}
                              className="flex items-center space-x-2 text-sm text-[#ff5a5f] hover:text-[#ff444a] transition-colors disabled:opacity-50"
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
                          className="text-gray-400 hover:text-white text-sm transition-colors flex items-center space-x-2"
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
                          className="relative text-gray-400 hover:text-white transition-colors flex items-center space-x-2 bg-[#222327] border border-gray-800 px-4 py-2 rounded-lg text-sm"
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
                          className="bg-[#ff5a5f] hover:bg-[#ff444a] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
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
                        <Trash2 className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                        <p className="text-gray-500">La papelera está vacía</p>
                      </div>
                    ) : (
                      trashedJobs.map(job => (
                        <div key={job.id} className="bg-[#222327] border border-gray-800 rounded-xl p-6 flex items-center justify-between opacity-70">
                          <div>
                            <h3 className="text-white font-medium">{job.title}</h3>
                            <div className="flex items-center space-x-4 mt-1 text-sm text-gray-400">
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
                      <form onSubmit={handleAddJob} className="bg-[#222327] border border-gray-800 rounded-xl p-6 mb-6 space-y-4">
                        <h3 className="font-medium text-white">Nueva publicación de empleo</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <input
                            type="text"
                            placeholder="Título del cargo"
                            value={newJob.title}
                            onChange={(e) => setNewJob(prev => ({ ...prev, title: e.target.value }))}
                            required
                            className="bg-[#16171a] border border-gray-700 rounded-lg py-2.5 px-4 text-sm text-white focus:outline-none focus:border-gray-500"
                          />
                          <input
                            type="text"
                            placeholder="Ubicación"
                            value={newJob.location}
                            onChange={(e) => setNewJob(prev => ({ ...prev, location: e.target.value }))}
                            className="bg-[#16171a] border border-gray-700 rounded-lg py-2.5 px-4 text-sm text-white focus:outline-none focus:border-gray-500"
                          />
                          <select
                            value={newJob.type}
                            onChange={(e) => setNewJob(prev => ({ ...prev, type: e.target.value }))}
                            className="bg-[#16171a] border border-gray-700 rounded-lg py-2.5 px-4 text-sm text-white focus:outline-none focus:border-gray-500"
                          >
                            <option>Tiempo completo</option>
                            <option>Part-time</option>
                            <option>Turno</option>
                          </select>
                        </div>
                        <div className="flex space-x-3">
                          <button type="submit" className="bg-[#ff5a5f] hover:bg-[#ff444a] text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors">Publicar</button>
                          <button type="button" onClick={() => { setShowNewJobForm(false); setNewJob({ title: "", location: "", type: "Tiempo completo" }); }} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-6 py-2 rounded-lg text-sm font-medium transition-colors">Cancelar</button>
                        </div>
                      </form>
                    )}

                    <div className="space-y-4">
                      {jobPostings.map(job => (
                        <div
                          key={job.id}
                          onClick={() => setSelectedJob(job)}
                          className="bg-[#222327] border border-gray-800 rounded-xl p-6 flex items-center justify-between hover:border-gray-600 transition-colors cursor-pointer"
                        >
                          <div>
                            <h3 className="text-white font-medium">{job.title}</h3>
                            <div className="flex items-center space-x-4 mt-1 text-sm text-gray-400">
                              <span className="flex items-center space-x-1"><MapPin className="w-3.5 h-3.5" /><span>{job.location}</span></span>
                              <span className="flex items-center space-x-1"><Clock className="w-3.5 h-3.5" /><span>{job.type}</span></span>
                              <span>{job.createdAt}</span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-6">
                            <div className="text-center">
                              <div className="text-xl font-bold text-white">{getJobCandidateCount(job.id)}</div>
                              <div className="text-[10px] text-gray-500 uppercase">Candidatos</div>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteJob(job.id); }}
                              className="text-gray-500 hover:text-red-500 transition-colors p-2"
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
            <div className="bg-[#222327] border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-6 border-b border-gray-800">
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 bg-[#ff5a5f]/20 text-[#ff5a5f] rounded-full flex items-center justify-center text-xl font-bold">
                    {selectedCandidate.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">{selectedCandidate.name}</h2>
                    <p className="text-gray-400">{selectedCandidate.role} • {selectedCandidate.date}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-center">
                    <div className={`text-3xl font-bold ${selectedCandidate.score >= 80 ? "text-green-500" : selectedCandidate.score >= 70 ? "text-yellow-500" : "text-red-500"}`}>{selectedCandidate.score}%</div>
                    <div className="text-[10px] text-gray-500 uppercase">Match</div>
                  </div>
                  <button onClick={() => setSelectedCandidate(null)} className="text-gray-400 hover:text-white transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Contact */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center space-x-3 text-sm">
                    <Mail className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-300">{selectedCandidate.email}</span>
                  </div>
                  <div className="flex items-center space-x-3 text-sm">
                    <Phone className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-300">{selectedCandidate.phone}</span>
                  </div>
                  <div className="flex items-center space-x-3 text-sm">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-300">{selectedCandidate.location}</span>
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-2">Habilidades</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedCandidate.tags.map((tag, i) => (
                      <span key={i} className="bg-[#16171a] text-gray-300 text-sm px-3 py-1 rounded-full border border-gray-700">{tag}</span>
                    ))}
                  </div>
                </div>

                {/* Experience */}
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-2 flex items-center space-x-2"><Briefcase className="w-4 h-4" /><span>Experiencia</span></h4>
                  <p className="text-gray-300 text-sm bg-[#16171a] p-4 rounded-xl border border-gray-800">{selectedCandidate.experience}</p>
                </div>

                {/* Education */}
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-2 flex items-center space-x-2"><GraduationCap className="w-4 h-4" /><span>Educación</span></h4>
                  <p className="text-gray-300 text-sm bg-[#16171a] p-4 rounded-xl border border-gray-800">{selectedCandidate.education}</p>
                </div>

                {/* Notes */}
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-2">Notas</h4>
                  <p className="text-gray-300 text-sm bg-[#16171a] p-4 rounded-xl border border-gray-800">{selectedCandidate.notes}</p>
                </div>

                {/* Status Change */}
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-3">Cambiar estado</h4>
                  <div className="flex flex-wrap gap-2">
                    {(["Nuevo", "Entrevistado", "Aprobado", "Rechazado"] as CandidateStatus[]).map(status => (
                      <button
                        key={status}
                        onClick={() => handleStatusChange(selectedCandidate.id, status)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          selectedCandidate.status === status
                            ? STATUS_COLORS[status].replace('/10', '/30') + " ring-1 ring-current"
                            : "bg-[#16171a] text-gray-400 border-gray-700 hover:border-gray-500"
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
        <p className="text-gray-400">
          Inicia sesión para gestionar candidatos filtrados por IA
        </p>
      </div>

      <div className="w-full max-w-md bg-[#222327] border border-gray-800 rounded-2xl p-8">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email corporativo
            </label>
            <div className="relative">
              <input
                type="email"
                required
                placeholder="tu@empresa.cl"
                className="w-full bg-[#16171a] border border-gray-700 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-green-500 transition-colors"
              />
              <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Contraseña
            </label>
            <div className="relative">
              <input
                type="password"
                required
                placeholder="Tu contraseña"
                className="w-full bg-[#16171a] border border-gray-700 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-green-500 transition-colors"
              />
              <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
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
            className="w-full bg-[#ff5a5f] hover:bg-[#ff444a] text-white py-3 rounded-xl font-medium transition-colors flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              "Iniciar sesión"
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <a href="#" className="text-sm text-[#ff5a5f] hover:underline">
            ¿Olvidaste tu contraseña?
          </a>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-800 text-center">
          <p className="text-sm text-gray-400 mb-4">
            ¿Tu empresa aún no tiene cuenta?
          </p>
          <button className="w-full bg-[#16171a] border border-gray-700 hover:border-gray-600 text-white py-3 rounded-xl text-sm font-medium transition-colors flex items-center justify-center space-x-2">
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
    <button onClick={onBack} className="flex items-center space-x-2 text-gray-400 hover:text-white mb-8 transition-colors text-sm">
      <ArrowLeft className="w-4 h-4" />
      <span>Volver</span>
    </button>
    <h1 className="text-3xl font-bold mb-2">{title}</h1>
    <p className="text-gray-500 text-sm mb-10">Última actualización: abril 2026 · NOUU SpA · Santiago, Chile</p>
    <div className="prose prose-invert prose-sm max-w-none space-y-6 text-gray-300 leading-relaxed">
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

  const stats = [
    { label: "CVs creados", value: 0 },
    { label: "Entrevistas practicadas", value: 0 },
    { label: "Días activo", value: 0 },
  ];

  const actions = [
    {
      icon: FileText,
      label: "Crear CV",
      desc: "Conversa con MarIA y crea tu CV profesional",
      color: "#ff5a5f",
      bg: "bg-[#ff5a5f]/10",
      view: "cv",
    },
    {
      icon: MapIcon,
      label: "Ver Mapa",
      desc: "Encuentra empresas y vacantes cerca de ti",
      color: "#f97316",
      bg: "bg-orange-500/10",
      view: "map",
    },
    {
      icon: MessageSquare,
      label: "Practicar Entrevista",
      desc: "MarIA te prepara para tu próxima entrevista",
      color: "#3b82f6",
      bg: "bg-blue-500/10",
      view: "assistant",
    },
  ];

  return (
    <div className="flex-1 flex flex-col px-8 py-10 max-w-5xl mx-auto w-full mb-20">
      {/* Welcome */}
      <div className="animate-fadeInUp mb-10">
        <div className="flex items-center space-x-5">
          <div className="w-16 h-16 bg-[#ff5a5f] rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-[#ff5a5f]/25 animate-pulseGlow">
            {initial}
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-1">Bienvenido de vuelta</p>
            <h1 className="text-2xl font-bold text-white">{displayName}</h1>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="animate-fadeInUp delay-100 grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="card-hover bg-[#222327] border border-gray-800 rounded-2xl p-6 text-center"
          >
            <div className="text-3xl font-bold gradient-text mb-1">{stat.value}</div>
            <div className="text-sm text-gray-400">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="animate-fadeInUp delay-200">
        <h2 className="text-lg font-bold text-white mb-4">Acciones rápidas</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {actions.map(({ icon: Icon, label, desc, color, bg, view }) => (
            <div
              key={view}
              onClick={() => setCurrentView(view)}
              className="card-hover bg-[#222327] border border-gray-800 rounded-2xl p-6 cursor-pointer"
            >
              <div className={`w-12 h-12 ${bg} rounded-xl flex items-center justify-center mb-4`} style={{ color }}>
                <Icon className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-white mb-1">{label}</h3>
              <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
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

      {/* Empty state encouragement */}
      <div className="animate-fadeInUp delay-300 mt-10 bg-[#222327] border border-gray-800 rounded-2xl p-8 text-center">
        <div className="w-14 h-14 bg-[#ff5a5f]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Bot className="w-7 h-7 text-[#ff5a5f]" />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">Tu viaje comienza aquí</h3>
        <p className="text-sm text-gray-400 max-w-sm mx-auto leading-relaxed">
          Crea tu primer CV con MarIA y da el primer paso hacia tu próximo trabajo. Solo conversando, sin formularios complicados.
        </p>
        <button
          onClick={() => setCurrentView("cv")}
          className="mt-6 btn-shimmer text-white px-8 py-3 rounded-xl font-bold text-sm hover:scale-105 transition-transform inline-flex items-center space-x-2"
        >
          <Bot className="w-4 h-4" />
          <span>Hablar con MarIA</span>
        </button>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────── */

export default function App() {
  const [currentView, setCurrentView] = useState("landing");
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem("nouu-theme") as "dark" | "light") || "dark";
  });
  const [showAuth, setShowAuth] = useState(false);
  const { user } = useAuth();

  // Wire auth gate so ChatContext can open the modal when user hits the limit
  useEffect(() => {
    setAuthGateCallback(() => setShowAuth(true));
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("nouu-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");

  const handleSetCurrentView = (view: string) => {
    setCurrentView(view);
    window.scrollTo(0, 0);
  };

  const renderView = () => {
    switch (currentView) {
      case "landing":
        return <LandingPage setCurrentView={handleSetCurrentView} onOpenAuth={() => setShowAuth(true)} />;
      case "cv":
        return <CVGenerator />;
      case "map":
        return <LaborMap />;
      case "assistant":
        return <Assistant />;
      case "b2b":
        return <B2BPanel setCurrentView={handleSetCurrentView} onOpenAuth={() => setShowAuth(true)} />;
      case "dashboard":
        return <Dashboard setCurrentView={handleSetCurrentView} />;
      case "terminos":
        return <TerminosView onBack={() => handleSetCurrentView("landing")} />;
      case "privacidad":
        return <PrivacidadView onBack={() => handleSetCurrentView("landing")} />;
      default:
        return <LandingPage setCurrentView={handleSetCurrentView} onOpenAuth={() => setShowAuth(true)} />;
    }
  };

  return (
    <ChatProvider>
      <div className={`min-h-screen font-sans flex flex-col ${theme === "dark" ? "bg-[#16171a] text-white" : "bg-gray-50 text-gray-900"}`}>
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
