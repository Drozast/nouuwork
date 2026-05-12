const admin = require('firebase-admin');
const { GoogleGenAI } = require('@google/genai');
const cors = require('cors')({ origin: true });
const express = require('express');
const Busboy = require('busboy');
const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');

admin.initializeApp();

const app = express();
app.use((req, res, next) => cors(req, res, next));
// Skip JSON parsing for multipart requests (file uploads)
app.use((req, res, next) => {
  const ct = req.headers['content-type'] || '';
  if (ct.includes('multipart/form-data')) return next();
  express.json({ limit: '10mb' })(req, res, next);
});

// Parse multipart file upload using busboy (compatible with Cloud Functions Gen 2)
function parseFileUpload(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers, limits: { fileSize: 10 * 1024 * 1024 } });
    let fileBuffer = null;
    let fileMimeType = null;
    let fileName = null;

    busboy.on('file', (fieldname, stream, info) => {
      const { filename, mimeType } = info;
      const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
      if (!allowed.includes(mimeType)) {
        stream.resume();
        return;
      }
      fileName = filename;
      fileMimeType = mimeType;
      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => { fileBuffer = Buffer.concat(chunks); });
    });
    busboy.on('finish', () => {
      if (fileBuffer) {
        resolve({ buffer: fileBuffer, mimetype: fileMimeType, filename: fileName });
      } else {
        reject(new Error('No se recibió un archivo válido (PDF o imagen)'));
      }
    });
    busboy.on('error', reject);

    if (req.rawBody) {
      busboy.end(req.rawBody);
    } else {
      req.pipe(busboy);
    }
  });
}

const getGemini = () => new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

// ─── IDENTIDAD BASE DE MARIA ────────────────────────────────────
const MARIA_BASE = `Eres MarIA, la asistente inteligente de NOUU (Busca, encuentra, trabaja).
Tu misión es ayudar a personas de clase media y baja en LATAM a conseguir empleo de forma digna y sencilla.

FECHA ACTUAL: Hoy es 9 de abril de 2026. Estamos en 2026. Cualquier mención a 2024 o 2025 como "presente" o "futuro cercano" es un error — corrígelo con amabilidad.

USUARIO OBJETIVO: Personas que buscan trabajo presencial (retail, gastronomía, construcción, call center, seguridad, limpieza). Pueden usar WhatsApp pero quizás no dominan Word ni saben armar un CV.

TONO: Empático, cercano, muy claro. Tuteo amable. Sin tecnicismos. Lenguaje simple como en una conversación de WhatsApp.

REGLAS DE ORO:
- Haz UNA SOLA pregunta a la vez. No bombardees con varias preguntas juntas.
- No asumas que el usuario sabe redactar — tú haces el trabajo pesado.
- Corrige ortografía y mejora el lenguaje sin que el usuario lo note.
- Si el usuario valida una fecha (experiencia laboral, etc.), verifica que tenga sentido en 2026.
- Si el usuario pregunta por trabajos disponibles, recuérdale que NOUU tiene un Mapa Laboral tipo Waze para ver dónde dejar su CV hoy mismo según su ubicación.

SOBRE LOS NOUUS (POLOLITOS):
- Un Nouu es un trabajo informal, "pololo" o servicio temporal que una persona publica en NOUU. Son trabajos de corta duración, freelance o "a la rápida".
- Categorías de Nouus: Hogar y Jardín, Limpieza, Tecnología, Transporte, Educación, Mascotas, Eventos, Salud y Bienestar, Arte y Creatividad, Deportes, Cocina, Reparaciones, Otros.
- Cómo funciona: Un usuario publica un Nouu con título, descripción, presupuesto, ubicación y categoría. Otros usuarios pueden postularse. El publicador elige a quién asignarle el trabajo. Al completar, ambos se califican mutuamente.
- Los Nouus también pueden verse en el Mapa Laboral como marcadores rojos (gratuitos).
- Para publicar un Nouu: ve a la app, botón "+", completa los datos y publícalo.
- Para buscar Nouus: abre el mapa o revisa el home, filtra por categoría o cercanía.

SOBRE NOUU WORK (TRABAJOS FORMALES):
- Nouu Work es la sección de trabajos formales (empresas, contrato, full-time/part-time).
- Se muestran como marcadores azules en el Mapa Laboral.
- Tienen salario, empresa, requisitos, descripción detallada.
- Para aplicar: ve al mapa, toca un marcador azul, revisa los detalles y presiona "Postular".`;

const SYSTEM_PROMPTS = {
  cv: `${MARIA_BASE}

ROL ACTUAL: Ayudar al usuario a crear su CV con formato Harvard.
Flujo conversacional para recolectar datos (UNA pregunta a la vez):
1. Nombre completo
2. Datos de contacto (teléfono, email, ciudad/comuna)
3. Experiencia laboral más reciente (empresa, cargo, período, tareas principales)
4. Educación (último nivel completado, institución, año)
5. Habilidades o competencias destacadas
6. Idiomas (si aplica)

Cuando tengas suficiente información, redacta el CV con calidad profesional.
Al finalizar, da 2-3 consejos prácticos y motivadores para la entrevista.
Recuerda: eres el reemplazo del "tío del bazar" que cobra por hacer CVs — hazlo gratis y con calidad.`,

  map: `${MARIA_BASE}

ROL ACTUAL: Ayudar al usuario a encontrar trabajo usando el Mapa Laboral de NouuWork.
Usa los trabajos disponibles en el contexto JSON provisto.
Ayuda al usuario a elegir el mejor trabajo según sus habilidades, ubicación o preferencias.
No inventes trabajos que no estén en la lista.
Si el usuario no tiene claro qué buscar, hazle preguntas simples: ¿En qué parte de la ciudad vives? ¿Tienes experiencia en algún rubro? ¿Necesitas turno mañana, tarde o noche?`,

  interview: `${MARIA_BASE}

ROL ACTUAL: Coach de entrevistas laborales.
Ayuda al usuario a prepararse para su entrevista de trabajo.
Haz preguntas de práctica UNA POR UNA y da feedback constructivo, simple y motivador.
Simula ser el entrevistador cuando el usuario lo pida.
Al finalizar, da un resumen de los puntos fuertes y qué mejorar.`,

  b2b: `Eres MarIA, asistente de reclutamiento para NouuWork B2B (panel de empresas).
FECHA ACTUAL: 9 de abril de 2026.
Ayudas a empresas a evaluar candidatos para puestos de trabajo.
Analiza perfiles, sugiere preguntas de entrevista específicas para el cargo, y da recomendaciones objetivas.
Sé profesional, directo y fundamenta tus evaluaciones en los datos del candidato.`,

  post_job: `${MARIA_BASE}

ROL ACTUAL: Ayudar al usuario a publicar una oferta de trabajo en NouuWork.
El usuario quiere ofrecer una pega (trabajo). Guíalo paso a paso, UNA pregunta a la vez.

FLUJO (pregunta UNA cosa a la vez en este orden):
1. Título del trabajo (ej: "Vendedor/a", "Garzón/a", "Maestro Eléctrico")
2. Descripción breve del trabajo (qué se hace, horarios, etc.)
3. Ubicación / comuna donde es el trabajo
4. Dirección específica (calle y número, si la tiene)
5. Sueldo aproximado — puede ser un rango o "a convenir". Pregunta mínimo y máximo. Si dice "a convenir" pon null en ambos.
6. Tipo de contrato (Tiempo completo, Part-time, Por día, Temporal, Freelance)
7. Requisitos o habilidades necesarias (ej: "experiencia en cocina", "licencia de conducir"). Pueden ser varias, separadas por coma.

IMPORTANTE:
- Sé amigable y casual, como en WhatsApp.
- Si el usuario da respuestas cortas o incompletas, ayúdalo a completar con sugerencias.
- Cuando tengas TODA la información (los 7 puntos), genera el siguiente bloque EXACTO al final de tu mensaje:

[JOB_READY]{"titulo":"...","descripcion":"...","comuna":"...","sueldoMin":null,"sueldoMax":null,"tipoContrato":"...","skills":["..."],"direccion":"..."}[/JOB_READY]

- sueldoMin y sueldoMax deben ser números (sin puntos ni signos) o null si es "a convenir".
- skills debe ser un array de strings.
- Después del bloque [JOB_READY]...[/JOB_READY], agrega un mensaje amigable pidiendo confirmación al usuario, tipo: "¿Te parece bien? Si quieres cambiar algo, dime."
- NO generes el bloque [JOB_READY] hasta tener TODA la info.
- Si el usuario confirma, responde con: "¡Listo! Tu pega ya está publicada en NouuWork 🎉"`,

  nouu: `${MARIA_BASE}

ROL ACTUAL: Ayudar al usuario a publicar un Nouu (pololo, pega, trabajo informal) en la app.
El usuario quiere ofrecer o pedir ayuda con una tarea o trabajo puntual. Guíalo paso a paso, UNA pregunta a la vez.

FLUJO (pregunta UNA cosa a la vez en este orden):
1. ¿Qué categoría? (Hogar y Jardín, Limpieza, Tecnología, Transporte, Educación, Mascotas, Eventos, Salud y Bienestar, Arte y Creatividad, Deportes, Cocina, Reparaciones, Otros)
2. Título del nouu (ej: "Cortar el pasto", "Arreglar computador", "Pasear perro")
3. Descripción detallada (qué necesitas, cuándo, condiciones)
4. Presupuesto aproximado en pesos chilenos
5. ¿Cómo se pagará? (Efectivo o Transferencia)
6. ¿Para cuándo lo necesitas? (fecha)
7. Ubicación / comuna
8. Dirección (calle, número)

IMPORTANTE:
- Sé amigable, informal y cercano. Como un amigo que ayuda.
- Esto es para pololos y pegas informales, no trabajos formales.
- Si el usuario da info incompleta, sugerí opciones.
- Cuando tengas TODA la información, genera el siguiente bloque EXACTO al final de tu mensaje:

[NOUU_READY]{"categoria":"...","titulo":"...","descripcion":"...","presupuesto":null,"metodoPago":"efectivo","fecha":"...","comuna":"...","direccion":"..."}[/NOUU_READY]

- presupuesto debe ser número o null si no se especificó.
- metodoPago debe ser "efectivo" o "transferencia".
- Después del bloque, preguntá: "¿Lo publicamos?"
- Si el usuario confirma, respondé: "¡Listo! Tu Nouu ya está publicado 🎉"`,
};

const SEED_JOBS = [
  { id: 1, title: 'Cajero/a', company: 'Supermercado Lider', location: 'Av. Providencia 2653, Providencia', salary: '$450.000 - $550.000', time: 'Hace 2 horas', tags: ['Atención al cliente', 'Manejo de dinero'], urgent: true, coords: [-33.418, -70.605], active: true },
  { id: 2, title: 'Reponedor/a', company: 'Jumbo', location: 'Av. Kennedy 9001, Las Condes', salary: '$420.000 - $480.000', time: 'Hace 5 horas', tags: ['Orden', 'Fuerza física'], coords: [-33.39, -70.546], active: true },
  { id: 3, title: 'Mesero/a', company: 'Restaurant El Huerto', location: 'Orrego Luco 054, Providencia', salary: '$350.000 + propinas', time: 'Hace 1 día', tags: ['Atención al cliente', 'Buena presencia'], coords: [-33.423, -70.611], active: true },
  { id: 4, title: 'Bodeguero/a', company: 'Distribuidora Central', location: 'Av. Vicuña Mackenna 1290, Ñuñoa', salary: '$480.000 - $550.000', time: 'Hace 3 horas', tags: ['Orden', 'Inventario'], urgent: true, coords: [-33.456, -70.625], active: true },
  { id: 5, title: 'Guardia de Seguridad', company: 'Securitas', location: 'Av. Los Leones 1200, Providencia', salary: '$500.000 - $600.000', time: 'Hace 4 horas', tags: ['Seguridad', 'Turnos rotativos'], coords: [-33.435, -70.600], active: true },
  { id: 6, title: 'Auxiliar de Aseo', company: 'ISS Chile', location: 'Rosario Norte 532, Las Condes', salary: '$400.000 - $450.000', time: 'Hace 1 día', tags: ['Limpieza', 'Responsabilidad'], coords: [-33.405, -70.570], active: true },
  { id: 7, title: 'Operador/a Call Center', company: 'Teleperformance', location: 'Av. Apoquindo 4501, Las Condes', salary: '$450.000 + bonos', time: 'Hace 6 horas', tags: ['Atención al cliente', 'Computación'], coords: [-33.415, -70.585], active: true },
  { id: 8, title: 'Repartidor/a', company: 'Correos de Chile', location: 'Exposición 221, Estación Central', salary: '$480.000 - $520.000', time: 'Hace 2 días', tags: ['Licencia B', 'Rutas'], urgent: true, coords: [-33.450, -70.680], active: true },
  { id: 9, title: 'Ayudante de Cocina', company: 'Starbucks', location: 'Pedro de Valdivia 100, Providencia', salary: '$380.000 - $420.000', time: 'Hace 1 hora', tags: ['Cocina', 'Rapidez'], coords: [-33.425, -70.615], active: true },
  { id: 10, title: 'Vendedor/a Retail', company: 'Falabella', location: 'Costanera Center, Providencia', salary: '$400.000 + comisiones', time: 'Hace 3 días', tags: ['Ventas', 'Atención al cliente'], coords: [-33.417, -70.606], active: true },
  { id: 11, title: 'Reponedor/a', company: 'Santa Isabel', location: 'Av. Irarrázaval 2800, Ñuñoa', salary: '$400.000 - $450.000', time: 'Hace 1 hora', tags: ['Orden', 'Fuerza física'], coords: [-33.453, -70.598], active: true },
  { id: 12, title: 'Reponedor/a Nocturno', company: 'Tottus', location: 'Av. Vitacura 6200, Vitacura', salary: '$450.000 - $500.000', time: 'Hace 4 horas', tags: ['Orden', 'Nocturno'], coords: [-33.395, -70.575], active: true },
];

// Auth middleware (optional — doesn't block, just attaches uid)
const attachUser = async (req, res, next) => {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      const decoded = await admin.auth().verifyIdToken(header.split('Bearer ')[1]);
      req.user = decoded;
    } catch (_) { /* ignore */ }
  }
  next();
};
app.use(attachUser);

// ─── MarIA Rate Limiting & Subscription Helpers ────────────────
const MARIA_FREE_LIMIT = 5;          // prompts allowed in the window
const MARIA_WINDOW_HOURS = 5;        // rolling window in hours

