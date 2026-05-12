import React from 'react';
import { Bot, Briefcase, MapIcon, MessageSquare } from 'lucide-react';

interface PublishChoiceProps {
  onSelect: (type: 'nouu' | 'nouuwork') => void;
}

export const PublishChoice: React.FC<PublishChoiceProps> = ({ onSelect }) => (
  <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 max-w-3xl mx-auto w-full mb-20">
    <div className="animate-fadeInUp text-center space-y-8 w-full">
      {/* Header */}
      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-white">Publicar</h2>
        <p className="text-gray-400 mt-2">¿Qué querés publicar?</p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto w-full">
        {/* Nouu Card */}
        <button
          onClick={() => onSelect('nouu')}
          className="bg-[#222222] border border-[#f83758]/30 hover:border-[#f83758]/60 rounded-2xl p-8 text-left transition-all hover:scale-[1.02] group"
        >
          <div className="w-14 h-14 bg-[#f83758]/15 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-[#f83758]/25 transition-colors">
            <MessageSquare className="w-7 h-7 text-[#f83758]" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Publicar un Nouu</h3>
          <p className="text-sm text-gray-400 leading-relaxed mb-3">
            ¿Un pololo? ¿Una pega? Publicá gratis y encontrá a alguien cerca tuyo.
          </p>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-[#f83758] group-hover:text-[#f83758]">
            <Bot className="w-4 h-4" />
            MarIA te ayuda
          </span>
        </button>

        {/* Nouu Work Card */}
        <button
          onClick={() => onSelect('nouuwork')}
          className="bg-[#222222] border border-[#0f70b7]/30 hover:border-[#0f70b7]/60 rounded-2xl p-8 text-left transition-all hover:scale-[1.02] group"
        >
          <div className="w-14 h-14 bg-[#0f70b7]/15 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-[#0f70b7]/25 transition-colors">
            <Briefcase className="w-7 h-7 text-[#0f70b7]" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Publicar Nouu Work</h3>
          <p className="text-sm text-gray-400 leading-relaxed mb-3">
            ¿Trabajo formal? Creá una oferta para tu empresa y encontrá al candidato ideal.
          </p>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-[#0f70b7] group-hover:text-[#0f70b7]">
            <MapIcon className="w-4 h-4" />
            Aparece en el Mapa Laboral
          </span>
        </button>
      </div>
    </div>
  </div>
);

export default PublishChoice;
