import { auth } from './firebase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await auth.currentUser?.getIdToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function chatWithAI(message: string, sessionType: 'cv' | 'map' | 'interview' | 'b2b', context?: string): Promise<string> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message, sessionType, context }),
  });
  if (!res.ok) throw new Error('Error en el chat');
  const data = await res.json();
  return data.text;
}

export async function extractCVFromChat(chatHistory: string): Promise<Record<string, string>> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/extract-cv`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ chatHistory }),
  });
  if (!res.ok) throw new Error('Error extrayendo CV');
  return res.json();
}

export async function getJobs(): Promise<any[]> {
  const res = await fetch(`${API_URL}/jobs`);
  if (!res.ok) throw new Error('Error cargando trabajos');
  return res.json();
}
