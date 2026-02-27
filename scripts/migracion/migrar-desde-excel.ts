/**
 * migrar-desde-excel.ts
 * Migración masiva de datos maestros (Clientes, Establecimientos, Sistemas, Módulos)
 * desde un Excel .xlsx a Firestore.
 *
 * USO:
 *   npx ts-node migrar-desde-excel.ts --dry-run           ← valida sin escribir
 *   npx ts-node migrar-desde-excel.ts --run               ← escribe en Firestore
 *   npx ts-node migrar-desde-excel.ts --run --only=clientes
 *
 * REQUISITO para --run:
 *   Colocar service-account.json en este directorio (NO commitear).
 *
 * FORMATO DEL EXCEL: ver README.md
 */

import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

// ─── Tipos de fila del Excel ──────────────────────────────────────────────────

interface ClienteRow {
  cuit: string;
  razonSocial: string;
  pais: string;
  rubro: string;
  direccionFiscal?: string;
  localidad?: string;
  provincia?: string;
  condicionIva?: string;
  notas?: string;
}

interface EstablecimientoRow {
  clienteCuit: string;
  nombre: string;
  direccion: string;
  localidad: string;
  provincia: string;
  codigoPostal?: string;
  tipo?: string;
  lat?: number;
  lng?: number;
}

interface SistemaRow {
  clienteCuit: string;
  establecimientoNombre: string;
  categoriaId: string;
  nombre: string;
  codigoInternoCliente: string;
  software?: string;
  observaciones?: string;
  // Configuración GC — solo aplica si nombre contiene "gaseoso"
  gcPuertoFront?: string;
  gcPuertoBack?: string;
  gcDetectorFront?: string;
  gcDetectorBack?: string;
}

interface ModuloRow {
  clienteCuit: string;
  establecimientoNombre: string;
  sistemaCodigo: string;
  nombre: string;
  serie: string;
  firmware?: string;
  marca?: string;
  observaciones?: string;
}

// ─── Resultado de validación ──────────────────────────────────────────────────

interface ValidationError {
  sheet: string;
  row: number;
  column: string;
  message: string;
}

