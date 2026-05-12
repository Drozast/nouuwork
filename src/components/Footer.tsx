import { FileText, MapIcon, MessageSquare, Building, Mail, Instagram, Linkedin, Facebook, Twitter } from "lucide-react";
import { NouuLogo } from "./NouuLogo";
import { useState } from "react";

interface FooterProps {
  setCurrentView?: (v: string) => void;
}

export const Footer = ({ setCurrentView }: FooterProps) => {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const nav = (v: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setCurrentView?.(v);
    window.scrollTo(0, 0);
  };

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubscribed(true);
      setEmail("");
    }
  };

  return (
    <footer className="bg-[#111111] border-t border-gray-800 text-white">
      {/* Main grid */}
      <div className="max-w-7xl mx-auto px-8 py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">

        {/* Brand */}
        <div className="space-y-5 lg:col-span-1">
          <NouuLogo className="text-2xl" />
          <p className="text-sm text-gray-400 leading-relaxed">
            El primer ecosistema laboral de Chile potenciado por IA. Busca pololos, encuentra trabajo formal, postula más rápido.
          </p>
          <div className="flex space-x-2">
            {[
              { icon: Instagram, label: "Instagram" },
              { icon: Linkedin,  label: "LinkedIn" },
              { icon: Facebook,  label: "Facebook" },
              { icon: Twitter,   label: "X / Twitter" },
            ].map(({ icon: Icon, label }) => (
              <button
                key={label}
                aria-label={label}
                className="w-9 h-9 bg-[#222222] border border-gray-700 rounded-lg flex items-center justify-center hover:border-[#f83758]/50 hover:bg-[#f83758]/10 transition-all"
              >
                <Icon className="w-4 h-4 text-gray-400 hover:text-[#f83758]" />
              </button>
            ))}
          </div>
        </div>

        {/* Plataforma */}
        <div>
          <h3 className="font-bold text-white text-sm mb-5 tracking-wider uppercase">Plataforma</h3>
          <ul className="space-y-3 text-sm">
            {[
              { icon: FileText,     label: "Crear CV con MarIA", view: "cv" },
              { icon: MapIcon,      label: "Mapa Laboral",       view: "map" },
              { icon: MessageSquare,label: "Asistente IA",       view: "assistant" },
              { icon: Building,     label: "Para Empresas",      view: "b2b" },
            ].map(({ icon: Icon, label, view }) => (
              <li key={view}>
                <a
                  href="#"
                  onClick={nav(view)}
                  className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors group"
                >
                  <Icon className="w-4 h-4 text-gray-600 group-hover:text-[#f83758] transition-colors" />
                  <span>{label}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Legal */}
        <div>
          <h3 className="font-bold text-white text-sm mb-5 tracking-wider uppercase">Legal</h3>
          <ul className="space-y-3 text-sm">
            <li>
              <a href="#" onClick={nav("terminos")} className="text-gray-400 hover:text-white transition-colors">
                Términos de uso
              </a>
            </li>
            <li>
              <a href="#" onClick={nav("privacidad")} className="text-gray-400 hover:text-white transition-colors">
                Política de privacidad
              </a>
            </li>
            <li>
              <a href="#" onClick={nav("privacidad")} className="text-gray-400 hover:text-white transition-colors flex items-start gap-1.5">
                <span>Protección de datos</span>
                <span className="text-[10px] bg-[#f83758]/15 text-[#f83758] border border-[#f83758]/30 px-1.5 py-0.5 rounded-full font-bold whitespace-nowrap">Ley 21.719</span>
              </a>
            </li>
            <li>
              <a href="mailto:privacidad@nouu.cl" className="text-gray-400 hover:text-white transition-colors flex items-center gap-2">
                <Mail className="w-3.5 h-3.5" />
                privacidad@nouu.cl
              </a>
            </li>
          </ul>
        </div>

        {/* Newsletter */}
        <div>
          <h3 className="font-bold text-white text-sm mb-5 tracking-wider uppercase">Novedades</h3>
          <p className="text-sm text-gray-400 mb-4 leading-relaxed">
            Recibe las mejores ofertas laborales y novedades de Nouu.
          </p>
          {subscribed ? (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-sm text-green-400 text-center">
              ¡Listo! Te avisamos cuando haya novedades.
            </div>
          ) : (
            <form onSubmit={handleSubscribe} className="space-y-2">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.cl"
                className="w-full bg-[#1a1a1a] border border-gray-700 text-white placeholder-gray-600 px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-[#f83758]/50 transition-colors"
              />
              <button
                type="submit"
                className="w-full bg-[#f83758] hover:bg-[#d62847] text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                Suscribirme
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-8 py-5 flex flex-col md:flex-row justify-between items-center gap-3 text-xs text-gray-500">
          <p>© 2026 NOUU SpA. Todos los derechos reservados. Santiago, Chile.</p>
          <div className="flex items-center gap-5">
            <a href="#" onClick={nav("privacidad")} className="hover:text-white transition-colors">Privacidad</a>
            <a href="#" onClick={nav("terminos")}   className="hover:text-white transition-colors">Términos</a>
            <span className="text-gray-700">·</span>
            <span>Ley 21.719 compliant</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