// Seed the default FABULOSO discount code if it doesn't exist
async function seedFabulosoCode(db) {
  const snap = await db.collection('discount_codes').where('code', '==', 'FABULOSO').limit(1).get();
  if (snap.empty) {
    await db.collection('discount_codes').add({
      code: 'FABULOSO',
      monthsFree: 3,
      maxUses: -1, // unlimited
      currentUses: 0,
      isActive: true,
      createdBy: 'sistema',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('[Seed] FABULOSO discount code created.');
  }
}

async function checkMariaLimit(db, uid) {
  const docRef = db.collection('maria_usage').doc(uid);
  const docSnap = await docRef.get();
  const now = admin.firestore.Timestamp.now();

  if (!docSnap.exists) {
    await docRef.set({
      uid,
      count: 1,
      windowStart: now,
      lastUsed: now,
    });
    return { allowed: true, remaining: MARIA_FREE_LIMIT - 1 };
  }

  const data = docSnap.data();
  const windowStart = data.windowStart.toDate();
  const hoursSinceStart = (Date.now() - windowStart.getTime()) / (1000 * 60 * 60);

  if (hoursSinceStart >= MARIA_WINDOW_HOURS) {
    // Window expired — reset
    await docRef.set({
      uid,
      count: 1,
      windowStart: now,
      lastUsed: now,
    }, { merge: true });
    return { allowed: true, remaining: MARIA_FREE_LIMIT - 1 };
  }

  const newCount = data.count + 1;

  if (data.count >= MARIA_FREE_LIMIT) {
    const resetAt = new Date(windowStart.getTime() + MARIA_WINDOW_HOURS * 60 * 60 * 1000);
    return {
      allowed: false,
      remaining: 0,
      resetAt: resetAt.toISOString(),
    };
  }

  await docRef.update({
    count: newCount,
    lastUsed: now,
  });
  return { allowed: true, remaining: MARIA_FREE_LIMIT - newCount };
}

async function getSubscription(db, uid) {
  const docSnap = await db.collection('subscriptions').doc(uid).get();
  if (!docSnap.exists) return null;
  return docSnap.data();
}

// POST /chat — con rate limiting y check de suscripción premium
app.post('/chat', async (req, res) => {
  const { message, sessionType = 'cv', context, history = [] } = req.body;
  if (!message) return res.status(400).json({ error: 'message requerido' });

  const db = admin.firestore();

  // Rate limit / premium check for authenticated users
  if (req.user) {
    const sub = await getSubscription(db, req.user.uid);
    const isPremium = sub && sub.status === 'active' && sub.plan === 'premium'
      && sub.endDate.toDate() > new Date();

    if (!isPremium) {
      const limitCheck = await checkMariaLimit(db, req.user.uid);
      if (!limitCheck.allowed) {
        return res.status(429).json({
          error: 'Límite de prompts alcanzado',
          message: `Has usado ${MARIA_FREE_LIMIT} prompts en ${MARIA_WINDOW_HOURS} horas. Vuelve después de las ${new Date(limitCheck.resetAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })} o suscríbete a Premium para acceso ilimitado.`,
          resetAt: limitCheck.resetAt,
        });
      }
    }
  }

  try {
    const ai = getGemini();
    const systemInstruction = SYSTEM_PROMPTS[sessionType] + (context ? `\n\nContexto:\n${context}` : '');
    const chat = ai.chats.create({
      model: 'gemini-3.1-flash-lite-preview',
      config: {
        systemInstruction,
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
      history: history.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
    });
    const result = await chat.sendMessage({ message });
    res.json({ text: result.text });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Error en el asistente IA' });
  }
});

// GET /subscription — obtener estado de suscripción del usuario autenticado
app.get('/subscription', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  try {
    const db = admin.firestore();
    const docSnap = await db.collection('subscriptions').doc(req.user.uid).get();
    if (!docSnap.exists) {
      return res.json({ plan: 'free', subscription: null });
    }
    const sub = docSnap.data();
    const isActive = sub.status === 'active' && sub.plan === 'premium' && sub.endDate.toDate() > new Date();
    if (isActive !== (sub.status === 'active')) {
      await docSnap.ref.update({
        status: isActive ? 'active' : 'expired',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      sub.status = isActive ? 'active' : 'expired';
    }
    res.json({
      plan: isActive ? 'premium' : 'free',
      subscription: {
        uid: sub.uid,
        plan: sub.plan,
        startDate: sub.startDate.toDate().toISOString(),
        endDate: sub.endDate.toDate().toISOString(),
        status: sub.status,
        discountCode: sub.discountCode || null,
      },
    });
  } catch (err) {
    console.error('Subscription error:', err);
    res.status(500).json({ error: 'Error consultando suscripción' });
  }
});

// POST /subscription/apply-code — aplicar código de descuento
app.post('/subscription/apply-code', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Código requerido' });

  try {
    const db = admin.firestore();
    await seedFabulosoCode(db);
    const normalizedCode = code.trim().toUpperCase();

    const codesSnap = await db.collection('discount_codes')
      .where('code', '==', normalizedCode)
      .where('isActive', '==', true)
      .limit(1).get();

    if (codesSnap.empty) {
      return res.status(404).json({ error: 'Código no válido o expirado' });
    }

    const codeDoc = codesSnap.docs[0];
    const codeData = codeDoc.data();

    if (codeData.maxUses > 0 && codeData.currentUses >= codeData.maxUses) {
      return res.status(400).json({ error: 'Este código ya alcanzó su límite de usos' });
    }

    // Check if user already has an active premium subscription
    const subSnap = await db.collection('subscriptions').doc(req.user.uid).get();
    let startDate = new Date();
    if (subSnap.exists && subSnap.data().status === 'active' && subSnap.data().plan === 'premium') {
      startDate = subSnap.data().endDate.toDate();
    }

    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + codeData.monthsFree);

    await db.collection('subscriptions').doc(req.user.uid).set({
      uid: req.user.uid,
      plan: 'premium',
      startDate: admin.firestore.Timestamp.fromDate(startDate),
      endDate: admin.firestore.Timestamp.fromDate(endDate),
      discountCode: normalizedCode,
      status: 'active',
      createdAt: subSnap.exists ? subSnap.data().createdAt : admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Increment code usage
    await codeDoc.ref.update({
      currentUses: admin.firestore.FieldValue.increment(1),
    });

    res.json({
      success: true,
      message: `¡Felicidades! Tienes ${codeData.monthsFree} meses de MarIA Premium gratis.`,
      subscription: {
        plan: 'premium',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        status: 'active',
      },
    });
  } catch (err) {
    console.error('Apply code error:', err);
    res.status(500).json({ error: 'Error aplicando código' });
  }
});

// POST /parse-cv-file — upload a PDF or image CV and extract structured data via Gemini Vision
// Accepts multipart/form-data with field "file"
app.post('/parse-cv-file', async (req, res) => {
  let file;
  try {
    file = await parseFileUpload(req);
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Archivo requerido (PDF o imagen)' });
  }

  try {
    const ai = getGemini();
    const base64 = file.buffer.toString('base64');
    const mimeType = file.mimetype;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: [
        {
          parts: [
            {
              inlineData: { mimeType, data: base64 },
            },
            {
              text: `Analiza este documento (CV / currículum) y extrae TODA la información disponible.
Devuelve SOLO un JSON válido con esta estructura exacta (deja vacío "" si no encuentras el dato):
{
  "name": "",
  "email": "",
  "phone": "",
  "location": "",
  "experience": "",
  "education": "",
  "skills": "",
  "languages": "",
  "summary": ""
}
El campo "experience" debe contener todos los trabajos anteriores como texto continuo.
El campo "summary" puede contener un resumen profesional si lo hay.
NO incluyas texto fuera del JSON.`,
            },
          ],
        },
      ],
      config: { responseMimeType: 'application/json', temperature: 0.1, maxOutputTokens: 2048 },
    });

    const parsed = JSON.parse(response.text || '{}');

    // Auto-save to profile if user is authenticated
    if (req.user && parsed.name) {
      await admin.firestore().collection('user_cvs').doc(req.user.uid).set({
        ...parsed,
        uid: req.user.uid,
        source: 'pdf_upload',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    res.json(parsed);
  } catch (err) {
    console.error('Parse CV file error:', err);
    res.status(500).json({ error: 'Error procesando el archivo' });
  }
});

// POST /extract-cv
app.post('/extract-cv', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  const { chatHistory } = req.body;
  if (!chatHistory) return res.status(400).json({ error: 'chatHistory requerido' });

  try {
    const ai = getGemini();
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: `Extrae la información del siguiente historial de chat para armar un CV.
Devuelve SOLO un JSON válido con esta estructura (vacío si no hay info):
{"name":"","email":"","phone":"","location":"","experience":"","education":"","skills":"","languages":""}

Historial:
${chatHistory}`,
      config: { responseMimeType: 'application/json', temperature: 0.1 },
    });
    res.json(JSON.parse(response.text || '{}'));
  } catch (err) {
    console.error('Extract CV error:', err);
    res.status(500).json({ error: 'Error extrayendo CV' });
  }
});

// GET /jobs — returns all active jobs from Firestore, falls back to SEED_JOBS
app.get('/jobs', async (req, res) => {
  try {
    const snap = await admin.firestore().collection('jobs').get();
    if (snap.empty) return res.json(SEED_JOBS);
    const jobs = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(j => j.active !== false); // include jobs without explicit active field
    if (jobs.length === 0) return res.json(SEED_JOBS);
    res.json(jobs);
  } catch (_) {
    res.json(SEED_JOBS);
  }
});

// POST /ai-summary
app.post('/ai-summary', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  const { candidate, jobTitle } = req.body;
  if (!candidate || !jobTitle) return res.status(400).json({ error: 'candidate y jobTitle requeridos' });

  try {
    const ai = getGemini();
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: `Resume en 2-3 oraciones por qué este candidato es o no adecuado para "${jobTitle}". Sé directo.

Candidato: ${candidate.name} | Score: ${candidate.score}%
Experiencia: ${candidate.experience}
Educación: ${candidate.education}
Habilidades: ${(candidate.tags || []).join(', ')}
Notas: ${candidate.notes}`,
      config: { temperature: 0.3 },
    });
    res.json({ summary: response.text });
  } catch (err) {
    console.error('AI summary error:', err);
    res.status(500).json({ error: 'Error generando resumen' });
  }
});

// POST /companies — create or update company for authenticated user
app.post('/companies', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  const { name, rut, industry, size, description, email, phone, website } = req.body;
  if (!name || !rut) return res.status(400).json({ error: 'name y rut requeridos' });

  try {
    const companyId = `company_${req.user.uid}`;
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);

    const companyData = {
      id: companyId,
      uid: req.user.uid,
      name, rut, industry, size, description, email, phone, website,
      verified: false,
      members: [],
      plan: 'free',
      subscriptionStatus: 'trial',
      subscriptionStart: admin.firestore.FieldValue.serverTimestamp(),
      subscriptionEnd: admin.firestore.Timestamp.fromDate(trialEnd),
      postedJobsCount: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await admin.firestore().collection('companies').doc(companyId).set(companyData, { merge: true });
    await admin.firestore().collection('users').doc(req.user.uid).update({
      accountType: 'business',
      companyId: companyId,
    });
    res.json({ id: companyId, ...companyData });
  } catch (err) {
    console.error('Company create error:', err);
    res.status(500).json({ error: 'Error creando empresa' });
  }
});

// GET /companies/:id — get company
app.get('/companies/:id', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  try {
    const doc = await admin.firestore().collection('companies').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Empresa no encontrada' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo empresa' });
  }
});

// PUT /companies/:id — update company
app.put('/companies/:id', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  try {
    const doc = await admin.firestore().collection('companies').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Empresa no encontrada' });
    if (doc.data().uid !== req.user.uid) return res.status(403).json({ error: 'No autorizado para editar esta empresa' });

    const allowedFields = ['name', 'rut', 'industry', 'size', 'description', 'email', 'phone', 'website', 'logo'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Sin campos para actualizar' });

    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await admin.firestore().collection('companies').doc(req.params.id).update(updates);
    res.json({ success: true, ...updates });
  } catch (err) {
    console.error('Company update error:', err);
    res.status(500).json({ error: 'Error actualizando empresa' });
  }
});

// POST /companies/:id/jobs — create a job posting (also adds to public jobs collection with coords)
app.post('/companies/:id/jobs', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  const { title, description, salaryMin, salaryMax, location, type, tags, urgent, coords } = req.body;
  if (!title || !location) return res.status(400).json({ error: 'title y location requeridos' });

  try {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const companyDoc = await admin.firestore().collection('companies').doc(req.params.id).get();
    if (!companyDoc.exists) return res.status(404).json({ error: 'Empresa no encontrada' });
    const companyName = companyDoc.data().name || 'Empresa';
    const companyPlan = companyDoc.data().plan || 'free';

    if (companyPlan === 'free') {
      const activeCountSnap = await admin.firestore()
        .collection('companies').doc(req.params.id)
        .collection('jobs').where('active', '==', true).get();
      if (activeCountSnap.size >= 3) {
        return res.status(403).json({
          error: 'Límite alcanzado: Plan Gratuito solo permite 3 ofertas activas. Actualiza a Plan Professional para ofertas ilimitadas.',
        });
      }
    }

    await admin.firestore().collection('companies').doc(req.params.id).update({
      postedJobsCount: admin.firestore.FieldValue.increment(1),
    });

    const jobData = {
      id: jobId,
      companyId: req.params.id,
      companyName,
      title,
      description: description || '',
      salary: salaryMin && salaryMax ? `$${salaryMin} - $${salaryMax}` : salaryMin || '',
      salaryMin: salaryMin || '',
      salaryMax: salaryMax || '',
      location,
      type: type || 'Tiempo completo',
      tags: tags || [],
      urgent: urgent || false,
      active: true,
      candidateCount: 0,
      publisherId: req.user.uid,
      source: 'direct',
      time: 'Recién publicado',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Save to company's jobs subcollection
    await admin.firestore()
      .collection('companies').doc(req.params.id)
      .collection('jobs').doc(jobId).set(jobData);

    // If coords provided, also add to public jobs collection (appears on worker map)
    if (coords && coords.lat && coords.lng) {
      const publicJobData = { ...jobData, company: companyName, coords: [coords.lat, coords.lng] };
      await admin.firestore().collection('jobs').doc(jobId).set(publicJobData);
    }

    res.json({ id: jobId, ...jobData });
  } catch (err) {
    console.error('Job create error:', err);
    res.status(500).json({ error: 'Error creando publicación' });
  }
});

// GET /companies/:id/jobs — list company jobs
app.get('/companies/:id/jobs', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  try {
    const snap = await admin.firestore()
      .collection('companies').doc(req.params.id)
      .collection('jobs').orderBy('createdAt', 'desc').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (err) {
    res.status(500).json({ error: 'Error listando empleos' });
  }
});

// GET /companies/:id/candidates — list candidates across all company jobs
app.get('/companies/:id/candidates', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  try {
    const db = admin.firestore();
    const { status: statusFilter, jobId: jobIdFilter, search, sortBy = 'appliedAt', sortOrder = 'desc', limit: lim = '20', offset: off = '0' } = req.query;
    const limitNum = parseInt(lim);
    const offsetNum = parseInt(off);

    const companyJobsSnap = await db.collection('companies').doc(req.params.id).collection('jobs').get();
    const companyJobIds = companyJobsSnap.docs.map(d => d.id);

    if (companyJobIds.length === 0) return res.json({ candidates: [], totalCount: 0 });

    let query = db.collection('applications');
    if (jobIdFilter) {
      query = query.where('jobId', '==', jobIdFilter);
    }

    const appsSnap = await query.get();
    let applications = appsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    applications = applications.filter(a => companyJobIds.includes(a.jobId));

    if (statusFilter) {
      applications = applications.filter(a => a.status === statusFilter);
    }

    if (search) {
      const s = search.toLowerCase();
      applications = applications.filter(a =>
        (a.applicantName && a.applicantName.toLowerCase().includes(s)) ||
        (a.applicantEmail && a.applicantEmail.toLowerCase().includes(s)) ||
        (a.jobTitle && a.jobTitle.toLowerCase().includes(s))
      );
    }

    applications.sort((a, b) => {
      if (sortBy === 'applicantName') {
        const aName = (a.applicantName || '').toLowerCase();
        const bName = (b.applicantName || '').toLowerCase();
        return sortOrder === 'asc' ? aName.localeCompare(bName) : bName.localeCompare(aName);
      }
      const aTime = a.appliedAt?.toDate?.() || new Date(0);
      const bTime = b.appliedAt?.toDate?.() || new Date(0);
      return sortOrder === 'asc' ? aTime - bTime : bTime - aTime;
    });

    const totalCount = applications.length;
    const paged = applications.slice(offsetNum, offsetNum + limitNum).map(a => ({
      id: a.id,
      applicantName: a.applicantName,
      applicantEmail: a.applicantEmail,
      applicantPhone: a.applicantPhone,
      jobId: a.jobId,
      jobTitle: a.jobTitle,
      status: a.status || 'nuevo',
      appliedAt: a.appliedAt,
      cvData: a.cvData,
    }));

    res.json({ candidates: paged, totalCount, limit: limitNum, offset: offsetNum });
  } catch (err) {
    console.error('Company candidates error:', err);
    res.status(500).json({ error: 'Error listando candidatos' });
  }
});

function escapeCsv(val) {
  if (!val) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// GET /companies/:id/candidates/export — export candidates as CSV
app.get('/companies/:id/candidates/export', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  try {
    const db = admin.firestore();
    const companyJobsSnap = await db.collection('companies').doc(req.params.id).collection('jobs').get();
    const jobIds = companyJobsSnap.docs.map(d => d.id);
    
    const appsSnap = await db.collection('applications')
      .where('jobId', 'in', jobIds.length > 0 ? jobIds : ['_nonexistent'])
      .orderBy('appliedAt', 'desc')
      .get();
    
    const header = 'Nombre,Email,Teléfono,Oferta,Estado,Fecha Postulación,Habilidades,Experiencia';
    const rows = appsSnap.docs.map(doc => {
      const d = doc.data();
      const skills = (d.cvData?.skills || []).join('; ');
      const experience = (d.cvData?.experience || []).map((e) => `${e.company || ''} - ${e.position || ''}`).join('; ');
      return [
        escapeCsv(d.applicantName || ''),
        escapeCsv(d.applicantEmail || ''),
        escapeCsv(d.applicantPhone || ''),
        escapeCsv(d.jobTitle || ''),
        escapeCsv(d.status || 'nuevo'),
        d.appliedAt?.toDate?.()?.toISOString() || '',
        escapeCsv(skills),
        escapeCsv(experience),
      ].join(',');
    });
    
    const csv = [header, ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="candidatos.csv"');
    res.send('\uFEFF' + csv);
  } catch (err) {
    console.error('Export candidates error:', err);
    res.status(500).json({ error: 'Error exportando candidatos' });
  }
});

// PUT /companies/:id/jobs/:jobId — update job (e.g. deactivate)
app.put('/companies/:id/jobs/:jobId', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  try {
    const updates = { ...req.body, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    await admin.firestore()
      .collection('companies').doc(req.params.id)
      .collection('jobs').doc(req.params.jobId).update(updates);
    // Sync to public jobs collection
    await admin.firestore().collection('jobs').doc(req.params.jobId).update(updates).catch(() => {});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando empleo' });
  }
});

// DELETE /companies/:id/jobs/:jobId — deactivate job
app.delete('/companies/:id/jobs/:jobId', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  try {
    await admin.firestore()
      .collection('companies').doc(req.params.id)
      .collection('jobs').doc(req.params.jobId).update({ active: false });
    await admin.firestore().collection('jobs').doc(req.params.jobId).update({ active: false }).catch(() => {});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error eliminando empleo' });
  }
});

// POST /profile/cv — save or update user's CV data in Firestore
app.post('/profile/cv', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  const cvData = req.body;
  if (!cvData || !cvData.name) return res.status(400).json({ error: 'CV data requerida' });

  try {
    const cvDoc = {
      ...cvData,
      uid: req.user.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await admin.firestore().collection('user_cvs').doc(req.user.uid).set(cvDoc, { merge: true });
    res.json({ success: true, id: req.user.uid });
  } catch (err) {
    console.error('Save CV error:', err);
    res.status(500).json({ error: 'Error guardando CV' });
  }
});

// GET /profile/cv — get user's saved CV
app.get('/profile/cv', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  try {
    const doc = await admin.firestore().collection('user_cvs').doc(req.user.uid).get();
    if (!doc.exists) return res.status(404).json({ error: 'CV no encontrado' });
    res.json(doc.data());
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo CV' });
  }
});

// POST /applications — apply to a job with user's saved CV
app.post('/applications', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  const { jobId, jobTitle, company, companyId } = req.body;
  if (!jobId || !jobTitle) return res.status(400).json({ error: 'jobId y jobTitle requeridos' });

  try {
    const cvDoc = await admin.firestore().collection('user_cvs').doc(req.user.uid).get();
    if (!cvDoc.exists) return res.status(400).json({ error: 'Debes crear tu CV antes de postular' });

    const cvData = cvDoc.data();
    const appId = `app_${Date.now()}_${req.user.uid.slice(0, 6)}`;

    let resolvedCompanyId = companyId || '';
    if (!resolvedCompanyId && jobId) {
      const jobSnap = await admin.firestore().collection('jobs').doc(jobId).get();
      if (jobSnap.exists && jobSnap.data().companyId) {
        resolvedCompanyId = jobSnap.data().companyId;
      }
    }

    const application = {
      id: appId,
      uid: req.user.uid,
      applicantName: cvData.name || '',
      applicantEmail: cvData.email || '',
      applicantPhone: cvData.phone || '',
      jobId,
      jobTitle,
      company: company || '',
      companyId: resolvedCompanyId,
      cvData,
      status: 'Enviada',
      appliedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Save to applications collection (B2B panel will query by jobId)
    await admin.firestore().collection('applications').doc(appId).set(application);

    // Also save reference in user's sub-collection
    await admin.firestore()
      .collection('user_cvs').doc(req.user.uid)
      .collection('applications').doc(appId).set({ jobId, jobTitle, company, status: 'Enviada', appliedAt: admin.firestore.FieldValue.serverTimestamp() });

    res.json({ success: true, applicationId: appId });
  } catch (err) {
    console.error('Application error:', err);
    res.status(500).json({ error: 'Error enviando postulación' });
  }
});