interface MigrationReport {
  timestamp: string;
  mode: 'dry-run' | 'run';
  errors: ValidationError[];
  warnings: ValidationError[];
  summary: {
    clientes: { total: number; valid: number };
    establecimientos: { total: number; valid: number };
    sistemas: { total: number; valid: number };
    modulos: { total: number; valid: number };
  };
  createdIds?: Record<string, string[]>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeCuit(cuit: string): string {
  return String(cuit ?? '').replace(/[-\s]/g, '').trim();
}

function str(val: any): string {
  return val != null ? String(val).trim() : '';
}

function num(val: any): number | undefined {
  const n = parseFloat(String(val));
  return isNaN(n) ? undefined : n;
}

function readSheet<T>(wb: XLSX.WorkBook, sheetName: string): any[] {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

function parseClientes(rows: any[]): ClienteRow[] {
  return rows.map(r => ({
    cuit: normalizeCuit(r['CUIT'] ?? r['cuit'] ?? ''),
    razonSocial: str(r['Razon Social'] ?? r['razonSocial'] ?? r['Razón Social'] ?? ''),
    pais: str(r['Pais'] ?? r['pais'] ?? r['País'] ?? 'Argentina'),
    rubro: str(r['Rubro'] ?? r['rubro'] ?? ''),
    direccionFiscal: str(r['Direccion Fiscal'] ?? r['direccionFiscal'] ?? '') || undefined,
    localidad: str(r['Localidad'] ?? r['localidad'] ?? '') || undefined,
    provincia: str(r['Provincia'] ?? r['provincia'] ?? '') || undefined,
    condicionIva: str(r['Condicion IVA'] ?? r['condicionIva'] ?? '') || undefined,
    notas: str(r['Notas'] ?? r['notas'] ?? '') || undefined,
  }));
}

function parseEstablecimientos(rows: any[]): EstablecimientoRow[] {
  return rows.map(r => ({
    clienteCuit: normalizeCuit(r['CUIT Cliente'] ?? r['clienteCuit'] ?? ''),
    nombre: str(r['Nombre'] ?? r['nombre'] ?? ''),
    direccion: str(r['Direccion'] ?? r['direccion'] ?? r['Dirección'] ?? ''),
    localidad: str(r['Localidad'] ?? r['localidad'] ?? ''),
    provincia: str(r['Provincia'] ?? r['provincia'] ?? ''),
    codigoPostal: str(r['Codigo Postal'] ?? r['codigoPostal'] ?? '') || undefined,
    tipo: str(r['Tipo'] ?? r['tipo'] ?? '') || undefined,
    lat: num(r['Latitud'] ?? r['lat']),
    lng: num(r['Longitud'] ?? r['lng']),
  }));
}

function parseSistemas(rows: any[]): SistemaRow[] {
  return rows.map(r => ({
    clienteCuit: normalizeCuit(r['CUIT Cliente'] ?? r['clienteCuit'] ?? ''),
    establecimientoNombre: str(r['Establecimiento'] ?? r['establecimientoNombre'] ?? ''),
    categoriaId: str(r['Categoria ID'] ?? r['categoriaId'] ?? ''),
    nombre: str(r['Nombre Sistema'] ?? r['nombre'] ?? ''),
    codigoInternoCliente: str(r['Codigo Interno'] ?? r['codigoInternoCliente'] ?? ''),
    software: str(r['Software'] ?? r['software'] ?? '') || undefined,
    observaciones: str(r['Observaciones'] ?? r['observaciones'] ?? '') || undefined,
    gcPuertoFront: str(r['GC Puerto Front'] ?? r['gcPuertoFront'] ?? '') || undefined,
    gcPuertoBack: str(r['GC Puerto Back'] ?? r['gcPuertoBack'] ?? '') || undefined,
    gcDetectorFront: str(r['GC Detector Front'] ?? r['gcDetectorFront'] ?? '') || undefined,
    gcDetectorBack: str(r['GC Detector Back'] ?? r['gcDetectorBack'] ?? '') || undefined,
  }));
}

function parseModulos(rows: any[]): ModuloRow[] {
  return rows.map(r => ({
    clienteCuit: normalizeCuit(r['CUIT Cliente'] ?? r['clienteCuit'] ?? ''),
    establecimientoNombre: str(r['Establecimiento'] ?? r['establecimientoNombre'] ?? ''),
    sistemaCodigo: str(r['Codigo Sistema'] ?? r['sistemaCodigo'] ?? r['codigoInternoCliente'] ?? ''),
    nombre: str(r['Nombre Modulo'] ?? r['nombre'] ?? ''),
    serie: str(r['Numero Serie'] ?? r['serie'] ?? ''),
    firmware: str(r['Firmware'] ?? r['firmware'] ?? '') || undefined,
    marca: str(r['Marca'] ?? r['marca'] ?? '') || undefined,
    observaciones: str(r['Observaciones'] ?? r['observaciones'] ?? '') || undefined,
  }));
}

// ─── Validadores ──────────────────────────────────────────────────────────────

function validateClientes(rows: ClienteRow[], errors: ValidationError[], warnings: ValidationError[]) {
  const cuits = new Set<string>();
  rows.forEach((r, i) => {
    const row = i + 2; // +2: encabezado en fila 1, datos desde fila 2
    if (!r.cuit) errors.push({ sheet: 'Clientes', row, column: 'CUIT', message: 'CUIT vacío' });
    else if (!/^\d{10,11}$/.test(r.cuit)) errors.push({ sheet: 'Clientes', row, column: 'CUIT', message: `CUIT inválido: "${r.cuit}" (debe tener 10-11 dígitos)` });
    else if (cuits.has(r.cuit)) warnings.push({ sheet: 'Clientes', row, column: 'CUIT', message: `CUIT duplicado en el archivo: ${r.cuit}` });
    else cuits.add(r.cuit);
    if (!r.razonSocial) errors.push({ sheet: 'Clientes', row, column: 'Razon Social', message: 'Razón Social vacía' });
    if (!r.rubro) warnings.push({ sheet: 'Clientes', row, column: 'Rubro', message: 'Rubro vacío' });
  });
}

function validateEstablecimientos(rows: EstablecimientoRow[], clientes: ClienteRow[], errors: ValidationError[], warnings: ValidationError[]) {
  const cuitSet = new Set(clientes.map(c => c.cuit));
  rows.forEach((r, i) => {
    const row = i + 2;
    if (!r.clienteCuit) errors.push({ sheet: 'Establecimientos', row, column: 'CUIT Cliente', message: 'CUIT Cliente vacío' });
    else if (!cuitSet.has(r.clienteCuit)) errors.push({ sheet: 'Establecimientos', row, column: 'CUIT Cliente', message: `CUIT ${r.clienteCuit} no existe en hoja Clientes` });
    if (!r.nombre) errors.push({ sheet: 'Establecimientos', row, column: 'Nombre', message: 'Nombre vacío' });
    if (!r.direccion) errors.push({ sheet: 'Establecimientos', row, column: 'Direccion', message: 'Dirección vacía' });
    if (!r.localidad) errors.push({ sheet: 'Establecimientos', row, column: 'Localidad', message: 'Localidad vacía' });
    if (!r.provincia) errors.push({ sheet: 'Establecimientos', row, column: 'Provincia', message: 'Provincia vacía' });
  });
}

function validateSistemas(rows: SistemaRow[], establecimientos: EstablecimientoRow[], errors: ValidationError[], warnings: ValidationError[]) {
  const establSet = new Set(establecimientos.map(e => `${e.clienteCuit}|${e.nombre.toLowerCase()}`));
  rows.forEach((r, i) => {
    const row = i + 2;
    if (!r.clienteCuit) errors.push({ sheet: 'Sistemas', row, column: 'CUIT Cliente', message: 'CUIT Cliente vacío' });
    if (!r.establecimientoNombre) errors.push({ sheet: 'Sistemas', row, column: 'Establecimiento', message: 'Nombre de establecimiento vacío' });
    else if (!establSet.has(`${r.clienteCuit}|${r.establecimientoNombre.toLowerCase()}`)) {
      warnings.push({ sheet: 'Sistemas', row, column: 'Establecimiento', message: `Establecimiento "${r.establecimientoNombre}" no encontrado en hoja Establecimientos para CUIT ${r.clienteCuit}` });
    }
    if (!r.categoriaId) errors.push({ sheet: 'Sistemas', row, column: 'Categoria ID', message: 'Categoria ID vacío' });
    if (!r.nombre) errors.push({ sheet: 'Sistemas', row, column: 'Nombre Sistema', message: 'Nombre de sistema vacío' });
    if (!r.codigoInternoCliente) errors.push({ sheet: 'Sistemas', row, column: 'Codigo Interno', message: 'Código interno vacío' });

    // Validar campos GC si el sistema es gaseoso
    const VALID_INLETS = ['SSL', 'COC', 'PTV'];
    const VALID_DETECTORS = ['FID', 'NCD', 'FPD', 'ECD', 'SCD'];
    if (r.nombre && r.nombre.toLowerCase().includes('gaseoso')) {
      if (r.gcPuertoFront && !VALID_INLETS.includes(r.gcPuertoFront.toUpperCase())) {
        errors.push({ sheet: 'Sistemas', row, column: 'GC Puerto Front', message: `Valor inválido "${r.gcPuertoFront}". Debe ser: ${VALID_INLETS.join(' | ')}` });
      }
      if (r.gcPuertoBack && !VALID_INLETS.includes(r.gcPuertoBack.toUpperCase())) {
        errors.push({ sheet: 'Sistemas', row, column: 'GC Puerto Back', message: `Valor inválido "${r.gcPuertoBack}". Debe ser: ${VALID_INLETS.join(' | ')}` });
      }
      if (r.gcDetectorFront && !VALID_DETECTORS.includes(r.gcDetectorFront.toUpperCase())) {
        errors.push({ sheet: 'Sistemas', row, column: 'GC Detector Front', message: `Valor inválido "${r.gcDetectorFront}". Debe ser: ${VALID_DETECTORS.join(' | ')}` });
      }
      if (r.gcDetectorBack && !VALID_DETECTORS.includes(r.gcDetectorBack.toUpperCase())) {
        errors.push({ sheet: 'Sistemas', row, column: 'GC Detector Back', message: `Valor inválido "${r.gcDetectorBack}". Debe ser: ${VALID_DETECTORS.join(' | ')}` });
      }
    } else {
      // Si el sistema NO es gaseoso y se llenaron campos GC, advertir
      if (r.gcPuertoFront || r.gcPuertoBack || r.gcDetectorFront || r.gcDetectorBack) {
        warnings.push({ sheet: 'Sistemas', row, column: 'GC Puerto Front', message: `Se completaron campos GC pero el sistema "${r.nombre}" no contiene la palabra "gaseoso"` });
      }
    }
  });
}

function validateModulos(rows: ModuloRow[], sistemas: SistemaRow[], errors: ValidationError[], warnings: ValidationError[]) {
  const sistSet = new Set(sistemas.map(s => `${s.clienteCuit}|${s.codigoInternoCliente.toLowerCase()}`));
  rows.forEach((r, i) => {
    const row = i + 2;
    if (!r.clienteCuit) errors.push({ sheet: 'Modulos', row, column: 'CUIT Cliente', message: 'CUIT Cliente vacío' });
    if (!r.sistemaCodigo) errors.push({ sheet: 'Modulos', row, column: 'Codigo Sistema', message: 'Código de sistema vacío' });
    else if (!sistSet.has(`${r.clienteCuit}|${r.sistemaCodigo.toLowerCase()}`)) {
      warnings.push({ sheet: 'Modulos', row, column: 'Codigo Sistema', message: `Sistema con código "${r.sistemaCodigo}" no encontrado en hoja Sistemas para CUIT ${r.clienteCuit}` });
    }
    if (!r.nombre) errors.push({ sheet: 'Modulos', row, column: 'Nombre Modulo', message: 'Nombre de módulo vacío' });
    if (!r.serie) errors.push({ sheet: 'Modulos', row, column: 'Numero Serie', message: 'Número de serie vacío' });
  });
}

// ─── Escritura en Firestore ───────────────────────────────────────────────────

async function writeToFirestore(
  clientes: ClienteRow[],
  establecimientos: EstablecimientoRow[],
  sistemas: SistemaRow[],
  modulos: ModuloRow[],
  onlyEntity: string | undefined,
  report: MigrationReport
): Promise<void> {
  const saPath = path.join(__dirname, 'service-account.json');
  if (!fs.existsSync(saPath)) {
    console.error('\n❌ No se encontró service-account.json en scripts/migracion/');
    console.error('   Solicitá la clave JSON al administrador de la empresa y colocala en ese directorio.\n');
    process.exit(1);
  }

  const admin = require('firebase-admin');
  const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf-8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();
  const createdIds: Record<string, string[]> = { clientes: [], establecimientos: [], sistemas: [], modulos: [] };

  // --- Clientes ---
  if (!onlyEntity || onlyEntity === 'clientes') {
    console.log('\n📥 Procesando clientes...');
    let batch = db.batch();
    let count = 0;
    for (const c of clientes) {
      const ref = db.collection('clientes').doc(c.cuit);
      const snap = await ref.get();
      if (snap.exists) { console.log(`  SKIP cliente ${c.cuit} (ya existe)`); continue; }
      batch.set(ref, {
        id: c.cuit, cuit: c.cuit, razonSocial: c.razonSocial,
        pais: c.pais, rubro: c.rubro,
        direccionFiscal: c.direccionFiscal ?? null,
        localidad: c.localidad ?? null, provincia: c.provincia ?? null,
        condicionIva: c.condicionIva ?? null, notas: c.notas ?? null,
        activo: true, createdAt: now, updatedAt: now, createdBy: 'migracion',
      });
      createdIds.clientes.push(c.cuit);
      count++;
      if (count % 500 === 0) { await batch.commit(); batch = db.batch(); }
    }
    if (count % 500 !== 0) await batch.commit();
    console.log(`  ✅ ${count} cliente(s) creado(s)`);
  }

  // --- Establecimientos ---
  if (!onlyEntity || onlyEntity === 'establecimientos') {
    console.log('\n📥 Procesando establecimientos...');
    let batch = db.batch();
    let count = 0;
    for (const e of establecimientos) {
      const q = await db.collection('establecimientos')
        .where('clienteId', '==', e.clienteCuit)
        .where('nombre', '==', e.nombre).limit(1).get();
      if (!q.empty) { console.log(`  SKIP establecimiento "${e.nombre}" (ya existe)`); continue; }
      const id = `${e.clienteCuit}-${e.nombre.toLowerCase().replace(/\s+/g, '-').slice(0, 40)}-${Date.now()}`;
      const ref = db.collection('establecimientos').doc(id);
      batch.set(ref, {
        id, clienteId: e.clienteCuit, nombre: e.nombre,
        direccion: e.direccion, localidad: e.localidad, provincia: e.provincia,
        codigoPostal: e.codigoPostal ?? null, tipo: e.tipo ?? null,
        lat: e.lat ?? null, lng: e.lng ?? null,
        activo: true, createdAt: now, updatedAt: now, createdBy: 'migracion',
      });
      createdIds.establecimientos.push(id);
      count++;
      if (count % 500 === 0) { await batch.commit(); batch = db.batch(); }
    }
    if (count % 500 !== 0) await batch.commit();
    console.log(`  ✅ ${count} establecimiento(s) creado(s)`);
  }

  // --- Sistemas ---
  if (!onlyEntity || onlyEntity === 'sistemas') {
    console.log('\n📥 Procesando sistemas...');
    let count = 0;
    for (const s of sistemas) {
      const establQ = await db.collection('establecimientos')
        .where('clienteId', '==', s.clienteCuit)
        .where('nombre', '==', s.establecimientoNombre).limit(1).get();
      if (establQ.empty) {
        console.warn(`  WARN: establecimiento "${s.establecimientoNombre}" no encontrado — SKIP sistema "${s.nombre}"`);
        continue;
      }
      const establecimientoId = establQ.docs[0].id;
      const q = await db.collection('sistemas')
        .where('establecimientoId', '==', establecimientoId)
        .where('codigoInternoCliente', '==', s.codigoInternoCliente).limit(1).get();
      if (!q.empty) { console.log(`  SKIP sistema "${s.codigoInternoCliente}" (ya existe)`); continue; }
      const id = require('crypto').randomUUID();
      const esGaseoso = s.nombre.toLowerCase().includes('gaseoso');
      const configuracionGC = esGaseoso ? {
        puertoInyeccionFront: (s.gcPuertoFront?.toUpperCase() as any) ?? null,
        puertoInyeccionBack: (s.gcPuertoBack?.toUpperCase() as any) ?? null,
        detectorFront: (s.gcDetectorFront?.toUpperCase() as any) ?? null,
        detectorBack: (s.gcDetectorBack?.toUpperCase() as any) ?? null,
      } : null;
      await db.collection('sistemas').doc(id).set({
        id, establecimientoId, clienteId: s.clienteCuit,
        categoriaId: s.categoriaId, nombre: s.nombre,
        codigoInternoCliente: s.codigoInternoCliente,
        software: s.software ?? null, observaciones: s.observaciones ?? null,
        configuracionGC,
        activo: true, ubicaciones: [], otIds: [],
        createdAt: now, updatedAt: now, createdBy: 'migracion',
      });
      createdIds.sistemas.push(id);
      count++;
    }
    console.log(`  ✅ ${count} sistema(s) creado(s)`);
  }

  // --- Módulos ---
  if (!onlyEntity || onlyEntity === 'modulos') {
    console.log('\n📥 Procesando módulos...');
    let count = 0;
    for (const m of modulos) {
      const sistQ = await db.collection('sistemas')
        .where('clienteId', '==', m.clienteCuit)
        .where('codigoInternoCliente', '==', m.sistemaCodigo).limit(1).get();
      if (sistQ.empty) {
        console.warn(`  WARN: sistema "${m.sistemaCodigo}" no encontrado — SKIP módulo "${m.nombre}"`);
        continue;
      }
      const sistemaId = sistQ.docs[0].id;
      const q = await db.collection('sistemas').doc(sistemaId).collection('modulos')
        .where('serie', '==', m.serie).limit(1).get();
      if (!q.empty) { console.log(`  SKIP módulo "${m.serie}" (ya existe)`); continue; }
      const id = require('crypto').randomUUID();
      await db.collection('sistemas').doc(sistemaId).collection('modulos').doc(id).set({
        id, sistemaId, nombre: m.nombre, serie: m.serie,
        firmware: m.firmware ?? null, marca: m.marca ?? null,
        observaciones: m.observaciones ?? null,
        activo: true, createdAt: now, updatedAt: now, createdBy: 'migracion',
      });
      createdIds.modulos.push(id);
      count++;
    }
    console.log(`  ✅ ${count} módulo(s) creado(s)`);
  }

  report.createdIds = createdIds;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isRun = args.includes('--run');
  const onlyEntity = args.find(a => a.startsWith('--only='))?.split('=')[1];

  if (!isDryRun && !isRun) {
    console.error('❌ Usá --dry-run o --run');
    process.exit(1);
  }

  const mode = isDryRun ? 'dry-run' : 'run';
  console.log(`\n🚀 AGS Migración — modo: ${mode.toUpperCase()}${onlyEntity ? ` (solo: ${onlyEntity})` : ''}\n`);

  // Leer Excel
  const xlsxPath = path.join(__dirname, 'input', 'datos.xlsx');
  if (!fs.existsSync(xlsxPath)) {
    console.error(`❌ No se encontró el archivo: ${xlsxPath}`);
    console.error('   Colocá el Excel en scripts/migracion/input/datos.xlsx');
    process.exit(1);
  }

  const wb = XLSX.readFile(xlsxPath);
  const sheetNames = wb.SheetNames;
  console.log(`📂 Hojas encontradas: ${sheetNames.join(', ')}`);

  // Parsear todas las hojas
  const clientesRaw = readSheet(wb, 'Clientes');
  const establRaw = readSheet(wb, 'Establecimientos');
  const sistemasRaw = readSheet(wb, 'Sistemas');
  const modulosRaw = readSheet(wb, 'Modulos');

  const clientes = parseClientes(clientesRaw);
  const establecimientos = parseEstablecimientos(establRaw);
  const sistemas = parseSistemas(sistemasRaw);
  const modulos = parseModulos(modulosRaw);

  console.log(`\n📊 Filas leídas: ${clientes.length} clientes | ${establecimientos.length} establecimientos | ${sistemas.length} sistemas | ${modulos.length} módulos`);

  // Validar
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  validateClientes(clientes, errors, warnings);
  validateEstablecimientos(establecimientos, clientes, errors, warnings);
  validateSistemas(sistemas, establecimientos, errors, warnings);
  validateModulos(modulos, sistemas, errors, warnings);

  if (errors.length > 0) {
    console.error(`\n❌ ${errors.length} error(es) encontrado(s):\n`);
    errors.forEach(e => console.error(`  [${e.sheet} fila ${e.row} / ${e.column}] ${e.message}`));
  }
  if (warnings.length > 0) {
    console.warn(`\n⚠️  ${warnings.length} advertencia(s):\n`);
    warnings.forEach(w => console.warn(`  [${w.sheet} fila ${w.row} / ${w.column}] ${w.message}`));
  }

  const report: MigrationReport = {
    timestamp: new Date().toISOString(),
    mode,
    errors,
    warnings,
    summary: {
      clientes: { total: clientes.length, valid: clientes.length - errors.filter(e => e.sheet === 'Clientes').length },
      establecimientos: { total: establecimientos.length, valid: establecimientos.length - errors.filter(e => e.sheet === 'Establecimientos').length },
      sistemas: { total: sistemas.length, valid: sistemas.length - errors.filter(e => e.sheet === 'Sistemas').length },
      modulos: { total: modulos.length, valid: modulos.length - errors.filter(e => e.sheet === 'Modulos').length },
    },
  };

  if (errors.length > 0 && isRun) {
    console.error('\n🚫 Hay errores bloqueantes. Corregí el Excel y volvé a ejecutar --dry-run antes de --run.');
    saveReport(report, mode);
    process.exit(1);
  }

  if (isDryRun) {
    console.log('\n✅ Dry-run completado. No se escribió nada en Firestore.');
  } else {
    await writeToFirestore(clientes, establecimientos, sistemas, modulos, onlyEntity, report);
  }

  saveReport(report, mode);
  printSummary(report);
}

function saveReport(report: MigrationReport, mode: string) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const filename = `${mode}-${date}.json`;
  const outPath = path.join(__dirname, 'output', filename);
  fs.mkdirSync(path.join(__dirname, 'output'), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\n📄 Reporte guardado en: output/${filename}`);
}

function printSummary(report: MigrationReport) {
  console.log('\n─────────────────────────────────────────');
  console.log('RESUMEN:');
  Object.entries(report.summary).forEach(([k, v]) => {
    console.log(`  ${k.padEnd(20)} ${v.valid}/${v.total} válidos`);
  });
  console.log(`  Errores: ${report.errors.length} | Advertencias: ${report.warnings.length}`);
  console.log('─────────────────────────────────────────\n');
}

main().catch(err => {
  console.error('\n💥 Error inesperado:', err);
  process.exit(1);
});
