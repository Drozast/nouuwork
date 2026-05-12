#!/usr/bin/env node

/**
 * Exporta los empleos activos de NouuWork a CSV para AIEP Expo Empleos.
 * No requiere credenciales — la colección jobs es de lectura pública.
 *
 * Uso:
 *   node scripts/export_jobs_aiep.js
 *   node scripts/export_jobs_aiep.js "biobio"
 *   node scripts/export_jobs_aiep.js "metropolitana"
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'nouu-work-2026';
const COLLECTION = 'jobs';
const PAGE_SIZE = 300;

const regionFilter = process.argv[2] ? process.argv[2].toLowerCase() : null;

function fetchPage(pageToken) {
  return new Promise((resolve, reject) => {
    let url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION}?pageSize=${PAGE_SIZE}`;
    if (pageToken) url += `&pageToken=${pageToken}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function str(fields, key) {
  if (!fields || !fields[key]) return '';
  const f = fields[key];
  if (f.stringValue !== undefined) return f.stringValue;
  if (f.integerValue !== undefined) return String(f.integerValue);
  if (f.booleanValue !== undefined) return f.booleanValue ? 'Sí' : 'No';
  if (f.timestampValue !== undefined) return new Date(f.timestampValue).toLocaleDateString('es-CL');
  if (f.arrayValue) {
    return (f.arrayValue.values || []).map(v => v.stringValue || '').filter(Boolean).join(' | ');
  }
  return '';
}

function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  const s = String(val).trim();
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function main() {
  console.log('Descargando ofertas desde NouuWork...\n');

  const all = [];
  let pageToken = null;

  do {
    const res = await fetchPage(pageToken);
    const docs = res.documents || [];
    docs.forEach(doc => {
      const f = doc.fields || {};

      // Saltar inactivos
      if (f.active && f.active.booleanValue === false) return;

      const region = str(f, 'region');
      if (regionFilter && !region.toLowerCase().includes(regionFilter)) return;

      const company = f.empresaAnonima && f.empresaAnonima.booleanValue
        ? 'Empresa confidencial'
        : str(f, 'company');

      all.push({
        titulo: str(f, 'title'),
        empresa: company,
        tipo_contrato: str(f, 'tipoContrato'),
        salario: str(f, 'salary'),
        region: region,
        descripcion: str(f, 'descripcion'),
        requisitos: str(f, 'tags'),
        fuente: str(f, 'fuente'),
        url: str(f, 'urlOriginal'),
        publicado: str(f, 'createdAt'),
        urgente: str(f, 'urgent'),
      });
    });
    pageToken = res.nextPageToken || null;
  } while (pageToken);

  if (all.length === 0) {
    console.log('No se encontraron ofertas activas' + (regionFilter ? ` para "${regionFilter}"` : '') + '.');
    return;
  }

  const headers = ['Titulo', 'Empresa', 'Tipo Contrato', 'Salario', 'Region', 'Descripcion', 'Requisitos', 'Fuente', 'URL', 'Fecha Publicacion', 'Urgente'];
  const keys = ['titulo', 'empresa', 'tipo_contrato', 'salario', 'region', 'descripcion', 'requisitos', 'fuente', 'url', 'publicado', 'urgente'];

  let csv = headers.join(',') + '\n';
  all.forEach(row => {
    csv += keys.map(k => escapeCSV(row[k])).join(',') + '\n';
  });

  const suffix = regionFilter ? regionFilter.replace(/\s+/g, '_') : 'todas';
  const filename = `ofertas_aiep_${suffix}_${new Date().toISOString().slice(0, 10)}.csv`;
  const outPath = path.join(__dirname, '..', '..', filename);
  fs.writeFileSync(outPath, csv, 'utf8');

  console.log(`✅ ${all.length} ofertas exportadas`);
  console.log(`📄 Archivo: ${outPath}\n`);

  // Resumen por región
  const regiones = {};
  all.forEach(r => {
    const k = r.region || '(sin región)';
    regiones[k] = (regiones[k] || 0) + 1;
  });
  console.log('Resumen por región:');
  Object.entries(regiones).sort((a, b) => b[1] - a[1]).forEach(([reg, n]) => {
    console.log(`   ${reg}: ${n}`);
  });
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