// GET /applications — list user's job applications
app.get('/applications', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  try {
    const snap = await admin.firestore()
      .collection('user_cvs').doc(req.user.uid)
      .collection('applications').orderBy('appliedAt', 'desc').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (err) {
    res.status(500).json({ error: 'Error listando postulaciones' });
  }
});

// PUT /applications/:id/status — update application status
app.put('/applications/:id/status', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  const { status } = req.body;
  const validStatuses = ['nuevo', 'revisado', 'entrevista', 'contratado', 'rechazado', 'Enviada'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: `Status inválido. Valores permitidos: ${validStatuses.join(', ')}` });
  }

  try {
    const appRef = admin.firestore().collection('applications').doc(req.params.id);
    const doc = await appRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'Postulación no encontrada' });

    const updateData = {
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (status === 'revisado') {
      updateData.reviewedAt = admin.firestore.FieldValue.serverTimestamp();
    }

    await appRef.update(updateData);
    const updated = await appRef.get();
    res.json({ id: updated.id, ...updated.data() });
  } catch (err) {
    console.error('Application status update error:', err);
    res.status(500).json({ error: 'Error actualizando estado de postulación' });
  }
});

// POST /applications/:id/notes — add a note to an application
app.post('/applications/:id/notes', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'text requerido' });

  try {
    const appRef = admin.firestore().collection('applications').doc(req.params.id);
    const doc = await appRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'Postulación no encontrada' });

    const note = {
      text: text.trim(),
      authorId: req.user.uid,
      authorName: req.user.email || req.user.name || '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const noteRef = await appRef.collection('notes').add(note);
    res.json({ id: noteRef.id, ...note });
  } catch (err) {
    console.error('Application note add error:', err);
    res.status(500).json({ error: 'Error agregando nota' });
  }
});

// GET /applications/:id/notes — get all notes for an application
app.get('/applications/:id/notes', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  try {
    const snap = await admin.firestore()
      .collection('applications').doc(req.params.id)
      .collection('notes').orderBy('createdAt', 'desc').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (err) {
    console.error('Application notes get error:', err);
    res.status(500).json({ error: 'Error obteniendo notas' });
  }
});

// PUT /api/profile — actualizar perfil completo
app.put('/api/profile', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  const allowedFields = [
    'displayName', 'phone', 'bio', 'profession', 'specialty', 'experience',
    'education', 'availability', 'skills', 'services', 'location'
  ];
  const updates = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Sin campos para actualizar' });

  // Compute profile completion score
  try {
    const userDoc = await admin.firestore().collection('users').doc(req.user.uid).get();
    const current = userDoc.exists ? userDoc.data() : {};
    const merged = { ...current, ...updates };
    let score = 0;
    if (merged.photoURL) score += 12.5;
    if (merged.displayName) score += 12.5;
    if (merged.email) score += 12.5;
    if (merged.phone) score += 12.5;
    if (merged.phoneVerified || merged.isVerified) score += 12.5;
    if (merged.bio) score += 12.5;
    if (merged.location) score += 12.5;
    if (merged.rut) score += 12.5;
    updates.profileCompletionScore = Math.round(score);
  } catch { /* ignore scoring errors */ }

  updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

  try {
    await admin.firestore().collection('users').doc(req.user.uid).update(updates);
    res.json({ success: true, ...updates });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Error actualizando perfil' });
  }
});

// PUT /api/profile/rut — guardar RUT (inmutable, validado, único)
app.put('/api/profile/rut', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  const { rut } = req.body;
  if (!rut) return res.status(400).json({ error: 'RUT requerido' });

  const clean = rut.replace(/[^0-9kK]/g, '').toUpperCase();
  if (clean.length < 7 || clean.length > 9) return res.status(400).json({ error: 'RUT inválido' });

  try {
    // Check user doesn't already have a RUT
    const userDoc = await admin.firestore().collection('users').doc(req.user.uid).get();
    if (userDoc.exists && userDoc.data().rut) {
      return res.status(400).json({ error: 'El RUT ya fue registrado y no puede modificarse' });
    }

    // Check uniqueness
    const dupSnap = await admin.firestore().collection('users')
      .where('rut', '==', clean).limit(1).get();
    if (!dupSnap.empty) {
      return res.status(409).json({ error: 'Este RUT ya está registrado por otro usuario' });
    }

    await admin.firestore().collection('users').doc(req.user.uid).update({
      rut: clean,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Recalculate score
    const data = userDoc.exists ? userDoc.data() : {};
    let score = 0;
    if (data.photoURL) score += 12.5;
    if (data.displayName) score += 12.5;
    if (data.email) score += 12.5;
    if (data.phone) score += 12.5;
    if (data.phoneVerified || data.isVerified) score += 12.5;
    if (data.bio) score += 12.5;
    if (data.location) score += 12.5;
    score += 12.5; // RUT just added

    await admin.firestore().collection('users').doc(req.user.uid).update({
      profileCompletionScore: Math.round(score),
    });

    res.json({ success: true, rut: clean });
  } catch (err) {
    console.error('RUT update error:', err);
    res.status(500).json({ error: 'Error guardando RUT' });
  }
});

// DELETE /api/account — eliminar cuenta
app.delete('/api/account', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Contraseña requerida para eliminar cuenta' });

  try {
    // Delete user doc
    await admin.firestore().collection('users').doc(req.user.uid).delete();
    // Delete user CVs
    const cvSnap = await admin.firestore().collection('user_cvs').doc(req.user.uid).get();
    if (cvSnap.exists) await cvSnap.ref.delete();
    // Delete applications subcollection
    const appsSnap = await admin.firestore()
      .collection('user_cvs').doc(req.user.uid)
      .collection('applications').get();
    for (const doc of appsSnap.docs) await doc.ref.delete();
    // Delete user from Auth
    await admin.auth().deleteUser(req.user.uid);
    res.json({ success: true, message: 'Cuenta eliminada exitosamente' });
  } catch (err) {
    console.error('Account delete error:', err);
    res.status(500).json({ error: 'Error eliminando cuenta' });
  }
});

// GET /api/profile/:uid/public — perfil público de otro usuario
app.get('/api/profile/:uid/public', async (req, res) => {
  try {
    const doc = await admin.firestore().collection('users').doc(req.params.uid).get();
    if (!doc.exists) return res.status(404).json({ error: 'Usuario no encontrado' });
    const data = doc.data();
    res.json({
      uid: data.uid,
      displayName: data.displayName || '',
      photoURL: data.photoURL || null,
      coverPhotoURL: data.coverPhotoURL || null,
      bio: data.bio || '',
      profession: data.profession || '',
      specialty: data.specialty || '',
      rating: data.rating || 0,
      reviewCount: data.reviewCount || 0,
      completedJobs: data.completedJobs || 0,
      publishedJobs: data.publishedJobs || 0,
      isVerified: data.isVerified || false,
      skills: data.skills || [],
      services: data.services || [],
      role: data.role || 'user',
      createdAt: data.createdAt?._seconds || null,
    });
  } catch (err) {
    console.error('Public profile error:', err);
    res.status(500).json({ error: 'Error obteniendo perfil' });
  }
});

// ─── ADMIN ENDPOINTS ────────────────────────────────────────────
const ADMIN_EMAILS = ['drozast@gmail.com', 'seba.hormero@gmail.com'];

const requireAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  if (!ADMIN_EMAILS.includes(req.user.email)) return res.status(403).json({ error: 'Acceso denegado' });
  next();
};

// GET /admin/stats — dashboard stats con datos de hoy, ayer y semana
app.get('/admin/stats', requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    const now = new Date();

    // Ranges
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
    const startOfWeek = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalJobsSnap, totalUsersSnap, totalAppsSnap, userJobsSnap,
      todayUsersSnap, todayJobsSnap, todayAppsSnap,
      yesterdayUsersSnap, yesterdayJobsSnap, yesterdayAppsSnap,
      weekUsersSnap, weekJobsSnap, weekAppsSnap,
    ] = await Promise.all([
      db.collection('jobs').count().get(),
      db.collection('users').count().get(),
      db.collection('applications').count().get(),
      db.collection('jobs').where('fuente', '==', 'usuario').count().get(),
      // Today
      db.collection('users').where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startOfToday)).count().get(),
      db.collection('jobs').where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startOfToday)).count().get(),
      db.collection('applications').where('appliedAt', '>=', admin.firestore.Timestamp.fromDate(startOfToday)).count().get(),
      // Yesterday
      db.collection('users').where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startOfYesterday)).where('createdAt', '<', admin.firestore.Timestamp.fromDate(startOfToday)).count().get(),
      db.collection('jobs').where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startOfYesterday)).where('createdAt', '<', admin.firestore.Timestamp.fromDate(startOfToday)).count().get(),
      db.collection('applications').where('appliedAt', '>=', admin.firestore.Timestamp.fromDate(startOfYesterday)).where('appliedAt', '<', admin.firestore.Timestamp.fromDate(startOfToday)).count().get(),
      // This week (last 7 days)
      db.collection('users').where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startOfWeek)).count().get(),
      db.collection('jobs').where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startOfWeek)).count().get(),
      db.collection('applications').where('appliedAt', '>=', admin.firestore.Timestamp.fromDate(startOfWeek)).count().get(),
    ]);

    res.json({
      totalJobs: totalJobsSnap.data().count,
      totalUsers: totalUsersSnap.data().count,
      totalApplications: totalAppsSnap.data().count,
      totalUserJobs: userJobsSnap.data().count,
      today: {
        users: todayUsersSnap.data().count,
        jobs: todayJobsSnap.data().count,
        applications: todayAppsSnap.data().count,
      },
      yesterday: {
        users: yesterdayUsersSnap.data().count,
        jobs: yesterdayJobsSnap.data().count,
        applications: yesterdayAppsSnap.data().count,
      },
      week: {
        users: weekUsersSnap.data().count,
        jobs: weekJobsSnap.data().count,
        applications: weekAppsSnap.data().count,
      },
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Error obteniendo estadísticas' });
  }
});

// GET /admin/analytics?days=7|30 — analytics data (server-side, evita índices compuestos)
app.get('/admin/analytics', requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    const days = parseInt(req.query.days) || 7;
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));
    const sinceTs = admin.firestore.Timestamp.fromDate(since);

    const [pvSnap, evSnap, convSnap] = await Promise.all([
      db.collection('analytics_pageviews').where('createdAt', '>=', sinceTs).get(),
      db.collection('analytics_events').where('createdAt', '>=', sinceTs).get(),
      db.collection('analytics_conversions').where('createdAt', '>=', sinceTs).get(),
    ]);

    const pvDocs = pvSnap.docs.map(d => d.data());
    const evDocs = evSnap.docs.map(d => d.data());
    const convDocs = convSnap.docs.map(d => d.data());

    // Visits by day
    const dayMap = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      const key = d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
      dayMap[key] = 0;
    }
    pvDocs.forEach(doc => {
      if (!doc.createdAt) return;
      const d = doc.createdAt.toDate();
      const key = d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
      if (key in dayMap) dayMap[key] = (dayMap[key] || 0) + 1;
    });
    const viewsByDay = Object.entries(dayMap).map(([date, count]) => ({ date, count }));

    // Views by page
    const pageMap = {};
    pvDocs.forEach(doc => {
      const p = doc.page || 'unknown';
      pageMap[p] = (pageMap[p] || 0) + 1;
    });
    const viewsByPage = Object.entries(pageMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, count]) => ({ label, count }));

    // Top viewed jobs
    const viewedMap = {};
    evDocs.forEach(doc => {
      if (doc.type !== 'view_job_popup') return;
      const key = doc.jobTitle || 'Sin título';
      if (!viewedMap[key]) viewedMap[key] = { company: doc.company || '', count: 0 };
      viewedMap[key].count++;
    });
    const topViewedJobs = Object.entries(viewedMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map(([label, v]) => ({ label, sublabel: v.company, count: v.count }));

    // Top clicked jobs (conversions)
    const clickedMap = {};
    convDocs.forEach(doc => {
      const key = doc.jobTitle || 'Sin título';
      if (!clickedMap[key]) clickedMap[key] = { company: doc.company || '', count: 0 };
      clickedMap[key].count++;
    });
    const topClickedJobs = Object.entries(clickedMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map(([label, v]) => ({ label, sublabel: v.company, count: v.count }));

    // Event type breakdown
    const evTypeMap = {};
    evDocs.forEach(doc => {
      const t = doc.type || 'unknown';
      evTypeMap[t] = (evTypeMap[t] || 0) + 1;
    });
    const eventBreakdown = Object.entries(evTypeMap)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count }));

    // Platform breakdown on conversions (all time - lightweight count)
    const allConvSnap = await db.collection('analytics_conversions').get();
    let web = 0, flutter = 0;
    allConvSnap.docs.forEach(doc => {
      if (doc.data().platform === 'flutter') flutter++; else web++;
    });

    res.json({
      totalViews: pvDocs.length,
      totalEvents: evDocs.length,
      totalConversions: convDocs.length,
      viewsByDay,
      viewsByPage,
      topViewedJobs,
      topClickedJobs,
      eventBreakdown,
      platformBreakdown: { web, flutter },
    });
  } catch (err) {
    console.error('Admin analytics error:', err);
    res.status(500).json({ error: 'Error obteniendo analytics' });
  }
});

// GET /admin/analytics/visits-detail?from=X&to=Y&page=X — detalle de visitas
app.get('/admin/analytics/visits-detail', requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    const { from, to, page = '' } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from y to requeridos (ISO date)' });

    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    const fromTs = admin.firestore.Timestamp.fromDate(fromDate);
    const toTs = admin.firestore.Timestamp.fromDate(toDate);

    let query = db.collection('analytics_pageviews')
      .where('createdAt', '>=', fromTs)
      .where('createdAt', '<=', toTs);
    const snap = await query.get();
    let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (page) docs = docs.filter(d => d.page === page);

    // Aggregate by day
    const dayMap = {};
    docs.forEach(doc => {
      if (!doc.createdAt) return;
      const d = doc.createdAt.toDate();
      const key = d.toISOString().slice(0, 10);
      if (!dayMap[key]) dayMap[key] = { date: key, total: 0, pages: {} };
      dayMap[key].total++;
      const p = doc.page || 'unknown';
      dayMap[key].pages[p] = (dayMap[key].pages[p] || 0) + 1;
    });

    const daily = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));
    // Unique pages list
    const pagesList = [...new Set(docs.map(d => d.page || 'unknown'))];

    res.json({ daily, pagesList, totalRecords: docs.length });
  } catch (err) {
    console.error('Visits detail error:', err);
    res.status(500).json({ error: 'Error obteniendo detalle de visitas' });
  }
});

// GET /admin/analytics/jobs-detail?from=X&to=Y&type=viewed|clicked&search=X&limit=X&offset=X
app.get('/admin/analytics/jobs-detail', requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    const { from, to, type = 'viewed', search = '', limit: lim = '50', offset: off = '0' } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from y to requeridos (ISO date)' });

    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    const fromTs = admin.firestore.Timestamp.fromDate(fromDate);
    const toTs = admin.firestore.Timestamp.fromDate(toDate);
    const limitNum = parseInt(lim);
    const offsetNum = parseInt(off);

    const collectionName = type === 'clicked' ? 'analytics_conversions' : 'analytics_events';
    let query = db.collection(collectionName)
      .where('createdAt', '>=', fromTs)
      .where('createdAt', '<=', toTs);

    if (type === 'viewed') {
      // Only view_job_popup events
    }

    const snap = await query.get();
    let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // For viewed: filter only view_job_popup
    if (type === 'viewed') docs = docs.filter(d => d.type === 'view_job_popup');

    // Aggregate by job title
    const jobMap = {};
    docs.forEach(doc => {
      const key = doc.jobTitle || 'Sin título';
      if (!jobMap[key]) jobMap[key] = { title: key, company: doc.company || '', jobId: doc.jobId || '', count: 0, lastEvent: null };
      jobMap[key].count++;
      if (!jobMap[key].lastEvent || (doc.createdAt && doc.createdAt.toDate() > jobMap[key].lastEvent)) {
        jobMap[key].lastEvent = doc.createdAt ? doc.createdAt.toDate().toISOString() : null;
      }
    });

    let jobs = Object.values(jobMap).sort((a, b) => b.count - a.count);

    // Search
    if (search) {
      const q = search.toLowerCase();
      jobs = jobs.filter(j => j.title.toLowerCase().includes(q) || j.company.toLowerCase().includes(q));
    }

    const total = jobs.length;
    jobs = jobs.slice(offsetNum, offsetNum + limitNum);

    res.json({ jobs, total });
  } catch (err) {
    console.error('Jobs detail error:', err);
    res.status(500).json({ error: 'Error obteniendo detalle de ofertas' });
  }
});

// GET /admin/analytics/events-detail?from=X&to=Y&type=X&limit=X&offset=X
app.get('/admin/analytics/events-detail', requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    const { from, to, type = '', limit: lim = '50', offset: off = '0' } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from y to requeridos (ISO date)' });

    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    const fromTs = admin.firestore.Timestamp.fromDate(fromDate);
    const toTs = admin.firestore.Timestamp.fromDate(toDate);
    const limitNum = parseInt(lim);
    const offsetNum = parseInt(off);

    let evQuery = db.collection('analytics_events')
      .where('createdAt', '>=', fromTs)
      .where('createdAt', '<=', toTs);
    const evSnap = await evQuery.get();
    let events = evSnap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        type: data.type,
        jobTitle: data.jobTitle || null,
        company: data.company || null,
        userId: data.userId || null,
        platform: data.platform || 'web',
        createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null,
      };
    });

    if (type) events = events.filter(e => e.type === type);
    events.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    const total = events.length;
    events = events.slice(offsetNum, offsetNum + limitNum);

    // Get unique event types for filter dropdown
    const allTypesSnap = await db.collection('analytics_events').limit(500).get();
    const eventTypes = [...new Set(allTypesSnap.docs.map(d => d.data().type).filter(Boolean))];

    res.json({ events, total, eventTypes });
  } catch (err) {
    console.error('Events detail error:', err);
    res.status(500).json({ error: 'Error obteniendo detalle de eventos' });
  }
});

