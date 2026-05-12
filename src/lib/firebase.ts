import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAnalytics, logEvent } from 'firebase/analytics';

export type EventType =
  | 'click_ver_oferta'
  | 'view_job_popup'
  | 'click_add_itinerario'
  | 'click_postular'
  | 'open_chat_maria'
  | 'open_cv_generator'
  | 'open_map'
  | 'open_assistant'
  | 'open_b2b'
  | 'open_post_job';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Analytics — solo en browser (no SSR)
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

/** Registra una visita de página (para dashboard de analytics). */
export async function trackPageView(page: string, userId?: string | null) {
  try {
    await addDoc(collection(db, 'analytics_pageviews'), {
      page,
      userId: userId ?? null,
      platform: 'web',
      createdAt: serverTimestamp(),
    });
  } catch (_) {}
  if (analytics) {
    logEvent(analytics, 'page_view', { page_title: page });
  }
}

/** Registra un evento de interacción genérico. */
export async function trackEvent(params: {
  type: EventType;
  jobId?: string | null;
  jobTitle?: string | null;
  company?: string | null;
  userId?: string | null;
}) {
  try {
    await addDoc(collection(db, 'analytics_events'), {
      type: params.type,
      jobId: params.jobId ?? null,
      jobTitle: params.jobTitle ?? null,
      company: params.company ?? null,
      userId: params.userId ?? null,
      platform: 'web',
      createdAt: serverTimestamp(),
    });
  } catch (_) {}
  if (analytics) {
    logEvent(analytics, params.type, {
      job_id: params.jobId ?? undefined,
      job_title: params.jobTitle ?? undefined,
    });
  }
}

/**
 * Registra un click en "Ver oferta original".
 * Escribe en Firestore para el dashboard de admin + lanza evento Analytics.
 */
export async function trackOfertaClick(params: {
  jobId: string | number;
  jobTitle: string;
  company: string;
  urlOriginal: string;
  userId?: string | null;
}) {
  // Firestore — historial de conversiones
  try {
    await addDoc(collection(db, 'analytics_conversions'), {
      type: 'click_ver_oferta',
      jobId: String(params.jobId),
      jobTitle: params.jobTitle,
      company: params.company,
      urlOriginal: params.urlOriginal,
      userId: params.userId ?? null,
      platform: 'web',
      createdAt: serverTimestamp(),
    });
  } catch (_) {
    // no bloquear la UX si falla el tracking
  }

  // Firebase Analytics
  if (analytics) {
    logEvent(analytics, 'click_ver_oferta', {
      job_id: String(params.jobId),
      job_title: params.jobTitle,
      company: params.company,
    });
  }
}
