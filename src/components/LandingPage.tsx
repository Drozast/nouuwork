import { useState, useRef, useEffect } from "react";
import { FileText, MapIcon, MessageSquare, Building, CheckCircle2, Bot, Route, ShieldCheck, Star, Send, Loader2 } from "lucide-react";
import { createCVChatSession } from "../lib/gemini";
import Markdown from "react-markdown";

export const LandingPage = ({ setCurrentView }: { setCurrentView: (v: string) => void }) => {
  const [messages, setMessages] = useState<{ role: "user" | "model"; text: string }[]>([
    { role: "model", text: "¡Hola! Soy MarIA, tu asistente para crear tu CV profesional.\n\nVamos a armarlo paso a paso, solo conversando. No necesitas saber de formato ni de Word.\n\n**¿Cómo te llamas?**" },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatSessionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      chatSessionRef.current = createCVChatSession();
    } catch (e) {
      console.error("Error initializing chat:", e);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: userMessage }]);
    setIsLoading(true);
    try {
      const result = await chatSessionRef.current.sendMessage({ message: userMessage });
      setMessages(prev => [...prev, { role: "model", text: result.text }]);
    } catch {
      setMessages(prev => [...prev, { role: "model", text: "Lo siento, hubo un error. ¿Podrías repetir tu respuesta?" }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#16171a] text-white">
      {/* Hero Section */}
      <section className="px-8 py-20 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="space-y-6">
          <div className="inline-flex items-center space-x-2 bg-[#ff5a5f]/10 text-[#ff5a5f] px-3 py-1 rounded-full text-sm font-medium border border-[#ff5a5f]/20">
            <Bot className="w-4 h-4" />
            <span>Ecosistema laboral potenciado por IA</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight">
            Busca,<br />encuentra,<br /><span className="text-[#ff5a5f]">trabaja</span>
          </h1>
          <p className="text-lg text-gray-300 max-w-md">
            Crea tu CV profesional conversando con MarIA. <span className="font-bold text-white">Sin saber Word. Sin computador. Solo tú y nuestra IA.</span>
          </p>
          <div className="flex flex-wrap gap-4 text-sm text-gray-400">
            <div className="flex items-center space-x-1">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>100% gratis</span>
            </div>
            <div className="flex items-center space-x-1">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>Sin registro</span>
            </div>
            <div className="flex items-center space-x-1">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>Desde tu celular</span>
            </div>
          </div>
        </div>
        <div className="bg-[#222327] rounded-2xl border border-gray-800 shadow-2xl relative flex flex-col" style={{ height: 420 }}>
          {/* Header */}
          <div className="flex items-start space-x-4 p-6 pb-4 border-b border-gray-800">
            <div className="w-10 h-10 bg-[#ff5a5f] rounded-full flex items-center justify-center flex-shrink-0">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-medium text-white">MarIA</h3>
              <div className="flex items-center space-x-1 text-xs text-green-500">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>En línea</span>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                  msg.role === "user"
                    ? "bg-[#ff5a5f] text-white rounded-br-none"
                    : "bg-[#16171a] border border-gray-800 text-gray-300 rounded-tl-none"
                }`}>
                  <Markdown>{msg.text}</Markdown>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-[#16171a] border border-gray-800 rounded-2xl rounded-tl-none p-3">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-800">
            <div className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Escribe tu respuesta..."
                className="w-full bg-[#16171a] border border-gray-800 rounded-xl py-3 pl-4 pr-12 text-sm text-white focus:outline-none focus:border-gray-600"
              />
              <button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-[#ff5a5f]/20 text-[#ff5a5f] rounded-lg flex items-center justify-center hover:bg-[#ff5a5f]/30 transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-8 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-orange-500 text-xs font-bold tracking-wider uppercase">Así de fácil</span>
          <h2 className="text-3xl font-bold mt-2">¿Cómo funciona?</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
          <div className="hidden md:block absolute top-8 left-[15%] right-[15%] h-[1px] bg-gray-800 z-0"></div>
          
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-[#ff5a5f] rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(255,90,95,0.3)]">
              <Bot className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-3">Conversa con MarIA</h3>
            <p className="text-gray-400 text-sm">Cuéntale tu experiencia, habilidades y qué trabajo buscas. Ella hace el resto.</p>
          </div>
          
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-[#ff5a5f] rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(255,90,95,0.3)]">
              <Route className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-3">Recibe tu ruta</h3>
            <p className="text-gray-400 text-sm">MarIA te muestra las empresas más cercanas con vacantes que calzan contigo.</p>
          </div>
          
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-[#ff5a5f] rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(255,90,95,0.3)]">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-3">Llega preparado</h3>
            <p className="text-gray-400 text-sm">Te entrena para la entrevista y te acompaña en todo el proceso de postulación.</p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-[#1a1b1e] py-20 px-8 border-y border-gray-800">
        <div className="max-w-7xl mx-auto">
          <p className="text-center text-gray-400 mb-12 max-w-2xl mx-auto">
            NOUU no asume que sabes armar un CV, redactar ni navegar plataformas complejas. Todo se hace conversando con IA.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-[#222327] border border-gray-800 rounded-2xl p-6 hover:border-gray-600 transition-colors cursor-pointer" onClick={() => setCurrentView('cv')}>
              <div className="w-10 h-10 bg-[#ff5a5f]/20 text-[#ff5a5f] rounded-xl flex items-center justify-center mb-4">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white mb-2">Generador de CV</h3>
              <p className="text-sm text-gray-400">Chatea con MarIA y ella te arma un CV profesional con formato Harvard. Sin saber Word, sin computador — solo conversando.</p>
            </div>
            <div className="bg-[#222327] border border-gray-800 rounded-2xl p-6 hover:border-gray-600 transition-colors cursor-pointer" onClick={() => setCurrentView('map')}>
              <div className="w-10 h-10 bg-orange-500/20 text-orange-500 rounded-xl flex items-center justify-center mb-4">
                <MapIcon className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white mb-2">Mapa Laboral</h3>
              <p className="text-sm text-gray-400">Como Waze, pero para buscar pega. Te muestra las empresas cerca de ti donde puedes dejar tu CV hoy, con la ruta óptima.</p>
            </div>
            <div className="bg-[#222327] border border-gray-800 rounded-2xl p-6 hover:border-gray-600 transition-colors cursor-pointer" onClick={() => setCurrentView('assistant')}>
              <div className="w-10 h-10 bg-blue-500/20 text-blue-500 rounded-xl flex items-center justify-center mb-4">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white mb-2">Asistente de Entrevista</h3>
              <p className="text-sm text-gray-400">Te prepara para la entrevista: qué preguntas te harán, qué habilidades destacar, cómo responder según el puesto.</p>
            </div>
            <div className="bg-[#222327] border border-gray-800 rounded-2xl p-6 hover:border-gray-600 transition-colors cursor-pointer" onClick={() => setCurrentView('b2b')}>
              <div className="w-10 h-10 bg-green-500/20 text-green-500 rounded-xl flex items-center justify-center mb-4">
                <Building className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white mb-2">Panel para Empresas</h3>
              <p className="text-sm text-gray-400">Recibe prospectos ya filtrados por IA. Screening conversacional automático y recomendación de habilidades por puesto.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Meet MarIA */}
      <section className="bg-gradient-to-br from-[#ff5a5f] to-[#ff8a8f] py-20 px-8 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6 backdrop-blur-sm">
            <Bot className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Conoce a MarIA</h2>
          <p className="text-white/90 text-lg mb-10">
            Tu asistente laboral con inteligencia artificial. Te ayuda a crear tu CV, encontrar trabajo cerca de ti, y prepararte para entrevistas. <span className="font-bold">Como tener un coach de empleo en tu bolsillo.</span>
          </p>
          <div className="flex flex-wrap justify-center gap-8 mb-10">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-3 backdrop-blur-sm">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm text-white/90">Crea tu CV conversando</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-3 backdrop-blur-sm">
                <Route className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm text-white/90">Planifica tu ruta de postulación</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-3 backdrop-blur-sm">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm text-white/90">Te prepara para entrevistas</span>
            </div>
          </div>
          <button 
            onClick={() => setCurrentView('cv')}
            className="bg-white text-[#ff5a5f] px-8 py-3 rounded-xl font-bold hover:bg-gray-50 transition-colors inline-flex items-center space-x-2 shadow-lg"
          >
            <Bot className="w-5 h-5" />
            <span>Hablar con MarIA</span>
          </button>
        </div>
      </section>

      {/* B2B Section */}
      <section className="py-20 px-8 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div>
          <span className="text-orange-500 text-xs font-bold tracking-wider uppercase mb-2 block">Para empresas</span>
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            El trabajador perfecto para el <span className="text-orange-500">trabajo perfecto</span>
          </h2>
          <p className="text-gray-400 mb-8">
            Recibe candidatos ya filtrados por IA. Nuestra tecnología hace el screening inicial, entrevista conversacional y te recomienda qué habilidades deberías pedir según el puesto.
          </p>
          <ul className="space-y-4 mb-8">
            <li className="flex items-center space-x-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
              <span className="text-gray-300">Screening automático vía IA conversacional</span>
            </li>
            <li className="flex items-center space-x-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
              <span className="text-gray-300">Candidatos pre-filtrados y rankeados</span>
            </li>
            <li className="flex items-center space-x-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
              <span className="text-gray-300">Recomendación de habilidades por puesto</span>
            </li>
            <li className="flex items-center space-x-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
              <span className="text-gray-300">Dashboard con métricas en tiempo real</span>
            </li>
            <li className="flex items-center space-x-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
              <span className="text-gray-300">Paga solo por contratación exitosa</span>
            </li>
          </ul>
          <button 
            onClick={() => setCurrentView('b2b')}
            className="bg-[#ff5a5f] hover:bg-[#ff444a] text-white px-6 py-3 rounded-xl font-medium transition-colors inline-flex items-center space-x-2"
          >
            <Building className="w-5 h-5" />
            <span>Ver panel de empresas</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </button>
        </div>
        <div className="bg-[#1a1b1e] border border-gray-800 rounded-2xl p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-white">Panel de Reclutamiento</h3>
            <div className="bg-green-500/10 text-green-500 text-xs px-2 py-1 rounded-md">En vivo</div>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-[#16171a] p-4 rounded-xl border border-gray-800 text-center">
              <div className="text-2xl font-bold text-orange-500">47</div>
              <div className="text-xs text-gray-500 mt-1">Candidatos hoy</div>
            </div>
            <div className="bg-[#16171a] p-4 rounded-xl border border-gray-800 text-center">
              <div className="text-2xl font-bold text-orange-500">23</div>
              <div className="text-xs text-gray-500 mt-1">Entrevistas IA</div>
            </div>
            <div className="bg-[#16171a] p-4 rounded-xl border border-gray-800 text-center">
              <div className="text-2xl font-bold text-orange-500">8</div>
              <div className="text-xs text-gray-500 mt-1">Contratados</div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="bg-[#16171a] p-3 rounded-xl border border-gray-800 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-500/20 text-blue-500 rounded-full flex items-center justify-center text-xs font-bold">M</div>
                <div>
                  <div className="text-sm font-medium text-white">María González</div>
                  <div className="text-xs text-gray-500">Cajera</div>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-green-500 text-sm font-bold">94%</span>
                <span className="bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded-md">Entrevistado</span>
              </div>
            </div>
            <div className="bg-[#16171a] p-3 rounded-xl border border-gray-800 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-purple-500/20 text-purple-500 rounded-full flex items-center justify-center text-xs font-bold">P</div>
                <div>
                  <div className="text-sm font-medium text-white">Pedro Muñoz</div>
                  <div className="text-xs text-gray-500">Bodeguero</div>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-green-500 text-sm font-bold">88%</span>
                <span className="bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded-md">En proceso</span>
              </div>
            </div>
            <div className="bg-[#16171a] p-3 rounded-xl border border-gray-800 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-orange-500/20 text-orange-500 rounded-full flex items-center justify-center text-xs font-bold">A</div>
                <div>
                  <div className="text-sm font-medium text-white">Ana Reyes</div>
                  <div className="text-xs text-gray-500">Reponedora</div>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-green-500 text-sm font-bold">82%</span>
                <span className="bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded-md">Nuevo</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-8 text-center border-t border-gray-800 bg-[#1a1b1e]">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">¿Listo para encontrar tu <span className="text-orange-500">próximo trabajo</span>?</h2>
        <p className="text-gray-400 mb-8 max-w-2xl mx-auto">
          Crea tu CV en minutos, encuentra empresas cerca de ti y llega preparado a tu entrevista. Todo gratis, todo con IA.
        </p>
        <button 
          onClick={() => setCurrentView('cv')}
          className="bg-[#ff5a5f] hover:bg-[#ff444a] text-white px-8 py-4 rounded-xl font-bold transition-colors inline-flex items-center space-x-2 shadow-lg shadow-[#ff5a5f]/20"
        >
          <Star className="w-5 h-5" />
          <span>Empezar ahora — es gratis</span>
        </button>
      </section>
    </div>
  );
};
