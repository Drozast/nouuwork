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
import {
  createCVChatSession,
  createInterviewChatSession,
  createMapChatSession,
  extractCVData,
} from "./lib/gemini";
import { generateCVHtml, CVData } from "./lib/cv-template";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { optimizeRoute, calculateTripMetrics } from "./lib/route-optimizer";
import { LandingPage } from "./components/LandingPage";
import { Footer } from "./components/Footer";
import { NouuLogo } from "./components/NouuLogo";
import { AuthModal } from "./components/AuthModal";
import { useAuth } from "./lib/auth";

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
            <div className="flex items-center space-x-2 bg-[#222327] border border-gray-700 px-3 py-1.5 rounded-lg">
              <div className="w-6 h-6 bg-[#ff5a5f] rounded-full flex items-center justify-center">
                <User className="w-3 h-3 text-white" />
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
  const [messages, setMessages] = useState<
    { role: "user" | "model"; text: string }[]
  >([
    {
      role: "model",
      text: "¡Hola! Soy MarIA, tu asistente para crear tu CV profesional.\n\nVamos a armarlo paso a paso, solo conversando. No necesitas saber de formato ni de Word.\n\n**¿Cómo te llamas?**",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [cvData, setCvData] = useState<CVData | null>(null);
  const [progress, setProgress] = useState(0);
  const chatSessionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatSessionRef.current = createCVChatSession();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  const updateCVPreview = async (chatHistory: string) => {
    const data = await extractCVData(chatHistory);
    setCvData(data as unknown as CVData);
    
    // Calculate progress based on filled fields
    let filled = 0;
    const totalFields = 8; // name, email, phone, location, experience, education, skills, languages
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
    const newMessages = [...messages, { role: "user" as const, text: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const result = await chatSessionRef.current.sendMessage({ message: userMessage });
      const finalMessages = [
        ...newMessages,
        { role: "model" as const, text: result.text },
      ];
      setMessages(finalMessages);
      
      // Update preview in background
      const chatHistory = finalMessages.map(m => `${m.role}: ${m.text}`).join('\n');
      updateCVPreview(chatHistory);
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          text: "Lo siento, hubo un error de conexión. ¿Podrías repetir tu respuesta?",
        },
      ]);
    } finally {
      setIsLoading(false);
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
    <div className="flex-1 flex flex-col bg-[#16171a] mb-20">
      {/* Header */}
      <div className="px-8 py-6 border-b border-gray-800 flex items-center justify-between bg-[#16171a]">
        <div className="flex items-center space-x-4">
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
            setMessages([{
              role: "model",
              text: "¡Hola! Soy MarIA, tu asistente para crear tu CV profesional.\n\nVamos a armarlo paso a paso, solo conversando. No necesitas saber de formato ni de Word.\n\n**¿Cómo te llamas?**",
            }]);
            setCvData(null);
            setProgress(0);
            chatSessionRef.current = createCVChatSession();
          }}
          className="flex items-center space-x-2 bg-[#222327] border border-gray-700 hover:border-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          <span>Reiniciar</span>
        </button>
      </div>

      {/* Progress Bar */}
      <div className="px-8 py-3 border-b border-gray-800 bg-[#16171a] flex items-center justify-between text-sm">
        <span className="text-gray-400">Progreso de tu CV</span>
        <span className="text-gray-400">{progress}%</span>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex justify-center p-8 overflow-hidden h-[calc(100vh-200px)]">
        <div className="w-full max-w-3xl bg-[#222327] rounded-2xl border border-gray-800 overflow-hidden shadow-2xl flex flex-col h-full">
          {/* Chat Header */}
          <div className="p-4 border-b border-gray-800 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-[#ff5a5f] rounded-full flex items-center justify-center">
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
                className={`flex space-x-3 ${msg.role === "user" ? "flex-row-reverse space-x-reverse" : ""}`}
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
    </div>
  );
};

