/**
 * Migración de datos: nouu-f8214 → nouu-work-2026
 * 
 * Uso:
 *   1. Asegurate de estar autenticado en Firebase CLI:
 *      firebase login --reauth
 *   2. Ejecuta el script:
 *      node functions/scripts/migrate-data.js
 */

const admin = require('firebase-admin');

// Inicializa el proyecto ORIGEN (nouu-f8214)
const srcApp = admin.initializeApp({
  projectId: 'nouu-f8214',
}, 'source');

// Inicializa el proyecto DESTINO (nouu-work-2026)
const dstApp = admin.initializeApp({
  projectId: 'nouu-work-2026',
}, 'dest');

const srcDb = srcApp.firestore();
const dstDb = dstApp.firestore();

async function migrateUsers() {
  console.log('\n👥 Migrando usuarios...');
  const snap = await srcDb.collection('users').get();
  let count = 0;
  let skipped = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    
    // Verificar si ya existe en destino
    const existing = await dstDb.collection('users').doc(doc.id).get();
    if (existing.exists) {
      skipped++;
      continue;
    }

    // Limpiar campos que no queremos migrar
    const cleanData = { ...data };
    delete cleanData.fcmToken;
    delete cleanData.notificationPreferences;
    
    // Migrar al destino
    await dstDb.collection('users').doc(doc.id).set({
      ...cleanData,
      migratedFrom: 'nouu-f8214',
      migratedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    count++;
    process.stdout.write(`\r   ${count} usuarios migrados...`);
  }
  console.log(`\n   ✅ ${count} migrados, ${skipped} saltados (ya existían)`);
  return count;
}

async function migrateNouus() {
  console.log('\n📦 Migrando Nouus...');
  const snap = await srcDb.collection('maria_nouus')
    .where('status', '==', 'active')
    .get();
  let count = 0;
  let skipped = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    
    const existing = await dstDb.collection('maria_nouus').doc(doc.id).get();
    if (existing.exists) {
      skipped++;
      continue;
    }

    const cleanData = {
      ...data,
      migratedFrom: 'nouu-f8214',
      migratedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    await dstDb.collection('maria_nouus').doc(doc.id).set(cleanData);
    count++;
    process.stdout.write(`\r   ${count} nouus migrados...`);
  }
  console.log(`\n   ✅ ${count} migrados, ${skipped} saltados (ya existían)`);
  return count;
}

async function showStats() {
  console.log('\n📊 Estadísticas del proyecto origen (nouu-f8214):');
  const [usersSnap, nouusSnap] = await Promise.all([
    srcDb.collection('users').get(),
    srcDb.collection('maria_nouus').where('status', '==', 'active').get(),
  ]);
  console.log(`   Usuarios: ${usersSnap.size}`);
  console.log(`   Nouus activos: ${nouusSnap.size}`);

  const dstUsersSnap = await dstDb.collection('users').get();
  const dstNouusSnap = await dstDb.collection('maria_nouus').where('status', '==', 'active').get();
  console.log(`\n📊 Proyecto destino (nouu-work-2026) ANTES de migrar:`);
  console.log(`   Usuarios: ${dstUsersSnap.size}`);
  console.log(`   Nouus activos: ${dstNouusSnap.size}`);
}

async function main() {
  console.log('🚀 Migración nouu-f8214 → nouu-work-2026');
  console.log('═══════════════════════════════════════');
  
  await showStats();
  
  const userCount = await migrateUsers();
  const nouuCount = await migrateNouus();
  
  console.log('\n═══════════════════════════════════════');
  console.log('✅ Migración completada');
  console.log(`   👥 ${userCount} usuarios migrados`);
  console.log(`   📦 ${nouuCount} nouus migrados`);
  console.log('═══════════════════════════════════════\n');
  
  process.exit(0);
}

main().catch(err => {
  console.error('\n❌ Error en la migración:', err.message);
  process.exit(1);
});
