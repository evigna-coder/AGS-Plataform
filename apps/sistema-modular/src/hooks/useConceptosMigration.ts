import { useState, useCallback } from 'react';
import { collection, doc, getDocs, query, where, limit, Timestamp } from 'firebase/firestore';
import { writeBatch } from '../services/firebase';
import { db } from '../services/firebase';
import * as XLSX from 'xlsx';

export interface ValidationIssue {
  sheet: string;
  row: number;
  column: string;
  message: string;
}

interface ConceptoRow {
  codigo: string;
  descripcion: string;
}

export interface ConceptosParsedData {
  conceptos: ConceptoRow[];
}

export interface ConceptosMigrationSummary {
  conceptos: { total: number; valid: number; skipped: number; created: number };
}

export type MigrationStep = 'idle' | 'parsing' | 'parsed' | 'validating' | 'validated' | 'writing' | 'done' | 'error';

function str(val: unknown): string {
  return val != null ? String(val).trim() : '';
}

function readSheet(wb: XLSX.WorkBook, name: string): Record<string, unknown>[] {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
}

function parseConceptos(rows: Record<string, unknown>[]): ConceptoRow[] {
  const headerWords = ['codigo', 'código', 'descripcion', 'descripción'];
  const filtered = rows.filter(r => {
    const firstVal = str(Object.values(r)[0]).toLowerCase();
    return !headerWords.includes(firstVal);
  });
  return filtered.map(r => ({
    codigo: str(r['Codigo'] ?? r['codigo'] ?? r['Código'] ?? r['CODIGO']),
    descripcion: str(r['Descripcion'] ?? r['descripcion'] ?? r['Descripción'] ?? r['DESCRIPCION']),
  }));
}

function validateConceptos(rows: ConceptoRow[]): { errors: ValidationIssue[]; warnings: ValidationIssue[] } {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const codigos = new Set<string>();

  rows.forEach((r, i) => {
    const row = i + 2;
    if (!r.descripcion) errors.push({ sheet: 'Conceptos', row, column: 'Descripcion', message: 'Descripcion vacia (requerida)' });
    if (!r.codigo) warnings.push({ sheet: 'Conceptos', row, column: 'Codigo', message: 'Codigo vacio' });
    else if (codigos.has(r.codigo.toLowerCase())) warnings.push({ sheet: 'Conceptos', row, column: 'Codigo', message: `Codigo duplicado en el archivo: ${r.codigo}` });
    else codigos.add(r.codigo.toLowerCase());
  });

  return { errors, warnings };
}

async function writeConceptos(
  conceptos: ConceptoRow[],
  onProgress: (msg: string) => void,
): Promise<ConceptosMigrationSummary> {
  const now = Timestamp.now();
  const summary: ConceptosMigrationSummary = {
    conceptos: { total: conceptos.length, valid: 0, skipped: 0, created: 0 },
  };

  onProgress('Resolviendo categoria "Iva 21%"...');
  const catsSnap = await getDocs(collection(db, 'categorias_presupuesto'));
  const iva21Cat = catsSnap.docs
    .map(d => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
    .find(c => String((c as { nombre?: string }).nombre || '').trim().toLowerCase() === 'iva 21%');
  const categoriaPresupuestoId = iva21Cat?.id || null;
  if (!categoriaPresupuestoId) {
    onProgress('Advertencia: no se encontro categoria llamada "Iva 21%" — conceptos se crearan sin categoria');
  } else {
    onProgress(`Categoria resuelta: ${(iva21Cat as { nombre?: string })?.nombre || categoriaPresupuestoId}`);
  }

  onProgress('Procesando conceptos...');
  let batch = writeBatch(db);
  let batchCount = 0;
  const BATCH_LIMIT = 400;

  for (const c of conceptos) {
    if (!c.descripcion) continue;
    summary.conceptos.valid++;

    if (c.codigo) {
      const q = query(
        collection(db, 'conceptos_servicio'),
        where('codigo', '==', c.codigo),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        summary.conceptos.skipped++;
        continue;
      }
    }

    const id = crypto.randomUUID();
    const ref = doc(db, 'conceptos_servicio', id);
    batch.set(ref, {
      id,
      codigo: c.codigo || null,
      descripcion: c.descripcion,
      valorBase: 0,
      moneda: 'USD',
      factorActualizacion: 1,
      categoriaPresupuestoId,
      activo: true,
      createdAt: now,
      updatedAt: now,
      createdBy: 'migracion-web',
    });
    summary.conceptos.created++;
    batchCount++;
    if (batchCount >= BATCH_LIMIT) {
      await batch.commit();
      batch = writeBatch(db);
      batchCount = 0;
    }
  }
  if (batchCount > 0) await batch.commit();
  onProgress(`Conceptos: ${summary.conceptos.created} creados, ${summary.conceptos.skipped} existentes`);

  return summary;
}

export function useConceptosMigration() {
  const [step, setStep] = useState<MigrationStep>('idle');
  const [data, setData] = useState<ConceptosParsedData | null>(null);
  const [errors, setErrors] = useState<ValidationIssue[]>([]);
  const [warnings, setWarnings] = useState<ValidationIssue[]>([]);
  const [summary, setSummary] = useState<ConceptosMigrationSummary | null>(null);
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
        s.toLowerCase().includes('concepto')
      ) || wb.SheetNames[0];

      addLog(`Usando hoja: "${sheetName}"`);

      const conceptos = parseConceptos(readSheet(wb, sheetName));
      const parsed: ConceptosParsedData = { conceptos };
      setData(parsed);

      addLog(`Filas: ${conceptos.length} conceptos`);

      setStep('validating');
      const { errors: errs, warnings: warns } = validateConceptos(conceptos);
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
      const result = await writeConceptos(data.conceptos, (msg) => {
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