const LaborMap = () => {
  const [itinerary, setItinerary] = useState<number[]>([]);
  const [showItinerary, setShowItinerary] = useState(false);
  const [messages, setMessages] = useState<
    { role: "user" | "model"; text: string }[]
  >([
    {
      role: "model",
      text: "¡Hola! Soy MarIA. Puedo ayudarte a encontrar el trabajo ideal en el mapa. ¿Qué tipo de trabajo buscas o en qué comuna?",
    },
  ]);
  const [input, setInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatSessionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    chatSessionRef.current = createMapChatSession(JSON.stringify(jobs));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userMessage }]);
    setIsLoading(true);

    try {
      const result = await chatSessionRef.current.sendMessage({ message: userMessage });
      setMessages((prev) => [
        ...prev,
        { role: "model", text: result.text },
      ]);
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          text: "Lo siento, hubo un error de conexión. ¿Podrías repetir tu respuesta?",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const userLocation: [number, number] = [-33.437, -70.65]; // Santiago center

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

  const openInGoogleMaps = () => {
    if (optimizedJobs.length === 0) return;
    
    const origin = `${userLocation[0]},${userLocation[1]}`;
    const destination = `${optimizedJobs[optimizedJobs.length - 1].coords[0]},${optimizedJobs[optimizedJobs.length - 1].coords[1]}`;
    
    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=transit`;
    
    if (optimizedJobs.length > 1) {
      const waypoints = optimizedJobs.slice(0, -1).map(j => `${j.coords[0]},${j.coords[1]}`).join('|');
      url += `&waypoints=${waypoints}`;
    }
    
    window.open(url, '_blank');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-73px)] mb-20">
      {/* Map Header */}
      <div className="px-8 py-6 border-b border-gray-800 flex items-center justify-between bg-[#16171a]">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center text-orange-500">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Mapa Laboral</h2>
            <p className="text-sm text-gray-400">
              Arma tu itinerario y optimiza tu ruta para dejar CVs
            </p>
          </div>
        </div>
        <button 
          onClick={() => setShowItinerary(!showItinerary)}
          className={`flex items-center space-x-2 border px-4 py-2 rounded-lg text-sm font-medium transition-colors ${showItinerary ? 'bg-[#ff5a5f] text-white border-[#ff5a5f]' : 'bg-[#222327] border-gray-700 hover:border-gray-600 text-white'}`}
        >
          <MapIcon className="w-4 h-4" />
          <span>Mi itinerario {itinerary.length > 0 && `(${itinerary.length})`}</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="px-8 py-4 border-b border-gray-800 flex items-center space-x-4 bg-[#16171a]">
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por cargo, empresa o etiqueta (ej. reponedor)..."
            className="w-full bg-[#222327] border border-gray-800 rounded-lg py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-gray-600"
          />
          <MapPin className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        </div>
        {searchQuery.trim() && filteredJobs.length > 0 && (
          <button 
            onClick={addAllFilteredToItinerary}
            className="flex items-center space-x-2 bg-[#ff5a5f] hover:bg-[#e62545] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar visibles al itinerario</span>
          </button>
        )}
        <button className="flex items-center space-x-2 bg-[#222327] border border-gray-800 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
          <Filter className="w-4 h-4" />
          <span>Filtros</span>
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <div className="w-[400px] border-r border-gray-800 bg-[#16171a] overflow-y-auto flex flex-col">
          {showItinerary ? (
            <div className="p-4 flex-1 flex flex-col">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-white mb-4">Ruta Optimizada</h3>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-[#222327] border border-gray-800 p-3 rounded-lg text-center">
                    <div className="text-xs text-gray-400 mb-1">Distancia</div>
                    <div className="font-bold text-white">{totalDistance.toFixed(1)} km</div>
                  </div>
                  <div className="bg-[#222327] border border-gray-800 p-3 rounded-lg text-center">
                    <div className="text-xs text-gray-400 mb-1">Tiempo</div>
                    <div className="font-bold text-white">{metrics.timeMinutes} min</div>
                  </div>
                  <div className="bg-[#222327] border border-gray-800 p-3 rounded-lg text-center">
                    <div className="text-xs text-gray-400 mb-1">Costo est.</div>
                    <div className="font-bold text-[#ff5a5f]">${metrics.costCLP}</div>
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

              {filteredJobs.map((job) => (
                <div
                  key={job.id}
                  className={`bg-[#222327] border ${itinerary.includes(job.id) ? "border-[#ff5a5f]" : "border-gray-800"} rounded-xl p-4 hover:border-gray-600 transition-colors cursor-pointer group`}
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
        <div className="flex-1 bg-[#0a0a0c] relative overflow-hidden z-0">
          <MapContainer
            center={userLocation}
            zoom={12}
            style={{ height: "100%", width: "100%" }}
            zoomControl={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />

            <Marker position={userLocation} icon={userIcon}>
              <Popup>
                <div className="text-gray-900 font-medium">
                  Tu ubicación actual
                </div>
              </Popup>
            </Marker>

            {itinerary.length > 0 && (
              <Polyline 
                positions={polylinePositions} 
                pathOptions={{ color: '#ff5a5f', dashArray: '5, 10', weight: 3 }} 
              />
            )}

            {filteredJobs.map((job) => {
              const orderIdx = optimizedRouteIds.indexOf(job.id);
              const isSelected = orderIdx !== -1;
              
              const icon = isSelected ? new L.DivIcon({
                className: "custom-marker-numbered",
                html: `<div style="width: 24px; height: 24px; background: linear-gradient(45deg, #ff3c59, #ffaa02); border-radius: 50%; border: 2px solid white; box-shadow: 0 0 15px rgba(255,90,95,0.5); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">${orderIdx + 1}</div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12],
              }) : customIcon;

              return (
                <Marker 
                  key={job.id} 
                  position={job.coords} 
                  icon={icon}
                  eventHandlers={{
                    click: () => {
                      if (!isSelected) {
                        toggleItinerary(job.id);
                      }
                    }
                  }}
                >
                  <Popup className="custom-popup" closeButton={true}>
                    <div className="p-5 min-w-[240px]">
                      <h3 className="font-bold text-lg text-white mb-4">
                        {isSelected ? `#${orderIdx + 1} — ` : ''}{job.title}
                      </h3>
                      <p className="text-gray-400 text-sm mb-4">{job.company}</p>
                      <p className="text-green-500 font-medium mb-4">{job.salary}</p>
                      <p className="text-gray-400 text-sm mb-4">{job.location}</p>
                      {isSelected && (
                        <p className="text-orange-500 font-medium text-sm">En tu itinerario</p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>

        {/* Chat Area */}
        <div className="w-[350px] border-l border-gray-800 bg-[#16171a] flex flex-col">
          {/* Chat Header */}
          <div className="p-4 border-b border-gray-800 flex items-center space-x-3 shrink-0">
            <div className="w-8 h-8 bg-[#ff5a5f] rounded-full flex items-center justify-center">
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
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [messages, setMessages] = useState<
    { role: "user" | "model"; text: string }[]
  >([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatSessionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTopic) {
      chatSessionRef.current = createInterviewChatSession(activeTopic);
      setMessages([
        {
          role: "model",
          text: `¡Excelente elección! Vamos a enfocarnos en: **${activeTopic}**.\n\nPara empezar, cuéntame un poco sobre el puesto al que estás postulando o el área en la que trabajas.`,
        },
      ]);
    }
  }, [activeTopic]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userMessage }]);
    setIsLoading(true);

    try {
      const result = await chatSessionRef.current.sendMessage({ message: userMessage });
      setMessages((prev) => [
        ...prev,
        { role: "model", text: result.text },
      ]);
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          text: "Lo siento, hubo un error de conexión. ¿Podrías repetir tu respuesta?",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
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

        <div className="w-full bg-[#222327] rounded-2xl border border-gray-800 overflow-hidden shadow-2xl flex flex-col flex-1 min-h-0">
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
                className={`flex space-x-3 ${msg.role === "user" ? "flex-row-reverse space-x-reverse" : ""}`}
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
    <div className="flex-1 flex flex-col items-center py-12 px-8 max-w-4xl mx-auto w-full mb-20">
      {/* Header */}
      <div className="w-full flex items-center space-x-4 mb-16 bg-[#222327] p-4 rounded-2xl border border-gray-800">
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
        <div className="w-16 h-16 bg-[#ff5a5f] rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(255,90,95,0.3)]">
          <Bot className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-3">
          ¿En qué te ayudo hoy?
        </h1>
        <p className="text-gray-400">
          Elige un tema y MarIA te guiará paso a paso para que llegues preparado
          a tu entrevista.
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-6 w-full mb-12">
        <div
          onClick={() => setActiveTopic("Preparar entrevista")}
          className="bg-[#222327] border border-gray-800 rounded-2xl p-6 hover:border-gray-600 transition-colors cursor-pointer group"
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
          onClick={() => setActiveTopic("Preguntas frecuentes")}
          className="bg-[#222327] border border-gray-800 rounded-2xl p-6 hover:border-gray-600 transition-colors cursor-pointer group"
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
          onClick={() => setActiveTopic("Destacar habilidades")}
          className="bg-[#222327] border border-gray-800 rounded-2xl p-6 hover:border-gray-600 transition-colors cursor-pointer group"
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
          onClick={() => setActiveTopic("Simulación completa")}
          className="bg-[#222327] border border-gray-800 rounded-2xl p-6 hover:border-gray-600 transition-colors cursor-pointer group"
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
      <div className="w-full bg-[#222327] border border-gray-800 rounded-2xl p-6">
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

export default function App() {
  const [currentView, setCurrentView] = useState("landing");
  const [cvKey, setCvKey] = useState(0);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem("nouu-theme") as "dark" | "light") || "dark";
  });
  const [showAuth, setShowAuth] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("nouu-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");

  const handleSetCurrentView = (view: string) => {
    if (view === "cv" && currentView === "cv") {
      setCvKey(prev => prev + 1);
    }
    setCurrentView(view);
    window.scrollTo(0, 0);
  };

  const requireAuth = (view: string) => {
    if (!user) {
      setShowAuth(true);
      return;
    }
    handleSetCurrentView(view);
  };

  const renderView = () => {
    switch (currentView) {
      case "landing":
        return <LandingPage setCurrentView={handleSetCurrentView} />;
      case "cv":
        return <CVGenerator key={cvKey} />;
      case "map":
        return <LaborMap />;
      case "assistant":
        return <Assistant />;
      case "b2b":
        return <B2BLogin />;
      default:
        return <LandingPage setCurrentView={handleSetCurrentView} />;
    }
  };

  return (
    <div className={`min-h-screen font-sans flex flex-col ${theme === "dark" ? "bg-[#16171a] text-white" : "bg-gray-50 text-gray-900"}`}>
      <Header
        currentView={currentView}
        setCurrentView={(v) => {
          // Protected views require auth
          if (["cv", "map", "assistant", "b2b"].includes(v) && !user) {
            setShowAuth(true);
            return;
          }
          handleSetCurrentView(v);
        }}
        theme={theme}
        toggleTheme={toggleTheme}
        onOpenAuth={() => setShowAuth(true)}
      />
      <main className="flex-1 flex flex-col">{renderView()}</main>
      <Footer />
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
}
