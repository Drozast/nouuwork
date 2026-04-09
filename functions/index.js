const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { GoogleGenAI } = require('@google/genai');
const cors = require('cors')({ origin: true });
const express = require('express');
const multer = require('multer');

admin.initializeApp();

const app = express();
app.use((req, res, next) => cors(req, res, next));
app.use(express.json({ limit: '10mb' }));

// multer: store file in memory, max 10MB, accept PDF + images
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

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
- Si el usuario pregunta por trabajos disponibles, recuérdale que NOUU tiene un Mapa Laboral tipo Waze para ver dónde dejar su CV hoy mismo según su ubicación.`;

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

// POST /chat — público (la API key está segura en el backend)
app.post('/chat', async (req, res) => {
  const { message, sessionType = 'cv', context, history = [] } = req.body;
  if (!message) return res.status(400).json({ error: 'message requerido' });

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

// POST /parse-cv-file — upload a PDF or image CV and extract structured data via Gemini Vision
// Accepts multipart/form-data with field "file"
app.post('/parse-cv-file', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Archivo requerido (PDF o imagen)' });

  try {
    const ai = getGemini();
    const base64 = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;

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

// GET /jobs
app.get('/jobs', async (req, res) => {
  try {
    const snap = await admin.firestore().collection('jobs').where('active', '==', true).get();
    if (snap.empty) return res.json(SEED_JOBS);
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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
    const companyData = {
      id: companyId,
      uid: req.user.uid,
      name, rut, industry, size, description, email, phone, website,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await admin.firestore().collection('companies').doc(companyId).set(companyData, { merge: true });
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

// POST /companies/:id/jobs — create a job posting (also adds to public jobs collection with coords)
app.post('/companies/:id/jobs', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  const { title, description, salaryMin, salaryMax, location, type, tags, urgent, coords } = req.body;
  if (!title || !location) return res.status(400).json({ error: 'title y location requeridos' });

  try {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    // Get company name
    const companyDoc = await admin.firestore().collection('companies').doc(req.params.id).get();
    const companyName = companyDoc.exists ? companyDoc.data().name : 'Empresa';

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

exports.api = functions.https.onRequest(app);
