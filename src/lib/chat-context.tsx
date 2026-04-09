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
}

const DEFAULT_GREETING: ChatMessage = {
  role: 'model',
  text: '¡Hola! Soy **MarIA**, tu asistente laboral de NouuWork 👋\n\nPuedo ayudarte a:\n- **Crear tu CV** profesional conversando\n- **Encontrar trabajo** cerca de ti\n- **Prepararte** para entrevistas\n\n**¿En qué te ayudo hoy?**',
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
  }, [sessionType, userMessageCount]);

  const clearChat = useCallback(() => {
    setMessages([DEFAULT_GREETING]);
    setUserMessageCount(0);
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  return (
    <ChatContext.Provider value={{ messages, isLoading, sessionType, userMessageCount, setSessionType, sendMessage, clearChat }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
};