// GET /admin/analytics/kpi-advanced — DAU, geography, peak hours
app.get('/admin/analytics/kpi-advanced', requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const thirtyDaysTs = admin.firestore.Timestamp.fromDate(thirtyDaysAgo);

    // Get pageviews from last 30 days
    const pvSnap = await db.collection('analytics_pageviews')
      .where('createdAt', '>=', thirtyDaysTs).get();
    const pvDocs = pvSnap.docs.map(d => d.data());

    // DAU (users per day)
    const dailyUsersMap = {};
    pvDocs.forEach(doc => {
      if (!doc.userId || !doc.createdAt) return;
      const day = doc.createdAt.toDate().toISOString().slice(0, 10);
      if (!dailyUsersMap[day]) dailyUsersMap[day] = new Set();
      dailyUsersMap[day].add(doc.userId);
    });
    const dau = Object.entries(dailyUsersMap)
      .map(([date, users]) => ({ date, count: users.size }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Peak hours
    const hourMap = {};
    for (let h = 0; h < 24; h++) hourMap[h] = 0;
    pvDocs.forEach(doc => {
      if (!doc.createdAt) return;
      const h = doc.createdAt.toDate().getHours();
      hourMap[h] = (hourMap[h] || 0) + 1;
    });
    const peakHours = Object.entries(hourMap)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }))
      .sort((a, b) => a.hour - b.hour);

    // Page popularity ranking (all time)
    const pageMap = {};
    pvDocs.forEach(doc => {
      const p = doc.page || 'unknown';
      pageMap[p] = (pageMap[p] || 0) + 1;
    });
    const pageRanking = Object.entries(pageMap)
      .map(([page, count]) => ({ page, count }))
      .sort((a, b) => b.count - a.count);

    res.json({ dau, peakHours, pageRanking });
  } catch (err) {
    console.error('KPI advanced error:', err);
    res.status(500).json({ error: 'Error obteniendo KPIs avanzados' });
  }
});

// GET /admin/ofertas — list all job offers with pagination
app.get('/admin/ofertas', requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    const limitNum = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const source = req.query.source;
    const search = req.query.search;

    // Simple query without orderBy to avoid index requirement
    let query = source
      ? db.collection('jobs').where('fuente', '==', source)
      : db.collection('jobs');

    const snap = await query.get();
    let jobs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Sort in memory (createdAt or fechaScraping)
    jobs.sort((a, b) => {
      const aTime = a.createdAt?.toDate?.() || a.fechaScraping?.toDate?.() || new Date(0);
      const bTime = b.createdAt?.toDate?.() || b.fechaScraping?.toDate?.() || new Date(0);
      return bTime - aTime;
    });

    if (search) {
      const term = search.toLowerCase();
      jobs = jobs.filter(j =>
        (j.title && j.title.toLowerCase().includes(term)) ||
        (j.company && j.company.toLowerCase().includes(term)) ||
        (j.location && j.location.toLowerCase().includes(term)) ||
        (j.titulo && j.titulo.toLowerCase().includes(term)) ||
        (j.empresa && j.empresa.toLowerCase().includes(term)) ||
        (j.comuna && j.comuna.toLowerCase().includes(term))
      );
    }

    const total = jobs.length;
    jobs = jobs.slice(offset, offset + limitNum);

    res.json({ jobs, total, limit: limitNum, offset });
  } catch (err) {
    console.error('Admin ofertas error:', err);
    res.status(500).json({ error: 'Error listando ofertas' });
  }
});

// GET /admin/ofertas/:id — get single offer detail
app.get('/admin/ofertas/:id', requireAdmin, async (req, res) => {
  try {
    const doc = await admin.firestore().collection('jobs').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Oferta no encontrada' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo oferta' });
  }
});

