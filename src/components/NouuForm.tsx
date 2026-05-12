import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, Loader2, ArrowLeft, MapPin, Camera, X, CheckCircle2, ChevronDown } from 'lucide-react';
import { useChat } from '../lib/chat-context';
import { useAuth } from '../lib/auth';
import Markdown from 'react-markdown';
import CodeInputBar from './CodeInputBar';
import { auth, db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const API_BASE = import.meta.env.VITE_API_URL || '';

const CATEGORIES = [
  'Hogar y Jardín', 'Limpieza', 'Tecnología', 'Transporte', 'Educación',
  'Mascotas', 'Eventos', 'Salud y Bienestar', 'Arte y Creatividad',
  'Deportes', 'Cocina', 'Reparaciones', 'Otros',
];

interface NouuFormProps {
  onBack: () => void;
}

export const NouuForm: React.FC<NouuFormProps> = ({ onBack }) => {
  const { user } = useAuth();
  const { messages, isLoading, sendMessage, setSessionType } = useChat();
  const [chatInput, setChatInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Form fields
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'transferencia' | 'efectivo'>('efectivo');
  const [scheduledDate, setScheduledDate] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [commune, setCommune] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [showCategory, setShowCategory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSessionType('nouu');
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages]);

  const handleChatSend = () => {
    if (!chatInput.trim() || isLoading) return;
    const msg = chatInput.trim();
    setChatInput('');
    sendMessage(msg);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImages(prev => [...prev, reader.result as string].slice(0, 5));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => alert('No se pudo obtener tu ubicación. Permití el acceso o ingresala manualmente.')
    );
  };

  const handlePublish = async () => {
    if (title.trim().length < 5) {
      alert('El título debe tener al menos 5 caracteres.');
      return;
    }
    if (description.trim().length < 20) {
      alert('La descripción debe tener al menos 20 caracteres.');
      return;
    }
    if (!category) {
      alert('Seleccioná una categoría.');
      return;
    }
    if (!commune.trim()) {
      alert('La comuna es obligatoria.');
      return;
    }
    if (!termsAccepted) {
      alert('Debés aceptar los términos y condiciones.');
      return;
    }
    if (!user) return;

    setPublishing(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const nouuData = {
        type: 'nouu',
        title: title.trim(),
        description: description.trim(),
        category,
        budget: budget ? Number(budget) : null,
        paymentMethod,
        scheduledDate: scheduledDate || null,
        location: location || { lat: -33.4489, lng: -70.6693 },
        address: `${street.trim()} ${number.trim()}, ${commune.trim()}`.trim(),
        city: commune.trim(),
        source: 'app',
        ownerContact: { name: user.displayName || user.email || '' },
        addedBy: user.uid,
        status: 'active',
        applicationCount: 0,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        mediaUrls: images,
      };

      const res = await fetch(`${API_BASE}/api/nouu`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(nouuData),
      });

      if (res.ok) {
        setPublished(true);
      } else {
        const err = await res.json();
        alert(err.error || 'Error al publicar');
      }
    } catch (e) {
      alert('Error de conexión');
    } finally {
      setPublishing(false);
    }
  };

  if (published) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 px-4 max-w-md mx-auto text-center mb-20">
        <div className="w-20 h-20 bg-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-green-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">¡Nouu publicado!</h2>
        <p className="text-gray-400 mb-6">Tu pololo ya está visible en el Mapa Laboral.</p>
        <button onClick={onBack} className="btn-shimmer text-white px-6 py-3 rounded-xl font-bold text-sm hover:scale-105 transition-transform">
          Volver al inicio
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col md:flex-row gap-0 md:gap-6 px-4 md:px-8 py-4 md:py-8 max-w-6xl mx-auto w-full mb-20 h-[calc(100vh-73px)]">
      {/* Form Column */}
      <div className="flex-1 overflow-y-auto pr-0 md:pr-4 space-y-5 pb-4">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={onBack} className="text-gray-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold text-white">Publicar un Nouu</h2>
          <span className="bg-[#f83758]/15 text-[#f83758] text-xs font-bold px-2 py-0.5 rounded-full">Pololos y pegas</span>
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Categoría *</label>
          <div className="relative">
            <button
              onClick={() => setShowCategory(!showCategory)}
              className="w-full bg-[#181818] border border-gray-700 rounded-xl py-2.5 px-4 text-sm text-white flex items-center justify-between focus:outline-none focus:border-[#f83758]"
            >
              <span className={category ? '' : 'text-gray-500'}>{category || 'Seleccionar categoría'}</span>
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </button>
            {showCategory && (
              <div className="absolute z-20 w-full mt-1 bg-[#1f1f1f] border border-gray-700 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                {CATEGORIES.map(c => (
                  <button
                    key={c}
                    onClick={() => { setCategory(c); setShowCategory(false); }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-800 transition-colors ${category === c ? 'text-[#f83758] bg-[#f83758]/10' : 'text-gray-300'}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Título *</label>
          <input
            type="text" value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Ej: Cortar césped en mi jardín"
            className="w-full bg-[#181818] border border-gray-700 rounded-xl py-2.5 px-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#f83758]"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Descripción *</label>
          <textarea
            value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Describe detalladamente el nouu que necesitas..."
            rows={4}
            className="w-full bg-[#181818] border border-gray-700 rounded-xl py-2.5 px-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#f83758] resize-none"
          />
        </div>

        {/* Budget + Payment */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Presupuesto (CLP)</label>
            <input
              type="number" value={budget} onChange={e => setBudget(e.target.value)}
              placeholder="Ej: 25000"
              className="w-full bg-[#181818] border border-gray-700 rounded-xl py-2.5 px-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#f83758]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Método de pago</label>
            <div className="flex gap-2">
              {(['efectivo', 'transferencia'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${
                    paymentMethod === m ? 'bg-[#f83758] text-white' : 'bg-[#181818] border border-gray-700 text-gray-400'
                  }`}
                >
                  {m === 'efectivo' ? 'Efectivo' : 'Transferencia'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Programación</label>
          <input
            type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)}
            className="w-full bg-[#181818] border border-gray-700 rounded-xl py-2.5 px-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#f83758] [color-scheme:dark]"
          />
        </div>

        {/* Address */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Calle</label>
            <input
              type="text" value={street} onChange={e => setStreet(e.target.value)}
              placeholder="Ej: Av. Principal"
              className="w-full bg-[#181818] border border-gray-700 rounded-xl py-2.5 px-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#f83758]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Número</label>
            <input
              type="text" value={number} onChange={e => setNumber(e.target.value)}
              placeholder="123"
              className="w-full bg-[#181818] border border-gray-700 rounded-xl py-2.5 px-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#f83758]"
            />
          </div>
        </div>

        {/* Commune */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Comuna *</label>
          <input
            type="text" value={commune} onChange={e => setCommune(e.target.value)}
            placeholder="Ej: Las Condes, Santiago"
            className="w-full bg-[#181818] border border-gray-700 rounded-xl py-2.5 px-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#f83758]"
          />
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Ubicación</label>
          <button
            onClick={handleGetLocation}
            className="w-full flex items-center gap-2 bg-[#181818] border border-gray-700 rounded-xl py-2.5 px-4 text-sm text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
          >
            <MapPin className="w-4 h-4 text-[#f83758]" />
            {location ? `📍 ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'Usar mi ubicación actual'}
          </button>
        </div>

        {/* Images */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Imágenes</label>
          <div className="flex gap-2 flex-wrap">
            {images.map((img, idx) => (
              <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-700">
                <img src={img} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => removeImage(idx)}
                  className="absolute top-0 right-0 w-5 h-5 bg-red-500 rounded-bl-lg flex items-center justify-center"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
            {images.length < 5 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-700 flex items-center justify-center text-gray-500 hover:border-gray-500 hover:text-gray-300 transition-colors"
              >
                <Camera className="w-5 h-5" />
              </button>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        </div>

        {/* Terms */}
        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={e => setTermsAccepted(e.target.checked)}
            className="mt-1 accent-[#f83758]"
          />
          <span className="text-xs text-gray-400">
            Acepto los <a href="/terminos" className="text-[#f83758] hover:underline">Términos y Condiciones</a> de Nouu
          </span>
        </div>

        {/* Publish Button */}
        <button
          onClick={handlePublish}
          disabled={publishing}
          className="w-full bg-gradient-to-r from-[#f83758] to-[#f83758] hover:from-[#f83758] hover:to-[#d62847] text-white py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.01] disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {publishing ? 'Publicando...' : 'Publicar Nouu'}
        </button>
      </div>

      {/* Chat Column — MarIA */}
      <div className="w-full md:w-80 lg:w-96 bg-[#1f1f1f] border border-gray-800 rounded-2xl flex flex-col overflow-hidden h-[400px] md:h-full shrink-0">
        <div className="flex items-center gap-3 p-4 border-b border-gray-800 shrink-0">
          <div className="w-9 h-9 bg-[#f83758] rounded-full flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-white font-medium text-sm">MarIA</h3>
            <p className="text-xs text-gray-500">Te ayuda a publicar tu Nouu</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[90%] p-2.5 rounded-2xl text-sm ${
                msg.role === 'user'
                  ? 'bg-[#f83758] text-white rounded-br-none'
                  : 'bg-[#222222] border border-gray-800 text-gray-300 rounded-tl-none'
              }`}>
                <Markdown>{msg.text}</Markdown>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-[#222222] p-3 rounded-2xl flex gap-1">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <CodeInputBar />
        <div className="p-3 border-t border-gray-800 shrink-0">
          <div className="relative">
            <input
              type="text" value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleChatSend()}
              placeholder="Pedile ayuda a MarIA..."
              className="w-full bg-[#181818] border border-gray-800 rounded-xl py-2.5 pl-4 pr-10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#f83758]/50"
              disabled={isLoading}
            />
            <button onClick={handleChatSend} disabled={isLoading || !chatInput.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-[#f83758]/20 text-[#f83758] rounded-lg flex items-center justify-center hover:bg-[#f83758]/40 disabled:opacity-40">
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NouuForm;
