/**
 * Phase 14 BOM-05 — hook del paso "Patrones consumidos" del cierre admin.
 * Pre-fill desde el reporte (dedupe + FIFO fallback), idempotency check pre-render,
 * submit a consumirComponentes y manejo de "ya descontados" como read-only.
 * Acceso a Firestore solo vía services (rule .claude/rules/firestore.md).
 */
import { useState, useEffect, useCallback } from 'react';
import type { Patron, PatronSeleccionado } from '@ags/shared';
import { buildPatronesConsumidosSugerencia, findLoteFifoDisponible } from '@ags/shared/utils/patronBom';
import { patronesService, consumirComponentes } from '../services/patronesService';
import { movimientosService } from '../services/stockService';
import { useAuth } from '../contexts/AuthContext';

export type RowMode = 'sugerido' | 'editado' | 'manual';

export interface ConsumidoRow {
  patronId: string;
  patronCodigo: string;
  patronDescripcion: string;
  lote: string;
  codigoComponente: string;
  descripcionComponente: string;
  cantidadSugerida: number;
  cantidad: number;
  motivo?: string;
  mode: RowMode;
}

export interface ReadOnlyInfo {
  fecha: string;
  creadoPor: string;
  count: number;
}

export interface UseCierrePatronesConsumidosResult {
  loading: boolean;
  readOnly: boolean;
  readOnlyInfo: ReadOnlyInfo | null;
  rows: ConsumidoRow[];
  patronesCache: Map<string, Patron>;
  updateRow: (idx: number, patch: Partial<ConsumidoRow>) => void;
  addRow: (patronId: string, lote: string, codigoComponente: string) => void;
  removeRow: (idx: number) => void;
  submit: () => Promise<{ movimientoIds: string[]; requerimientosCreados: string[] }>;
  error: string | null;
  submitting: boolean;
}