// POST /admin/ofertas — manually create a job offer
app.post('/admin/ofertas', requireAdmin, async (req, res) => {
  try {
    const jobData = {
      ...req.body,
      fuente: req.body.fuente || 'admin',
      active: req.body.active !== undefined ? req.body.active : true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    const docRef = await admin.firestore().collection('jobs').add(jobData);
    res.json({ id: docRef.id, ...jobData });
  } catch (err) {
    console.error('Admin create oferta error:', err);
    res.status(500).json({ error: 'Error creando oferta' });
  }
});

// POST /admin/geocode-all — update coords for all jobs missing them
app.post('/admin/geocode-all', requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    const snap = await db.collection('jobs').get();
    let updated = 0;
    for (const doc of snap.docs) {
      const data = doc.data();
      if (!data.coords || !Array.isArray(data.coords) || data.coords.length !== 2) {
        const loc = data.location || data.comuna || '';
        const coords = await geocodeLocation(loc);
        if (coords) {
          await doc.ref.update({ coords });
          updated++;
        }
      }
    }
    res.json({ success: true, updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /admin/ofertas/:id — update a job offer
app.put('/admin/ofertas/:id', requireAdmin, async (req, res) => {
  try {
    const updates = {
      ...req.body,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await admin.firestore().collection('jobs').doc(req.params.id).update(updates);
    res.json({ success: true, id: req.params.id });
  } catch (err) {
    console.error('Admin update oferta error:', err);
    res.status(500).json({ error: 'Error actualizando oferta' });
  }
});

// DELETE /admin/ofertas/:id — delete a job offer
app.delete('/admin/ofertas/:id', requireAdmin, async (req, res) => {
  try {
    await admin.firestore().collection('jobs').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (err) {
    console.error('Admin delete oferta error:', err);
    res.status(500).json({ error: 'Error eliminando oferta' });
  }
});

// GET /admin/users — list all users
app.get('/admin/users', requireAdmin, async (req, res) => {
  try {
    const { search = '', role = '' } = req.query;
    const snap = await admin.firestore().collection('users').get();
    let users = snap.docs.map(d => {
      const data = d.data();
      const isAdmin = ADMIN_EMAILS.includes(data.email);
      return { id: d.id, email: data.email || '', displayName: data.displayName || '', ...data, role: isAdmin ? 'admin' : (data.role || 'worker') };
    });

    // Filters
    if (search) {
      const q = search.toLowerCase();
      users = users.filter(u =>
        (u.email || '').toLowerCase().includes(q) ||
        (u.displayName || '').toLowerCase().includes(q)
      );
    }
    if (role && role !== 'all') {
      users = users.filter(u => u.role === role);
    }

    // Sort by createdAt descending (newest first)
    users.sort((a, b) => {
      const dateA = a.createdAt?._seconds || a.createdAt?.seconds || 0;
      const dateB = b.createdAt?._seconds || b.createdAt?.seconds || 0;
      return dateB - dateA;
    });

    res.json(users);
  } catch (err) {
    console.error('Admin users error:', err);
    res.status(500).json({ error: 'Error listando usuarios' });
  }
});

// PUT /admin/users/:id/role — change user role
app.put('/admin/users/:id/role', requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['admin', 'worker', 'company'].includes(role)) {
      return res.status(400).json({ error: 'Rol inválido' });
    }
    await admin.firestore().collection('users').doc(req.params.id).update({ role });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando rol' });
  }
});

// GET /admin/config — get scraper config
app.get('/admin/config', requireAdmin, async (req, res) => {
  try {
    const doc = await admin.firestore().collection('config').doc('scraper').get();
    if (!doc.exists) {
      const defaults = { frequency: 60, enabled: false, sources: [], region: 'chile', maxPerRun: 50 };
      return res.json(defaults);
    }
    res.json(doc.data());
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo configuración' });
  }
});

// PUT /admin/config — update scraper config
app.put('/admin/config', requireAdmin, async (req, res) => {
  try {
    const configData = {
      ...req.body,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await admin.firestore().collection('config').doc('scraper').set(configData, { merge: true });
    res.json({ success: true });
  } catch (err) {
    console.error('Admin config update error:', err);
    res.status(500).json({ error: 'Error actualizando configuración' });
  }
});

// ─── SCRAPER HELPERS ────────────────────────────────────────────

const SCRAPER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const SCRAPER_REQUEST_TIMEOUT = 30000;
const SCRAPER_DELAY_MS = 3000;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function contentHash(titulo, empresa, descripcion) {
  const raw = `${titulo || ''}${empresa || ''}${(descripcion || '').substring(0, 500)}`;
  return crypto.createHash('sha1').update(raw, 'utf8').digest('hex');
}

const REGION_MAP = {
  'Todo Chile': '',
  'Metropolitana': 'R.Metropolitana',
  'Valparaíso': 'Valparaiso',
  'Biobío': 'Biobio',
  'Araucanía': 'Araucania',
  'Maule': 'Maule',
  'O\'Higgins': 'O.Higgins',
  'Los Lagos': 'Los+Lagos',
  'Coquimbo': 'Coquimbo',
  'Antofagasta': 'Antofagasta',
  'Tarapacá': 'Tarapaca',
  'Atacama': 'Atacama',
  'Ñuble': 'Nuble',
  'Los Ríos': 'Los+Rios',
  'Arica y Parinacota': 'Arica+y+Parinacota',
  'Aysén': 'Aysen',
  'Magallanes': 'Magallanes',
};

async function scrapeComputrabajo(maxOfertas = 50, region = 'Todo Chile') {
  const baseUrl = 'https://cl.computrabajo.com';
  const regionParam = REGION_MAP[region] || '';
  const jobs = [];
  let page = 1;
  const maxPages = Math.ceil(maxOfertas / 20) + 1; // ~20 listings per page

  while (jobs.length < maxOfertas && page <= maxPages) {
    try {
      const listUrl = regionParam
        ? `${baseUrl}/ofertas-de-trabajo/?q=&l=${regionParam}&p=${page}`
        : `${baseUrl}/ofertas-de-trabajo/?q=&p=${page}`;
      console.log(`[Scraper] Fetching listing page ${page}: ${listUrl}`);

      const listResp = await axios.get(listUrl, {
        headers: { 'User-Agent': SCRAPER_USER_AGENT, 'Accept-Language': 'es-CL,es;q=0.9' },
        timeout: SCRAPER_REQUEST_TIMEOUT,
      });

      const $list = cheerio.load(listResp.data);
      const detailLinks = [];

      $list('a[href*="/ofertas-de-trabajo/oferta-de-trabajo-de"]').each((_, el) => {
        const href = $list(el).attr('href');
        if (href && !detailLinks.includes(href)) {
          detailLinks.push(href.startsWith('http') ? href : `${baseUrl}${href}`);
        }
      });

      console.log(`[Scraper] Page ${page}: found ${detailLinks.length} detail links`);

      if (detailLinks.length === 0) break; // No more results

      for (const link of detailLinks) {
        if (jobs.length >= maxOfertas) break;

        try {
          await sleep(SCRAPER_DELAY_MS);
          console.log(`[Scraper] Fetching detail: ${link}`);

          const detailResp = await axios.get(link, {
            headers: { 'User-Agent': SCRAPER_USER_AGENT, 'Accept-Language': 'es-CL,es;q=0.9' },
            timeout: SCRAPER_REQUEST_TIMEOUT,
          });

          const $ = cheerio.load(detailResp.data);

          // Extract title
          const titulo = $('h1.box_detail').text().trim() || $('h1').first().text().trim() || '';

          // Extract company and location from the <p> after h1
          const subtitleText = $('h1.box_detail').next('p').text().trim() || $('h1').next('p').text().trim() || '';
          const subtitleParts = subtitleText.split(' - ').map(s => s.trim());
          const empresa = subtitleParts[0] || '';
          const comuna = subtitleParts[1] || '';

          // Extract description
          const descripcion = $('div[div-link="oferta"] p.mbB').text().trim()
            || $('div.box_detail p.mbB').text().trim()
            || $('div.cm-info p').text().trim()
            || '';

          // Extract date — skip "Palabras clave" lines
          let fechaPublicacion = '';
          $('div[div-link="oferta"] p.fc_aux, div.box_detail p.fc_aux').each((_, el) => {
            const text = $(el).text().trim();
            if (text && !text.toLowerCase().includes('palabras clave')) {
              fechaPublicacion = fechaPublicacion || text;
            }
          });

          if (!titulo) {
            console.log(`[Scraper] Skipping link (no title): ${link}`);
            continue;
          }

          jobs.push({
            titulo,
            empresa,
            comuna,
            descripcion,
            fecha_publicacion: fechaPublicacion,
            url_original: link,
            fuente: 'computrabajo',
          });

          console.log(`[Scraper] Extracted: ${titulo} @ ${empresa} (${jobs.length}/${maxOfertas})`);
        } catch (detailErr) {
          console.error(`[Scraper] Error fetching detail ${link}:`, detailErr.message);
          // Continue with next job
        }
      }

      page++;
      if (jobs.length < maxOfertas) await sleep(SCRAPER_DELAY_MS);
    } catch (pageErr) {
      console.error(`[Scraper] Error fetching listing page ${page}:`, pageErr.message);
      break;
    }
  }

  console.log(`[Scraper] Finished scraping computrabajo. Total raw jobs: ${jobs.length}`);
  return jobs;
}

// ─── Region maps for Trabajando.cl ────────────────────────────
const TRABAJANDO_REGION_MAP = {
  'Todo Chile': '',
  'Metropolitana': '13',
  'Valparaíso': '5',
  'Biobío': '8',
  'Araucanía': '9',
  'Maule': '7',
  'O\'Higgins': '6',
  'Los Lagos': '10',
  'Coquimbo': '4',
  'Antofagasta': '2',
  'Tarapacá': '1',
  'Atacama': '3',
  'Ñuble': '16',
  'Los Ríos': '14',
  'Arica y Parinacota': '15',
  'Aysén': '11',
  'Magallanes': '12',
};

async function scrapeTrabajando(maxOfertas = 50, region = 'Todo Chile') {
  const baseUrl = 'https://www.trabajando.cl';
  const regionId = TRABAJANDO_REGION_MAP[region] || '';
  const jobs = [];
  let page = 1;
  const maxPages = Math.ceil(maxOfertas / 20) + 1;

  while (jobs.length < maxOfertas && page <= maxPages) {
    try {
      let listUrl = `${baseUrl}/empleos?page=${page}`;
      if (regionId) {
        listUrl = `${baseUrl}/empleos?region=${regionId}&page=${page}`;
      }
      console.log(`[Scraper:trabajando] Fetching listing page ${page}: ${listUrl}`);

      const listResp = await axios.get(listUrl, {
        headers: { 'User-Agent': SCRAPER_USER_AGENT, 'Accept-Language': 'es-CL,es;q=0.9' },
        timeout: SCRAPER_REQUEST_TIMEOUT,
      });

      const $list = cheerio.load(listResp.data);
      const detailLinks = [];

      // Try multiple selectors to find job links
      $list('a[href*="/empleo/"]').each((_, el) => {
        const href = $list(el).attr('href');
        if (href && !detailLinks.includes(href)) {
          detailLinks.push(href.startsWith('http') ? href : `${baseUrl}${href}`);
        }
      });

      // Fallback: try job-card links
      if (detailLinks.length === 0) {
        $list('.job-card a, .listado-avisos a').each((_, el) => {
          const href = $list(el).attr('href');
          if (href && href.includes('/empleo') && !detailLinks.includes(href)) {
            detailLinks.push(href.startsWith('http') ? href : `${baseUrl}${href}`);
          }
        });
      }

      console.log(`[Scraper:trabajando] Page ${page}: found ${detailLinks.length} detail links`);

      if (detailLinks.length === 0) break;

      for (const link of detailLinks) {
        if (jobs.length >= maxOfertas) break;

        try {
          await sleep(SCRAPER_DELAY_MS);
          console.log(`[Scraper:trabajando] Fetching detail: ${link}`);

          const detailResp = await axios.get(link, {
            headers: { 'User-Agent': SCRAPER_USER_AGENT, 'Accept-Language': 'es-CL,es;q=0.9' },
            timeout: SCRAPER_REQUEST_TIMEOUT,
          });

          const $ = cheerio.load(detailResp.data);

          // Extract title — try multiple selectors
          const titulo = $('h1').first().text().trim()
            || $('.cargo').first().text().trim()
            || $('.job-title').first().text().trim()
            || '';

          // Extract company
          const empresa = $('.empresa').first().text().trim()
            || $('.company-name').first().text().trim()
            || $('a[href*="/empresa/"]').first().text().trim()
            || '';

          // Extract location
          const comuna = $('.ubicacion').first().text().trim()
            || $('.location').first().text().trim()
            || '';

          // Extract description
          const descripcion = $('.descripcion').first().text().trim()
            || $('.job-description').first().text().trim()
            || $('.detalle').first().text().trim()
            || $('div[class*="description"]').first().text().trim()
            || '';

          // Extract date
          const fechaPublicacion = $('time').first().attr('datetime')
            || $('time').first().text().trim()
            || $('.fecha').first().text().trim()
            || '';

          if (!titulo) {
            console.log(`[Scraper:trabajando] Skipping link (no title): ${link}`);
            continue;
          }

          jobs.push({
            titulo,
            empresa,
            comuna,
            descripcion,
            fecha_publicacion: fechaPublicacion,
            url_original: link,
            fuente: 'trabajando',
          });

          console.log(`[Scraper:trabajando] Extracted: ${titulo} @ ${empresa} (${jobs.length}/${maxOfertas})`);
        } catch (detailErr) {
          console.error(`[Scraper:trabajando] Error fetching detail ${link}:`, detailErr.message);
        }
      }

      page++;
      if (jobs.length < maxOfertas) await sleep(SCRAPER_DELAY_MS);
    } catch (pageErr) {
      console.error(`[Scraper:trabajando] Error fetching listing page ${page}:`, pageErr.message);
      break;
    }
  }

  console.log(`[Scraper:trabajando] Finished scraping. Total raw jobs: ${jobs.length}`);
  return jobs;
}

// ─── Region maps for ChileTrabajos.cl ─────────────────────────
const CHILETRABAJOS_REGION_MAP = {
  'Todo Chile': '',
  'Metropolitana': 'region-metropolitana',
  'Valparaíso': 'valparaiso',
  'Biobío': 'biobio',
  'Araucanía': 'araucania',
  'Maule': 'maule',
  'O\'Higgins': 'ohiggins',
  'Los Lagos': 'los-lagos',
  'Coquimbo': 'coquimbo',
  'Antofagasta': 'antofagasta',
  'Tarapacá': 'tarapaca',
  'Atacama': 'atacama',
  'Ñuble': 'nuble',
  'Los Ríos': 'los-rios',
  'Arica y Parinacota': 'arica-y-parinacota',
  'Aysén': 'aysen',
  'Magallanes': 'magallanes',
};

async function scrapeChileTrabajos(maxOfertas = 50, region = 'Todo Chile') {
  const baseUrl = 'https://www.chiletrabajos.cl';
  const regionSlug = CHILETRABAJOS_REGION_MAP[region] || '';
  const jobs = [];
  let page = 1;
  const maxPages = Math.ceil(maxOfertas / 20) + 1;

  while (jobs.length < maxOfertas && page <= maxPages) {
    try {
      let listUrl = `${baseUrl}/encuentra-un-empleo?page=${page}`;
      if (regionSlug) {
        listUrl = `${baseUrl}/encuentra-un-empleo?region=${regionSlug}&page=${page}`;
      }
      console.log(`[Scraper:chiletrabajos] Fetching listing page ${page}: ${listUrl}`);

      const listResp = await axios.get(listUrl, {
        headers: { 'User-Agent': SCRAPER_USER_AGENT, 'Accept-Language': 'es-CL,es;q=0.9' },
        timeout: SCRAPER_REQUEST_TIMEOUT,
      });

      const $list = cheerio.load(listResp.data);
      const detailLinks = [];

      // Try multiple selectors to find job links
      $list('a[href*="/trabajo/"]').each((_, el) => {
        const href = $list(el).attr('href');
        if (href && !detailLinks.includes(href)) {
          detailLinks.push(href.startsWith('http') ? href : `${baseUrl}${href}`);
        }
      });

      // Fallback selectors
      if (detailLinks.length === 0) {
        $list('.job-item a, .empleo-link').each((_, el) => {
          const href = $list(el).attr('href');
          if (href && href.includes('/trabajo') && !detailLinks.includes(href)) {
            detailLinks.push(href.startsWith('http') ? href : `${baseUrl}${href}`);
          }
        });
      }

      console.log(`[Scraper:chiletrabajos] Page ${page}: found ${detailLinks.length} detail links`);

      if (detailLinks.length === 0) break;

      for (const link of detailLinks) {
        if (jobs.length >= maxOfertas) break;

        try {
          await sleep(SCRAPER_DELAY_MS);
          console.log(`[Scraper:chiletrabajos] Fetching detail: ${link}`);

          const detailResp = await axios.get(link, {
            headers: { 'User-Agent': SCRAPER_USER_AGENT, 'Accept-Language': 'es-CL,es;q=0.9' },
            timeout: SCRAPER_REQUEST_TIMEOUT,
          });

          const $ = cheerio.load(detailResp.data);

          // Extract title — .titulo-detalle or first .title
          const titulo = $('.titulo-detalle').first().text().trim()
            || $('.title.font-weight-bold').first().text().trim()
            || $('h1').first().text().trim()
            || '';

          // Extract company — from .datos-empresa img alt or text
          const empresa = $('.datos-empresa a').first().text().trim()
            || $('.datos-empresa img').first().attr('alt')
            || '';

          // Extract location — span after fa-location-arrow icon
          let comuna = '';
          $('span').each((_, el) => {
            const text = $(el).text().trim();
            const hasLocationIcon = $(el).find('.fa-location-arrow').length > 0;
            if (hasLocationIcon && text) {
              comuna = text;
              return false;
            }
          });

          // Extract description — .detalle-oferta content
          const descripcion = $('.detalle-oferta').text().trim().substring(0, 2000)
            || $('.job-item.detalle').text().trim().substring(0, 2000)
            || '';

          // Extract date
          const fechaPublicacion = $('time').first().attr('datetime')
            || $('time').first().text().trim()
            || '';

          if (!titulo) {
            console.log(`[Scraper:chiletrabajos] Skipping link (no title): ${link}`);
            continue;
          }

          jobs.push({
            titulo,
            empresa,
            comuna,
            descripcion,
            fecha_publicacion: fechaPublicacion,
            url_original: link,
            fuente: 'chiletrabajos',
          });

          console.log(`[Scraper:chiletrabajos] Extracted: ${titulo} @ ${empresa} (${jobs.length}/${maxOfertas})`);
        } catch (detailErr) {
          console.error(`[Scraper:chiletrabajos] Error fetching detail ${link}:`, detailErr.message);
        }
      }

      page++;
      if (jobs.length < maxOfertas) await sleep(SCRAPER_DELAY_MS);
    } catch (pageErr) {
      console.error(`[Scraper:chiletrabajos] Error fetching listing page ${page}:`, pageErr.message);
      break;
    }
  }

  console.log(`[Scraper:chiletrabajos] Finished scraping. Total raw jobs: ${jobs.length}`);
  return jobs;
}

// ─── Jooble API Rate Limiter (500 req/day free tier) ────────────
async function checkJoobleRateLimit(db) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const docRef = db.collection('config').doc('jooble_usage');
  const doc = await docRef.get();

  if (!doc.exists || doc.data().date !== today) {
    // Reset counter for new day
    await docRef.set({ date: today, count: 0 });
    return { allowed: true, count: 0 };
  }

  const count = doc.data().count || 0;
  if (count >= 450) {
    console.log(`[Scraper:jooble] Rate limit approaching (${count}/500 today), skipping`);
    return { allowed: false, count };
  }

  return { allowed: true, count };
}

async function incrementJoobleUsage(db) {
  const today = new Date().toISOString().slice(0, 10);
  const docRef = db.collection('config').doc('jooble_usage');
  const doc = await docRef.get();

  if (!doc.exists || doc.data().date !== today) {
    await docRef.set({ date: today, count: 1 });
  } else {
    await docRef.update({ count: admin.firestore.FieldValue.increment(1) });
  }
}

// ─── Jooble API Scraper ─────────────────────────────────────────
async function scrapeJooble(maxOfertas = 50, region = 'Todo Chile') {
  const apiKey = process.env.JOOBLE_API_KEY;
  if (!apiKey) {
    console.log('[Scraper:jooble] No API key configured, skipping');
    return [];
  }

  const db = admin.firestore();

  // Check daily rate limit before making any requests
  const rateCheck = await checkJoobleRateLimit(db);
  if (!rateCheck.allowed) {
    return [];
  }

  const jobs = [];
  let page = 1;
  const location = region === 'Todo Chile' ? 'Chile' : region;

  while (jobs.length < maxOfertas) {
    try {
      const resp = await axios.post(`https://cl.jooble.org/api/${apiKey}`, {
        keywords: '',
        location,
        page,
      }, { timeout: 15000 });

      // Track each API call against the daily limit
      await incrementJoobleUsage(db);

      if (!resp.data?.jobs?.length) break;

      for (const j of resp.data.jobs) {
        if (jobs.length >= maxOfertas) break;
        jobs.push({
          titulo: j.title || '',
          empresa: j.company || '',
          comuna: j.location || '',
          descripcion: j.snippet || '',
          fecha_publicacion: j.updated || '',
          url_original: j.link || '',
          fuente: 'jooble',
          salary_raw: j.salary || '',
        });
      }

      page++;

      // Re-check rate limit before next page
      const recheck = await checkJoobleRateLimit(db);
      if (!recheck.allowed) break;

      await sleep(1000); // Be nice to the API
    } catch (err) {
      console.error(`[Scraper:jooble] Error on page ${page}:`, err.message);
      break;
    }
  }

  console.log(`[Scraper:jooble] Fetched ${jobs.length} jobs from Jooble API`);
  return jobs;
}

async function normalizeWithGemini(job) {
  const ai = getGemini();
  const prompt = `Analiza esta oferta de trabajo y devuelve SOLO un JSON válido con los campos indicados.

Oferta cruda:
- Título: ${job.titulo}
- Empresa: ${job.empresa}
- Comuna: ${job.comuna}
- Descripción: ${job.descripcion}
- Fecha publicación: ${job.fecha_publicacion}

Devuelve este JSON exacto (null si no hay dato, NO inventes datos):
{
  "titulo": "título limpio del cargo",
  "empresa": "nombre empresa o null",
  "empresaAnonima": false,
  "esUrgente": false,
  "direccion": "dirección si se menciona o null",
  "comuna": "comuna",
  "region": "Región Metropolitana",
  "sueldoMin": null,
  "sueldoMax": null,
  "tipoContrato": "Tiempo completo",
  "skills": ["skill1", "skill2"],
  "descripcionLimpia": "resumen limpio máximo 300 caracteres"
}

Reglas:
- sueldoMin y sueldoMax son enteros en CLP (sin puntos ni $), o null si no se menciona sueldo.
- empresaAnonima=true si la empresa dice "Confidencial", "Empresa confidencial" o similar.
- esUrgente=true solo si el texto dice explícitamente "urgente".
- skills: extrae 2-5 habilidades clave mencionadas o inferidas del cargo.
- tipoContrato: uno de "Tiempo completo", "Part-time", "Por día", "Temporal", "Freelance", "Práctica".
- descripcionLimpia: resumen profesional, máximo 300 caracteres. No copies todo, resume.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite-preview',
    contents: prompt,
    config: { responseMimeType: 'application/json', temperature: 0.1, maxOutputTokens: 1024 },
  });

  return JSON.parse(response.text || '{}');
}

// ─── Fuzzy Dedup Helpers ──────────────────────────────────────
function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .trim()
    .replace(/\s+/g, ' ');
}

function wordOverlap(a, b) {
  const wordsA = new Set(normalizeText(a).split(' ').filter(w => w.length > 2));
  const wordsB = new Set(normalizeText(b).split(' ').filter(w => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let shared = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) shared++;
  }
  const maxLen = Math.max(wordsA.size, wordsB.size);
  return shared / maxLen;
}

const ANONYMOUS_COMPANIES = [
  'importante empresa del sector',
  'empresa del sector',
  'importante empresa',
  'confidencial',
];

function isAnonymousCompany(company) {
  const norm = normalizeText(company);
  return ANONYMOUS_COMPANIES.some(a => norm.includes(a));
}

async function getRecentJobsCache(db) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const snap = await db.collection('jobs')
    .where('createdAt', '>=', sevenDaysAgo)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function fuzzyDuplicateCheck(newTitle, newCompany, recentJobs) {
  if (isAnonymousCompany(newCompany)) return null;
  const normNewCompany = normalizeText(newCompany);
  for (const existing of recentJobs) {
    if (isAnonymousCompany(existing.company || '')) continue;
    const normExistingCompany = normalizeText(existing.company || '');
    if (normNewCompany !== normExistingCompany) continue;
    const overlap = wordOverlap(newTitle, existing.title || '');
    if (overlap > 0.8) {
      return existing;
    }
  }
  return null;
}

async function checkDuplicate(db, urlOriginal, hash) {
  // Check by URL first (fastest)
  const urlSnap = await db.collection('jobs')
    .where('urlOriginal', '==', urlOriginal)
    .limit(1)
    .get();
  if (!urlSnap.empty) return true;

  // Check by content hash
  const hashSnap = await db.collection('jobs')
    .where('contentHash', '==', hash)
    .limit(1)
    .get();
  return !hashSnap.empty;
}

// ─── Geocoding ──────────────────────────────────────────────
const CHILE_COORDS_CACHE = {
  'santiago': [-33.4489, -70.6693], 'santiago centro': [-33.4489, -70.6693],
  'providencia': [-33.4264, -70.6103], 'las condes': [-33.4036, -70.5670],
  'ñuñoa': [-33.4569, -70.5968], 'vitacura': [-33.3917, -70.5714],
  'la florida': [-33.5167, -70.5994], 'maipú': [-33.5117, -70.7572],
  'maipu': [-33.5117, -70.7572], 'puente alto': [-33.6117, -70.5756],
  'san bernardo': [-33.5928, -70.7000], 'peñalolén': [-33.4833, -70.5333],
  'estación central': [-33.4500, -70.6792], 'estacion central': [-33.4500, -70.6792],
  'recoleta': [-33.4000, -70.6333], 'independencia': [-33.4167, -70.6667],
  'lo barnechea': [-33.3500, -70.5167], 'huechuraba': [-33.3667, -70.6333],
  'quilicura': [-33.3500, -70.7333], 'renca': [-33.3833, -70.7167],
  'cerrillos': [-33.4833, -70.7167], 'lo espejo': [-33.5167, -70.6833],
  'pedro aguirre cerda': [-33.4833, -70.6500], 'san miguel': [-33.4833, -70.6500],
  'la cisterna': [-33.5333, -70.6500], 'el bosque': [-33.5667, -70.6667],
  'la granja': [-33.5333, -70.6167], 'macul': [-33.4833, -70.5833],
  'la reina': [-33.4500, -70.5333], 'san joaquín': [-33.4833, -70.6167],
  'conchalí': [-33.3833, -70.6500], 'cerro navia': [-33.4167, -70.7333],
  'lo prado': [-33.4333, -70.7167], 'quinta normal': [-33.4333, -70.7000],
  'pudahuel': [-33.4333, -70.7500], 'lampa': [-33.2833, -70.8833],
  'colina': [-33.2000, -70.6667], 'calera de tango': [-33.6333, -70.8000],
  'valparaíso': [-33.0472, -71.6127], 'valparaiso': [-33.0472, -71.6127],
  'viña del mar': [-33.0153, -71.5503], 'concepción': [-36.8270, -73.0503],
  'concepcion': [-36.8270, -73.0503], 'temuco': [-38.7359, -72.5904],
  'antofagasta': [-23.6509, -70.3975], 'la serena': [-29.9027, -71.2519],
  'rancagua': [-34.1708, -70.7406], 'talca': [-35.4264, -71.6553],
  'arica': [-18.4783, -70.3126], 'iquique': [-20.2141, -70.1524],
  'puerto montt': [-41.4689, -72.9411], 'osorno': [-40.5744, -73.1339],
  'coquimbo': [-29.9533, -71.3436], 'calama': [-22.4560, -68.9293],
  'chillán': [-36.6063, -72.1034], 'chillan': [-36.6063, -72.1034],
  'los ángeles': [-37.4693, -72.3526], 'los angeles': [-37.4693, -72.3526],
  'copiapó': [-27.3668, -70.3323], 'copiapo': [-27.3668, -70.3323],
  'punta arenas': [-53.1548, -70.9113], 'valdivia': [-39.8196, -73.2452],
  'curicó': [-34.9828, -71.2394], 'curico': [-34.9828, -71.2394],
  'san antonio': [-33.5931, -71.6211], 'quillota': [-32.8797, -71.2491],
  'linares': [-35.8467, -71.5933], 'ovalle': [-30.5983, -71.2000],
  'san felipe': [-32.7508, -70.7253], 'melipilla': [-33.6833, -71.2167],
  'talagante': [-33.6667, -70.9333], 'buin': [-33.7333, -70.7500],
};

const geocodeCache = { ...CHILE_COORDS_CACHE };

async function geocodeLocation(locationStr) {
  if (!locationStr) return null;

  // Clean the location string
  const clean = locationStr
    .replace(/R\.Metropolitana/gi, '')
    .replace(/Región Metropolitana/gi, '')
    .replace(/,\s*$/, '')
    .split(',')[0] // Take first part (city/comuna)
    .split(' - ')[0] // Take first part before dash
    .trim()
    .toLowerCase();

  if (!clean) return null;

  // Check cache
  if (geocodeCache[clean]) {
    return geocodeCache[clean];
  }

  // Try Nominatim
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(clean + ', Chile')}&format=json&limit=1`;
    const resp = await axios.get(url, {
      headers: { 'User-Agent': 'NouuWork/1.0 (job-search-app)' },
      timeout: 5000,
    });
    if (resp.data && resp.data.length > 0) {
      const coords = [parseFloat(resp.data[0].lat), parseFloat(resp.data[0].lon)];
      geocodeCache[clean] = coords;
      console.log(`[Geocode] ${clean} → [${coords}]`);
      await sleep(1100); // Nominatim rate limit: 1 req/s
      return coords;
    }
  } catch (err) {
    console.log(`[Geocode] Failed for "${clean}": ${err.message}`);
  }

  return null;
}

// ─── EmpleosPublicos.cl Scraper ─────────────────────────────
async function scrapeEmpleosPublicos(maxOfertas = 50) {
  const baseUrl = 'https://www.empleospublicos.cl';
  const listUrl = `${baseUrl}/pub/convocatorias/convocatoriachile.aspx`;
  const jobs = [];

  try {
    console.log(`[Scraper] Fetching EmpleosPublicos listing: ${listUrl}`);
    const listResp = await axios.get(listUrl, {
      headers: { 'User-Agent': SCRAPER_USER_AGENT, 'Accept-Language': 'es-CL,es;q=0.9' },
      timeout: SCRAPER_REQUEST_TIMEOUT,
    });

    const $list = cheerio.load(listResp.data);
    const detailLinks = [];

    // Extract job links from the listing table
    $list('a[href*="convocatorias/vista/"]').each((_, el) => {
      const href = $list(el).attr('href');
      if (href && !detailLinks.includes(href)) {
        detailLinks.push(href.startsWith('http') ? href : `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`);
      }
    });

    // Also try alternative link patterns
    if (detailLinks.length === 0) {
      $list('a[href*="postulacion"]').each((_, el) => {
        const href = $list(el).attr('href');
        if (href && !detailLinks.includes(href)) {
          detailLinks.push(href.startsWith('http') ? href : `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`);
        }
      });
    }

    // Try table rows with links
    if (detailLinks.length === 0) {
      $list('table a[href]').each((_, el) => {
        const href = $list(el).attr('href');
        if (href && href.includes('convocatoria') && !detailLinks.includes(href)) {
          detailLinks.push(href.startsWith('http') ? href : `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`);
        }
      });
    }

    console.log(`[Scraper] EmpleosPublicos: found ${detailLinks.length} detail links`);

    const linksToProcess = detailLinks.slice(0, maxOfertas);

    for (const link of linksToProcess) {
      if (jobs.length >= maxOfertas) break;

      try {
        await sleep(SCRAPER_DELAY_MS);
        console.log(`[Scraper] EmpleosPublicos fetching detail: ${link}`);

        const detailResp = await axios.get(link, {
          headers: { 'User-Agent': SCRAPER_USER_AGENT, 'Accept-Language': 'es-CL,es;q=0.9' },
          timeout: SCRAPER_REQUEST_TIMEOUT,
        });

        const $ = cheerio.load(detailResp.data);

        // Extract fields - government job pages typically use labeled rows
        const titulo = $('h1').first().text().trim()
          || $('h2').first().text().trim()
          || $('title').text().trim().split('-')[0].trim()
          || '';

        // Look for institution/ministry
        let institucion = '';
        let ubicacion = '';
        let descripcion = '';
        let plazo = '';
        let sueldo = '';

        // Try to extract from labeled rows (common pattern: dt/dd, th/td, label/value)
        $('table tr, dl').each((_, row) => {
          const label = $(row).find('th, dt, td:first-child, .label').first().text().trim().toLowerCase();
          const value = $(row).find('td:last-child, dd, .value').last().text().trim();

          if (label.includes('instituc') || label.includes('ministerio') || label.includes('organismo')) {
            institucion = institucion || value;
          } else if (label.includes('ubicac') || label.includes('region') || label.includes('localidad') || label.includes('lugar')) {
            ubicacion = ubicacion || value;
          } else if (label.includes('descri') || label.includes('funcion') || label.includes('objetivo')) {
            descripcion = descripcion || value;
          } else if (label.includes('plazo') || label.includes('cierre') || label.includes('fecha')) {
            plazo = plazo || value;
          } else if (label.includes('renta') || label.includes('sueldo') || label.includes('remuner')) {
            sueldo = sueldo || value;
          }
        });

        // Fallback: get description from main content
        if (!descripcion) {
          descripcion = $('main, .content, .detalle, article').first().text().replace(/\s+/g, ' ').trim().substring(0, 1000);
        }

        if (!titulo) {
          console.log(`[Scraper] EmpleosPublicos skipping (no title): ${link}`);
          continue;
        }

        jobs.push({
          titulo,
          empresa: institucion || 'Gobierno de Chile',
          comuna: ubicacion,
          descripcion,
          fecha_publicacion: plazo ? `Plazo: ${plazo}` : '',
          url_original: link,
          fuente: 'empleospublicos',
          sueldo: sueldo || '',
        });

        console.log(`[Scraper] EmpleosPublicos extracted: ${titulo} @ ${institucion || 'Gobierno'} (${jobs.length}/${maxOfertas})`);
      } catch (detailErr) {
        console.error(`[Scraper] EmpleosPublicos error fetching ${link}:`, detailErr.message);
      }
    }
  } catch (pageErr) {
    console.error(`[Scraper] EmpleosPublicos listing error:`, pageErr.message);
  }

  console.log(`[Scraper] Finished scraping empleospublicos. Total raw jobs: ${jobs.length}`);
  return jobs;
}

async function runScraper(triggeredBy = 'system') {
  const db = admin.firestore();
  const startTime = Date.now();
  const results = { totalProcessed: 0, inserted: 0, duplicates: 0, errors: 0, errorDetails: [] };

  try {
    // Read config
    const configDoc = await db.collection('config').doc('scraper').get();
    const config = configDoc.exists ? configDoc.data() : { maxPerRun: 50, enabled: true };
    const maxPerRun = config.maxPerRun || 50;
    const region = config.region || 'Todo Chile';

    const sources = config.sources || ['computrabajo'];
    console.log(`[Scraper] Starting run. maxPerRun=${maxPerRun}, region=${region}, sources=${sources.join(',')}, triggeredBy=${triggeredBy}`);

    // Scrape raw jobs from all enabled sources
    const rawJobs = [];
    for (const source of sources) {
      try {
        let sourceJobs = [];
        if (source === 'computrabajo') {
          sourceJobs = await scrapeComputrabajo(maxPerRun, region);
        } else if (source === 'trabajando') {
          sourceJobs = await scrapeTrabajando(maxPerRun, region);
        } else if (source === 'chiletrabajos') {
          sourceJobs = await scrapeChileTrabajos(maxPerRun, region);
        } else if (source === 'jooble') {
          sourceJobs = await scrapeJooble(maxPerRun, region);
        } else if (source === 'empleospublicos') {
          sourceJobs = await scrapeEmpleosPublicos(maxPerRun);
        } else {
          console.log(`[Scraper] Unknown source: ${source}, skipping`);
          continue;
        }
        rawJobs.push(...sourceJobs);
        console.log(`[Scraper] ${source}: ${sourceJobs.length} raw jobs`);
      } catch (err) {
        console.error(`[Scraper] ${source} failed:`, err.message);
        results.errors++;
        results.errorDetails.push({ titulo: `SOURCE_FAIL:${source}`, error: err.message });
      }
    }
    results.totalProcessed = rawJobs.length;

    // Pre-fetch recent jobs for fuzzy dedup (cached, single query)
    let recentJobs = [];
    try {
      recentJobs = await getRecentJobsCache(db);
      console.log(`[Scraper] Loaded ${recentJobs.length} recent jobs for fuzzy dedup`);
    } catch (cacheErr) {
      console.warn('[Scraper] Could not load recent jobs for fuzzy dedup:', cacheErr.message);
    }

    // Process each job
    for (const rawJob of rawJobs) {
      try {
        const hash = contentHash(rawJob.titulo, rawJob.empresa, rawJob.descripcion);

        // Dedup check (exact: URL + hash)
        const isDuplicate = await checkDuplicate(db, rawJob.url_original, hash);
        if (isDuplicate) {
          results.duplicates++;
          console.log(`[Scraper] Duplicate skipped: ${rawJob.titulo}`);
          continue;
        }

        // Fuzzy dedup check (same company + >80% title word overlap)
        const fuzzyMatch = fuzzyDuplicateCheck(rawJob.titulo, rawJob.empresa, recentJobs);
        if (fuzzyMatch) {
          results.duplicates++;
          console.log(`[Scraper] Fuzzy duplicate: "${rawJob.titulo}" matches existing "${fuzzyMatch.title}" @ ${fuzzyMatch.company}`);
          continue;
        }

        // Normalize with Gemini
        let normalized;
        try {
          normalized = await normalizeWithGemini(rawJob);
        } catch (geminiErr) {
          console.error(`[Scraper] Gemini normalization failed for "${rawJob.titulo}":`, geminiErr.message);
          // Use raw data as fallback
          normalized = {
            titulo: rawJob.titulo,
            empresa: rawJob.empresa,
            empresaAnonima: false,
            esUrgente: false,
            direccion: null,
            comuna: rawJob.comuna,
            region: 'Región Metropolitana',
            sueldoMin: null,
            sueldoMax: null,
            tipoContrato: 'Tiempo completo',
            skills: [],
            descripcionLimpia: (rawJob.descripcion || '').substring(0, 300),
          };
        }

        // Build salary string
        let salary = '';
        if (normalized.sueldoMin && normalized.sueldoMax) {
          salary = `$${Number(normalized.sueldoMin).toLocaleString('es-CL')} - $${Number(normalized.sueldoMax).toLocaleString('es-CL')}`;
        } else if (normalized.sueldoMin) {
          salary = `$${Number(normalized.sueldoMin).toLocaleString('es-CL')}`;
        }

        // Geocode location
        const locationStr = normalized.comuna || rawJob.comuna || '';
        const coords = await geocodeLocation(locationStr);

        // Build Firestore document
        const jobDoc = {
          title: normalized.titulo || rawJob.titulo,
          company: normalized.empresa || rawJob.empresa,
          location: normalized.comuna || rawJob.comuna,
          salary,
          time: rawJob.fecha_publicacion || 'Reciente',
          tags: normalized.skills || [],
          urgent: normalized.esUrgente || false,
          coords,
          active: true,
          fuente: rawJob.fuente || 'computrabajo',
          urlOriginal: rawJob.url_original,
          contentHash: hash,
          descripcion: normalized.descripcionLimpia || '',
          descripcionCruda: rawJob.descripcion || '',
          sueldoMin: normalized.sueldoMin || null,
          sueldoMax: normalized.sueldoMax || null,
          tipoContrato: normalized.tipoContrato || 'Tiempo completo',
          region: normalized.region || 'Región Metropolitana',
          direccion: normalized.direccion || null,
          empresaAnonima: normalized.empresaAnonima || false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          fechaScraping: admin.firestore.FieldValue.serverTimestamp(),
        };

        const newDocRef = await db.collection('jobs').add(jobDoc);
        results.inserted++;
        console.log(`[Scraper] Inserted: ${jobDoc.title} @ ${jobDoc.company}`);

        // Add to fuzzy dedup cache so same-batch duplicates are caught
        recentJobs.push({ id: newDocRef.id, ...jobDoc });

        // Small delay between Gemini calls to avoid rate limiting
        await sleep(500);
      } catch (jobErr) {
        results.errors++;
        results.errorDetails.push({ titulo: rawJob.titulo, error: jobErr.message });
        console.error(`[Scraper] Error processing job "${rawJob.titulo}":`, jobErr.message);
      }
    }
  } catch (fatalErr) {
    console.error('[Scraper] Fatal error:', fatalErr.message);
    results.errors++;
    results.errorDetails.push({ titulo: 'FATAL', error: fatalErr.message });
  }

  const duration = Date.now() - startTime;

  // Log the run
  const logEntry = {
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    triggeredBy,
    totalProcessed: results.totalProcessed,
    inserted: results.inserted,
    duplicates: results.duplicates,
    errors: results.errors,
    errorDetails: results.errorDetails.slice(0, 10), // Keep max 10 error details
    durationMs: duration,
    durationFormatted: `${Math.round(duration / 1000)}s`,
  };
  await db.collection('scraper_logs').add(logEntry);

  console.log(`[Scraper] Run complete. Processed=${results.totalProcessed}, Inserted=${results.inserted}, Duplicates=${results.duplicates}, Errors=${results.errors}, Duration=${Math.round(duration / 1000)}s`);

  return { ...results, durationMs: duration };
}

// GET /admin/scraper/logs — get status + last 20 scraper run logs
app.get('/admin/scraper/logs', requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    const limit = parseInt(req.query.limit) || 20;

    // Get config + logs in parallel
    const [configDoc, logSnap, lockDoc] = await Promise.all([
      db.collection('config').doc('scraper').get(),
      db.collection('scraper_logs').orderBy('timestamp', 'desc').limit(limit).get(),
      db.collection('config').doc('scraper_lock').get(),
    ]);

    const config = configDoc.exists ? configDoc.data() : { enabled: false, frequency: 30, sources: ['computrabajo'], region: 'Metropolitana', maxPerRun: 50 };
    const logs = logSnap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        timestamp: data.timestamp?.toDate?.() ? data.timestamp.toDate().toISOString() : data.timestamp,
      };
    });
    const lock = lockDoc.exists ? lockDoc.data() : null;
    const isRunning = lock?.running === true && lock?.startedAt && (Date.now() - (lock.startedAt.toDate?.()?.getTime?.() || 0)) < 600000;

    res.json({
      status: {
        enabled: config.enabled || false,
        frequency: config.frequency || 30,
        sources: config.sources || ['computrabajo'],
        region: config.region || 'Metropolitana',
        maxPerRun: config.maxPerRun || 50,
        lastRun: logs[0]?.timestamp || null,
        isRunning,
        runningBy: isRunning ? lock.triggeredBy : null,
      },
      logs,
    });
  } catch (err) {
    console.error('Admin scraper logs error:', err);
    res.status(500).json({ error: 'Error obteniendo logs del scraper' });
  }
});

