import { useState, useCallback } from 'react';
import { collection, doc, getDocs, Timestamp } from 'firebase/firestore';
import { writeBatch } from '../services/firebase';
import { db } from '../services/firebase';
import type { TipoPosicionStock } from '@ags/shared';
import * as XLSX from 'xlsx';

export interface ValidationIssue {
  sheet: string;
  row: number;
  column: string;
  message: string;
}

interface PosicionRow {
  codigo: string;
  nombre: string;
  tipo: string;
  posicionPadreCodigo: string;
  zona: string;
}

export interface PosicionesParsedData {
  posiciones: PosicionRow[];
}

export interface PosicionesMigrationSummary {
  posiciones: { total: number; valid: number; skipped: number; created: number; parentsLinked: number };
}

export type MigrationStep = 'idle' | 'parsing' | 'parsed' | 'validating' | 'validated' | 'writing' | 'done' | 'error';

const TIPOS_VALIDOS: TipoPosicionStock[] = ['cajonera', 'estante', 'deposito', 'vitrina', 'otro'];

function str(val: unknown): string {
  return val != null ? String(val).trim() : '';
}

function readSheet(wb: XLSX.WorkBook, name: string): Record<string, unknown>[] {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
}

function normalizeTipo(raw: string): TipoPosicionStock | null {
  const t = raw.trim().toLowerCase().replace(/[áéíóú]/g, m => ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' }[m]!));
  return (TIPOS_VALIDOS as string[]).includes(t) ? (t as TipoPosicionStock) : null;
}

function parsePosiciones(rows: Record<string, unknown>[]): PosicionRow[] {
  const headerWords = ['codigo', 'código', 'descripcion', 'descripción', 'tipo'];
  const filtered = rows.filter(r => {
    const firstVal = str(Object.values(r)[0]).toLowerCase();
    return !headerWords.includes(firstVal);
  });
  return filtered.map(r => ({
    codigo: str(r['Codigo'] ?? r['codigo'] ?? r['Código'] ?? r['CODIGO']),
    nombre: str(r['Descripcion'] ?? r['descripcion'] ?? r['Descripción'] ?? r['DESCRIPCION']),
    tipo: str(r['Tipo'] ?? r['tipo'] ?? r['TIPO']),
    posicionPadreCodigo: str(r['Posicion padre'] ?? r['Posición padre'] ?? r['posicionPadre'] ?? r['Padre'] ?? r['padre']),
    zona: str(r['Zona'] ?? r['zona'] ?? r['ZONA']),
  }));
}

function validatePosiciones(rows: PosicionRow[]): { errors: ValidationIssue[]; warnings: ValidationIssue[] } {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const codigos = new Set<string>();

  rows.forEach((r, i) => {
    const row = i + 2;
    if (!r.codigo) errors.push({ sheet: 'Posiciones', row, column: 'Codigo', message: 'Codigo vacio (requerido)' });
    else if (codigos.has(r.codigo.toLowerCase())) errors.push({ sheet: 'Posiciones', row, column: 'Codigo', message: `Codigo duplicado en el archivo: ${r.codigo}` });
    else codigos.add(r.codigo.toLowerCase());
    if (!r.nombre) errors.push({ sheet: 'Posiciones', row, column: 'Descripcion', message: 'Descripcion vacia (requerida)' });
    if (!r.tipo) errors.push({ sheet: 'Posiciones', row, column: 'Tipo', message: `Tipo vacio. Valores validos: ${TIPOS_VALIDOS.join(' | ')}` });
    else if (!normalizeTipo(r.tipo)) errors.push({ sheet: 'Posiciones', row, column: 'Tipo', message: `Tipo invalido "${r.tipo}". Valores validos: ${TIPOS_VALIDOS.join(' | ')}` });
  });

  // Validar que los padres referenciados existan en el Excel (warning si no — podrian estar en Firestore)
  const codigosEnExcel = new Set(rows.map(r => r.codigo.toLowerCase()));
  rows.forEach((r, i) => {
    const row = i + 2;
    if (r.posicionPadreCodigo && !codigosEnExcel.has(r.posicionPadreCodigo.toLowerCase())) {
      warnings.push({
        sheet: 'Posiciones',
        row,
        column: 'Posicion padre',
        message: `Padre "${r.posicionPadreCodigo}" no esta en el Excel — se buscara en Firestore al importar`,
      });
    }
  });

  return { errors, warnings };
}

async function writePosiciones(
  posiciones: PosicionRow[],
  onProgress: (msg: string) => void,
): Promise<PosicionesMigrationSummary> {
  const now = Timestamp.now();
  const summary: PosicionesMigrationSummary = {
    posiciones: { total: posiciones.length, valid: 0, skipped: 0, created: 0, parentsLinked: 0 },
  };

  onProgress('Cargando posiciones existentes...');
  const existingSnap = await getDocs(collection(db, 'posicionesStock'));
  const codigoToId = new Map<string, string>();
  existingSnap.docs.forEach(d => {
    const codigo = (d.data().codigo as string) || '';
    if (codigo) codigoToId.set(codigo.toLowerCase(), d.id);
  });
  onProgress(`${codigoToId.size} posiciones ya existentes en Firestore`);

  // ── PASO 1: Crear posiciones nuevas (sin parentId) ──
  onProgress('Creando posiciones nuevas...');
  let batch = writeBatch(db);
  let batchCount = 0;
  const BATCH_LIMIT = 400;
  const nuevasConPadre: { id: string; padreCodigo: string }[] = [];

  for (const p of posiciones) {
    const tipo = normalizeTipo(p.tipo);
    if (!p.codigo || !p.nombre || !tipo) continue;
    summary.posiciones.valid++;

    if (codigoToId.has(p.codigo.toLowerCase())) {
      summary.posiciones.skipped++;
      continue;
    }

    const id = crypto.randomUUID();
    const ref = doc(db, 'posicionesStock', id);
    batch.set(ref, {
      id,
      codigo: p.codigo,
      nombre: p.nombre,
      descripcion: null,
      tipo,
      parentId: null,
      zona: p.zona || null,
      activo: true,
      createdAt: now,
      updatedAt: now,
      createdBy: 'migracion-web',
    });
    codigoToId.set(p.codigo.toLowerCase(), id);
    summary.posiciones.created++;
    if (p.posicionPadreCodigo) nuevasConPadre.push({ id, padreCodigo: p.posicionPadreCodigo });
    batchCount++;
    if (batchCount >= BATCH_LIMIT) {
      await batch.commit();
      batch = writeBatch(db);
      batchCount = 0;
    }
  }
  if (batchCount > 0) await batch.commit();
  onProgress(`Posiciones: ${summary.posiciones.created} creadas, ${summary.posiciones.skipped} existentes`);

  // ── PASO 2: Linkear parents ──
  if (nuevasConPadre.length > 0) {
    onProgress('Linkeando posiciones padre...');
    let updateBatch = writeBatch(db);
    let updateCount = 0;
    for (const { id, padreCodigo } of nuevasConPadre) {
      const parentId = codigoToId.get(padreCodigo.toLowerCase());
      if (!parentId) continue; // padre no encontrado ni en Excel ni en Firestore — queda como raiz
      updateBatch.update(doc(db, 'posicionesStock', id), { parentId, updatedAt: Timestamp.now() });
      summary.posiciones.parentsLinked++;
      updateCount++;
      if (updateCount >= BATCH_LIMIT) {
        await updateBatch.commit();
        updateBatch = writeBatch(db);
        updateCount = 0;
      }
    }
    if (updateCount > 0) await updateBatch.commit();
    onProgress(`Padres linkeados: ${summary.posiciones.parentsLinked}`);
  }

  return summary;
}

export function useStockPosicionesMigration() {
  const [step, setStep] = useState<MigrationStep>('idle');
  const [data, setData] = useState<PosicionesParsedData | null>(null);
  const [errors, setErrors] = useState<ValidationIssue[]>([]);
  const [warnings, setWarnings] = useState<ValidationIssue[]>([]);
  const [summary, setSummary] = useState<PosicionesMigrationSummary | null>(null);
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

      const sheetName = wb.SheetNames.find(s =>
        s.toLowerCase().includes('posicion') || s.toLowerCase().includes('ubicacion')
      ) || wb.SheetNames[0];

      addLog(`Usando hoja: "${sheetName}"`);

      const posiciones = parsePosiciones(readSheet(wb, sheetName));
      const parsed: PosicionesParsedData = { posiciones };
      setData(parsed);

      addLog(`Filas: ${posiciones.length} posiciones`);

      setStep('validating');
      const { errors: errs, warnings: warns } = validatePosiciones(posiciones);
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
      const result = await writePosiciones(data.posiciones, (msg) => {
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
