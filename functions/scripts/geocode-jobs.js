// Script standalone para geocodificar jobs sin coords
// Uso: node scripts/geocode-jobs.js
// Requiere: gcloud auth application-default login O variable GOOGLE_APPLICATION_CREDENTIALS

const admin = require('firebase-admin');
const axios = require('axios');

admin.initializeApp({
  projectId: 'nouu-work-2026',
});

const db = admin.firestore();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function geocodeLocation(locationStr) {
  if (!locationStr) return null;
  const clean = locationStr
    .replace(/R\.Metropolitana/gi, '')
    .replace(/Región Metropolitana/gi, '')
    .replace(/,\s*$/, '')
    .split(',')[0]
    .split(' - ')[0]
    .trim()
    .toLowerCase();
  if (!clean) return null;

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(clean + ', Chile')}&format=json&limit=1`;
    const resp = await axios.get(url, {
      headers: { 'User-Agent': 'NouuWork/1.0 (job-search-app)' },
      timeout: 5000,
    });
    if (resp.data && resp.data.length > 0) {
      const coords = [parseFloat(resp.data[0].lat), parseFloat(resp.data[0].lon)];
      console.log(`  ✓ ${clean} → [${coords}]`);
      await sleep(1100);
      return coords;
    }
  } catch (err) {
    console.log(`  ✗ Failed "${clean}": ${err.message}`);
  }
  return null;
}

(async () => {
  const snap = await db.collection('jobs').get();
  console.log(`📋 Encontrados ${snap.size} jobs en total`);

  let updated = 0;
  let skipped = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    if (!data.coords || !Array.isArray(data.coords) || data.coords.length !== 2) {
      const loc = data.location || data.comuna || '';
      console.log(`🔍 ${doc.id}: "${loc}"`);
      const coords = await geocodeLocation(loc);
      if (coords) {
        await doc.ref.update({ coords });
        updated++;
      }
    } else {
      skipped++;
    }
  }

  console.log(`\n✅ Actualizados: ${updated}`);
  console.log(`⏭️  Ya tenían coords: ${skipped}`);
  process.exit(0);
})().catch((e) => {
  console.error('❌ Error:', e);
  process.exit(1);
});
