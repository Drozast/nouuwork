/**
 * Gemini API proxy — all AI calls go through the backend (Cloud Functions).
 * The Gemini API key is NEVER exposed to the frontend.
 */
import { auth } from './firebase';

const API_BASE = import.meta.env.VITE_API_URL || '';

async function getHeaders(): Promise<HeadersInit> {
  const token = await auth.currentUser?.getIdToken().catch(() => null);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

interface ChatSession {
  history: { role: 'user' | 'model'; text: string }[];
  sessionType: string;
  context?: string;
  sendMessage: (opts: { message: string }) => Promise<{ text: string }>;
}

function createSession(sessionType: string, context?: string): ChatSession {
  const session: ChatSession = {
    history: [],
    sessionType,
    context,
    sendMessage: async ({ message }) => {
      const headers = await getHeaders();
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message,
          sessionType: session.sessionType,
          context: session.context,
          history: session.history,
        }),
      });
      if (!res.ok) throw new Error('Error en el asistente');
      const data = await res.json();
      session.history.push({ role: 'user', text: message });
      session.history.push({ role: 'model', text: data.text });
      return { text: data.text };
    },
  };
  return session;
}

export const createCVChatSession = () => createSession('cv');

export const createInterviewChatSession = (topic: string) =>
  createSession('interview', `El usuario quiere practicar: "${topic}"`);

export const createMapChatSession = (jobsContext: string) =>
  createSession('map', jobsContext);

export const extractCVData = async (chatHistory: string): Promise<Record<string, string>> => {
  const headers = await getHeaders();
  const res = await fetch(`${API_BASE}/api/extract-cv`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ chatHistory }),
  });
  if (!res.ok) return {};
  return res.json();
};
