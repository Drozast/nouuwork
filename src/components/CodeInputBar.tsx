import React, { useRef } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useChat } from '../lib/chat-context';

const CodeInputBar: React.FC = () => {
  const { showCodeInput, codeMessage, applyingCode, applyDiscountCode, dismissCodeInput } = useChat();
  const inputRef = useRef<HTMLInputElement>(null);

  if (!showCodeInput) return null;

  const handleApply = () => {
    const code = inputRef.current?.value?.trim();
    if (code) applyDiscountCode(code);
  };

  return (
    <div className="px-4 pb-2 shrink-0">
      <div className="bg-gradient-to-r from-yellow-500/10 to-[#f83758]/10 border border-yellow-500/30 rounded-xl p-2.5 flex items-center gap-2">
        <span className="text-yellow-400 text-xs font-medium shrink-0 hidden sm:inline">Premium</span>
        <div className="flex-1">
          <input
            ref={inputRef}
            type="text"
            placeholder="Código de descuento..."
            className="w-full bg-[var(--bg-primary)] border border-yellow-500/20 rounded-lg py-1.5 px-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400 uppercase"
            disabled={applyingCode}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleApply();
            }}
          />
          {codeMessage && (
            <p className={`text-[11px] mt-1 ml-0.5 ${
              codeMessage.toLowerCase().includes('error') || codeMessage.includes('no válido')
                ? 'text-red-400'
                : 'text-green-400'
            }`}>
              {codeMessage}
            </p>
          )}
        </div>
        <button
          onClick={handleApply}
          disabled={applyingCode}
          className="bg-yellow-500 hover:bg-yellow-400 text-black px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors disabled:opacity-50"
        >
          {applyingCode ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Activar'}
        </button>
        <button onClick={dismissCodeInput} className="p-1 text-gray-500 hover:text-white transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default CodeInputBar;
