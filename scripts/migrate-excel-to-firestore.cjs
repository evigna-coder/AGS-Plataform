/**
 * Script de migración: Excel → Firestore
 * Lee "Para script.xlsx" y crea documentos en Firestore:
 *   /clientes          → hoja Clientes
 *   /establecimientos   → hoja Establecimientos
 *   /sistemas          → hoja Sistemas (auto-vinculados al establecimiento único del cliente)
 *   /sistemas/{id}/modulos → hoja Modulos (subcolección)
 *
 * Uso:
 *   node scripts/migrate-excel-to-firestore.cjs [--dry-run]
 *
 * Requiere: scripts/serviceAccountKey.json (ver README)
 */

const XLSX = require('./node_modules/xlsx');
const admin = require('./node_modules/firebase-admin');
const path = require('path');
const fs = require('fs');

// ── Config ──────────────────────────────────────────────────────────────────
const EXCEL_PATH = path.resolve(__dirname, '..', 'Para script.xlsx');
const SA_KEY_PATH = path.resolve(__dirname, 'serviceAccountKey.json');
const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 400; // Firestore limit is 500, dejamos margen

// ── Helpers ─────────────────────────────────────────────────────────────────
function trim(v) { return v == null ? '' : String(v).trim(); }
function nowISO() { return new Date().toISOString(); }
function normalizeCuit(raw) {
  // Quita guiones y espacios: "30-52999439-3" → "30529994393"
  return trim(raw).replace(/[-\s]/g, '');
}

function readSheet(wb, name) {
  const ws = wb.Sheets[name];
  if (!ws || !ws['!ref']) return [];
  return XLSX.utils.sheet_to_json(ws, { defval: null });
}