export function useCierrePatronesConsumidos(
  otNumber: string,
  patronesSeleccionados: PatronSeleccionado[],
): UseCierrePatronesConsumidosResult {
  const { firebaseUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [readOnly, setReadOnly] = useState(false);
  const [readOnlyInfo, setReadOnlyInfo] = useState<ReadOnlyInfo | null>(null);
  const [patronesCache, setPatronesCache] = useState<Map<string, Patron>>(new Map());
  const [rows, setRows] = useState<ConsumidoRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const psKey = JSON.stringify(patronesSeleccionados);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const patronIds = Array.from(new Set(patronesSeleccionados.map(ps => ps.patronId)));
        const patrones = await Promise.all(patronIds.map(id => patronesService.getById(id)));
        const cache = new Map<string, Patron>();
        for (const p of patrones) if (p) cache.set(p.id, p);
        if (cancelled) return;
        setPatronesCache(cache);

        // Idempotency: si ya hay MovimientoStock de patrón para esta OT, read-only.
        const movsExistentes = await movimientosService.getAll({ otNumber });
        const movsPatron = movsExistentes.filter((m: any) => m.entidadTipo === 'patron');
        if (cancelled) return;
        if (movsPatron.length > 0) {
          const first: any = movsPatron[0];
          setReadOnly(true);
          setReadOnlyInfo({
            fecha: first.createdAt?.toDate?.().toISOString?.() ?? String(first.createdAt ?? '-'),
            creadoPor: first.creadoPor ?? first.createdBy ?? '(desconocido)',
            count: movsPatron.length,
          });
          setRows([]);
          setLoading(false);
          return;
        }

        // Solo patrones BOM-aware participan; legacy se skipean silenciosos.
        const patronesBom = Array.from(cache.values()).filter(p => (p.componentes ?? []).length > 0);
        if (patronesBom.length === 0) {
          setRows([]);
          setLoading(false);
          return;
        }
        const sugerencia = buildPatronesConsumidosSugerencia(
          patronesSeleccionados.map(ps => ({ patronId: ps.patronId, lote: ps.lote ?? '' })),
          patronesBom,
        );

        const fechaHoy = new Date().toISOString();
        const enriched: ConsumidoRow[] = sugerencia.map(s => {
          const patron = cache.get(s.patronId)!;
          let lote = s.lote;
          if (!lote) {
            const fifo = findLoteFifoDisponible(patron, fechaHoy);
            lote = fifo?.lote ?? '';
          }
          const comp = (patron.componentes ?? []).find(c => c.codigoComponente === s.codigoComponente);
          return {
            patronId: s.patronId,
            patronCodigo: patron.codigoArticulo,
            patronDescripcion: patron.descripcion,
            lote,
            codigoComponente: s.codigoComponente,
            descripcionComponente: comp?.descripcion ?? s.codigoComponente,
            cantidadSugerida: s.cantidadSugerida,
            cantidad: s.cantidadSugerida,
            mode: 'sugerido',
          };
        });
        if (cancelled) return;
        setRows(enriched);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otNumber, psKey]);

  const updateRow = useCallback((idx: number, patch: Partial<ConsumidoRow>) => {
    setRows(prev => prev.map((r, i) =>
      i === idx ? { ...r, ...patch, mode: r.mode === 'manual' ? 'manual' : 'editado' } : r));
  }, []);

  const addRow = useCallback((patronId: string, lote: string, codigoComponente: string) => {
    const patron = patronesCache.get(patronId);
    if (!patron) return;
    const comp = (patron.componentes ?? []).find(c => c.codigoComponente === codigoComponente);
    if (!comp) return;
    setRows(prev => [...prev, {
      patronId,
      patronCodigo: patron.codigoArticulo,
      patronDescripcion: patron.descripcion,
      lote,
      codigoComponente,
      descripcionComponente: comp.descripcion,
      cantidadSugerida: 0,
      cantidad: 1,
      mode: 'manual',
    }]);
  }, [patronesCache]);

  const removeRow = useCallback((idx: number) => {
    setRows(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const submit = useCallback(async () => {
    if (readOnly) throw new Error('Patrones ya descontados — sección read-only');
    setSubmitting(true);
    setError(null);
    try {
      const grupos = new Map<string, ConsumidoRow[]>();
      for (const r of rows.filter(r => r.cantidad > 0)) {
        const key = `${r.patronId}::${r.lote}`;
        const arr = grupos.get(key) ?? [];
        arr.push(r);
        grupos.set(key, arr);
      }
      const consumos = Array.from(grupos.values()).map(arr => ({
        patronId: arr[0].patronId,
        lote: arr[0].lote,
        componentes: arr.map(r => {
          const motivoBase = r.mode !== 'sugerido' && r.cantidad !== r.cantidadSugerida
            ? `Divergencia admin: sugerido=${r.cantidadSugerida}, real=${r.cantidad}${r.motivo ? ` — ${r.motivo}` : ''}`
            : r.motivo;
          return {
            codigoComponente: r.codigoComponente,
            cantidad: r.cantidad,
            ...(motivoBase ? { motivo: motivoBase } : {}),
          };
        }),
      }));

      const result = await consumirComponentes({
        otNumber,
        consumos,
        creadoPor: firebaseUser?.uid ?? '(unknown)',
      });
      setReadOnly(true);
      setReadOnlyInfo({
        fecha: new Date().toISOString(),
        creadoPor: firebaseUser?.uid ?? '(unknown)',
        count: result.movimientoIds.length,
      });
      return result;
    } catch (e: any) {
      const msg: string = e?.message ?? String(e);
      // Idempotency: el servicio throwa "Patrones ya descontados..." — viramos a read-only.
      if (/ya descontados/i.test(msg)) {
        setReadOnly(true);
        setReadOnlyInfo({ fecha: new Date().toISOString(), creadoPor: '(detectado al confirmar)', count: 0 });
      }
      setError(msg);
      throw e;
    } finally {
      setSubmitting(false);
    }
  }, [otNumber, rows, readOnly, firebaseUser]);

  return {
    loading, readOnly, readOnlyInfo, rows, patronesCache,
    updateRow, addRow, removeRow, submit, error, submitting,
  };
}