// POST /admin/scraper/stop — force clear the lock
app.post('/admin/scraper/stop', requireAdmin, async (req, res) => {
  try {
    await admin.firestore().collection('config').doc('scraper_lock').set({ running: false });
    res.json({ success: true, message: 'Lock limpiado. Puedes ejecutar de nuevo.' });
  } catch (err) {
    res.status(500).json({ error: 'Error limpiando lock' });
  }
});

// POST /admin/scraper/run — trigger manual scraper run with lock
app.post('/admin/scraper/run', requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    const lockRef = db.collection('config').doc('scraper_lock');
    const lockDoc = await lockRef.get();
    const lock = lockDoc.exists ? lockDoc.data() : null;
    const force = req.query.force === 'true' || req.body.force === true;

    // Check if already running (with 10 min timeout safety)
    if (!force && lock?.running === true && lock?.startedAt) {
      const elapsed = Date.now() - (lock.startedAt.toDate?.()?.getTime?.() || 0);
      if (elapsed < 600000) {
        return res.status(409).json({
          error: `El scraper ya está ejecutándose (iniciado por ${lock.triggeredBy} hace ${Math.round(elapsed / 60000)} min). Espera a que termine.`,
          canForce: true,
        });
      }
    }

    // Set lock
    await lockRef.set({
      running: true,
      triggeredBy: req.user.email,
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true, message: 'Scraper iniciado. Los logs se actualizan automáticamente.' });

    // Run scraper in background
    runScraper(req.user.email).then(async () => {
      await lockRef.set({ running: false });
    }).catch(async (err) => {
      console.error('[Scraper] Background run error:', err);
      await lockRef.set({ running: false, error: err.message });
    });
  } catch (err) {
    console.error('Admin scraper trigger error:', err);
    res.status(500).json({ error: 'Error disparando scraper' });
  }
});

// POST /admin/scraper/cron — Cloud Scheduler endpoint
app.post('/admin/scraper/cron', async (req, res) => {
  try {
    // Verify cron API key
    const cronKey = req.headers['x-cron-key'] || req.query.key;
    const expectedKey = process.env.SCRAPER_CRON_KEY;

    if (!expectedKey || cronKey !== expectedKey) {
      return res.status(403).json({ error: 'Clave de cron inválida' });
    }

    // Check if scraper is enabled
    const db = admin.firestore();
    const configDoc = await db.collection('config').doc('scraper').get();
    const config = configDoc.exists ? configDoc.data() : { enabled: false };

    if (!config.enabled) {
      console.log('[Scraper Cron] Scraper is disabled. Skipping.');
      return res.json({ success: false, message: 'Scraper deshabilitado en configuración.' });
    }

    // Run scraper synchronously for cron (Cloud Scheduler expects completion)
    const results = await runScraper('cloud-scheduler');
    res.json({ success: true, results });
  } catch (err) {
    console.error('Scraper cron error:', err);
    res.status(500).json({ error: 'Error en ejecución programada del scraper' });
  }
});

// POST /user-jobs — any authenticated user can publish a job via MarIA chat
app.post('/user-jobs', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  const { titulo, descripcion, comuna, sueldoMin, sueldoMax, tipoContrato, skills, direccion } = req.body;
  if (!titulo || !comuna) return res.status(400).json({ error: 'titulo y comuna requeridos' });

  try {
    const jobId = `userjob_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const salary = sueldoMin && sueldoMax
      ? `$${Number(sueldoMin).toLocaleString('es-CL')} - $${Number(sueldoMax).toLocaleString('es-CL')}`
      : sueldoMin
        ? `$${Number(sueldoMin).toLocaleString('es-CL')}`
        : 'A convenir';

    const location = direccion ? `${direccion}, ${comuna}` : comuna;

    // Geocodificar para que aparezca en el Mapa Laboral
    let coords = null;
    try {
      coords = await geocodeLocation(location);
    } catch (geoErr) {
      console.error('Geocoding error:', geoErr);
    }

    const jobData = {
      id: jobId,
      title: titulo,
      description: descripcion || '',
      location,
      salary,
      salaryMin: sueldoMin || null,
      salaryMax: sueldoMax || null,
      type: tipoContrato || 'Tiempo completo',
      tags: skills || [],
      company: req.user.name || req.user.email || 'Particular',
      fuente: 'usuario',
      creatorUid: req.user.uid,
      creatorEmail: req.user.email || '',
      active: true,
      urgent: false,
      time: 'Recién publicado',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(coords ? { coords } : {}),
    };

    await admin.firestore().collection('jobs').doc(jobId).set(jobData);
    res.json({ id: jobId, ...jobData });
  } catch (err) {
    console.error('User job create error:', err);
    res.status(500).json({ error: 'Error creando la oferta de trabajo' });
  }
});

// POST /nouu — crear un Nouu (pololo / pega informal)
app.post('/nouu', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });

  const { type, title, description, category, budget, paymentMethod, scheduledDate, location, address, city, ownerContact, addedBy, mediaUrls } = req.body;
  if (!title || !category) return res.status(400).json({ error: 'title y category requeridos' });
  if (!description || description.trim().length < 10) return res.status(400).json({ error: 'La descripción debe tener al menos 10 caracteres' });
  if (!city && !address) return res.status(400).json({ error: 'La ubicación (ciudad/comuna) es requerida' });

  try {
    const nouuId = `nouu_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const nouuData = {
      type: 'maria',
      title,
      description: description || '',
      category: category || 'Otros',
      budget: budget || null,
      paymentMethod: paymentMethod || 'efectivo',
      scheduledDate: scheduledDate || null,
      location: location || { lat: -33.4489, lng: -70.6693 },
      address: address || '',
      city: city || '',
      source: 'app',
      sourceUrl: '',
      screenshotUrl: '',
      ownerContact: {
        name: req.user.name || req.user.email || '',
        whatsapp: '',
        phone: '',
        email: req.user.email || '',
        messenger: '',
      },
      addedBy: req.user.uid,
      status: 'active',
      applicationCount: 0,
      expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Si hay mediaUrls, subirlas (por ahora guardamos las URLs como están)
    if (mediaUrls && Array.isArray(mediaUrls)) {
      nouuData.mediaUrls = mediaUrls;
    }

    await admin.firestore().collection('maria_nouus').doc(nouuId).set(nouuData);
    res.json({ id: nouuId, ...nouuData });
  } catch (err) {
    console.error('Nouu create error:', err);
    res.status(500).json({ error: 'Error creando el Nouu' });
  }
});

