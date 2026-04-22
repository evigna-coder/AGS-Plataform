import { useState, useCallback } from 'react';
import type { Articulo, Presupuesto, PresupuestoItem } from '@ags/shared';
import { collection, doc, writeBatch, Timestamp } from 'firebase/firestore';
import { db, deepCleanForFirestore } from '../../services/firebase';
import { articulosService } from '../../services/stockService';
import { presupuestosService } from '../../services/presupuestosService';

// ── Types ────────────────────────────────────────────────────────────────────

export type MatchStatus = 'matched' | 'ambiguous' | 'no_match' | 'already_linked';

export interface ScannedItem {
  presupuestoId: string;
  presupuestoNumero: string;
  itemId: string;
  descripcion: string;
  codigoProducto: string;
  status: MatchStatus;
  candidates: Articulo[];
  /** For ambiguous: the admin-selected candidate (if any) */
  selectedCandidateId: string | null;
  /** For matched: auto-filled from the single candidate */
  apply: boolean;
}

export interface ScanCounts {
  total: number;
  linkeable: number;
  ambiguous: number;
  noMatch: number;
  alreadyLinked: number;
}

export interface ApplyResult {
  linked: number;
  presupuestosUpdated: number;
  errors: string[];
}

// ── Matching helpers ─────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function matchArticulos(codigoProducto: string, articulos: Articulo[]): Articulo[] {
  const key = normalize(codigoProducto);

  // Pass 1: exact match
  const exact = articulos.filter(a => normalize(a.codigo) === key);
  if (exact.length > 0) return exact;

  // Pass 2: substring — only if exactly 1 match (never auto-link ambiguous)
  const partial = articulos.filter(
    a => normalize(a.codigo).includes(key) || key.includes(normalize(a.codigo))
  );
  return partial;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useRelinkearArticulos() {
  const [scanning, setScanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [items, setItems] = useState<ScannedItem[] | null>(null);
  const [counts, setCounts] = useState<ScanCounts | null>(null);
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);
  const [applyProgress, setApplyProgress] = useState<string | null>(null);

  const scan = useCallback(async () => {
    setScanning(true);
    setItems(null);
    setCounts(null);
    setApplyResult(null);
    setApplyProgress(null);

    try {
      const [presupuestos, articulos] = await Promise.all([
        presupuestosService.getAll(),
        articulosService.getAll({ activoOnly: false }),
      ]);

      const scanned: ScannedItem[] = [];
      let alreadyLinked = 0;

      for (const p of presupuestos as Presupuesto[]) {
        const pItems: PresupuestoItem[] = (p as any).items ?? [];
        for (const item of pItems) {
          // Skip: service items
          if (item.conceptoServicioId) continue;

          // Skip: no codigoProducto
          const codigo = item.codigoProducto?.trim() ?? '';
          if (!codigo) continue;

          // Already linked
          if (item.stockArticuloId) {
            alreadyLinked++;
            continue;
          }

          const candidates = matchArticulos(codigo, articulos);
          let status: MatchStatus;

          if (candidates.length === 0) {
            status = 'no_match';
          } else if (candidates.length === 1) {
            status = 'matched';
          } else {
            status = 'ambiguous';
          }

          scanned.push({
            presupuestoId: p.id,
            presupuestoNumero: (p as any).numero ?? p.id,
            itemId: item.id,
            descripcion: item.descripcion,
            codigoProducto: codigo,
            status,
            candidates,
            selectedCandidateId: candidates.length === 1 ? candidates[0].id : null,
            apply: status === 'matched',
          });
        }
      }

      const linkeable = scanned.filter(i => i.status === 'matched').length;
      const ambiguous = scanned.filter(i => i.status === 'ambiguous').length;
      const noMatch = scanned.filter(i => i.status === 'no_match').length;

      setItems(scanned);
      setCounts({
        total: scanned.length + alreadyLinked,
        linkeable,
        ambiguous,
        noMatch,
        alreadyLinked,
      });
    } finally {
      setScanning(false);
    }
  }, []);

  const toggleApply = useCallback((itemId: string, value: boolean) => {
    setItems(prev =>
      prev
        ? prev.map(i => (i.itemId === itemId ? { ...i, apply: value } : i))
        : prev
    );
  }, []);

  const selectCandidate = useCallback((itemId: string, candidateId: string) => {
    setItems(prev =>
      prev
        ? prev.map(i =>
            i.itemId === itemId
              ? { ...i, selectedCandidateId: candidateId, apply: true }
              : i
          )
        : prev
    );
  }, []);

  const applySelected = useCallback(async () => {
    if (!items) return;
    setApplying(true);
    setApplyResult(null);

    // Collect items to link: must have apply=true and a selectedCandidateId
    const toLink = items.filter(i => i.apply && i.selectedCandidateId);

    // Group by presupuestoId for efficient batch writes
    const byPpto = new Map<string, ScannedItem[]>();
    for (const item of toLink) {
      const list = byPpto.get(item.presupuestoId) ?? [];
      list.push(item);
      byPpto.set(item.presupuestoId, list);
    }

    // Load presupuesto docs we need to mutate (all items arrays)
    // We need the full items array of each presupuesto to patch it.
    // presupuestosService.getAll already ran; we'll re-fetch only affected ones.
    const presupuestoIds = Array.from(byPpto.keys());
    const presupuestoFetches = await Promise.all(
      presupuestoIds.map(id => presupuestosService.getById(id))
    );

    const errors: string[] = [];
    let linked = 0;
    const CHUNK = 400;

    // Build list of (docRef, updatedData) pairs
    const updates: Array<{ id: string; items: PresupuestoItem[] }> = [];

    for (let i = 0; i < presupuestoIds.length; i++) {
      const pId = presupuestoIds[i];
      const pDoc = presupuestoFetches[i];
      if (!pDoc) {
        errors.push(`Presupuesto ${pId} no encontrado al aplicar.`);
        continue;
      }

      const pItems: PresupuestoItem[] = (pDoc as any).items ?? [];
      const patchMap = byPpto.get(pId)!;

      const patched = pItems.map(item => {
        const patch = patchMap.find(p => p.itemId === item.id);
        if (!patch || !patch.selectedCandidateId) return item;
        linked++;
        return { ...item, stockArticuloId: patch.selectedCandidateId };
      });

      updates.push({ id: pId, items: patched });
    }

    // Write in chunks of ≤400 operations
    let batch = writeBatch(db);
    let opsInBatch = 0;
    let batchIndex = 0;

    for (const { id, items: patchedItems } of updates) {
      const ref = doc(collection(db, 'presupuestos'), id);
      const payload = deepCleanForFirestore({ items: patchedItems, updatedAt: Timestamp.now() });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      batch.update(ref, payload as any);
      opsInBatch++;

      if (opsInBatch >= CHUNK) {
        console.info(`[RelinkearArticulos] Committing batch ${++batchIndex} (${opsInBatch} ops)`);
        setApplyProgress(`Aplicando lote ${batchIndex}...`);
        try {
          await batch.commit();
        } catch (err: any) {
          errors.push(`Error en lote ${batchIndex}: ${err?.message ?? 'desconocido'}`);
        }
        batch = writeBatch(db);
        opsInBatch = 0;
      }
    }

    if (opsInBatch > 0) {
      console.info(`[RelinkearArticulos] Committing final batch ${batchIndex + 1} (${opsInBatch} ops)`);
      setApplyProgress('Aplicando lote final...');
      try {
        await batch.commit();
      } catch (err: any) {
        errors.push(`Error en lote final: ${err?.message ?? 'desconocido'}`);
      }
    }

    setApplyResult({ linked, presupuestosUpdated: presupuestoIds.length, errors });
    setApplyProgress(null);
    setApplying(false);

    // Refresh items: mark applied ones as already_linked
    if (errors.length === 0) {
      setItems(prev =>
        prev
          ? prev.map(i => (i.apply && i.selectedCandidateId ? { ...i, status: 'already_linked', apply: false } : i))
          : prev
      );
    }
  }, [items]);

  const selectedCount = items?.filter(i => i.apply && i.selectedCandidateId).length ?? 0;

  return {
    scanning,
    applying,
    items,
    counts,
    applyResult,
    applyProgress,
    selectedCount,
    scan,
    toggleApply,
    selectCandidate,
    applySelected,
  };
}
