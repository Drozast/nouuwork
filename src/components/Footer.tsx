import { FileText, MapIcon, MessageSquare, Building } from "lucide-react";
import { NouuLogo } from "./NouuLogo";

interface FooterProps {
  setCurrentView?: (v: string) => void;
}

export const Footer = ({ setCurrentView }: FooterProps) => {
  const nav = (v: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setCurrentView?.(v);
    window.scrollTo(0, 0);
  };

  return (
    <footer className="bg-[#0077cc] text-white py-12 px-8">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="space-y-4">
          <NouuLogo className="text-2xl" />
          <p className="text-sm text-blue-100">
            El primer ecosistema laboral de LATAM potenciado por IA. Busca, encuentra, trabaja.
          </p>
          <div className="flex space-x-2">
            {["F", "I", "L", "T"].map(l => (
              <button key={l} className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center hover:bg-blue-700 transition-colors">
                <span className="font-bold text-sm">{l}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-bold mb-4">PLATAFORMA</h3>
          <ul className="space-y-2 text-sm text-blue-100">
            <li><a href="#" onClick={nav("cv")} className="hover:text-white flex items-center space-x-2"><FileText className="w-4 h-4" /><span>Crear CV</span></a></li>
            <li><a href="#" onClick={nav("map")} className="hover:text-white flex items-center space-x-2"><MapIcon className="w-4 h-4" /><span>Mapa Laboral</span></a></li>
            <li><a href="#" onClick={nav("assistant")} className="hover:text-white flex items-center space-x-2"><MessageSquare className="w-4 h-4" /><span>Asistente IA</span></a></li>
            <li><a href="#" onClick={nav("b2b")} className="hover:text-white flex items-center space-x-2"><Building className="w-4 h-4" /><span>Para Empresas</span></a></li>
          </ul>
        </div>

        <div>
          <h3 className="font-bold mb-4">LEGAL</h3>
          <ul className="space-y-2 text-sm text-blue-100">
            <li><a href="#" onClick={nav("terminos")} className="hover:text-white">Términos de uso</a></li>
            <li><a href="#" onClick={nav("privacidad")} className="hover:text-white">Política de privacidad</a></li>
            <li><a href="#" onClick={nav("privacidad")} className="hover:text-white">Protección de datos (Ley 21.719)</a></li>
          </ul>
        </div>

        <div>
          <h3 className="font-bold mb-4">MANTENTE INFORMADO</h3>
          <p className="text-sm text-blue-100 mb-4">Recibe las mejores ofertas laborales en tu correo.</p>
          <div className="flex space-x-2">
            <input
              type="email" placeholder="Tu email"
              className="bg-blue-600 border border-blue-500 text-white px-3 py-2 rounded-lg text-sm flex-1 focus:outline-none focus:border-white"
            />
            <button className="bg-[#ff5a5f] hover:bg-[#ff444a] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              Enviar
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-blue-500 flex flex-col md:flex-row justify-between items-center text-sm text-blue-200">
        <p>© 2026 NOUU SpA. Todos los derechos reservados. Santiago, Chile.</p>
        <div className="flex space-x-4 mt-4 md:mt-0">
          <a href="#" onClick={nav("privacidad")} className="hover:text-white transition-colors">Privacidad</a>
          <a href="#" onClick={nav("terminos")} className="hover:text-white transition-colors">Términos</a>
        </div>
      </div>
    </footer>
  );
};
