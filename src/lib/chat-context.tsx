/**
 * Global ChatContext — one persistent MarIA conversation across all views.
 * The session type (cv / map / interview) changes per view but the history is shared.
 * Messages survive view-switches via sessionStorage; cleared only on clearChat().
 *
 * Auth gate: after 2 user messages without a logged-in account, sendMessage
 * calls onNeedAuth() instead of making the API request.
 */
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { auth } from './firebase';

const API_BASE = import.meta.env.VITE_API_URL || '';
const STORAGE_KEY = 'nouu_maria_chat';
const FREE_MESSAGES = 2; // user messages allowed without auth

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

interface ChatContextType {
  messages: ChatMessage[];
  isLoading: boolean;
  sessionType: string;
  userMessageCount: number;
  setSessionType: (type: string, context?: string) => void;
  sendMessage: (message: string, contextOverride?: string) => Promise<void>;
  clearChat: () => void;
  showCodeInput: boolean;
  codeMessage: string;
  applyingCode: boolean;
  applyDiscountCode: (code: string) => Promise<void>;
  dismissCodeInput: () => void;
}

const DEFAULT_GREETING: ChatMessage = {
  role: 'model',
  text: '¡Hola! Soy **MarIA**, tu asistente laboral ⚡\n\nEn NOUU puedes encontrar dos tipos de trabajo:\n\n🔴 **Nouus (pololitos):** trabajos informales, freelance o servicios puntuales. Puedes publicar uno o postularte al de otra persona. Se ven como marcadores rojos en el Mapa Laboral.\n\n🔵 **Nouu Work:** trabajos formales con empresas (full-time, part-time, contrato). Tienen sueldo y requisitos. Se ven como marcadores azules en el Mapa Laboral.\n\nPuedes crear tu CV, buscar trabajo cerca tuyo, publicar una pega formal o un pololo.\n\n**¡Cuéntame y te ayudo!** 💬',
};

const ChatContext = createContext<ChatContextType | null>(null);

// Global auth gate callback — set by ChatProvider, called when user hits the limit
let _onNeedAuth: (() => void) | null = null;

