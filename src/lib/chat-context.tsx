/**
 * Global ChatContext — one persistent MarIA conversation across all views.
 * The session type (cv / map / interview) changes per view but the history is shared.
 * Messages survive view-switches via sessionStorage; cleared only on clearChat().
 */
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { auth } from './firebase';

const API_BASE = import.meta.env.VITE_API_URL || '';
const STORAGE_KEY = 'nouu_maria_chat';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

interface ChatContextType {
  messages: ChatMessage[];
  isLoading: boolean;
  sessionType: string;
  setSessionType: (type: string, context?: string) => void;
  sendMessage: (message: string, contextOverride?: string) => Promise<void>;
  clearChat: () => void;
}

const DEFAULT_GREETING: ChatMessage = {
  role: 'model',
  text: '¡Hola! Soy **MarIA**, tu asistente laboral de NouuWork 👋\n\nPuedo ayudarte a:\n- **Crear tu CV** profesional conversando\n- **Encontrar trabajo** cerca de ti\n- **Prepararte** para entrevistas\n\n**¿En qué te ayudo hoy?**',
};

const ChatContext = createContext<ChatContextType | null>(null);

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
    const userMsg: ChatMessage = { role: 'user', text: message };
    const currentHistory = [...historyRef.current];
    setMessages(prev => [...prev, userMsg]);
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

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'model', text: data.text }]);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [
        ...prev,
        { role: 'model', text: 'Lo siento, hubo un error de conexión. ¿Podrías repetir tu mensaje?' },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [sessionType]);

  const clearChat = useCallback(() => {
    setMessages([DEFAULT_GREETING]);
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  return (
    <ChatContext.Provider value={{ messages, isLoading, sessionType, setSessionType, sendMessage, clearChat }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
};