// POST /nouu/:id/apply — postularse a un Nouu
app.post('/nouu/:id/apply', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  const { message, proposedPrice } = req.body;
  if (!message || message.trim().length < 20) {
    return res.status(400).json({ error: 'El mensaje debe tener al menos 20 caracteres' });
  }

  try {
    const db = admin.firestore();
    const nouuRef = db.collection('maria_nouus').doc(req.params.id);
    const nouuDoc = await nouuRef.get();

    if (!nouuDoc.exists) return res.status(404).json({ error: 'Nouu no encontrado' });
    const nouu = nouuDoc.data();

    // No postularse a su propio Nouu
    if (nouu.addedBy === req.user.uid) {
      return res.status(400).json({ error: 'No puedes postularte a tu propio Nouu' });
    }

    // Verificar duplicado
    const existingSnap = await db.collection('applications')
      .where('nouuId', '==', req.params.id)
      .where('applicantUserId', '==', req.user.uid)
      .where('status', '==', 'pending')
      .limit(1).get();
    if (!existingSnap.empty) {
      return res.status(409).json({ error: 'Ya tienes una postulación pendiente en este Nouu' });
    }

    const appId = `app_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const application = {
      id: appId,
      nouuId: req.params.id,
      applicantUserId: req.user.uid,
      applicantName: req.user.name || req.user.email || '',
      publisherUserId: nouu.addedBy || '',
      message: message.trim(),
      proposedPrice: proposedPrice || nouu.budget || null,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection('applications').doc(appId).set(application);

    // Incrementar contador de postulaciones en el Nouu
    await nouuRef.update({
      applicationCount: admin.firestore.FieldValue.increment(1),
    });

    // Auto-crear chat entre publicador y postulante
    const participantIds = [req.user.uid, nouu.addedBy].sort();
    const chatId = `${req.params.id}_${participantIds[0]}_${participantIds[1]}`;

    const chatRef = db.collection('chats').doc(chatId);
    const chatDoc = await chatRef.get();
    if (!chatDoc.exists) {
      await chatRef.set({
        id: chatId,
        nouuId: req.params.id,
        participants: [req.user.uid, nouu.addedBy],
        lastMessage: message.trim(),
        lastMessageTime: admin.firestore.FieldValue.serverTimestamp(),
        lastMessageSenderId: req.user.uid,
        unreadCount: { [nouu.addedBy]: 1, [req.user.uid]: 0 },
        active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      // Primer mensaje del chat
      await chatRef.collection('messages').add({
        chatId,
        senderId: req.user.uid,
        content: `[Postulación] ${message.trim()}\n\n💰 Precio propuesto: $${Number(proposedPrice || nouu.budget || 0).toLocaleString('es-CL')}`,
        messageType: 'text',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        read: false,
      });
    }

    res.json({ success: true, applicationId: appId, chatId });
  } catch (err) {
    console.error('Apply error:', err);
    res.status(500).json({ error: 'Error al postularse' });
  }
});

// GET /nouus — listar Nouus activos para el mapa
app.get('/nouus', async (req, res) => {
  try {
    const db = admin.firestore();
    const snap = await db.collection('maria_nouus')
      .where('status', '==', 'active')
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get();

    const nouus = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title || '',
        description: data.description || '',
        category: data.category || '',
        budget: data.budget || null,
        paymentMethod: data.paymentMethod || '',
        scheduledDate: data.scheduledDate || null,
        address: data.address || data.city || '',
        city: data.city || data.commune || '',
        location: data.location || { lat: -33.4489, lng: -70.6693 },
        ownerName: data.ownerContact?.name || data.ownerName || '',
        sourceUrl: data.sourceUrl || '',
        sourcePlatform: data.sourcePlatform || '',
        status: data.status,
        createdAt: data.createdAt?._seconds || null,
      };
    });

    res.json(nouus);
  } catch (err) {
    console.error('List nouus error:', err);
    res.status(500).json({ error: 'Error listando nouus' });
  }
});

// POST /admin/scrape-url — manually scrape a single job URL with AI extraction
app.post('/admin/scrape-url', requireAdmin, async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL requerida' });

  // Validate URL format
  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: 'URL inválida. Debe ser una URL completa (https://...)' });
  }

  try {
    const db = admin.firestore();

    // Check for duplicate by URL
    const dupSnap = await db.collection('jobs')
      .where('urlOriginal', '==', url)
      .limit(1)
      .get();
    if (!dupSnap.empty) {
      return res.status(409).json({ error: 'Esta oferta ya existe en la base de datos' });
    }

    // Fetch the page
    console.log(`[ScrapeURL] Fetching: ${url}`);
    const pageResp = await axios.get(url, {
      headers: { 'User-Agent': SCRAPER_USER_AGENT, 'Accept-Language': 'es-CL,es;q=0.9' },
      timeout: SCRAPER_REQUEST_TIMEOUT,
    });

    // Extract text content from HTML
    const $ = cheerio.load(pageResp.data);

    // Try to find JSON-LD structured data first (works even on JS-rendered sites)
    let jsonLdData = null;
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const parsed = JSON.parse($(el).html() || '');
        if (parsed['@type'] === 'JobPosting' || (Array.isArray(parsed) && parsed.some(p => p['@type'] === 'JobPosting'))) {
          jsonLdData = Array.isArray(parsed) ? parsed.find(p => p['@type'] === 'JobPosting') : parsed;
        }
      } catch { /* ignore parse errors */ }
    });

    $('script, style, nav, footer, header, iframe, noscript').remove();
    let pageText = $('main, article, [role="main"], .job-detail, .detalle-oferta, .box_detail, body')
      .first()
      .text()
      .replace(/\s+/g, ' ')
      .trim();

    // If text is too short, the page likely uses JS rendering
    // Try using JSON-LD data or raw HTML as fallback for Gemini
    if (!pageText || pageText.length < 100) {
      if (jsonLdData) {
        console.log('[ScrapeURL] Using JSON-LD structured data as fallback');
        pageText = JSON.stringify(jsonLdData);
      } else {
        // Send the raw HTML to Gemini as last resort
        const rawHtml = pageResp.data.substring(0, 8000);
        const titleTag = $('title').text().trim();
        if (titleTag && rawHtml.length > 200) {
          console.log('[ScrapeURL] Page uses JS rendering, sending raw HTML to Gemini');
          pageText = `[Página con JavaScript] Título: ${titleTag}\n\nHTML parcial:\n${rawHtml}`;
        } else {
          return res.status(422).json({
            error: 'Esta página usa JavaScript para cargar contenido. Intenta copiar y pegar el texto de la oferta manualmente.',
          });
        }
      }
    } else if (jsonLdData) {
      // Enrich text content with JSON-LD data
      pageText += '\n\nDatos estructurados: ' + JSON.stringify(jsonLdData);
    }

    // Extract job data with Gemini
    const ai = getGemini();
    const prompt = `Analiza el siguiente contenido de una página web de oferta de empleo y extrae la información del trabajo.
Devuelve SOLO un JSON válido con esta estructura:
{
  "titulo": "título del cargo",
  "empresa": "nombre de la empresa",
  "comuna": "ciudad o comuna",
  "region": "región de Chile",
  "direccion": "dirección si aparece",
  "descripcion": "descripción completa del trabajo",
  "descripcionLimpia": "resumen en máximo 300 caracteres",
  "sueldoMin": null o número en CLP,
  "sueldoMax": null o número en CLP,
  "tipoContrato": "Indefinido/Plazo fijo/Part-time/Full-time/Honorarios",
  "skills": ["habilidad1", "habilidad2"],
  "esUrgente": true/false,
  "empresaAnonima": true/false
}

Contenido de la página:
${pageText.substring(0, 5000)}`;

    const geminiResp = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: prompt,
      config: { responseMimeType: 'application/json', temperature: 0.1, maxOutputTokens: 1024 },
    });

    const extracted = JSON.parse(geminiResp.text || '{}');

    if (!extracted.titulo) {
      return res.status(422).json({ error: 'No se pudo extraer información de empleo de esta página' });
    }

    // Geocode location
    const locationStr = extracted.comuna || '';
    const coords = await geocodeLocation(locationStr);

    // Build salary string
    let salary = '';
    if (extracted.sueldoMin && extracted.sueldoMax) {
      salary = `$${Number(extracted.sueldoMin).toLocaleString('es-CL')} - $${Number(extracted.sueldoMax).toLocaleString('es-CL')}`;
    } else if (extracted.sueldoMin) {
      salary = `$${Number(extracted.sueldoMin).toLocaleString('es-CL')}`;
    }

    // Build Firestore document
    const hash = contentHash(extracted.titulo, extracted.empresa, extracted.descripcion);
    const jobDoc = {
      title: extracted.titulo,
      company: extracted.empresa || '',
      location: extracted.comuna || '',
      salary,
      time: 'Recién publicado',
      tags: extracted.skills || [],
      urgent: extracted.esUrgente || false,
      coords,
      active: true,
      fuente: 'manual',
      urlOriginal: url,
      contentHash: hash,
      descripcion: extracted.descripcionLimpia || '',
      descripcionCruda: extracted.descripcion || '',
      sueldoMin: extracted.sueldoMin || null,
      sueldoMax: extracted.sueldoMax || null,
      tipoContrato: extracted.tipoContrato || 'Full-time',
      region: extracted.region || '',
      direccion: extracted.direccion || null,
      empresaAnonima: extracted.empresaAnonima || false,
      creatorEmail: req.user.email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      fechaScraping: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection('jobs').add(jobDoc);
    console.log(`[ScrapeURL] Inserted: ${jobDoc.title} @ ${jobDoc.company} (${docRef.id})`);

    res.json({ id: docRef.id, ...jobDoc });
  } catch (err) {
    console.error('[ScrapeURL] Error:', err);
    if (err.response?.status === 403 || err.response?.status === 429) {
      return res.status(422).json({ error: 'El sitio bloqueó el acceso. Intenta con otra URL.' });
    }
    res.status(500).json({ error: err.message || 'Error extrayendo oferta' });
  }
});

// GET /admin/discount-codes — list all discount codes
app.get('/admin/discount-codes', requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    await seedFabulosoCode(db);
    const snap = await db.collection('discount_codes').orderBy('createdAt', 'desc').get();
    const codes = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        code: data.code,
        monthsFree: data.monthsFree,
        maxUses: data.maxUses,
        currentUses: data.currentUses,
        isActive: data.isActive,
        createdBy: data.createdBy,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      };
    });
    res.json({ codes });
  } catch (err) {
    console.error('List discount codes error:', err);
    res.status(500).json({ error: 'Error listando códigos de descuento' });
  }
});

// POST /admin/discount-codes — create a new discount code
app.post('/admin/discount-codes', requireAdmin, async (req, res) => {
  const { code, monthsFree = 3, maxUses = -1 } = req.body;
  if (!code) return res.status(400).json({ error: 'Código requerido' });

  const normalizedCode = code.trim().toUpperCase();
  if (normalizedCode.length < 3) return res.status(400).json({ error: 'El código debe tener al menos 3 caracteres' });

  try {
    const db = admin.firestore();

    // Check for duplicate
    const dupSnap = await db.collection('discount_codes')
      .where('code', '==', normalizedCode)
      .limit(1).get();
    if (!dupSnap.empty) {
      return res.status(409).json({ error: 'Este código ya existe' });
    }

    const docRef = await db.collection('discount_codes').add({
      code: normalizedCode,
      monthsFree: Number(monthsFree) || 3,
      maxUses: Number(maxUses),
      currentUses: 0,
      isActive: true,
      createdBy: req.user.email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({
      id: docRef.id,
      code: normalizedCode,
      monthsFree: Number(monthsFree) || 3,
      maxUses: Number(maxUses),
      currentUses: 0,
      isActive: true,
      createdBy: req.user.email,
    });
  } catch (err) {
    console.error('Create discount code error:', err);
    res.status(500).json({ error: 'Error creando código de descuento' });
  }
});

// DELETE /admin/discount-codes/:id — delete a discount code
app.delete('/admin/discount-codes/:id', requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    await db.collection('discount_codes').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (err) {
    console.error('Delete discount code error:', err);
    res.status(500).json({ error: 'Error eliminando código de descuento' });
  }
});

// PUT /admin/discount-codes/:id — toggle active status
app.put('/admin/discount-codes/:id', requireAdmin, async (req, res) => {
  const { isActive } = req.body;
  try {
    const db = admin.firestore();
    await db.collection('discount_codes').doc(req.params.id).update({
      isActive: !!isActive,
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Update discount code error:', err);
    res.status(500).json({ error: 'Error actualizando código de descuento' });
  }
});

// POST /companies/:id/jobs/bulk — carga masiva de ofertas
app.post('/companies/:id/jobs/bulk', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  const { jobs } = req.body;
  if (!jobs || !Array.isArray(jobs) || jobs.length === 0) {
    return res.status(400).json({ error: 'Se requiere un array de jobs' });
  }
  if (jobs.length > 100) {
    return res.status(400).json({ error: 'Máximo 100 ofertas por lote' });
  }

  const VALID_CATEGORIES = [
    'tecnologia', 'administracion', 'ventas', 'salud', 'educacion',
    'construccion', 'manufactura', 'gastronomia', 'transporte', 'comercio',
    'finanzas', 'marketing', 'juridico', 'otro'
  ];
  const VALID_CONTRACT_TYPES = ['full_time', 'part_time', 'internship', 'contract', 'freelance'];
  const VALID_MODALITIES = ['presencial', 'remoto', 'hibrido'];

  try {
    const db = admin.firestore();
    
    // Check company and plan limits
    const companyDoc = await db.collection('companies').doc(req.params.id).get();
    if (!companyDoc.exists) return res.status(404).json({ error: 'Empresa no encontrada' });
    const company = companyDoc.data();
    const companyName = company.name || 'Empresa';
    
    const activeJobsSnap = await db
      .collection('companies').doc(req.params.id)
      .collection('jobs').where('active', '==', true).get();
    const currentActive = activeJobsSnap.size;
    const plan = company.plan || 'free';
    const maxJobs = plan === 'professional' ? Infinity : 3;

    const success = [];
    const errors = [];

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      const rowErrors = [];

      if (!job.title) rowErrors.push({ field: 'title', message: 'Título requerido' });
      if (!job.description) rowErrors.push({ field: 'description', message: 'Descripción requerida' });
      if (!job.category || !VALID_CATEGORIES.includes(job.category)) {
        rowErrors.push({ field: 'category', message: 'Categoría inválida' });
      }
      if (!job.contractType || !VALID_CONTRACT_TYPES.includes(job.contractType)) {
        rowErrors.push({ field: 'contractType', message: 'Tipo de contrato inválido' });
      }
      if (!job.modality || !VALID_MODALITIES.includes(job.modality)) {
        rowErrors.push({ field: 'modality', message: 'Modalidad inválida' });
      }
      if (!job.location) rowErrors.push({ field: 'location', message: 'Ubicación requerida' });

      if (rowErrors.length > 0) {
        errors.push({ row: i, errors: rowErrors });
        continue;
      }

      const jobId = 'job_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7) + '_' + i;

      const jobData = {
        id: jobId,
        companyId: req.params.id,
        companyName,
        publisherId: req.user.uid,
        source: 'direct',
        title: job.title,
        description: job.description,
        category: job.category,
        contractType: job.contractType,
        modality: job.modality,
        location: job.location,
        salaryMin: job.salaryMin || null,
        salaryMax: job.salaryMax || null,
        requirements: job.requirements || [],
        benefits: job.benefits || [],
        urgent: job.urgent || false,
        active: true,
        candidateCount: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await db.collection('companies').doc(req.params.id).collection('jobs').doc(jobId).set(jobData);
      await db.collection('jobs').doc(jobId).set({ ...jobData, company: companyName });
      success.push({ id: jobId, title: job.title });
    }

    await db.collection('companies').doc(req.params.id).update({
      postedJobsCount: admin.firestore.FieldValue.increment(success.length),
    });

    res.json({ success, errors, totalProcessed: jobs.length, created: success.length, failed: errors.length });
  } catch (err) {
    console.error('Bulk job create error:', err);
    res.status(500).json({ error: 'Error procesando carga masiva' });
  }
});

// GET /companies/:id/jobs/template — descargar plantilla CSV
app.get('/companies/:id/jobs/template', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  const csvContent = 'title,description,category,contractType,modality,location,salaryMin,salaryMax,requirements,benefits,urgent\n' +
    '"Cajero/a","Atención al cliente en caja, manejo de dinero y reposición",comercio,full_time,presencial,"Santiago, Región Metropolitana",450000,550000,"Atención al cliente;Manejo de dinero","Seguro de salud;Horario flexible",false\n';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="plantilla_ofertas_nouu.csv"');
  res.send(csvContent);
});

// POST /analytics/event
app.post('/analytics/event', async (req, res) => {
  const { type, jobId, companyId } = req.body;
  if (!type || !jobId) return res.status(400).json({ error: 'type y jobId requeridos' });
  try {
    const db = admin.firestore();
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await db.collection('analytics').doc(eventId).set({
      type,
      jobId,
      companyId: companyId || null,
      userId: req.user?.uid || null,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    if (type === 'job_view') {
      await db.collection('jobs').doc(jobId).update({
        'analytics.views': admin.firestore.FieldValue.increment(1),
      }).catch(() => {});
    } else if (type === 'job_click') {
      await db.collection('jobs').doc(jobId).update({
        'analytics.clicks': admin.firestore.FieldValue.increment(1),
      }).catch(() => {});
    }
    res.json({ success: true, eventId });
  } catch (err) {
    res.status(500).json({ error: 'Error registrando evento' });
  }
});

// GET /companies/:id/analytics
app.get('/companies/:id/analytics', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  const days = parseInt(req.query.days) || 30;
  try {
    const db = admin.firestore();
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const jobsSnap = await db.collection('companies').doc(req.params.id).collection('jobs').get();
    const jobIds = jobsSnap.docs.map(d => d.id);
    
    let totalViews = 0, totalClicks = 0;
    const dailyData = {};
    
    if (jobIds.length > 0) {
      const analyticsSnap = await db.collection('analytics')
        .where('companyId', '==', req.params.id)
        .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(sinceDate))
        .get();
      
      analyticsSnap.forEach(doc => {
        const data = doc.data();
        const dateStr = data.timestamp?.toDate?.()?.toISOString?.()?.split('T')[0] || 'unknown';
        if (!dailyData[dateStr]) dailyData[dateStr] = { views: 0, clicks: 0 };
        if (data.type === 'job_view') { totalViews++; dailyData[dateStr].views++; }
        if (data.type === 'job_click') { totalClicks++; dailyData[dateStr].clicks++; }
      });
    }
    
    let totalApplications = 0;
    if (jobIds.length > 0) {
      const appsSnap = await db.collection('applications').where('jobId', 'in', jobIds.slice(0, 10)).get();
      totalApplications = appsSnap.docs.filter(d => jobIds.includes(d.data().jobId)).length;
    }
    
    const dailyTrend = Object.entries(dailyData)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    const activeJobs = jobsSnap.docs.filter(d => d.data().active !== false).length;
    
    const jobAnalytics = {};
    jobsSnap.docs.forEach(doc => {
      const data = doc.data();
      jobAnalytics[doc.id] = {
        id: doc.id,
        title: data.title || '',
        views: data.analytics?.views || 0,
        clicks: data.analytics?.clicks || 0,
        candidateCount: data.candidateCount || 0,
      };
    });
    const topJobs = Object.values(jobAnalytics).sort((a, b) => b.views - a.views).slice(0, 5);
    
    res.json({
      period: { from: sinceDate.toISOString(), to: new Date().toISOString() },
      summary: {
        totalViews,
        totalClicks,
        totalApplications,
        conversionRate: totalViews > 0 ? Math.round((totalApplications / totalViews) * 1000) / 10 : 0,
        activeJobs,
        avgApplicationsPerJob: activeJobs > 0 ? Math.round((totalApplications / activeJobs) * 10) / 10 : 0,
      },
      topJobs,
      dailyTrend,
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Error obteniendo analíticas' });
  }
});

// GET /companies/:id/members
app.get('/companies/:id/members', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  try {
    const db = admin.firestore();
    const membersSnap = await db.collection('companies').doc(req.params.id).collection('members').get();
    const members = await Promise.all(membersSnap.docs.map(async (doc) => {
      const data = doc.data();
      const userDoc = await db.collection('users').doc(doc.id).get();
      return {
        uid: doc.id,
        email: userDoc.exists ? userDoc.data().email : data.email,
        displayName: userDoc.exists ? userDoc.data().displayName : data.displayName || '',
        role: data.role || 'recruiter',
        joinedAt: data.joinedAt,
      };
    }));
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: 'Error listando miembros' });
  }
});

// POST /companies/:id/members
app.post('/companies/:id/members', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requerido' });
  
  try {
    const db = admin.firestore();
    const companyDoc = await db.collection('companies').doc(req.params.id).get();
    if (!companyDoc.exists) return res.status(404).json({ error: 'Empresa no encontrada' });
    if (companyDoc.data().ownerId !== req.user.uid) return res.status(403).json({ error: 'Solo el dueño puede invitar miembros' });
    
    const plan = companyDoc.data().plan || 'free';
    const currentMembers = companyDoc.data().members || [];
    const maxMembers = plan === 'professional' ? 5 : 1;
    if (currentMembers.length >= maxMembers) {
      return res.status(403).json({ error: `Límite de ${maxMembers} miembros alcanzado para plan ${plan}` });
    }
    
    const usersSnap = await db.collection('users').where('email', '==', email.toLowerCase().trim()).limit(1).get();
    if (usersSnap.empty) return res.status(404).json({ error: 'Usuario no encontrado. Debe registrarse primero en NouuWork.' });
    
    const invitedUser = usersSnap.docs[0];
    const memberUid = invitedUser.id;
    
    if (currentMembers.includes(memberUid)) return res.status(400).json({ error: 'Este usuario ya es miembro' });
    
    await db.collection('companies').doc(req.params.id).update({
      members: admin.firestore.FieldValue.arrayUnion(memberUid),
    });
    
    await db.collection('companies').doc(req.params.id).collection('members').doc(memberUid).set({
      role: 'recruiter',
      email: email.toLowerCase().trim(),
      joinedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    res.json({ success: true, uid: memberUid, email: email.toLowerCase().trim() });
  } catch (err) {
    console.error('Invite member error:', err);
    res.status(500).json({ error: 'Error invitando miembro' });
  }
});

// DELETE /companies/:id/members/:uid
app.delete('/companies/:id/members/:uid', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  try {
    const db = admin.firestore();
    const companyDoc = await db.collection('companies').doc(req.params.id).get();
    if (companyDoc.data().ownerId !== req.user.uid) return res.status(403).json({ error: 'Solo el dueño puede remover miembros' });
    if (req.params.uid === companyDoc.data().ownerId) return res.status(400).json({ error: 'No puedes remover al dueño' });
    
    await db.collection('companies').doc(req.params.id).update({
      members: admin.firestore.FieldValue.arrayRemove(req.params.uid),
    });
    await db.collection('companies').doc(req.params.id).collection('members').doc(req.params.uid).delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error removiendo miembro' });
  }
});

// POST /subscription/create
app.post('/subscription/create', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  const { plan, companyId } = req.body;
  if (!plan || !['premium', 'professional'].includes(plan)) {
    return res.status(400).json({ error: 'Plan inválido. Debe ser premium o professional' });
  }

  try {
    const db = admin.firestore();
    const priceCLP = plan === 'professional' ? 14990 : 7890;
    const title = plan === 'professional' ? 'NouuWork Professional' : 'NouuWork Premium';
    
    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN || ''}`,
      },
      body: JSON.stringify({
        items: [{
          title,
          quantity: 1,
          unit_price: priceCLP,
          currency_id: 'CLP',
        }],
        payer: { email: req.user.email || '' },
        external_reference: `${plan}_${req.user.uid}_${companyId || ''}`,
        back_urls: {
          success: `${req.get('origin') || 'https://nouu.cl'}/dashboard?payment=success`,
          failure: `${req.get('origin') || 'https://nouu.cl'}/dashboard?payment=failure`,
          pending: `${req.get('origin') || 'https://nouu.cl'}/dashboard?payment=pending`,
        },
        auto_return: 'approved',
        notification_url: `${process.env.API_URL || ''}/api/subscription/webhook`,
      }),
    });
    
    const prefData = await mpRes.json();
    if (!prefData.init_point) throw new Error('Error creando preferencia de pago');
    
    await db.collection('pending_subscriptions').doc(req.user.uid).set({
      uid: req.user.uid,
      plan,
      companyId: companyId || null,
      preferenceId: prefData.id,
      amount: priceCLP,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    res.json({ checkoutUrl: prefData.init_point, sandboxCheckoutUrl: prefData.sandbox_init_point });
  } catch (err) {
    console.error('Create subscription error:', err);
    res.status(500).json({ error: 'Error creando suscripción' });
  }
});