export const setAuthGateCallback = (cb: () => void) => { _onNeedAuth = cb; };

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /* ignore */ }
    return [DEFAULT_GREETING];
  });

  const [isLoading, setIsLoading] = useState(false);
  const [sessionType, _setSessionType] = useState('cv');
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [codeMessage, setCodeMessage] = useState('');
  const [applyingCode, setApplyingCode] = useState(false);
  // Count user messages sent this session (reset on clearChat)
  const [userMessageCount, setUserMessageCount] = useState(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as ChatMessage[];
        return parsed.filter(m => m.role === 'user').length;
      }
    } catch { /* ignore */ }
    return 0;
  });

  const contextRef = useRef<string | undefined>(undefined);
  const historyRef = useRef<ChatMessage[]>(messages);

  // Keep historyRef and sessionStorage in sync
  useEffect(() => {
    historyRef.current = messages;
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch { /* ignore */ }
  }, [messages]);

  const setSessionType = useCallback((type: string, context?: string) => {
    _setSessionType(type);
    contextRef.current = context;
  }, []);

  const sendMessage = useCallback(async (message: string, contextOverride?: string) => {
    const isLoggedIn = !!auth.currentUser;

    // Auth gate: anonymous users get FREE_MESSAGES free, then must log in
    if (!isLoggedIn && userMessageCount >= FREE_MESSAGES) {
      // Show a nudge message in chat, then open auth modal
      setMessages(prev => [
        ...prev,
        { role: 'user', text: message },
        {
          role: 'model',
          text: `¡Genial! Ya llevamos una buena conversación 😊\n\nPara **guardar tu progreso** y seguir usando MarIA sin límites, necesitas crear una cuenta gratis. Solo toma 30 segundos ✨`,
        },
      ]);
      setTimeout(() => { _onNeedAuth?.(); }, 800);
      return;
    }

    const userMsg: ChatMessage = { role: 'user', text: message };
    const currentHistory = [...historyRef.current];
    setMessages(prev => [...prev, userMsg]);
    if (!isLoggedIn) setUserMessageCount(prev => prev + 1);
    setIsLoading(true);

    try {
      const token = await auth.currentUser?.getIdToken().catch(() => null);
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message,
          sessionType,
          context: contextOverride ?? contextRef.current,
          history: currentHistory.map(m => ({ role: m.role, text: m.text })),
        }),
      });

      if (!res.ok) {
        if (res.status === 429) {
          const limitData = await res.json().catch(() => ({}));
          const resetTime = limitData.resetAt
            ? new Date(limitData.resetAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
            : 'después';
          setMessages(prev => [
            ...prev,
            {
              role: 'model',
              text: limitData.message || `Has alcanzado el límite de 5 prompts cada 5 horas. Vuelve ${resetTime} o suscríbete a Premium para acceso ilimitado.`,
            },
          ]);
          if (isLoggedIn) {
            setShowCodeInput(true);
            setCodeMessage('');
          }
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      let responseText = data.text as string;

      // Handle [JOB_READY] marker from post_job sessions
      if (sessionType === 'post_job' && responseText.includes('[JOB_READY]')) {
        const match = responseText.match(/\[JOB_READY\]([\s\S]*?)\[\/JOB_READY\]/);
        if (match) {
          try {
            const jobData = JSON.parse(match[1]);
            const jobToken = await auth.currentUser?.getIdToken().catch(() => null);
            if (jobToken) {
              const jobRes = await fetch(`${API_BASE}/api/user-jobs`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${jobToken}`,
                },
                body: JSON.stringify(jobData),
              });
              if (jobRes.ok) {
                responseText = responseText.replace(
                  /\[JOB_READY\][\s\S]*?\[\/JOB_READY\]/,
                  '\n\n**Tu pega fue publicada exitosamente en NouuWork** \\u2705\nYa aparece en el Mapa Laboral para que la vean los postulantes.'
                );
              } else {
                responseText = responseText.replace(
                  /\[JOB_READY\][\s\S]*?\[\/JOB_READY\]/,
                  '\n\n*Hubo un error al publicar. Intenta de nuevo.*'
                );
              }
            }
          } catch (e) {
            console.error('Error processing job data:', e);
            responseText = responseText.replace(
              /\[JOB_READY\][\s\S]*?\[\/JOB_READY\]/,
              '\n\n*Hubo un error procesando los datos. Intenta de nuevo.*'
            );
          }
        }
      }

      // Handle [NOUU_READY] marker from nouu sessions
      if (sessionType === 'nouu' && responseText.includes('[NOUU_READY]')) {
        const match = responseText.match(/\[NOUU_READY\]([\s\S]*?)\[\/NOUU_READY\]/);
        if (match) {
          try {
            const nouuData = JSON.parse(match[1]);
            const nouuToken = await auth.currentUser?.getIdToken().catch(() => null);
            if (nouuToken) {
              const nouuRes = await fetch(`${API_BASE}/api/nouu`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${nouuToken}`,
                },
                body: JSON.stringify(nouuData),
              });
              if (nouuRes.ok) {
                responseText = responseText.replace(
                  /\[NOUU_READY\][\s\S]*?\[\/NOUU_READY\]/,
                  '\n\n**¡Tu Nouu fue publicado!** 🎉\nYa aparece en el Mapa Laboral para que lo vean todos.'
                );
              } else {
                responseText = responseText.replace(
                  /\[NOUU_READY\][\s\S]*?\[\/NOUU_READY\]/,
                  '\n\n*Hubo un error al publicar. Intenta de nuevo.*'
                );
              }
            }
          } catch (e) {
            console.error('Error processing nouu data:', e);
            responseText = responseText.replace(
              /\[NOUU_READY\][\s\S]*?\[\/NOUU_READY\]/,
              '\n\n*Hubo un error procesando los datos. Intenta de nuevo.*'
            );
          }
        }
      }

      setMessages(prev => [...prev, { role: 'model', text: responseText }]);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [
        ...prev,
        { role: 'model', text: 'Lo siento, hubo un error de conexión. ¿Podrías repetir tu mensaje?' },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [sessionType, userMessageCount]);

  const applyDiscountCode = useCallback(async (code: string) => {
    setApplyingCode(true);
    setCodeMessage('');
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setCodeMessage('Debes iniciar sesión primero');
        return;
      }
      const res = await fetch(`${API_BASE}/api/subscription/apply-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowCodeInput(false);
        setCodeMessage('');
        setMessages(prev => [
          ...prev,
          { role: 'model', text: data.message || `¡Código aplicado! Ahora tienes MarIA Premium. Disfruta de acceso ilimitado.` },
        ]);
      } else {
        setCodeMessage(data.error || 'Código no válido');
      }
    } catch {
      setCodeMessage('Error de conexión. Intenta de nuevo.');
    } finally {
      setApplyingCode(false);
    }
  }, []);

  const dismissCodeInput = useCallback(() => {
    setShowCodeInput(false);
    setCodeMessage('');
  }, []);

  const clearChat = useCallback(() => {
    setMessages([DEFAULT_GREETING]);
    setUserMessageCount(0);
    setShowCodeInput(false);
    setCodeMessage('');
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  return (
    <ChatContext.Provider value={{ messages, isLoading, sessionType, userMessageCount, setSessionType, sendMessage, clearChat, showCodeInput, codeMessage, applyingCode, applyDiscountCode, dismissCodeInput }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
};
