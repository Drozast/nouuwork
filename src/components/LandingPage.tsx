import { useState, useRef, useEffect, useCallback } from "react";
import {
  FileText, MapIcon, MessageSquare, Building, CheckCircle2,
  Bot, Route, ShieldCheck, Star, Send, Loader2, Sparkles, TrendingUp, X,
} from "lucide-react";
import { createCVChatSession } from "../lib/gemini";
import Markdown from "react-markdown";
import { useAuth } from "../lib/auth";

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
    <div ref={ref} className="text-2xl font-bold text-orange-500 tabular-nums">
      {count}{suffix}
    </div>
  );
}

/* ── Floating particles ── */
function Particles() {
  const dots = [
    { x: "15%", y: "20%", size: 4, dur: "7s", delay: "0s" },
    { x: "80%", y: "15%", size: 6, dur: "9s", delay: "1s" },
    { x: "60%", y: "70%", size: 3, dur: "6s", delay: "2s" },
    { x: "25%", y: "80%", size: 5, dur: "8s", delay: "0.5s" },
    { x: "90%", y: "55%", size: 3, dur: "7.5s", delay: "1.5s" },
    { x: "45%", y: "30%", size: 4, dur: "10s", delay: "3s" },
  ];
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {dots.map((d, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-[#ff5a5f]/30 particle"
          style={{
            left: d.x, top: d.y,
            width: d.size, height: d.size,
            "--dur": d.dur, "--delay": d.delay,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

export const LandingPage = ({ setCurrentView, onOpenAuth }: { setCurrentView: (v: string) => void; onOpenAuth: () => void }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<{ role: "user" | "model"; text: string }[]>([
    { role: "model", text: "¡Hola! Soy MarIA, tu asistente para crear tu CV profesional.\n\nVamos a armarlo paso a paso, solo conversando. No necesitas saber de formato ni de Word.\n\n**¿Cómo te llamas?**" },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showGate, setShowGate] = useState(false);
  const [gateDismissed, setGateDismissed] = useState(false);
  const chatSessionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /* Section refs */
  const [howRef, howInView]       = useInView();
  const [featRef, featInView]     = useInView();
  const [mariaRef, mariaInView]   = useInView();
  const [b2bRef, b2bInView]       = useInView();
  const [ctaRef, ctaInView]       = useInView();

  useEffect(() => {
    try { chatSessionRef.current = createCVChatSession(); }
    catch (e) { console.error("Error initializing chat:", e); }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    const userMessage = input.trim();
    setInput("");
    setMessages(prev => {
      const updated = [...prev, { role: "user" as const, text: userMessage }];
      const newUserCount = updated.filter(m => m.role === "user").length;
      if (newUserCount >= 3 && !user && !gateDismissed) {
        setShowGate(true);
      }
      sessionStorage.setItem("nouu_landing_chat", JSON.stringify(updated));
      return updated;
    });
    setIsLoading(true);
    try {
      const result = await chatSessionRef.current.sendMessage({ message: userMessage });
      setMessages(prev => {
        const updated = [...prev, { role: "model" as const, text: result.text }];
        sessionStorage.setItem("nouu_landing_chat", JSON.stringify(updated));
        return updated;
      });
    } catch {
      setMessages(prev => [...prev, { role: "model", text: "Lo siento, hubo un error. ¿Podrías repetir tu respuesta?" }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, user, gateDismissed]);

  return (
    <div className="flex flex-col min-h-screen bg-[#16171a] text-white overflow-x-hidden">

      {/* ══════════════════════════════════════════
          HERO
      ══════════════════════════════════════════ */}
      <section className="relative px-8 py-24 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
        {/* Background glow */}
        <div className="absolute -top-20 -left-20 w-[600px] h-[600px] hero-glow rounded-full pointer-events-none" />
        <div className="absolute top-1/2 right-0 w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(ellipse at center, rgba(255,138,66,0.08) 0%, transparent 70%)" }} />
        <Particles />

        {/* Left: Text */}
        <div className="relative space-y-7 z-10">
          <div className="animate-fadeInUp delay-100 inline-flex items-center space-x-2 bg-[#ff5a5f]/10 text-[#ff5a5f] px-4 py-1.5 rounded-full text-sm font-medium border border-[#ff5a5f]/20 animate-borderGlow">
            <Sparkles className="w-4 h-4" />
            <span>Ecosistema laboral potenciado por IA</span>
          </div>

          <h1 className="animate-fadeInUp delay-200 text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]">
            Busca,<br />encuentra,<br />
            <span className="gradient-text">trabaja</span>
          </h1>

          <p className="animate-fadeInUp delay-300 text-lg text-gray-300 max-w-md leading-relaxed">
            Crea tu CV profesional conversando con MarIA.{" "}
            <span className="font-bold text-white">Sin saber Word. Sin computador. Solo tú y nuestra IA.</span>
          </p>

          <div className="animate-fadeInUp delay-400 flex flex-wrap gap-5 text-sm text-gray-400">
            {[["100% gratis"], ["Sin registro"], ["Desde tu celular"]].map(([label]) => (
              <div key={label} className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span>{label}</span>
              </div>
            ))}
          </div>

          <div className="animate-fadeInUp delay-500 flex flex-wrap gap-3 pt-2">
            <button
              onClick={() => setCurrentView("cv")}
              className="btn-shimmer text-white px-7 py-3 rounded-xl font-bold shadow-lg shadow-[#ff5a5f]/25 hover:scale-105 transition-transform inline-flex items-center space-x-2"
            >
              <Bot className="w-5 h-5" />
              <span>Hablar con MarIA</span>
            </button>
            <button
              onClick={() => setCurrentView("map")}
              className="bg-[#222327] border border-gray-700 text-white px-7 py-3 rounded-xl font-medium hover:border-gray-500 hover:scale-105 transition-all inline-flex items-center space-x-2"
            >
              <MapIcon className="w-5 h-5" />
              <span>Ver mapa laboral</span>
            </button>
          </div>
        </div>

        {/* Right: Live Chat Widget */}
        <div className="animate-slideInBlur delay-300 relative z-10 bg-[#222327] rounded-2xl border border-gray-800 shadow-2xl flex flex-col animate-pulseGlow" style={{ height: 440 }}>

          {/* 3-message gate overlay */}
          {showGate && !user && (
            <div className="absolute inset-0 z-20 bg-[#16171a]/90 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-8 text-center">
              <div className="w-14 h-14 bg-[#ff5a5f]/10 border border-[#ff5a5f]/30 rounded-2xl flex items-center justify-center mb-5">
                <Bot className="w-7 h-7 text-[#ff5a5f]" />
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
                  className="bg-[#222327] border border-gray-700 text-white py-2.5 px-6 rounded-xl font-medium text-sm hover:border-gray-500 transition-colors"
                >
                  Iniciar sesión
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-4">
                También puedes seguir sin cuenta, pero perderás tu progreso
              </p>
              <button
                onClick={() => { setShowGate(false); setGateDismissed(true); }}
                className="mt-3 text-xs text-[#ff5a5f] hover:underline flex items-center space-x-1"
              >
                <X className="w-3 h-3" />
                <span>Continuar sin guardar</span>
              </button>
            </div>
          )}
          {/* Decorative corner */}
          <div className="absolute -top-2 -right-2 w-20 h-20 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(255,90,95,0.2) 0%, transparent 70%)" }} />

          <div className="flex items-start space-x-4 p-6 pb-4 border-b border-gray-800">
            <div className="relative">
              <div className="animate-float w-10 h-10 bg-[#ff5a5f] rounded-full flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#ff5a5f]/30">
                <Bot className="w-6 h-6 text-white" />
              </div>
              {/* Ripple */}
              <div className="absolute inset-0 rounded-full border border-[#ff5a5f]/30 animate-ping" style={{ animationDuration: "2.5s" }} />
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
                    ? "bg-[#ff5a5f] text-white rounded-br-none shadow-md shadow-[#ff5a5f]/20"
                    : "bg-[#16171a] border border-gray-800 text-gray-300 rounded-tl-none"
                }`}>
                  <Markdown>{msg.text}</Markdown>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start" style={{ animation: "fadeInUp 0.3s ease both" }}>
                <div className="bg-[#16171a] border border-gray-800 rounded-2xl rounded-tl-none p-3 flex space-x-1">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-gray-800">
            <div className="relative">
              <input
                type="text" value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSend()}
                placeholder="Escribe tu respuesta..."
                className="w-full bg-[#16171a] border border-gray-800 rounded-xl py-3 pl-4 pr-12 text-sm text-white focus:outline-none focus:border-[#ff5a5f]/50 transition-colors"
              />
              <button onClick={handleSend} disabled={isLoading || !input.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-[#ff5a5f]/20 text-[#ff5a5f] rounded-lg flex items-center justify-center hover:bg-[#ff5a5f]/40 transition-all hover:scale-110 disabled:opacity-40">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          STATS BAR
      ══════════════════════════════════════════ */}
      <section className="border-y border-gray-800 bg-[#1a1b1e] py-10 px-8">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: 12000, suffix: "+", label: "CVs creados" },
            { value: 340,   suffix: "+", label: "Empresas activas" },
            { value: 94,    suffix: "%", label: "Satisfacción" },
            { value: 8,     suffix: "x", label: "Más rápido que Word" },
          ].map(stat => (
            <div key={stat.label} className="space-y-1">
              <AnimatedCounter target={stat.value} suffix={stat.suffix} />
              <div className="text-xs text-gray-500 uppercase tracking-wider">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════════ */}
      <section ref={howRef} className="py-24 px-8 max-w-7xl mx-auto w-full">
        <div className={`text-center mb-20 ${howInView ? "animate-fadeInUp" : "opacity-0"}`}>
          <span className="text-[#ff5a5f] text-xs font-bold tracking-widest uppercase">Así de fácil</span>
          <h2 className="text-3xl md:text-4xl font-bold mt-3">¿Cómo funciona?</h2>
          <p className="text-gray-500 mt-3 max-w-xl mx-auto text-sm">Tres pasos simples. Sin burocracia. Sin conocimientos previos.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
          {/* Connecting line */}
          <div className={`hidden md:block absolute top-8 left-[20%] right-[20%] h-px transition-all duration-1000 ${howInView ? "opacity-100" : "opacity-0"}`}
            style={{ background: "linear-gradient(90deg, rgba(255,90,95,0.5), rgba(255,138,66,0.3), rgba(255,90,95,0.5))" }} />

          {[
            { icon: Bot,        label: "Conversa con MarIA", desc: "Cuéntale tu experiencia y habilidades. Ella hace las preguntas correctas.", delay: "delay-200" },
            { icon: Route,      label: "Recibe tu ruta",     desc: "MarIA te muestra las empresas más cercanas con vacantes que calzan contigo.", delay: "delay-400" },
            { icon: ShieldCheck,label: "Llega preparado",    desc: "Te entrena para la entrevista y te acompaña en todo el proceso.", delay: "delay-600" },
          ].map(({ icon: Icon, label, desc, delay }, i) => (
            <div key={label} className={`relative z-10 flex flex-col items-center text-center ${howInView ? `animate-fadeInUp ${delay}` : "opacity-0"}`}>
              <div className="relative mb-6">
                <div className="animate-float w-16 h-16 bg-gradient-to-br from-[#ff5a5f] to-[#e62545] rounded-2xl flex items-center justify-center shadow-[0_0_40px_rgba(255,90,95,0.35)]">
                  <Icon className="w-8 h-8 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-[#ff5a5f] rounded-full flex items-center justify-center text-xs font-bold text-white shadow-lg">
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
          FEATURES CARDS
      ══════════════════════════════════════════ */}
      <section ref={featRef} className="bg-[#1a1b1e] py-24 px-8 border-y border-gray-800">
        <div className="max-w-7xl mx-auto">
          <div className={`text-center mb-14 ${featInView ? "animate-fadeInUp" : "opacity-0"}`}>
            <span className="text-[#ff5a5f] text-xs font-bold tracking-widest uppercase">Herramientas</span>
            <h2 className="text-3xl font-bold mt-3">Todo lo que necesitas para encontrar trabajo</h2>
            <p className="text-gray-500 mt-3 max-w-2xl mx-auto text-sm">
              NOUU no asume que sabes armar un CV, redactar ni navegar plataformas complejas. Todo se hace conversando con IA.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                icon: FileText, color: "#ff5a5f", bg: "bg-[#ff5a5f]/10", view: "cv", delay: "delay-100",
                title: "Generador de CV",
                desc: "Chatea con MarIA y ella te arma un CV profesional con formato Harvard. Sin Word, sin computador.",
              },
              {
                icon: MapIcon, color: "#f97316", bg: "bg-orange-500/10", view: "map", delay: "delay-200",
                title: "Mapa Laboral",
                desc: "Como Waze, pero para buscar pega. Empresas cerca tuyo donde puedes dejar tu CV hoy.",
              },
              {
                icon: MessageSquare, color: "#3b82f6", bg: "bg-blue-500/10", view: "assistant", delay: "delay-300",
                title: "Asistente de Entrevista",
                desc: "Te prepara para la entrevista: qué preguntas harán, qué destacar, cómo responder.",
              },
              {
                icon: Building, color: "#22c55e", bg: "bg-green-500/10", view: "b2b", delay: "delay-400",
                title: "Panel para Empresas",
                desc: "Candidatos ya filtrados por IA. Screening automático y ranking de habilidades.",
              },
            ].map(({ icon: Icon, color, bg, view, delay, title, desc }) => (
              <div
                key={view}
                onClick={() => setCurrentView(view)}
                className={`card-hover bg-[#222327] border border-gray-800 rounded-2xl p-6 cursor-pointer ${featInView ? `animate-fadeInUp ${delay}` : "opacity-0"}`}
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
        style={{ background: "linear-gradient(135deg, #ff5a5f 0%, #e62545 40%, #ff8c42 100%)", backgroundSize: "200% 200%", animation: "gradientShift 8s ease infinite" }}
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
            className={`bg-white text-[#ff5a5f] px-10 py-4 rounded-xl font-bold hover:bg-gray-50 hover:scale-105 transition-all inline-flex items-center space-x-2 shadow-2xl shadow-black/30 ${mariaInView ? "animate-fadeInUp delay-500" : "opacity-0"}`}
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
          <span className="text-orange-500 text-xs font-bold tracking-widest uppercase mb-3 block">Para empresas</span>
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            El trabajador perfecto para el{" "}
            <span className="text-orange-500">trabajo perfecto</span>
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
            className="bg-[#ff5a5f] hover:bg-[#ff444a] text-white px-7 py-3 rounded-xl font-medium hover:scale-105 transition-all inline-flex items-center space-x-2 shadow-lg shadow-[#ff5a5f]/20"
          >
            <Building className="w-5 h-5" />
            <span>Ver panel de empresas</span>
            <TrendingUp className="w-4 h-4 ml-1" />
          </button>
        </div>

        {/* Dashboard mockup */}
        <div className={`bg-[#1a1b1e] border border-gray-800 rounded-2xl p-6 shadow-2xl ${b2bInView ? "animate-fadeInRight" : "opacity-0"}`}>
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
              <div key={stat.label} className="bg-[#16171a] p-4 rounded-xl border border-gray-800 text-center hover:border-orange-500/30 transition-colors">
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
                className="bg-[#16171a] p-3 rounded-xl border border-gray-800 flex items-center justify-between hover:border-gray-600 transition-all hover:-translate-y-0.5"
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
      <section ref={ctaRef} className="py-24 px-8 text-center border-t border-gray-800 bg-[#1a1b1e] relative overflow-hidden">
        {/* Background grid */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

        <div className="relative z-10 max-w-3xl mx-auto">
          <div className={ctaInView ? "animate-fadeInUp" : "opacity-0"}>
            <div className="inline-flex items-center space-x-2 bg-[#ff5a5f]/10 text-[#ff5a5f] px-4 py-1.5 rounded-full text-sm font-medium border border-[#ff5a5f]/20 mb-6">
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
              className="btn-shimmer text-white px-10 py-4 rounded-xl font-bold shadow-2xl shadow-[#ff5a5f]/25 hover:scale-105 transition-transform inline-flex items-center space-x-2"
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