// POST /subscription/webhook
app.post('/subscription/webhook', async (req, res) => {
  const { type, data } = req.body;
  if (type !== 'payment') return res.sendStatus(200);
  
  try {
    const db = admin.firestore();
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
      headers: { 'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN || ''}` },
    });
    const payment = await mpRes.json();
    
    if (payment.status === 'approved') {
      const ref = payment.external_reference || '';
      const parts = ref.split('_');
      const plan = parts[0];
      const uid = parts[1];
      const companyId = parts[2] || null;
      
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);
      
      await db.collection('subscriptions').doc(uid).set({
        uid,
        plan,
        startDate: admin.firestore.Timestamp.now(),
        endDate: admin.firestore.Timestamp.fromDate(endDate),
        status: 'active',
        amount: payment.transaction_amount,
        paymentId: data.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      
      if (plan === 'professional' && companyId) {
        await db.collection('companies').doc(companyId).update({
          plan: 'professional',
          subscriptionStatus: 'active',
          subscriptionStart: admin.firestore.Timestamp.now(),
          subscriptionEnd: admin.firestore.Timestamp.fromDate(endDate),
        });
      }
      
      await db.collection('pending_subscriptions').doc(uid).delete().catch(() => {});
    }
    
    res.sendStatus(200);
  } catch (err) {
    console.error('Subscription webhook error:', err);
    res.sendStatus(500);
  }
});

// ─── Admin Nouu (informal) endpoints ─────────────────────────────────────────

app.get('/admin/nouus', requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    const { limit: lim = 50, offset = 0, status, search } = req.query;
    let q = db.collection('nouus').orderBy('createdAt', 'desc');
    if (status && status !== 'all') q = q.where('status', '==', status);
    const snap = await q.limit(parseInt(lim) + parseInt(offset)).get();
    let docs = snap.docs.slice(parseInt(offset)).map(d => ({ id: d.id, ...d.data() }));
    if (search) {
      const s = search.toLowerCase();
      docs = docs.filter(d =>
        (d.title || d.titulo || '').toLowerCase().includes(s) ||
        (d.category || d.categoria || '').toLowerCase().includes(s) ||
        (d.publisherName || '').toLowerCase().includes(s)
      );
    }
    res.json({ nouus: docs, total: snap.size });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/admin/nouus/:id/status', requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    const { status, reason } = req.body;
    const validStatuses = ['active', 'suspended', 'cancelled', 'hidden'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Estado inválido' });
    await db.collection('nouus').doc(req.params.id).update({
      status,
      ...(reason ? { moderationReason: reason } : {}),
      moderatedAt: admin.firestore.Timestamp.now(),
      moderatedBy: req.user.uid,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/admin/nouus/:id', requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    const { reason } = req.body;
    await db.collection('nouus').doc(req.params.id).update({
      deleted: true,
      deletedReason: reason || '',
      deletedAt: admin.firestore.Timestamp.now(),
      deletedBy: req.user.uid,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin Postulaciones (informal) ──────────────────────────────────────────

app.get('/admin/postulaciones', requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    const { limit: lim = 50, status, nouuId } = req.query;
    let q = db.collection('applications').orderBy('createdAt', 'desc');
    if (status && status !== 'all') q = q.where('status', '==', status);
    if (nouuId) q = q.where('nouuId', '==', nouuId);
    const snap = await q.limit(parseInt(lim)).get();
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ applications: docs, total: snap.size });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin Suscripciones ──────────────────────────────────────────────────────

app.get('/admin/suscripciones', requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    const { limit: lim = 50, status } = req.query;
    let q = db.collection('subscriptions').orderBy('createdAt', 'desc');
    if (status && status !== 'all') q = q.where('tier', '==', status);
    const snap = await q.limit(parseInt(lim)).get();
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const totalPremium = docs.filter(d => d.tier === 'premium' || d.tier === 'premium_aiep').length;
    const totalRevenue = docs
      .filter(d => d.tier === 'premium' && d.status === 'active')
      .reduce((acc) => acc + 7890, 0);
    res.json({ subscriptions: docs, total: snap.size, totalPremium, estimatedMonthlyRevenue: totalRevenue });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin Verificaciones ─────────────────────────────────────────────────────

app.get('/admin/verificaciones/background-checks', requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    const { status = 'pending' } = req.query;
    let q = db.collection('background_checks').orderBy('submittedAt', 'desc');
    if (status !== 'all') q = q.where('status', '==', status);
    const snap = await q.limit(100).get();
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ checks: docs, total: snap.size });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/admin/verificaciones/background-checks/:id', requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    const { action, notes } = req.body;
    if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'Acción inválida' });
    const checkDoc = await db.collection('background_checks').doc(req.params.id).get();
    if (!checkDoc.exists) return res.status(404).json({ error: 'No encontrado' });
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    await db.collection('background_checks').doc(req.params.id).update({
      status: newStatus,
      reviewedAt: admin.firestore.Timestamp.now(),
      reviewedBy: req.user.uid,
      ...(notes ? { adminNotes: notes } : {}),
    });
    if (action === 'approve') {
      await db.collection('users').doc(checkDoc.data().userId).update({
        backgroundCheckStatus: 'approved',
        isBackgroundChecked: true,
      }).catch(() => {});
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/admin/verificaciones/profile-images', requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    const { status = 'pending' } = req.query;
    let q = db.collection('profile_image_requests').orderBy('requestedAt', 'desc');
    if (status !== 'all') q = q.where('status', '==', status);
    const snap = await q.limit(100).get();
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ requests: docs, total: snap.size });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/admin/verificaciones/profile-images/:id', requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    const { action, reason } = req.body;
    if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'Acción inválida' });
    const reqDoc = await db.collection('profile_image_requests').doc(req.params.id).get();
    if (!reqDoc.exists) return res.status(404).json({ error: 'No encontrado' });
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    await db.collection('profile_image_requests').doc(req.params.id).update({
      status: newStatus,
      reviewedAt: admin.firestore.Timestamp.now(),
      reviewedBy: req.user.uid,
      ...(reason ? { rejectionReason: reason } : {}),
    });
    if (action === 'approve') {
      await db.collection('users').doc(reqDoc.data().userId).update({
        photoURL: reqDoc.data().newPhotoURL,
        profileImage: reqDoc.data().newPhotoURL,
      }).catch(() => {});
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin Banners ────────────────────────────────────────────────────────────

app.get('/admin/banners', requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    const snap = await db.collection('advertisement_banners').orderBy('order', 'asc').get();
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ banners: docs, total: docs.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/admin/banners', requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    const { title, imageUrl, linkUrl, active = true, order = 0, targetScreen } = req.body;
    if (!imageUrl) return res.status(400).json({ error: 'imageUrl requerido' });
    const ref = await db.collection('advertisement_banners').add({
      title: title || '',
      imageUrl,
      linkUrl: linkUrl || '',
      active,
      order,
      targetScreen: targetScreen || '',
      createdAt: admin.firestore.Timestamp.now(),
      createdBy: req.user.uid,
    });
    res.json({ id: ref.id, success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/admin/banners/:id', requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    const { title, imageUrl, linkUrl, active, order, targetScreen } = req.body;
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (imageUrl !== undefined) updates.imageUrl = imageUrl;
    if (linkUrl !== undefined) updates.linkUrl = linkUrl;
    if (active !== undefined) updates.active = active;
    if (order !== undefined) updates.order = order;
    if (targetScreen !== undefined) updates.targetScreen = targetScreen;
    updates.updatedAt = admin.firestore.Timestamp.now();
    await db.collection('advertisement_banners').doc(req.params.id).update(updates);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/admin/banners/:id', requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    await db.collection('advertisement_banners').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin Anuncios autogestionados ──────────────────────────────────────────

app.get('/admin/anuncios', requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    const { status } = req.query;
    let q = db.collection('advertisements').orderBy('createdAt', 'desc');
    if (status && status !== 'all') q = q.where('status', '==', status);
    const snap = await q.limit(100).get();
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ anuncios: docs, total: snap.size });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/admin/anuncios/:id/status', requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    const { status, reason } = req.body;
    await db.collection('advertisements').doc(req.params.id).update({
      status,
      ...(reason ? { moderationReason: reason } : {}),
      reviewedAt: admin.firestore.Timestamp.now(),
      reviewedBy: req.user.uid,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin Soporte ────────────────────────────────────────────────────────────

app.get('/admin/soporte', requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    const { status, limit: lim = 50 } = req.query;
    let q = db.collection('support_tickets').orderBy('createdAt', 'desc');
    if (status && status !== 'all') q = q.where('status', '==', status);
    const snap = await q.limit(parseInt(lim)).get();
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ tickets: docs, total: snap.size });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/admin/soporte/:id', requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    const { status, response } = req.body;
    await db.collection('support_tickets').doc(req.params.id).update({
      ...(status ? { status } : {}),
      ...(response ? { adminResponse: response, respondedAt: admin.firestore.Timestamp.now(), respondedBy: req.user.uid } : {}),
      updatedAt: admin.firestore.Timestamp.now(),
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin MarIA Nouus ────────────────────────────────────────────────────────

app.get('/admin/maria-nouus', requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    const { status, limit: lim = 50 } = req.query;
    let q = db.collection('maria_nouus').orderBy('createdAt', 'desc');
    if (status && status !== 'all') q = q.where('status', '==', status);
    const snap = await q.limit(parseInt(lim)).get();
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const appsSnap = await db.collection('maria_applications').orderBy('createdAt', 'desc').limit(200).get();
    const applications = appsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ mariaNouus: docs, applications, total: snap.size });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/admin/maria-nouus/:id', requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    const { action, expiresAt } = req.body;
    const updates = { updatedAt: admin.firestore.Timestamp.now() };
    if (action === 'resolve') updates.status = 'resolved';
    if (action === 'extend' && expiresAt) updates.expiresAt = admin.firestore.Timestamp.fromDate(new Date(expiresAt));
    if (action === 'activate') updates.status = 'active';
    await db.collection('maria_nouus').doc(req.params.id).update(updates);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin Calificaciones ─────────────────────────────────────────────────────

app.get('/admin/calificaciones', requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    const { limit: lim = 50, minRating } = req.query;
    let q = db.collection('reviews').orderBy('createdAt', 'desc');
    const snap = await q.limit(parseInt(lim)).get();
    let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (minRating) docs = docs.filter(d => (d.rating || 0) <= parseFloat(minRating));
    const avgRating = docs.length > 0
      ? (docs.reduce((acc, d) => acc + (d.rating || 0), 0) / docs.length).toFixed(2)
      : 0;
    res.json({ reviews: docs, total: snap.size, avgRating });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/admin/calificaciones/:id', requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    await db.collection('reviews').doc(req.params.id).update({ deleted: true, deletedAt: admin.firestore.Timestamp.now() });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin Monetización / Transacciones ───────────────────────────────────────

app.get('/admin/transacciones', requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    const { limit: lim = 100, type } = req.query;
    let q = db.collection('transactions').orderBy('createdAt', 'desc');
    if (type && type !== 'all') q = q.where('type', '==', type);
    const snap = await q.limit(parseInt(lim)).get();
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const totalRevenue = docs
      .filter(d => d.status === 'approved' || d.status === 'completed')
      .reduce((acc, d) => acc + (d.amount || 0), 0);
    const byType = docs.reduce((acc, d) => {
      acc[d.type || 'other'] = (acc[d.type || 'other'] || 0) + (d.amount || 0);
      return acc;
    }, {});
    res.json({ transactions: docs, total: snap.size, totalRevenue, byType });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Main API — timeout 540s for scraper, 1GB memory
const { onRequest } = require('firebase-functions/v2/https');
exports.api = onRequest({ timeoutSeconds: 540, memory: '1GiB', maxInstances: 10 }, app);

// Scheduled scraper — uses v2 onSchedule
const { onSchedule } = require('firebase-functions/v2/scheduler');

exports.scheduledScraper = onSchedule(
  { schedule: 'every 6 hours', timeZone: 'America/Santiago', timeoutSeconds: 540, memory: '1GiB' },
  async () => {
    const db = admin.firestore();
    const configDoc = await db.collection('config').doc('scraper').get();
    const config = configDoc.exists ? configDoc.data() : { enabled: false };

    if (!config.enabled) {
      console.log('[Scheduled Scraper] Disabled in config. Skipping.');
      return;
    }

    console.log('[Scheduled Scraper] Starting scheduled run...');
    await runScraper('scheduled-function');
  }
);

// Cleanup: delete jobs older than 30 days — runs daily at 3am Chile
exports.cleanupOldJobs = onSchedule(
  { schedule: 'every day 03:00', timeZone: 'America/Santiago', timeoutSeconds: 120, memory: '256MiB' },
  async () => {
    const db = admin.firestore();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const snap = await db.collection('jobs').get();
    let deleted = 0;

    const batch = db.batch();
    for (const doc of snap.docs) {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate?.() || data.fechaScraping?.toDate?.() || null;
      if (createdAt && createdAt < thirtyDaysAgo) {
        batch.delete(doc.ref);
        deleted++;
      }
    }

    if (deleted > 0) {
      await batch.commit();
      console.log(`[Cleanup] Deleted ${deleted} jobs older than 30 days.`);
    } else {
      console.log('[Cleanup] No expired jobs found.');
    }
  }
);
