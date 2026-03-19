import { useState, useCallback } from 'react';
import { collection, doc, getDoc, getDocs, query, where, limit, writeBatch, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { normalizeCuit } from '../services/firebase';
import * as XLSX from 'xlsx';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ValidationIssue {
  sheet: string;
  row: number;
  column: string;
  message: string;
}

interface ClienteRow {
  cuit: string;
  razonSocial: string;
  pais: string;
  rubro: string;
  direccionFiscal: string;
  localidad: string;
  provincia: string;
  condicionIva: string;
  notas: string;
}

interface EstablecimientoRow {
  clienteCuit: string;
  nombre: string;
  direccion: string;
  localidad: string;
  provincia: string;
  codigoPostal: string;
  tipo: string;
  lat: number | null;
  lng: number | null;
}

interface SistemaRow {
  clienteCuit: string;
  establecimientoNombre: string;
  categoriaId: string;
  nombre: string;
  codigoInternoCliente: string;
  software: string;
  observaciones: string;
  gcPuertoFront: string;
  gcPuertoBack: string;
  gcDetectorFront: string;
  gcDetectorBack: string;
}

interface ModuloRow {
  clienteCuit: string;
  establecimientoNombre: string;
  sistemaCodigo: string;
  nombre: string;
  serie: string;
  firmware: string;
  marca: string;
  observaciones: string;
}

export interface ParsedData {
  clientes: ClienteRow[];
  establecimientos: EstablecimientoRow[];
  sistemas: SistemaRow[];
  modulos: ModuloRow[];
}

export interface MigrationSummary {
  clientes: { total: number; valid: number; skipped: number; created: number };
  establecimientos: { total: number; valid: number; skipped: number; created: number };
  sistemas: { total: number; valid: number; skipped: number; created: number };
  modulos: { total: number; valid: number; skipped: number; created: number };
}

export type MigrationStep = 'idle' | 'parsing' | 'parsed' | 'validating' | 'validated' | 'writing' | 'done' | 'error';

// ─── Parsers ─────────────────────────────────────────────────────────────────

function str(val: unknown): string {
  return val != null ? String(val).trim() : '';
}

function num(val: unknown): number | null {
  const n = parseFloat(String(val));
  return isNaN(n) ? null : n;
}

function readSheet(wb: XLSX.WorkBook, name: string): Record<string, unknown>[] {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
}

function parseClientes(rows: Record<string, unknown>[]): ClienteRow[] {
  return rows.map(r => ({
    cuit: normalizeCuit(str(r['CUIT'] ?? r['Cuit'] ?? r['cuit'])),
    razonSocial: str(r['Razon Social'] ?? r['razonSocial'] ?? r['Razón Social']),
    pais: str(r['Pais'] ?? r['pais'] ?? r['País']) || 'Argentina',
    rubro: str(r['Rubro'] ?? r['rubro']),
    direccionFiscal: str(r['Direccion Fiscal'] ?? r['direccionFiscal'] ?? r['Dirección fiscal']),
    localidad: str(r['Localidad'] ?? r['localidad']),
    provincia: str(r['Provincia'] ?? r['provincia']),
    condicionIva: str(r['Condicion IVA'] ?? r['condicionIva'] ?? r['Condición Iva']),
    notas: str(r['Notas'] ?? r['notas']),
  }));
}

function parseEstablecimientos(rows: Record<string, unknown>[]): EstablecimientoRow[] {
  return rows.map(r => ({
    clienteCuit: normalizeCuit(str(r['CUIT Cliente'] ?? r['Cuit Cliente'] ?? r['clienteCuit'])),
    nombre: str(r['Nombre'] ?? r['nombre']),
    direccion: str(r['Direccion'] ?? r['direccion'] ?? r['Dirección']),
    localidad: str(r['Localidad'] ?? r['localidad']),
    provincia: str(r['Provincia'] ?? r['provincia'] ?? r['Provicia']),
    codigoPostal: str(r['Codigo Postal'] ?? r['Codigo postal'] ?? r['codigoPostal']),
    tipo: str(r['Tipo'] ?? r['tipo']),
    lat: num(r['Latitud'] ?? r['lat']),
    lng: num(r['Longitud'] ?? r['lng']),
  }));
}

function parseSistemas(rows: Record<string, unknown>[]): SistemaRow[] {
  return rows.map(r => ({
    clienteCuit: normalizeCuit(str(r['CUIT Cliente'] ?? r['Cuit cliente'] ?? r['clienteCuit'])),
    establecimientoNombre: str(r['Establecimiento'] ?? r['establecimientoNombre']),
    categoriaId: str(r['Categoria ID'] ?? r['categoriaId']),
    nombre: str(r['Nombre Sistema'] ?? r['Nombre sistema'] ?? r['nombre']),
    codigoInternoCliente: str(r['Codigo Interno'] ?? r['Codigo interno'] ?? r['codigoInternoCliente']),
    software: str(r['Software'] ?? r['software']),
    observaciones: str(r['Observaciones'] ?? r['observaciones']),
    gcPuertoFront: str(r['GC Puerto Front'] ?? r['gcPuertoFront']),
    gcPuertoBack: str(r['GC Puerto Back'] ?? r['gcPuertoBack']),
    gcDetectorFront: str(r['GC Detector Front'] ?? r['gcDetectorFront']),
    gcDetectorBack: str(r['GC Detector Back'] ?? r['gcDetectorBack']),
  }));
}

function parseModulos(rows: Record<string, unknown>[]): ModuloRow[] {
  return rows.map(r => ({
    clienteCuit: normalizeCuit(str(r['CUIT Cliente'] ?? r['Cuit Cliente'] ?? r['clienteCuit'])),
    establecimientoNombre: str(r['Establecimiento'] ?? r['establecimientoNombre']),
    sistemaCodigo: str(r['Codigo Sistema'] ?? r['Codigo sistema'] ?? r['sistemaCodigo'] ?? r['codigoInternoCliente']),
    nombre: str(r['Nombre Modulo'] ?? r['Nombre modulo'] ?? r['nombre']),
    serie: str(r['Numero Serie'] ?? r['Número de serie'] ?? r['serie']),
    firmware: str(r['Firmware'] ?? r['firmware']),
    marca: str(r['Marca'] ?? r['marca']),
    observaciones: str(r['Observaciones'] ?? r['observaciones']),
  }));
}

// ─── Validators ──────────────────────────────────────────────────────────────

const VALID_INLETS = ['SSL', 'COC', 'PTV'];
const VALID_DETECTORS = ['FID', 'NCD', 'FPD', 'ECD', 'SCD'];

function validateAll(data: ParsedData): { errors: ValidationIssue[]; warnings: ValidationIssue[] } {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // Clientes
  const cuits = new Set<string>();
  data.clientes.forEach((r, i) => {
    const row = i + 2;
    if (!r.cuit) errors.push({ sheet: 'Clientes', row, column: 'CUIT', message: 'CUIT vacio' });
    else if (!/^\d{2}-\d{8}-\d{1}$/.test(r.cuit)) errors.push({ sheet: 'Clientes', row, column: 'CUIT', message: `CUIT invalido: "${r.cuit}" (debe ser XX-XXXXXXXX-X)` });
    else if (cuits.has(r.cuit)) warnings.push({ sheet: 'Clientes', row, column: 'CUIT', message: `CUIT duplicado: ${r.cuit}` });
    else cuits.add(r.cuit);
    if (!r.razonSocial) errors.push({ sheet: 'Clientes', row, column: 'Razon Social', message: 'Razon Social vacia' });
    if (!r.rubro) warnings.push({ sheet: 'Clientes', row, column: 'Rubro', message: 'Rubro vacio' });
  });

  // Establecimientos
  const cuitSet = new Set(data.clientes.map(c => c.cuit));
  data.establecimientos.forEach((r, i) => {
    const row = i + 2;
    if (!r.clienteCuit) errors.push({ sheet: 'Establecimientos', row, column: 'CUIT Cliente', message: 'CUIT Cliente vacio' });
    else if (!cuitSet.has(r.clienteCuit)) errors.push({ sheet: 'Establecimientos', row, column: 'CUIT Cliente', message: `CUIT ${r.clienteCuit} no existe en hoja Clientes` });
    if (!r.nombre) errors.push({ sheet: 'Establecimientos', row, column: 'Nombre', message: 'Nombre vacio' });
    if (!r.direccion) warnings.push({ sheet: 'Establecimientos', row, column: 'Direccion', message: 'Direccion vacia' });
  });

  // Sistemas
  const establSet = new Set(data.establecimientos.map(e => `${e.clienteCuit}|${e.nombre.toLowerCase()}`));
  data.sistemas.forEach((r, i) => {
    const row = i + 2;
    if (!r.clienteCuit) errors.push({ sheet: 'Sistemas', row, column: 'CUIT Cliente', message: 'CUIT Cliente vacio' });
    if (!r.establecimientoNombre) errors.push({ sheet: 'Sistemas', row, column: 'Establecimiento', message: 'Nombre de establecimiento vacio' });
    else if (!establSet.has(`${r.clienteCuit}|${r.establecimientoNombre.toLowerCase()}`)) {
      warnings.push({ sheet: 'Sistemas', row, column: 'Establecimiento', message: `"${r.establecimientoNombre}" no encontrado en hoja Establecimientos para CUIT ${r.clienteCuit}` });
    }
    if (!r.categoriaId) warnings.push({ sheet: 'Sistemas', row, column: 'Categoria ID', message: 'Categoria ID vacio' });
    if (!r.nombre) errors.push({ sheet: 'Sistemas', row, column: 'Nombre Sistema', message: 'Nombre de sistema vacio' });
    if (!r.codigoInternoCliente) errors.push({ sheet: 'Sistemas', row, column: 'Codigo Interno', message: 'Codigo interno vacio' });

    const esGaseoso = r.nombre?.toLowerCase().includes('gaseoso');
    if (esGaseoso) {
      if (r.gcPuertoFront && !VALID_INLETS.includes(r.gcPuertoFront.toUpperCase()))
        errors.push({ sheet: 'Sistemas', row, column: 'GC Puerto Front', message: `Valor invalido "${r.gcPuertoFront}". Debe ser: ${VALID_INLETS.join(' | ')}` });
      if (r.gcPuertoBack && !VALID_INLETS.includes(r.gcPuertoBack.toUpperCase()))
        errors.push({ sheet: 'Sistemas', row, column: 'GC Puerto Back', message: `Valor invalido "${r.gcPuertoBack}". Debe ser: ${VALID_INLETS.join(' | ')}` });
      if (r.gcDetectorFront && !VALID_DETECTORS.includes(r.gcDetectorFront.toUpperCase()))
        errors.push({ sheet: 'Sistemas', row, column: 'GC Detector Front', message: `Valor invalido "${r.gcDetectorFront}". Debe ser: ${VALID_DETECTORS.join(' | ')}` });
      if (r.gcDetectorBack && !VALID_DETECTORS.includes(r.gcDetectorBack.toUpperCase()))
        errors.push({ sheet: 'Sistemas', row, column: 'GC Detector Back', message: `Valor invalido "${r.gcDetectorBack}". Debe ser: ${VALID_DETECTORS.join(' | ')}` });
    } else if (r.gcPuertoFront || r.gcPuertoBack || r.gcDetectorFront || r.gcDetectorBack) {
      warnings.push({ sheet: 'Sistemas', row, column: 'GC', message: `Campos GC completados pero "${r.nombre}" no contiene "gaseoso"` });
    }
  });

  // Modulos
  const sistSet = new Set(data.sistemas.map(s => `${s.clienteCuit}|${s.codigoInternoCliente.toLowerCase()}`));
  data.modulos.forEach((r, i) => {
    const row = i + 2;
    if (!r.clienteCuit) errors.push({ sheet: 'Modulos', row, column: 'CUIT Cliente', message: 'CUIT Cliente vacio' });
    if (!r.sistemaCodigo) errors.push({ sheet: 'Modulos', row, column: 'Codigo Sistema', message: 'Codigo de sistema vacio' });
    else if (!sistSet.has(`${r.clienteCuit}|${r.sistemaCodigo.toLowerCase()}`))
      warnings.push({ sheet: 'Modulos', row, column: 'Codigo Sistema', message: `Sistema "${r.sistemaCodigo}" no encontrado para CUIT ${r.clienteCuit}` });
    if (!r.nombre) errors.push({ sheet: 'Modulos', row, column: 'Nombre Modulo', message: 'Nombre de modulo vacio' });
    if (!r.serie) warnings.push({ sheet: 'Modulos', row, column: 'Numero Serie', message: 'Numero de serie vacio' });
  });

  return { errors, warnings };
}

// ─── Firestore Writer ────────────────────────────────────────────────────────

async function writeToFirestore(
  data: ParsedData,
  onProgress: (msg: string) => void,
): Promise<MigrationSummary> {
  const now = Timestamp.now();
  const summary: MigrationSummary = {
    clientes: { total: data.clientes.length, valid: 0, skipped: 0, created: 0 },
    establecimientos: { total: data.establecimientos.length, valid: 0, skipped: 0, created: 0 },
    sistemas: { total: data.sistemas.length, valid: 0, skipped: 0, created: 0 },
    modulos: { total: data.modulos.length, valid: 0, skipped: 0, created: 0 },
  };

  // ── PASO 1: Clientes ──
  onProgress('Procesando clientes...');
  let batch = writeBatch(db);
  let batchCount = 0;
  const BATCH_LIMIT = 400;

  for (const c of data.clientes) {
    if (!c.cuit || !c.razonSocial) continue;
    summary.clientes.valid++;
    const ref = doc(db, 'clientes', c.cuit);
    const existing = await getDoc(ref);
    if (existing.exists()) { summary.clientes.skipped++; continue; }
    batch.set(ref, {
      id: c.cuit, cuit: c.cuit, razonSocial: c.razonSocial,
      pais: c.pais, rubro: c.rubro || null,
      direccionFiscal: c.direccionFiscal || null,
      localidadFiscal: c.localidad || null,
      provinciaFiscal: c.provincia || null,
      condicionIva: c.condicionIva || null,
      notas: c.notas || null,
      activo: true, createdAt: now, updatedAt: now, createdBy: 'migracion-web',
    });
    summary.clientes.created++;
    batchCount++;
    if (batchCount >= BATCH_LIMIT) {
      await batch.commit();
      batch = writeBatch(db);
      batchCount = 0;
    }
  }
  if (batchCount > 0) { await batch.commit(); batch = writeBatch(db); batchCount = 0; }
  onProgress(`Clientes: ${summary.clientes.created} creados, ${summary.clientes.skipped} existentes`);

  // ── PASO 2: Establecimientos ──
  onProgress('Procesando establecimientos...');
  for (const e of data.establecimientos) {
    if (!e.clienteCuit || !e.nombre) continue;
    summary.establecimientos.valid++;
    // Check dedup: clienteId + nombre
    const q = query(
      collection(db, 'establecimientos'),
      where('clienteCuit', '==', e.clienteCuit),
      where('nombre', '==', e.nombre),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) { summary.establecimientos.skipped++; continue; }
    const id = `${e.clienteCuit}-${e.nombre.toLowerCase().replace(/\s+/g, '-').slice(0, 40)}-${Date.now()}`;
    const ref = doc(db, 'establecimientos', id);
    batch.set(ref, {
      id, clienteCuit: e.clienteCuit, nombre: e.nombre,
      direccion: e.direccion || '', localidad: e.localidad || '',
      provincia: e.provincia || '', codigoPostal: e.codigoPostal || null,
      tipo: e.tipo || null, lat: e.lat, lng: e.lng,
      activo: true, createdAt: now, updatedAt: now, createdBy: 'migracion-web',
    });
    summary.establecimientos.created++;
    batchCount++;
    if (batchCount >= BATCH_LIMIT) {
      await batch.commit();
      batch = writeBatch(db);
      batchCount = 0;
    }
  }
  if (batchCount > 0) { await batch.commit(); batch = writeBatch(db); batchCount = 0; }
  onProgress(`Establecimientos: ${summary.establecimientos.created} creados, ${summary.establecimientos.skipped} existentes`);

  // ── PASO 3: Sistemas ──
  onProgress('Procesando sistemas...');
  for (const s of data.sistemas) {
    if (!s.clienteCuit || !s.codigoInternoCliente || !s.nombre) continue;
    summary.sistemas.valid++;
    // Find establecimiento
    const establQ = query(
      collection(db, 'establecimientos'),
      where('clienteCuit', '==', s.clienteCuit),
      where('nombre', '==', s.establecimientoNombre),
      limit(1)
    );
    const establSnap = await getDocs(establQ);
    const establecimientoId = establSnap.empty ? '' : establSnap.docs[0].id;
    // Check dedup
    const sistQ = query(
      collection(db, 'sistemas'),
      where('establecimientoId', '==', establecimientoId),
      where('codigoInternoCliente', '==', s.codigoInternoCliente),
      limit(1)
    );
    const sistSnap = await getDocs(sistQ);
    if (!sistSnap.empty) { summary.sistemas.skipped++; continue; }

    const id = crypto.randomUUID();
    const esGaseoso = s.nombre.toLowerCase().includes('gaseoso');
    const configuracionGC = esGaseoso ? {
      puertoInyeccionFront: s.gcPuertoFront?.toUpperCase() || null,
      puertoInyeccionBack: s.gcPuertoBack?.toUpperCase() || null,
      detectorFront: s.gcDetectorFront?.toUpperCase() || null,
      detectorBack: s.gcDetectorBack?.toUpperCase() || null,
    } : null;

    const ref = doc(db, 'sistemas', id);
    batch.set(ref, {
      id, establecimientoId, clienteId: s.clienteCuit,
      categoriaId: s.categoriaId, nombre: s.nombre,
      codigoInternoCliente: s.codigoInternoCliente,
      software: s.software || null, observaciones: s.observaciones || null,
      configuracionGC,
      activo: true, ubicaciones: [], otIds: [],
      createdAt: now, updatedAt: now, createdBy: 'migracion-web',
    });
    summary.sistemas.created++;
    batchCount++;
    if (batchCount >= BATCH_LIMIT) {
      await batch.commit();
      batch = writeBatch(db);
      batchCount = 0;
    }
  }
  if (batchCount > 0) { await batch.commit(); batch = writeBatch(db); batchCount = 0; }
  onProgress(`Sistemas: ${summary.sistemas.created} creados, ${summary.sistemas.skipped} existentes`);

  // ── PASO 4: Modulos ──
  onProgress('Procesando modulos...');
  for (const m of data.modulos) {
    if (!m.clienteCuit || !m.sistemaCodigo || !m.nombre) continue;
    summary.modulos.valid++;
    // Find parent sistema
    const sistQ = query(
      collection(db, 'sistemas'),
      where('clienteCuit', '==', m.clienteCuit),
      where('codigoInternoCliente', '==', m.sistemaCodigo),
      limit(1)
    );
    const sistSnap = await getDocs(sistQ);
    if (sistSnap.empty) { summary.modulos.skipped++; continue; }
    const sistemaId = sistSnap.docs[0].id;
    // Check dedup by serie
    if (m.serie) {
      const modQ = query(
        collection(db, 'sistemas', sistemaId, 'modulos'),
        where('serie', '==', m.serie),
        limit(1)
      );
      const modSnap = await getDocs(modQ);
      if (!modSnap.empty) { summary.modulos.skipped++; continue; }
    }
    const id = crypto.randomUUID();
    const ref = doc(db, 'sistemas', sistemaId, 'modulos', id);
    batch.set(ref, {
      id, sistemaId, nombre: m.nombre, serie: m.serie || null,
      firmware: m.firmware || null, marca: m.marca || null,
      observaciones: m.observaciones || null,
      activo: true, createdAt: now, updatedAt: now, createdBy: 'migracion-web',
    });
    summary.modulos.created++;
    batchCount++;
    if (batchCount >= BATCH_LIMIT) {
      await batch.commit();
      batch = writeBatch(db);
      batchCount = 0;
    }
  }
  if (batchCount > 0) { await batch.commit(); }
  onProgress(`Modulos: ${summary.modulos.created} creados, ${summary.modulos.skipped} existentes`);

  return summary;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useExcelMigration() {
  const [step, setStep] = useState<MigrationStep>('idle');
  const [data, setData] = useState<ParsedData | null>(null);
  const [errors, setErrors] = useState<ValidationIssue[]>([]);
  const [warnings, setWarnings] = useState<ValidationIssue[]>([]);
  const [summary, setSummary] = useState<MigrationSummary | null>(null);
  const [progressLog, setProgressLog] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

  const addLog = (msg: string) => setProgressLog(prev => [...prev, msg]);

  const parseFile = useCallback(async (file: File) => {
    setStep('parsing');
    setErrors([]);
    setWarnings([]);
    setSummary(null);
    setProgressLog([]);
    setErrorMessage('');

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });

      addLog(`Hojas encontradas: ${wb.SheetNames.join(', ')}`);

      const clientes = parseClientes(readSheet(wb, 'Clientes'));
      const establecimientos = parseEstablecimientos(readSheet(wb, 'Establecimientos'));
      const sistemas = parseSistemas(readSheet(wb, 'Sistemas'));
      const modulos = parseModulos(readSheet(wb, 'Modulos'));

      const parsed: ParsedData = { clientes, establecimientos, sistemas, modulos };
      setData(parsed);

      addLog(`Filas: ${clientes.length} clientes, ${establecimientos.length} establecimientos, ${sistemas.length} sistemas, ${modulos.length} modulos`);

      // Validate
      setStep('validating');
      const { errors: errs, warnings: warns } = validateAll(parsed);
      setErrors(errs);
      setWarnings(warns);

      if (errs.length > 0) {
        addLog(`${errs.length} error(es) bloqueante(s) encontrados`);
      }
      if (warns.length > 0) {
        addLog(`${warns.length} advertencia(s)`);
      }
      if (errs.length === 0) {
        addLog('Validacion exitosa - listo para importar');
      }

      setStep('validated');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al leer el archivo');
      setStep('error');
    }
  }, []);

  const execute = useCallback(async () => {
    if (!data || errors.length > 0) return;

    setStep('writing');
    setProgressLog(prev => [...prev, '--- Iniciando escritura en Firestore ---']);

    try {
      const result = await writeToFirestore(data, (msg) => {
        setProgressLog(prev => [...prev, msg]);
      });
      setSummary(result);
      setProgressLog(prev => [...prev, '--- Migracion completada ---']);
      setStep('done');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al escribir en Firestore');
      setProgressLog(prev => [...prev, `ERROR: ${err instanceof Error ? err.message : 'Error desconocido'}`]);
      setStep('error');
    }
  }, [data, errors]);

  const reset = useCallback(() => {
    setStep('idle');
    setData(null);
    setErrors([]);
    setWarnings([]);
    setSummary(null);
    setProgressLog([]);
    setErrorMessage('');
  }, []);

  return { step, data, errors, warnings, summary, progressLog, errorMessage, parseFile, execute, reset };
}
