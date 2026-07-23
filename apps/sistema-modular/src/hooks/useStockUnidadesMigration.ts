import { useState, useCallback } from 'react';
import { collection, doc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { writeBatch } from '../services/firebase';
import { db } from '../services/firebase';
import * as XLSX from 'xlsx';

export interface ValidationIssue {
  sheet: string;
  row: number;
  column: string;
  message: string;
}

interface UnidadRow {
  codigoDeposito: string;
  codigoArticulo: string;
  cantidad: number;
  nroSerie: string;
  nroLote: string;
}

export interface UnidadesParsedData {
  unidades: UnidadRow[];
}

export interface UnidadesMigrationSummary {
  filas: number;
  unidadesACrear: number;
  /** Documentos de unidad creados (serie → 1 c/u; granel/lote → 1 doc con cantidad N). */
  unidadesCreadas: number;
  /** Unidades físicas representadas (suma de cantidades). */
  unidadesFisicas: number;
  /** Movimientos de 'ingreso' creados (uno por doc de unidad — invariante del circuito). */
  movimientosCreados: number;
  filasBloqueadas: number;
  filasSinAsignar: number;
  filasWipeadas: number;
}

export type MigrationStep = 'idle' | 'parsing' | 'parsed' | 'validating' | 'validated' | 'writing' | 'done' | 'error';

const SIN_ASIGNAR_CODIGO = 'SIN_ASIGNAR';
const SIN_ASIGNAR_NOMBRE = 'Sin asignar';

function str(val: unknown): string {
  return val != null ? String(val).trim() : '';
}

function num(val: unknown): number {
  if (val === '' || val == null) return 0;
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

function readSheet(wb: XLSX.WorkBook, name: string): Record<string, unknown>[] {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
}

function parseUnidades(rows: Record<string, unknown>[]): UnidadRow[] {
  return rows.map(r => ({
    codigoDeposito: str(r['Código Depósito'] ?? r['Codigo Deposito'] ?? r['CodigoDeposito'] ?? r['codigoDeposito']),
    codigoArticulo: str(r['Código Artículo'] ?? r['Codigo Articulo'] ?? r['CodigoArticulo'] ?? r['codigoArticulo']),
    cantidad: num(r['Cantidad'] ?? r['cantidad'] ?? r['CANTIDAD']),
    nroSerie: str(r['Nro. Serie'] ?? r['Nro Serie'] ?? r['NroSerie'] ?? r['nroSerie'] ?? r['Numero Serie']),
    nroLote: str(r['Nro. Lote'] ?? r['Nro Lote'] ?? r['NroLote'] ?? r['nroLote'] ?? r['Lote'] ?? r['LOTE']),
  }));
}

interface ValidationContext {
  articulosByCodigo: Map<string, { id: string; codigo: string; descripcion: string }>;
  posicionesByCodigo: Map<string, { id: string; codigo: string; nombre: string }>;
}

function validateUnidades(
  rows: UnidadRow[],
  ctx: ValidationContext,
): { errors: ValidationIssue[]; warnings: ValidationIssue[]; unidadesACrear: number; filasSinAsignar: number } {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  let unidadesACrear = 0;
  let filasSinAsignar = 0;

  rows.forEach((r, i) => {
    const row = i + 2; // header en fila 1

    if (!r.codigoArticulo) {
      errors.push({ sheet: 'Unidades', row, column: 'Código Artículo', message: 'Código de artículo vacío' });
      return;
    }
    if (!ctx.articulosByCodigo.has(r.codigoArticulo.toLowerCase())) {
      errors.push({ sheet: 'Unidades', row, column: 'Código Artículo', message: `Artículo "${r.codigoArticulo}" no existe en el catálogo` });
      return;
    }

    if (r.nroSerie && r.cantidad > 1) {
      errors.push({ sheet: 'Unidades', row, column: 'Cantidad', message: `Conflicto: tiene Nro Serie "${r.nroSerie}" y Cantidad ${r.cantidad}. Si tiene serie, cantidad debe ser 1 (o vacía).` });
      return;
    }

    if (!r.nroSerie && r.cantidad <= 0) {
      errors.push({ sheet: 'Unidades', row, column: 'Cantidad', message: 'Sin Nro Serie y sin Cantidad — no se sabe cuántas unidades crear' });
      return;
    }

    const unidadesDeFila = r.nroSerie ? 1 : r.cantidad;
    unidadesACrear += unidadesDeFila;

    if (r.codigoDeposito && !ctx.posicionesByCodigo.has(r.codigoDeposito.toLowerCase())) {
      warnings.push({ sheet: 'Unidades', row, column: 'Código Depósito', message: `Depósito "${r.codigoDeposito}" no encontrado — ${unidadesDeFila} unidad(es) irán a SIN_ASIGNAR` });
      filasSinAsignar++;
    } else if (!r.codigoDeposito) {
      warnings.push({ sheet: 'Unidades', row, column: 'Código Depósito', message: `Depósito vacío — ${unidadesDeFila} unidad(es) irán a SIN_ASIGNAR` });
      filasSinAsignar++;
    }
  });

  return { errors, warnings, unidadesACrear, filasSinAsignar };
}

async function loadArticulos(): Promise<Map<string, { id: string; codigo: string; descripcion: string }>> {
  const snap = await getDocs(collection(db, 'articulos'));
  const map = new Map<string, { id: string; codigo: string; descripcion: string }>();
  snap.docs.forEach(d => {
    const data = d.data() as { codigo?: string; descripcion?: string };
    const codigo = String(data.codigo || '').trim();
    if (codigo) {
      map.set(codigo.toLowerCase(), {
        id: d.id,
        codigo,
        descripcion: String(data.descripcion || ''),
      });
    }
  });
  return map;
}

async function loadPosiciones(): Promise<Map<string, { id: string; codigo: string; nombre: string }>> {
  const snap = await getDocs(collection(db, 'posicionesStock'));
  const map = new Map<string, { id: string; codigo: string; nombre: string }>();
  snap.docs.forEach(d => {
    const data = d.data() as { codigo?: string; nombre?: string };
    const codigo = String(data.codigo || '').trim();
    if (codigo) {
      map.set(codigo.toLowerCase(), {
        id: d.id,
        codigo,
        nombre: String(data.nombre || ''),
      });
    }
  });
  return map;
}

async function getOrCreateSinAsignar(
  posicionesByCodigo: Map<string, { id: string; codigo: string; nombre: string }>,
): Promise<{ id: string; codigo: string; nombre: string }> {
  const existing = posicionesByCodigo.get(SIN_ASIGNAR_CODIGO.toLowerCase());
  if (existing) return existing;
  const now = Timestamp.now();
  const id = crypto.randomUUID();
  const batch = writeBatch(db);
  batch.set(doc(db, 'posicionesStock', id), {
    id,
    codigo: SIN_ASIGNAR_CODIGO,
    nombre: SIN_ASIGNAR_NOMBRE,
    descripcion: 'Posición especial para unidades sin depósito asignado (creada por migración)',
    tipo: 'deposito',
    parentId: null,
    zona: null,
    activo: true,
    createdAt: now,
    updatedAt: now,
    createdBy: 'migracion-stock',
  });
  await batch.commit();
  const created = { id, codigo: SIN_ASIGNAR_CODIGO, nombre: SIN_ASIGNAR_NOMBRE };
  posicionesByCodigo.set(SIN_ASIGNAR_CODIGO.toLowerCase(), created);
  return created;
}

async function wipePreviousBatch(
  tag: string,
  onProgress: (msg: string) => void,
): Promise<number> {
  const createdBy = `migracion-stock-${tag}`;
  onProgress(`Buscando unidades previas con tag "${tag}"...`);
  const q = query(collection(db, 'unidades'), where('createdBy', '==', createdBy));
  const snap = await getDocs(q);
  if (snap.empty) {
    onProgress('No hay unidades previas con ese tag');
  } else {
    onProgress(`Eliminando ${snap.size} unidades previas...`);
  }
  const BATCH_LIMIT = 400;
  let batch = writeBatch(db);
  let count = 0;
  let deleted = 0;
  for (const d of snap.docs) {
    batch.delete(d.ref);
    count++;
    deleted++;
    if (count >= BATCH_LIMIT) {
      await batch.commit();
      batch = writeBatch(db);
      count = 0;
    }
  }
  if (count > 0) await batch.commit();
  if (deleted > 0) onProgress(`${deleted} unidades previas eliminadas`);

  // Movimientos 'ingreso' de la tanda previa: también se limpian para que la
  // re-corrida no duplique el log. OJO: con las rules movimientosStock
  // create-only DEPLOYADAS este delete falla — la re-tanda con wipe debe
  // hacerse ANTES del deploy de rules (o aceptar los movimientos huérfanos).
  try {
    const qMov = query(collection(db, 'movimientosStock'), where('creadoPor', '==', createdBy));
    const snapMov = await getDocs(qMov);
    if (!snapMov.empty) {
      onProgress(`Eliminando ${snapMov.size} movimientos de la tanda previa...`);
      let batchMov = writeBatch(db);
      let countMov = 0;
      for (const d of snapMov.docs) {
        batchMov.delete(d.ref);
        countMov++;
        if (countMov >= BATCH_LIMIT) {
          await batchMov.commit();
          batchMov = writeBatch(db);
          countMov = 0;
        }
      }
      if (countMov > 0) await batchMov.commit();
      onProgress(`${snapMov.size} movimientos previos eliminados`);
    }
  } catch (err) {
    onProgress(`⚠ No se pudieron eliminar los movimientos de la tanda previa (¿rules create-only ya deployadas?): ${err instanceof Error ? err.message : err}`);
    onProgress('⚠ Los movimientos de ingreso de la tanda anterior quedan huérfanos en el log.');
  }
  return deleted;
}

async function writeUnidades(
  rows: UnidadRow[],
  tag: string,
  wipePrevious: boolean,
  onProgress: (msg: string) => void,
): Promise<UnidadesMigrationSummary> {
  const summary: UnidadesMigrationSummary = {
    filas: rows.length,
    unidadesACrear: 0,
    unidadesCreadas: 0,
    unidadesFisicas: 0,
    movimientosCreados: 0,
    filasBloqueadas: 0,
    filasSinAsignar: 0,
    filasWipeadas: 0,
  };

  if (wipePrevious) {
    summary.filasWipeadas = await wipePreviousBatch(tag, onProgress);
  }

  onProgress('Cargando catálogo de artículos...');
  const articulosByCodigo = await loadArticulos();
  onProgress(`${articulosByCodigo.size} artículos en catálogo`);

  onProgress('Cargando posiciones de stock...');
  const posicionesByCodigo = await loadPosiciones();
  onProgress(`${posicionesByCodigo.size} posiciones en catálogo`);

  onProgress(`Asegurando posición especial ${SIN_ASIGNAR_CODIGO}...`);
  const sinAsignar = await getOrCreateSinAsignar(posicionesByCodigo);

  const createdBy = `migracion-stock-${tag}`;
  const now = Timestamp.now();
  let batch = writeBatch(db);
  let batchCount = 0;
  // 2 docs por alta (unidad + movimiento de ingreso) → 200 altas por batch < límite 500.
  const BATCH_LIMIT = 200;

  onProgress('Creando unidades + movimientos de ingreso...');
  for (const r of rows) {
    if (!r.codigoArticulo) { summary.filasBloqueadas++; continue; }
    const articulo = articulosByCodigo.get(r.codigoArticulo.toLowerCase());
    if (!articulo) { summary.filasBloqueadas++; continue; }
    if (r.nroSerie && r.cantidad > 1) { summary.filasBloqueadas++; continue; }
    if (!r.nroSerie && r.cantidad <= 0) { summary.filasBloqueadas++; continue; }

    const ubicacionRef = r.codigoDeposito ? posicionesByCodigo.get(r.codigoDeposito.toLowerCase()) : null;
    const ubicacion = ubicacionRef || sinAsignar;
    if (!ubicacionRef) summary.filasSinAsignar++;

    // Modelo actual de existencias (auditoría I7, lotes por cantidad):
    // serie → un doc con cantidad 1; granel/lote → UN doc con cantidad N
    // (antes se creaban N docs sueltos, inconsistente con el circuito).
    const cantidadDoc = r.nroSerie ? 1 : r.cantidad;
    summary.unidadesACrear += 1;
    summary.unidadesFisicas += cantidadDoc;

    const id = crypto.randomUUID();
    batch.set(doc(db, 'unidades', id), {
      id,
      articuloId: articulo.id,
      articuloCodigo: articulo.codigo,
      articuloDescripcion: articulo.descripcion,
      nroSerie: r.nroSerie || null,
      nroLote: r.nroLote || null,
      cantidad: cantidadDoc,
      condicion: 'nuevo',
      estado: 'disponible',
      ubicacion: {
        tipo: 'posicion',
        referenciaId: ubicacion.id,
        referenciaNombre: ubicacion.nombre,
      },
      costoUnitario: null,
      monedaCosto: null,
      ordenCompraNumero: null,
      despachoImportacionNumero: null,
      observaciones: null,
      activo: true,
      createdAt: now,
      updatedAt: now,
      createdBy,
    });
    summary.unidadesCreadas++;

    // Invariante del circuito (auditoría pre-go-live): toda existencia nace con
    // su MovimientoStock de ingreso. Sin esto el stock migrado arranca sin log.
    const movId = crypto.randomUUID();
    batch.set(doc(db, 'movimientosStock', movId), {
      id: movId,
      tipo: 'ingreso',
      unidadId: id,
      articuloId: articulo.id,
      articuloCodigo: articulo.codigo,
      articuloDescripcion: articulo.descripcion,
      cantidad: cantidadDoc,
      // Denormalizado para poder filtrar el log por serie/lote (igual que en la unidad).
      nroSerie: r.nroSerie || null,
      nroLote: r.nroLote || null,
      origenTipo: 'ajuste',
      origenId: '',
      origenNombre: 'Migración sistema anterior',
      destinoTipo: 'posicion',
      destinoId: ubicacion.id,
      destinoNombre: ubicacion.nombre,
      remitoId: null,
      otNumber: null,
      motivo: `Carga inicial de stock — migración sistema anterior (tanda ${tag})`,
      creadoPor: createdBy,
      createdAt: now,
    });
    summary.movimientosCreados++;

    batchCount += 2;
    if (batchCount >= BATCH_LIMIT * 2) {
      await batch.commit();
      onProgress(`${summary.unidadesCreadas} docs de unidad creados (${summary.unidadesFisicas} unidades físicas)...`);
      batch = writeBatch(db);
      batchCount = 0;
    }
  }
  if (batchCount > 0) await batch.commit();
  onProgress(`Migración completada: ${summary.unidadesCreadas} docs de unidad (${summary.unidadesFisicas} unidades físicas) + ${summary.movimientosCreados} movimientos de ingreso`);

  return summary;
}

export function useStockUnidadesMigration() {
  const [step, setStep] = useState<MigrationStep>('idle');
  const [data, setData] = useState<UnidadesParsedData | null>(null);
  const [errors, setErrors] = useState<ValidationIssue[]>([]);
  const [warnings, setWarnings] = useState<ValidationIssue[]>([]);
  const [summary, setSummary] = useState<UnidadesMigrationSummary | null>(null);
  const [previewCounts, setPreviewCounts] = useState<{ unidadesACrear: number; filasSinAsignar: number } | null>(null);
  const [progressLog, setProgressLog] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [tag, setTag] = useState('v1');
  const [wipePrevious, setWipePrevious] = useState(false);

  const addLog = (msg: string) => setProgressLog(prev => [...prev, msg]);

  const parseFile = useCallback(async (file: File) => {
    setStep('parsing');
    setErrors([]);
    setWarnings([]);
    setSummary(null);
    setPreviewCounts(null);
    setProgressLog([]);
    setErrorMessage('');

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      addLog(`Hojas encontradas: ${wb.SheetNames.join(', ')}`);
      const sheetName = wb.SheetNames[0];
      addLog(`Usando hoja: "${sheetName}"`);

      const unidades = parseUnidades(readSheet(wb, sheetName));
      setData({ unidades });
      addLog(`Filas: ${unidades.length}`);

      setStep('validating');
      addLog('Cargando catálogos para validación...');
      const [articulosByCodigo, posicionesByCodigo] = await Promise.all([
        loadArticulos(),
        loadPosiciones(),
      ]);
      addLog(`Catálogo: ${articulosByCodigo.size} artículos, ${posicionesByCodigo.size} posiciones`);

      const { errors: errs, warnings: warns, unidadesACrear, filasSinAsignar } = validateUnidades(unidades, {
        articulosByCodigo,
        posicionesByCodigo,
      });
      setErrors(errs);
      setWarnings(warns);
      setPreviewCounts({ unidadesACrear, filasSinAsignar });

      if (errs.length > 0) addLog(`${errs.length} error(es) bloqueante(s)`);
      if (warns.length > 0) addLog(`${warns.length} advertencia(s) — ${filasSinAsignar} fila(s) irán a SIN_ASIGNAR`);
      addLog(`${unidadesACrear} unidades físicas a migrar (filas válidas: ${unidades.length - errs.length}; un doc por fila + su movimiento de ingreso)`);
      if (errs.length === 0) addLog('Validación exitosa — listo para importar');

      setStep('validated');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al leer el archivo');
      setStep('error');
    }
  }, []);

  const execute = useCallback(async () => {
    if (!data || errors.length > 0) return;
    if (!tag.trim()) {
      setErrorMessage('Tag de tanda es obligatorio (ej v1, v2)');
      return;
    }

    setStep('writing');
    setProgressLog(prev => [...prev, '--- Iniciando escritura en Firestore ---', `Tag de tanda: "${tag.trim()}"`, `Wipe previo: ${wipePrevious ? 'SÍ' : 'NO'}`]);

    try {
      const result = await writeUnidades(data.unidades, tag.trim(), wipePrevious, (msg) => {
        setProgressLog(prev => [...prev, msg]);
      });
      setSummary(result);
      setProgressLog(prev => [...prev, '--- Migración completada ---']);
      setStep('done');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al escribir en Firestore');
      setProgressLog(prev => [...prev, `ERROR: ${err instanceof Error ? err.message : 'Error desconocido'}`]);
      setStep('error');
    }
  }, [data, errors, tag, wipePrevious]);

  const reset = useCallback(() => {
    setStep('idle');
    setData(null);
    setErrors([]);
    setWarnings([]);
    setSummary(null);
    setPreviewCounts(null);
    setProgressLog([]);
    setErrorMessage('');
  }, []);

  return {
    step, data, errors, warnings, summary, previewCounts,
    progressLog, errorMessage,
    tag, setTag, wipePrevious, setWipePrevious,
    parseFile, execute, reset,
  };
}