// ── Init Firebase Admin ─────────────────────────────────────────────────────
if (DRY_RUN) {
  console.log('🔵 DRY RUN — no se escribirá nada en Firestore\n');
} else {
  if (!fs.existsSync(SA_KEY_PATH)) {
    console.error('❌ No se encontró serviceAccountKey.json en scripts/');
    console.error('   Descargalo desde Firebase Console → Configuración → Cuentas de servicio → Generar nueva clave privada');
    process.exit(1);
  }
  const serviceAccount = require(SA_KEY_PATH);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = DRY_RUN ? null : admin.firestore();

// ── Commit batches helper ───────────────────────────────────────────────────
async function commitBatches(operations) {
  if (DRY_RUN) return;
  // Split into chunks of BATCH_SIZE
  for (let i = 0; i < operations.length; i += BATCH_SIZE) {
    const chunk = operations.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const op of chunk) {
      if (op.type === 'set') batch.set(op.ref, op.data);
    }
    await batch.commit();
    console.log(`  ✓ batch ${Math.floor(i / BATCH_SIZE) + 1} committed (${chunk.length} ops)`);
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('📖 Leyendo Excel:', EXCEL_PATH);
  const wb = XLSX.readFile(EXCEL_PATH);

  const clientesRaw = readSheet(wb, 'Clientes');
  const establRaw = readSheet(wb, 'Establecimientos');
  const sistemasRaw = readSheet(wb, 'Sistemas');
  const modulosRaw = readSheet(wb, 'Modulos');

  console.log(`   Clientes: ${clientesRaw.length} filas`);
  console.log(`   Establecimientos: ${establRaw.length} filas`);
  console.log(`   Sistemas: ${sistemasRaw.length} filas`);
  console.log(`   Módulos: ${modulosRaw.length} filas`);
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // PASO 1: Clientes
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('👤 Paso 1: Clientes...');
  const clienteOps = [];
  const cuitToClienteId = new Map(); // cuit normalizado → docId

  for (const row of clientesRaw) {
    const cuitRaw = trim(row['Cuit']);
    if (!cuitRaw) continue;

    const cuitNorm = normalizeCuit(cuitRaw);
    const docId = cuitRaw; // Usamos CUIT con guiones como ID (legible)
    cuitToClienteId.set(cuitNorm, docId);

    const data = {
      razonSocial: trim(row['Razon Social']),
      cuit: cuitRaw,
      pais: trim(row['País']) || 'Argentina',
      rubro: trim(row['Rubro']) || '',
      direccionFiscal: trim(row['Dirección fiscal']) || null,
      localidadFiscal: trim(row['Localidad']) || null,
      provinciaFiscal: trim(row['Provincia']) || null,
      condicionIva: trim(row['Condición Iva']) || null,
      notas: trim(row['Notas']) || null,
      activo: true,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      createdBy: 'migration-script',
    };

    if (!DRY_RUN) {
      const ref = db.collection('clientes').doc(docId);
      clienteOps.push({ type: 'set', ref, data });
    }
  }

  console.log(`   → ${DRY_RUN ? cuitToClienteId.size : clienteOps.length} clientes a crear`);
  await commitBatches(clienteOps);

  // ═══════════════════════════════════════════════════════════════════════════
  // PASO 2: Establecimientos (1 por cliente, auto-vinculado)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('🏭 Paso 2: Establecimientos...');
  const establOps = [];
  const cuitToEstablId = new Map(); // cuit normalizado → establecimiento docId

  for (const row of establRaw) {
    const cuitRaw = trim(row['Cuit Cliente']);
    if (!cuitRaw) continue;
    const cuitNorm = normalizeCuit(cuitRaw);
    const clienteId = cuitToClienteId.get(cuitNorm);
    if (!clienteId) {
      console.warn(`   ⚠ Establecimiento sin cliente: CUIT ${cuitRaw}`);
      continue;
    }

    const nombre = trim(row['Nombre']);
    const direccion = trim(row['Dirección']);
    const localidad = trim(row['Localidad']);

    const data = {
      clienteCuit: cuitRaw,
      nombre: nombre || direccion || (localidad ? `Sede ${localidad}` : 'Sede principal'),
      direccion: direccion || '',
      localidad: localidad || '',
      provincia: trim(row['Provicia']) || '', // typo en Excel: "Provicia"
      codigoPostal: trim(row['Codigo postal']) || null,
      pais: 'Argentina',
      tipo: trim(row['Tipo']) || null,
      lat: row['Latitud'] || null,
      lng: row['Longitud'] || null,
      activo: true,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      createdBy: 'migration-script',
    };

    if (!DRY_RUN) {
      const ref = db.collection('establecimientos').doc(); // auto-ID
      cuitToEstablId.set(cuitNorm, ref.id);
      establOps.push({ type: 'set', ref, data });
    } else {
      const fakeId = `est-${cuitNorm}`;
      cuitToEstablId.set(cuitNorm, fakeId);
    }
  }

  console.log(`   → ${DRY_RUN ? cuitToEstablId.size : establOps.length} establecimientos a crear`);
  await commitBatches(establOps);

  // ═══════════════════════════════════════════════════════════════════════════
  // PASO 3: Sistemas (vinculados al establecimiento único del cliente)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('⚙️  Paso 3: Sistemas...');
  const sistemaOps = [];
  // Deduplicar: mismos sistemas aparecen repetidos (1 fila por módulo en el Excel)
  // Clave: cuit + código interno + nombre. Permite que un mismo cliente tenga
  // 2 sistemas con el mismo código pero distinto nombre (equipos distintos).
  const sistemaKey = (cuit, codInterno, nombre) => `${normalizeCuit(cuit)}|${trim(codInterno)}|${trim(nombre)}`;
  const seenSistemas = new Map(); // key → { docId, data }
  let dupSistemas = 0;

  for (const row of sistemasRaw) {
    const cuitRaw = trim(row['Cuit cliente']);
    if (!cuitRaw) continue;
    const cuitNorm = normalizeCuit(cuitRaw);
    const codInterno = trim(row['Codigo interno']);
    const nombreSistema = trim(row['Nombre sistema']);
    const key = sistemaKey(cuitRaw, codInterno, nombreSistema);

    if (seenSistemas.has(key)) { dupSistemas++; continue; }

    const clienteId = cuitToClienteId.get(cuitNorm) || null;
    const establId = cuitToEstablId.get(cuitNorm) || null;

    const data = {
      establecimientoId: establId || '',
      clienteId: clienteId, // legacy, para referencia
      categoriaId: trim(row['Categoria ID']) || '',
      nombre: trim(row['Nombre sistema']) || '',
      codigoInternoCliente: codInterno || '',
      software: trim(row['Software']) || null,
      observaciones: trim(row['Observaciones']) || null,
      activo: true,
      ubicaciones: [],
      otIds: [],
      createdAt: nowISO(),
      updatedAt: nowISO(),
      createdBy: 'migration-script',
    };

    if (!DRY_RUN) {
      const ref = db.collection('sistemas').doc(); // auto-ID
      seenSistemas.set(key, { docId: ref.id, data });
      sistemaOps.push({ type: 'set', ref, data });
    } else {
      const fakeId = `sys-${seenSistemas.size}`;
      seenSistemas.set(key, { docId: fakeId, data });
    }
  }

  console.log(`   → ${seenSistemas.size} sistemas únicos (${dupSistemas} duplicados ignorados)`);
  await commitBatches(sistemaOps);

  // ═══════════════════════════════════════════════════════════════════════════
  // PASO 4: Módulos (subcolección de cada sistema)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('🔧 Paso 4: Módulos...');
  const moduloOps = [];
  let modulosSkipped = 0;

  for (const row of modulosRaw) {
    const cuitRaw = trim(row['Cuit Cliente']);
    const codSistema = trim(row['Codigo sistema']);
    if (!cuitRaw || !codSistema) { modulosSkipped++; continue; }

    const nombreSistema = trim(row['Nombre sistema']) || '';
    // Intentar match exacto (cuit+codigo+nombre), si no, buscar por cuit+codigo (primer match)
    let key = sistemaKey(cuitRaw, codSistema, nombreSistema);
    let sistema = seenSistemas.get(key);
    if (!sistema && !nombreSistema) {
      // Fallback: buscar el primer sistema que matchee cuit+codigo (ignorando nombre)
      const prefix = `${normalizeCuit(cuitRaw)}|${codSistema}|`;
      for (const [k, v] of seenSistemas) {
        if (k.startsWith(prefix)) { sistema = v; break; }
      }
    }
    if (!sistema) {
      modulosSkipped++;
      console.warn(`   ⚠ Módulo sin sistema: CUIT ${cuitRaw}, código ${codSistema}, nombre "${nombreSistema}"`);
      continue;
    }

    const nombre = trim(row['Nombre modulo']);
    if (!nombre) { modulosSkipped++; continue; }

    const data = {
      sistemaId: sistema.docId,
      nombre: nombre,
      descripcion: null,
      serie: trim(row['Número de serie']) || null,
      firmware: trim(row['Firmware']) || null,
      marca: trim(row['Marca']) || null,
      observaciones: trim(row['Observaciones']) || null,
      ubicaciones: [],
      otIds: [],
    };

    moduloOps.push(DRY_RUN
      ? { type: 'set', ref: null, data }
      : { type: 'set', ref: db.collection('sistemas').doc(sistema.docId).collection('modulos').doc(), data }
    );
  }

  console.log(`   → ${moduloOps.length} módulos a crear (${modulosSkipped} filas sin vínculo)`);
  await commitBatches(moduloOps);

  // ═══════════════════════════════════════════════════════════════════════════
  // Resumen
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n════════════════════════════════════════');
  console.log('✅ Migración completada');
  console.log(`   Clientes:         ${DRY_RUN ? cuitToClienteId.size : clienteOps.length}`);
  console.log(`   Establecimientos: ${DRY_RUN ? cuitToEstablId.size : establOps.length}`);
  console.log(`   Sistemas:         ${seenSistemas.size}`);
  console.log(`   Módulos:          ${moduloOps.length}`);
  if (DRY_RUN) console.log('\n🔵 DRY RUN — nada se escribió en Firestore');
  console.log('════════════════════════════════════════');
}

main().catch(err => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
