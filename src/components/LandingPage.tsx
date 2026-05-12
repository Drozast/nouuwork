import { useState, useRef, useEffect } from "react";
import {
  FileText, MapIcon, MessageSquare, Building, Briefcase, CheckCircle2,
  Bot, Route, ShieldCheck, Star, Send, Loader2, Sparkles, TrendingUp, X,
} from "lucide-react";
import Markdown from "react-markdown";
import { useAuth } from "../lib/auth";
import { useChat } from "../lib/chat-context";
import CodeInputBar from "./CodeInputBar";

/* ── Scroll-reveal hook ── */
function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

/* ── Animated counter ── */
function AnimatedCounter({ target, suffix = "", duration = 1400 }: { target: number; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const [ref, inView] = useInView(0.5);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!inView || startedRef.current) return;
    startedRef.current = true;
    const start = performance.now();
    const tick = (now: number) => {
      const pct = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - pct, 3);
      setCount(Math.round(target * ease));
      if (pct < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, target, duration]);

  return (
    <div ref={ref} className="text-2xl font-bold text-[#f83758] tabular-nums">
      {count}{suffix}
    </div>
  );
}

/* ── FAQ Item ── */
const FaqItem = ({ q, a }: { q: string; a: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-[#222222] border border-gray-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-800/30 transition-colors"
      >
        <span className="text-white text-sm font-medium pr-4">{q}</span>
        <span className={`text-gray-500 text-lg transition-transform shrink-0 ${open ? 'rotate-45' : ''}`}>+</span>
      </button>
      {open && (
        <div className="px-5 pb-4 text-gray-400 text-sm leading-relaxed border-t border-gray-800/50">
          <div className="pt-3">{a}</div>
        </div>
      )}
    </div>
  );
};

export const LandingPage = ({ setCurrentView, onOpenAuth }: { setCurrentView: (v: string) => void; onOpenAuth: () => void }) => {
  const { user } = useAuth();
  const { messages, isLoading, userMessageCount, sendMessage, setSessionType } = useChat();
  const [input, setInput] = useState("");
  const [showGate, setShowGate] = useState(false);
  const [gateDismissed, setGateDismissed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /* Section refs */
  const [howRef, howInView]       = useInView();
  const [featRef, featInView]     = useInView();
  const [mariaRef, mariaInView]   = useInView();
  const [b2bRef, b2bInView]       = useInView();
  const [ctaRef, ctaInView]       = useInView();

  useEffect(() => {
    setSessionType('cv');
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    const userMessage = input.trim();
    setInput("");

    // Auth gate: after 3 user messages without login, show landing gate overlay
    if (!user && !gateDismissed && userMessageCount >= 2) {
      setShowGate(true);
      return;
    }

    sendMessage(userMessage);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#181818] text-white overflow-x-hidden">

      {/* ══════════════════════════════════════════
          HERO
      ══════════════════════════════════════════ */}
      <section className="relative px-8 py-24 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">

        {/* Left: Text */}
        <div className="relative space-y-7 z-10">
          <h1 className="animate-fadeInUp delay-100 text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]">
            Buscar pega<br />
            <span className="text-gray-400">no debería ser</span><br />
            <span className="gradient-text">una pega.</span>
          </h1>

          <p className="animate-fadeInUp delay-200 text-2xl md:text-3xl font-bold text-white">
            Por eso existe <span className="gradient-text">Nouu</span>{" "}
            <img src="/isologo3dnouu.png" alt="Nouu" className="inline-block w-12 h-12 md:w-16 md:h-16 object-contain align-middle animate-float -mt-2" />
          </p>

          <div className="animate-fadeInUp delay-300 space-y-3 text-lg text-gray-300 leading-relaxed">
            <div className="flex items-start gap-3">
              <span className="text-[#f83758] mt-1">→</span>
              <span><span className="font-bold text-white">Habla con MarIA</span> y cuéntale qué buscas: ¿un pololo, una pega o un trabajo formal?</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-[#f83758] mt-1">→</span>
              <span><span className="font-bold text-white">Encuentra pegas y trabajos</span> cerca de ti con el Mapa Laboral</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-[#f83758] mt-1">→</span>
              <span><span className="font-bold text-white">Postula 8x más rápido,</span> sin CV en Word</span>
            </div>
            <div className="flex gap-2 pt-1">
              <span className="bg-[#f83758]/15 text-[#f83758] text-xs font-bold px-2.5 py-0.5 rounded-full border border-[#f83758]/30">Pololos y pegas</span>
              <span className="bg-[#0f70b7]/15 text-[#0f70b7] text-xs font-bold px-2.5 py-0.5 rounded-full border border-[#0f70b7]/30">Trabajos formales</span>
            </div>
          </div>

          <p className="animate-fadeInUp delay-400 text-base text-gray-400">
            La nueva forma de encontrar <span className="text-[#f83758] font-medium">pololos</span> y <span className="text-[#0f70b7] font-medium">trabajos formales</span> en Chile ya está aquí.
          </p>

          <div className="animate-fadeInUp delay-500 flex flex-wrap gap-3 pt-2">
            <button
              onClick={() => setCurrentView("cv")}
              className="btn-shimmer text-white px-7 py-3 rounded-xl font-bold hover:scale-105 transition-transform inline-flex items-center space-x-2"
            >
              <Bot className="w-5 h-5" />
              <span>Hablar con MarIA</span>
            </button>
            <button
              onClick={() => setCurrentView("map")}
              className="bg-[#222222] border border-gray-700 text-white px-7 py-3 rounded-xl font-medium hover:border-gray-500 hover:scale-105 transition-all inline-flex items-center space-x-2"
            >
              <MapIcon className="w-5 h-5" />
              <span>Ver mapa laboral</span>
            </button>
          </div>
        </div>

        {/* Right: Live Chat Widget */}
        <div className="animate-slideInBlur delay-300 relative z-10 bg-[#222222] rounded-2xl border border-gray-800 shadow-2xl flex flex-col" style={{ height: 440 }}>

          {/* 3-message gate overlay */}
          {showGate && !user && (
            <div className="absolute inset-0 z-20 bg-[#181818]/90 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-8 text-center">
              <div className="w-14 h-14 bg-[#f83758]/10 border border-[#f83758]/30 rounded-2xl flex items-center justify-center mb-5">
                <Bot className="w-7 h-7 text-[#f83758]" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Guarda tu progreso</h3>
              <p className="text-sm text-gray-400 mb-6 max-w-xs leading-relaxed">
                Crea una cuenta gratis para no perder tu CV y continuar donde lo dejaste
              </p>
              <div className="flex flex-col gap-3 w-full max-w-xs">
                <button
                  onClick={() => { onOpenAuth(); }}
                  className="btn-shimmer text-white py-2.5 px-6 rounded-xl font-bold text-sm hover:scale-105 transition-transform"
                >
                  Crear cuenta
                </button>
                <button
                  onClick={() => { onOpenAuth(); }}
                  className="bg-[#222222] border border-gray-700 text-white py-2.5 px-6 rounded-xl font-medium text-sm hover:border-gray-500 transition-colors"
                >
                  Iniciar sesión
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-4">
                También puedes seguir sin cuenta, pero perderás tu progreso
              </p>
              <button
                onClick={() => { setShowGate(false); setGateDismissed(true); }}
                className="mt-3 text-xs text-[#f83758] hover:underline flex items-center space-x-1"
              >
                <X className="w-3 h-3" />
                <span>Continuar sin guardar</span>
              </button>
            </div>
          )}

          <div className="flex items-start space-x-4 p-6 pb-4 border-b border-gray-800">
            <div className="relative">
              <div className="w-10 h-10 bg-[#f83758] rounded-full flex items-center justify-center flex-shrink-0">
                <Bot className="w-6 h-6 text-white" />
              </div>
            </div>
            <div>
              <h3 className="font-medium text-white">MarIA</h3>
              <div className="flex items-center space-x-1.5 text-xs text-green-400">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span>En línea ahora</span>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                style={{ animation: "fadeInUp 0.3s ease both" }}>
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                  msg.role === "user"
                    ? "bg-[#f83758] text-white rounded-br-none"
                    : "bg-[#181818] border border-gray-800 text-gray-300 rounded-tl-none"
                }`}>
                  <Markdown>{msg.text}</Markdown>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start" style={{ animation: "fadeInUp 0.3s ease both" }}>
                <div className="bg-[#181818] border border-gray-800 rounded-2xl rounded-tl-none p-3 flex space-x-1">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <CodeInputBar />
          <div className="p-4 border-t border-gray-800">
            <div className="relative">
              <input
                type="text" value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSend()}
                placeholder="Escribe tu respuesta..."
                className="w-full bg-[#181818] border border-gray-800 rounded-xl py-3 pl-4 pr-12 text-sm text-white focus:outline-none focus:border-[#f83758]/50 transition-colors"
                disabled={isLoading}
              />
              <button onClick={handleSend} disabled={isLoading || !input.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-[#f83758]/20 text-[#f83758] rounded-lg flex items-center justify-center hover:bg-[#f83758]/40 transition-all hover:scale-110 disabled:opacity-40">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════════ */}
      <section ref={howRef} className="py-24 px-8 max-w-7xl mx-auto w-full">
        <div className={`text-center mb-20 ${howInView ? "animate-fadeInUp" : "opacity-0"}`}>
          <span className="text-[#f83758] text-xs font-bold tracking-widest uppercase">Así de fácil</span>
          <h2 className="text-3xl md:text-4xl font-bold mt-3">¿Cómo funciona?</h2>
          <p className="text-gray-500 mt-3 max-w-xl mx-auto text-sm">Sin burocracia. Sin CV en Word. Solo tú y MarIA.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 relative">
          {/* Connecting line */}
          <div className={`hidden lg:block absolute top-8 left-[12%] right-[12%] h-px transition-all duration-1000 ${howInView ? "opacity-100" : "opacity-0"}`}
            style={{ background: "linear-gradient(90deg, rgba(248,55,88,0.5), rgba(248,55,88,0.4), rgba(248,55,88,0.4), rgba(248,55,88,0.5))" }} />

          {[
            { icon: MessageSquare, label: "¿Qué buscas?", desc: "¿Un pololo? ¿Una pega? ¿Trabajo formal? Cuéntale a MarIA.", delay: "delay-100" },
            { icon: Bot,           label: "Habla con MarIA", desc: "Ella te guía paso a paso. Sin formularios, sin Word, solo conversando.", delay: "delay-200" },
            { icon: FileText,      label: "Crea tu CV", desc: "MarIA te arma un CV profesional automáticamente con lo que conversaron.", delay: "delay-300" },
            { icon: MapIcon,       label: "Encuentra y postula", desc: "Te muestra pololos y trabajos cerca tuyo. Postula al toque, sin papeles.", delay: "delay-400" },
          ].map(({ icon: Icon, label, desc, delay }, i) => (
            <div key={label} className={`relative z-10 flex flex-col items-center text-center ${howInView ? `animate-fadeInUp ${delay}` : "opacity-0"}`}>
              <div className="relative mb-6">
                <div className="w-16 h-16 bg-[#f83758] rounded-2xl flex items-center justify-center">
                  <Icon className="w-8 h-8 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-[#f83758] rounded-full flex items-center justify-center text-xs font-bold text-white shadow-lg">
                  {i + 1}
                </div>
              </div>
              <h3 className="text-xl font-bold mb-3">{label}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          NOUU vs NOUU WORK — FAQ
      ══════════════════════════════════════════ */}
      <section className="py-24 px-8 max-w-5xl mx-auto w-full">
        <div className="text-center mb-14">
          <span className="text-[#f83758] text-xs font-bold tracking-widest uppercase">¿Qué es qué?</span>
          <h2 className="text-3xl md:text-4xl font-bold mt-3">Nouu y Nouu Work</h2>
          <p className="text-gray-500 mt-3 max-w-xl mx-auto text-sm">Dos formas de encontrar lo que buscas. Simple.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          {/* Nouu Card */}
          <div className="bg-[#222222] border border-[#f83758]/20 rounded-2xl p-7 hover:border-[#f83758]/40 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <img src="/isologo3dnouu.png" alt="Nouu" className="w-8 h-8 object-contain" />
              <h3 className="text-xl font-bold text-white">Nouu</h3>
              <span className="bg-[#f83758]/15 text-[#f83758] text-[10px] font-bold px-2 py-0.5 rounded-full">Pololos y pegas</span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">
              ¿Necesitas a alguien que te corte el pasto, te arregle el computador o te cuide las mascotas? ¿O quieres ganar plata con una pega puntual?
            </p>
            <ul className="space-y-2 text-sm text-gray-400 mb-5">
              <li className="flex items-start gap-2">
                <span className="text-[#f83758] mt-0.5">•</span>
                <span>Trabajos puntuales, por día o por tarea</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#f83758] mt-0.5">•</span>
                <span>Publicá gratis, sin papeles ni requisitos</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#f83758] mt-0.5">•</span>
                <span>13 categorías: Hogar, Tecnología, Mascotas, Eventos y más</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#f83758] mt-0.5">•</span>
                <span>Presupuesto libre, pago en efectivo o transferencia</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#f83758] mt-0.5">•</span>
                <span>Visible por 30 días en el Mapa Laboral</span>
              </li>
            </ul>
            <img src="/isologo3dnouu.png" alt="" className="w-10 h-10 opacity-30" />
          </div>

          {/* Nouu Work Card */}
          <div className="bg-[#222222] border border-[#0f70b7]/20 rounded-2xl p-7 hover:border-[#0f70b7]/40 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-[#0f70b7]/15 rounded-lg flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-[#0f70b7]" />
              </div>
              <h3 className="text-xl font-bold text-white">Nouu Work</h3>
              <span className="bg-[#0f70b7]/15 text-[#0f70b7] text-[10px] font-bold px-2 py-0.5 rounded-full">Trabajos formales</span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">
              ¿Buscas trabajo estable? ¿Tu empresa necesita contratar? Nouu Work conecta empleadores con candidatos mediante IA.
            </p>
            <ul className="space-y-2 text-sm text-gray-400 mb-5">
              <li className="flex items-start gap-2">
                <span className="text-[#0f70b7] mt-0.5">•</span>
                <span>Trabajos formales: full-time, part-time, por contrato</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#0f70b7] mt-0.5">•</span>
                <span>CV profesional creado por MarIA con formato Harvard</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#0f70b7] mt-0.5">•</span>
                <span>Ofertas de empresas reales scrapeadas de portales de empleo</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#0f70b7] mt-0.5">•</span>
                <span>Preparación para entrevistas con IA conversacional</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#0f70b7] mt-0.5">•</span>
                <span>Panel de reclutamiento para empresas con screening automático</span>
              </li>
            </ul>
            <Briefcase className="w-10 h-10 text-[#0f70b7]/30" />
          </div>
        </div>

        {/* FAQ Accordion */}
        <div className="max-w-3xl mx-auto">
          <h3 className="text-xl font-bold text-white text-center mb-8">Preguntas frecuentes</h3>
          <div className="space-y-3">
            {[
              { q: '¿Nouu es gratis?', a: 'Sí. Publicar un Nouu y postular a trabajos es 100% gratis. Sin pagos escondidos.' },
              { q: '¿Necesito crear un CV para publicar un Nouu?', a: 'No. Para los Nouus no necesitas CV. Solo cuéntale a MarIA lo que necesitas y ella te ayuda a publicarlo.' },
              { q: '¿Cómo encuentro trabajos cerca mío?', a: 'Usa el Mapa Laboral. Te muestra tanto Nouus (pololos) como Nouu Work (trabajos formales) cerca de tu ubicación. Puedes filtrar por tipo.' },
              { q: '¿MarIA puede ayudarme con todo?', a: 'Sí. MarIA te ayuda a crear tu CV, encontrar trabajo, prepararte para entrevistas, publicar un Nouu y más. Solo conversationala.' },
              { q: '¿Qué diferencia hay entre Nouu y Nouu Work?', a: 'Nouu es para pegas puntuales e informales (pololos). Nouu Work es para trabajos formales con contrato, CV y postulación tradicional.' },
              { q: '¿Puedo publicar un Nouu desde el celular?', a: 'Claro. La web funciona perfecto en el celular. Solo entra a nouu.cl y publica tu Nouu en minutos.' },
              { q: '¿Mis datos están seguros?', a: 'Sí. Usamos Firebase con encriptación. Solo compartimos la info que vos ponés en tu Nouu o CV público.' },
            ].map((item, i) => (
              <FaqItem key={i} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FEATURES CARDS
      ══════════════════════════════════════════ */}
      <section ref={featRef} className="bg-[#1f1f1f] py-24 px-8 border-y border-gray-800">
        <div className="max-w-7xl mx-auto">
          <div className={`text-center mb-14 ${featInView ? "animate-fadeInUp" : "opacity-0"}`}>
            <span className="text-[#f83758] text-xs font-bold tracking-widest uppercase">Herramientas</span>
            <h2 className="text-3xl font-bold mt-3">Todo lo que necesitas para encontrar trabajo</h2>
            <p className="text-gray-500 mt-3 max-w-2xl mx-auto text-sm">
              NOUU no asume que sabes armar un CV, redactar ni navegar plataformas complejas. Todo se hace conversando con IA.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                icon: FileText, color: "#f83758", bg: "bg-[#f83758]/10", view: "cv", delay: "delay-100",
                title: "Generador de CV",
                desc: "Chatea con MarIA y ella te arma un CV profesional con formato Harvard. Sin Word, sin computador.",
              },
              {
                icon: MapIcon, color: "#f83758", bg: "bg-[#f83758]/10", view: "map", delay: "delay-200",
                title: "Mapa Laboral",
                desc: "Como Waze, pero para buscar pega. Empresas cerca tuyo donde puedes dejar tu CV hoy.",
              },
              {
                icon: MessageSquare, color: "#0f70b7", bg: "bg-[#0f70b7]/10", view: "assistant", delay: "delay-300",
                title: "Asistente de Entrevista",
                desc: "Te prepara para la entrevista: qué preguntas harán, qué destacar, cómo responder.",
              },
              {
                icon: Building, color: "#0f70b7", bg: "bg-[#0f70b7]/10", view: "b2b", delay: "delay-400",
                title: "Panel para Empresas",
                desc: "Candidatos ya filtrados por IA. Screening automático y ranking de habilidades.",
              },
            ].map(({ icon: Icon, color, bg, view, delay, title, desc }) => (
              <div
                key={view}
                onClick={() => setCurrentView(view)}
                className={`card-hover bg-[#222222] border border-gray-800 rounded-2xl p-6 cursor-pointer ${featInView ? `animate-fadeInUp ${delay}` : "opacity-0"}`}
              >
                <div className={`w-11 h-11 ${bg} rounded-xl flex items-center justify-center mb-5 transition-transform group-hover:scale-110`}
                  style={{ color }}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-white mb-2 text-sm">{title}</h3>
                <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
                <div className="mt-4 flex items-center space-x-1 text-xs font-medium" style={{ color }}>
                  <span>Explorar</span>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          MEET MARÍA
      ══════════════════════════════════════════ */}
      <section
        ref={mariaRef}
        className="relative py-24 px-8 text-center overflow-hidden"
        style={{ background: "linear-gradient(135deg, #f83758 0%, #d62847 40%, #f83758 100%)", backgroundSize: "200% 200%", animation: "gradientShift 8s ease infinite" }}
      >
        {/* Decorative blobs */}
        <div className="absolute top-0 left-0 w-64 h-64 rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.05)", transform: "translate(-30%, -30%)" }} />
        <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.05)", transform: "translate(30%, 30%)" }} />

        <div className={`max-w-3xl mx-auto relative z-10 ${mariaInView ? "animate-scaleIn" : "opacity-0"}`}>
          <div className="animate-floatSlow w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-8 backdrop-blur-sm shadow-xl shadow-black/20">
            <Bot className="w-10 h-10 text-white" />
          </div>
          <h2 className={`text-3xl md:text-5xl font-bold text-white mb-6 ${mariaInView ? "animate-fadeInUp delay-200" : "opacity-0"}`}>
            Conoce a MarIA
          </h2>
          <p className={`text-white/90 text-lg mb-12 leading-relaxed ${mariaInView ? "animate-fadeInUp delay-300" : "opacity-0"}`}>
            Tu asistente laboral con inteligencia artificial. Te ayuda a crear tu CV, encontrar trabajo cerca de ti,
            y prepararte para entrevistas.{" "}
            <span className="font-bold bg-white/20 px-2 py-0.5 rounded-lg">Como tener un coach de empleo en tu bolsillo.</span>
          </p>

          <div className={`flex flex-wrap justify-center gap-10 mb-12 ${mariaInView ? "animate-fadeInUp delay-400" : "opacity-0"}`}>
            {[
              { icon: FileText,     label: "Crea tu CV conversando" },
              { icon: Route,        label: "Planifica tu ruta" },
              { icon: MessageSquare,label: "Te prepara para entrevistas" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center group">
                <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mb-3 backdrop-blur-sm group-hover:bg-white/30 transition-all group-hover:scale-110">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <span className="text-sm text-white/90 font-medium">{label}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => setCurrentView("cv")}
            className={`bg-white text-[#f83758] px-10 py-4 rounded-xl font-bold hover:bg-gray-50 hover:scale-105 transition-all inline-flex items-center space-x-2 shadow-2xl shadow-black/30 ${mariaInView ? "animate-fadeInUp delay-500" : "opacity-0"}`}
          >
            <Bot className="w-5 h-5" />
            <span>Hablar con MarIA</span>
          </button>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          B2B SECTION
      ══════════════════════════════════════════ */}
      <section ref={b2bRef} className="py-24 px-8 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        {/* Text */}
        <div className={b2bInView ? "animate-fadeInLeft" : "opacity-0"}>
          <span className="text-[#f83758] text-xs font-bold tracking-widest uppercase mb-3 block">Para empresas</span>
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            El trabajador perfecto para el{" "}
            <span className="text-[#f83758]">trabajo perfecto</span>
          </h2>
          <p className="text-gray-400 mb-8 leading-relaxed">
            Recibe candidatos ya filtrados por IA. Nuestra tecnología hace el screening inicial,
            entrevista conversacional y te recomienda las habilidades clave por puesto.
          </p>
          <ul className="space-y-4 mb-10">
            {[
              "Screening automático vía IA conversacional",
              "Candidatos pre-filtrados y rankeados",
              "Recomendación de habilidades por puesto",
              "Dashboard con métricas en tiempo real",
              "Paga solo por contratación exitosa",
            ].map((item, i) => (
              <li key={item} className="flex items-center space-x-3"
                style={{ animation: b2bInView ? `fadeInLeft 0.5s ${0.1 + i * 0.1}s both` : "none" }}>
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                <span className="text-gray-300 text-sm">{item}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={() => setCurrentView("b2b")}
            className="bg-[#f83758] hover:bg-[#d62847] text-white px-7 py-3 rounded-xl font-medium hover:scale-105 transition-all inline-flex items-center space-x-2"
          >
            <Building className="w-5 h-5" />
            <span>Ver panel de empresas</span>
            <TrendingUp className="w-4 h-4 ml-1" />
          </button>
        </div>

        {/* Dashboard mockup */}
        <div className={`bg-[#1f1f1f] border border-gray-800 rounded-2xl p-6 shadow-2xl ${b2bInView ? "animate-fadeInRight" : "opacity-0"}`}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-white">Panel de Reclutamiento</h3>
            <div className="flex items-center space-x-1.5 bg-green-500/10 text-green-400 text-xs px-3 py-1 rounded-full border border-green-500/20">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              <span>En vivo</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { value: 47, label: "Candidatos hoy" },
              { value: 23, label: "Entrevistas IA" },
              { value: 8,  label: "Contratados" },
            ].map(stat => (
              <div key={stat.label} className="bg-[#181818] p-4 rounded-xl border border-gray-800 text-center hover:border-[#f83758]/30 transition-colors">
                <AnimatedCounter target={stat.value} duration={1200} />
                <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {[
              { initials: "M", name: "María González", role: "Cajera",     score: 94, status: "Entrevistado", color: "blue" },
              { initials: "P", name: "Pedro Muñoz",    role: "Bodeguero",  score: 88, status: "En proceso",   color: "purple" },
              { initials: "A", name: "Ana Reyes",      role: "Reponedora", score: 82, status: "Nuevo",        color: "orange" },
            ].map(({ initials, name, role, score, status, color }, i) => (
              <div
                key={name}
                className="bg-[#181818] p-3 rounded-xl border border-gray-800 flex items-center justify-between hover:border-gray-600 transition-all hover:-translate-y-0.5"
                style={{ animation: b2bInView ? `fadeInUp 0.5s ${0.2 + i * 0.1}s both` : "none" }}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-9 h-9 bg-${color}-500/20 text-${color}-400 rounded-full flex items-center justify-center text-xs font-bold`}>
                    {initials}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">{name}</div>
                    <div className="text-xs text-gray-500">{role}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-green-400 text-sm font-bold">{score}%</span>
                  <span className="bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded-lg">{status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          CTA FINAL
      ══════════════════════════════════════════ */}
      <section ref={ctaRef} className="py-24 px-8 text-center border-t border-gray-800 bg-[#1f1f1f] relative overflow-hidden">
        {/* Background grid */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

        <div className="relative z-10 max-w-3xl mx-auto">
          <div className={ctaInView ? "animate-fadeInUp" : "opacity-0"}>
            <div className="inline-flex items-center space-x-2 bg-[#f83758]/10 text-[#f83758] px-4 py-1.5 rounded-full text-sm font-medium border border-[#f83758]/20 mb-6">
              <Star className="w-4 h-4" />
              <span>Gratuito para siempre</span>
            </div>
          </div>
          <h2 className={`text-3xl md:text-5xl font-bold mb-5 ${ctaInView ? "animate-fadeInUp delay-100" : "opacity-0"}`}>
            ¿Listo para encontrar tu{" "}
            <span className="gradient-text">próximo trabajo</span>?
          </h2>
          <p className={`text-gray-400 mb-10 max-w-xl mx-auto leading-relaxed ${ctaInView ? "animate-fadeInUp delay-200" : "opacity-0"}`}>
            Crea tu CV en minutos, encuentra empresas cerca de ti y llega preparado a tu entrevista.
            Todo gratis, todo con IA.
          </p>
          <div className={`flex flex-wrap justify-center gap-4 ${ctaInView ? "animate-fadeInUp delay-300" : "opacity-0"}`}>
            <button
              onClick={() => setCurrentView("cv")}
              className="btn-shimmer text-white px-10 py-4 rounded-xl font-bold hover:scale-105 transition-transform inline-flex items-center space-x-2"
            >
              <Star className="w-5 h-5" />
              <span>Empezar ahora — es gratis</span>
            </button>
            <button
              onClick={() => setCurrentView("map")}
              className="bg-transparent border border-gray-600 text-white px-8 py-4 rounded-xl font-medium hover:border-gray-400 hover:scale-105 transition-all inline-flex items-center space-x-2"
            >
              <MapIcon className="w-5 h-5" />
              <span>Ver el mapa</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
