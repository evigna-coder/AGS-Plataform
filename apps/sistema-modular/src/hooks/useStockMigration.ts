import { useState, useCallback } from 'react';
import { collection, doc, getDocs, query, where, limit, writeBatch, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import * as XLSX from 'xlsx';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ValidationIssue {
  sheet: string;
  row: number;
  column: string;
  message: string;
}

interface ArticuloRow {
  codigo: string;
  descripcion: string;
  posicionArancelaria: string;
  marca: string;
  origen: string;
}

export interface StockParsedData {
  articulos: ArticuloRow[];
}

export interface StockMigrationSummary {
  articulos: { total: number; valid: number; skipped: number; created: number };
}

export type MigrationStep = 'idle' | 'parsing' | 'parsed' | 'validating' | 'validated' | 'writing' | 'done' | 'error';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function str(val: unknown): string {
  return val != null ? String(val).trim() : '';
}

function readSheet(wb: XLSX.WorkBook, name: string): Record<string, unknown>[] {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
}

/** Formatea posicion arancelaria: 9027909900A → 9027.90.90.900A */
function formatPosicionArancelaria(raw: string): string {
  const clean = raw.replace(/[^a-zA-Z0-9]/g, '');
  if (clean.length < 4) return clean;
  // Formato: XXXX.XX.XX.XXXX
  let result = clean.slice(0, 4);
  if (clean.length > 4) result += '.' + clean.slice(4, 6);
  if (clean.length > 6) result += '.' + clean.slice(6, 8);
  if (clean.length > 8) result += '.' + clean.slice(8);
  return result;
}

// ─── Parser ──────────────────────────────────────────────────────────────────

function parseArticulos(rows: Record<string, unknown>[]): ArticuloRow[] {
  // Filtrar filas que son headers duplicados (ej: "Nro. de Parte" como valor de codigo)
  const headerWords = ['codigo', 'código', 'descripcion', 'descripción', 'nro. de parte', 'part number', 'marca'];
  const filtered = rows.filter(r => {
    const firstVal = str(Object.values(r)[0]).toLowerCase();
    return !headerWords.includes(firstVal);
  });
  return filtered.map(r => ({
    codigo: str(r['Codigo'] ?? r['codigo'] ?? r['Código'] ?? r['CODIGO'] ?? r['Part Number'] ?? r['part_number'] ?? r['Nro. de Parte'] ?? r['Nro de Parte'] ?? r['NRO DE PARTE']),
    descripcion: str(r['Descripcion'] ?? r['descripcion'] ?? r['Descripción'] ?? r['DESCRIPCION']),
    posicionArancelaria: str(r['Posicion Arancelaria'] ?? r['posicionArancelaria'] ?? r['Posición Arancelaria'] ?? r['POSICION ARANCELARIA'] ?? r['Posicion arancelaria'] ?? r['PA']),
    marca: str(r['Marca'] ?? r['marca'] ?? r['MARCA'] ?? r['Brand']),
    origen: str(r['Origen'] ?? r['origen'] ?? r['ORIGEN'] ?? r['Procedencia'] ?? r['procedencia']),
  }));
}

// ─── Validator ───────────────────────────────────────────────────────────────

function validateArticulos(rows: ArticuloRow[]): { errors: ValidationIssue[]; warnings: ValidationIssue[] } {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const codigos = new Set<string>();

  rows.forEach((r, i) => {
    const row = i + 2;
    if (!r.codigo) warnings.push({ sheet: 'Articulos', row, column: 'Codigo', message: 'Codigo vacio — se omitira' });
    else if (codigos.has(r.codigo.toLowerCase())) warnings.push({ sheet: 'Articulos', row, column: 'Codigo', message: `Codigo duplicado en el archivo: ${r.codigo}` });
    else codigos.add(r.codigo.toLowerCase());
    if (!r.descripcion) warnings.push({ sheet: 'Articulos', row, column: 'Descripcion', message: 'Descripcion vacia — se omitira' });
    if (!r.posicionArancelaria) warnings.push({ sheet: 'Articulos', row, column: 'Posicion Arancelaria', message: 'Posicion arancelaria vacia' });
    if (!r.marca) warnings.push({ sheet: 'Articulos', row, column: 'Marca', message: 'Marca vacia' });
  });

  return { errors, warnings };
}

// ─── Firestore Writer ────────────────────────────────────────────────────────

async function writeArticulos(
  articulos: ArticuloRow[],
  onProgress: (msg: string) => void,
): Promise<StockMigrationSummary> {
  const now = Timestamp.now();
  const summary: StockMigrationSummary = {
    articulos: { total: articulos.length, valid: 0, skipped: 0, created: 0 },
  };

  // Resolver marcas: cargar existentes y crear las nuevas
  onProgress('Resolviendo marcas...');
  const marcasSnap = await getDocs(collection(db, 'marcas'));
  const marcasMap = new Map<string, string>(); // nombre lowercase → id
  marcasSnap.docs.forEach(d => {
    const nombre = (d.data().nombre as string) || '';
    marcasMap.set(nombre.toLowerCase(), d.id);
  });

  // Detectar marcas nuevas del Excel
  const marcasNuevas = new Set<string>();
  for (const a of articulos) {
    if (a.marca && !marcasMap.has(a.marca.toLowerCase())) marcasNuevas.add(a.marca);
  }
  if (marcasNuevas.size > 0) {
    onProgress(`Creando ${marcasNuevas.size} marca(s) nueva(s)...`);
    let marcaBatch = writeBatch(db);
    let marcaBatchCount = 0;
    for (const nombre of marcasNuevas) {
      const marcaId = crypto.randomUUID();
      const marcaRef = doc(db, 'marcas', marcaId);
      marcaBatch.set(marcaRef, { id: marcaId, nombre, activo: true, createdAt: now, updatedAt: now });
      marcasMap.set(nombre.toLowerCase(), marcaId);
      marcaBatchCount++;
      if (marcaBatchCount >= 400) { await marcaBatch.commit(); marcaBatch = writeBatch(db); marcaBatchCount = 0; }
    }
    if (marcaBatchCount > 0) await marcaBatch.commit();
  }

  onProgress('Procesando articulos...');
  let batch = writeBatch(db);
  let batchCount = 0;
  const BATCH_LIMIT = 400;

  for (const a of articulos) {
    if (!a.codigo || !a.descripcion) continue;
    summary.articulos.valid++;

    // Dedup por codigo
    const q = query(
      collection(db, 'articulos'),
      where('codigo', '==', a.codigo),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      summary.articulos.skipped++;
      continue;
    }

    const marcaId = a.marca ? (marcasMap.get(a.marca.toLowerCase()) || '') : '';

    const id = crypto.randomUUID();
    const ref = doc(db, 'articulos', id);
    batch.set(ref, {
      id,
      codigo: a.codigo,
      descripcion: a.descripcion,
      posicionArancelaria: a.posicionArancelaria ? formatPosicionArancelaria(a.posicionArancelaria) : null,
      marca: a.marca || null,
      origen: a.origen || null,
      // Defaults — el resto se completa desde el sistema
      categoriaEquipo: 'GENERAL',
      marcaId,
      proveedorIds: [],
      tipo: 'repuesto',
      unidadMedida: 'unidad',
      stockMinimo: 0,
      precioReferencia: null,
      monedaPrecio: null,
      notas: null,
      activo: true,
      createdAt: now,
      updatedAt: now,
      createdBy: 'migracion-web',
    });
    summary.articulos.created++;
    batchCount++;
    if (batchCount >= BATCH_LIMIT) {
      await batch.commit();
      batch = writeBatch(db);
      batchCount = 0;
    }
  }
  if (batchCount > 0) await batch.commit();
  onProgress(`Articulos: ${summary.articulos.created} creados, ${summary.articulos.skipped} existentes`);

  return summary;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useStockMigration() {
  const [step, setStep] = useState<MigrationStep>('idle');
  const [data, setData] = useState<StockParsedData | null>(null);
  const [errors, setErrors] = useState<ValidationIssue[]>([]);
  const [warnings, setWarnings] = useState<ValidationIssue[]>([]);
  const [summary, setSummary] = useState<StockMigrationSummary | null>(null);
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

      // Buscar la hoja: puede llamarse Articulos, Stock, o ser la primera hoja
      const sheetName = wb.SheetNames.find(s =>
        s.toLowerCase().includes('articulo') || s.toLowerCase().includes('stock')
      ) || wb.SheetNames[0];

      addLog(`Usando hoja: "${sheetName}"`);

      const articulos = parseArticulos(readSheet(wb, sheetName));
      const parsed: StockParsedData = { articulos };
      setData(parsed);

      addLog(`Filas: ${articulos.length} articulos`);

      setStep('validating');
      const { errors: errs, warnings: warns } = validateArticulos(articulos);
      setErrors(errs);
      setWarnings(warns);

      if (errs.length > 0) addLog(`${errs.length} error(es) bloqueante(s)`);
      if (warns.length > 0) addLog(`${warns.length} advertencia(s)`);
      if (errs.length === 0) addLog('Validacion exitosa - listo para importar');

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
      const result = await writeArticulos(data.articulos, (msg) => {
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
