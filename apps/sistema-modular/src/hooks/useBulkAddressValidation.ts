import { useCallback } from 'react';
import { geocodeAddress, type GeocodingResult } from '../services/geocodingService';
import { establecimientosService } from '../services/firebaseService';
import { useBackgroundTasks } from '../contexts/BackgroundTasksContext';
import type { Establecimiento } from '@ags/shared';

interface FieldDiff {
  field: string;
  label: string;
  current: string;
  google: string;
}

export interface AddressValidationRow {
  est: Establecimiento;
  status: 'pending' | 'validating' | 'done' | 'skipped' | 'error';
  result: GeocodingResult | null;
  diffs: FieldDiff[];
  applied: boolean;
}

const TASK_ID = 'bulk-address-validation';
const DELAY_MS = 250;

const buildSearchAddress = (est: Establecimiento): string => {
  const parts = [est.direccion, est.localidad, est.provincia].filter(Boolean);
  return parts.join(', ') + ', Argentina';
};

const computeDiffs = (est: Establecimiento, geo: GeocodingResult): FieldDiff[] => {
  const diffs: FieldDiff[] = [];
  const norm = (s: string | null | undefined) => (s || '').trim().toLowerCase();

  if (geo.direccion && norm(geo.direccion) !== norm(est.direccion))
    diffs.push({ field: 'direccion', label: 'Dirección', current: est.direccion || '', google: geo.direccion });
  if (geo.localidad && norm(geo.localidad) !== norm(est.localidad))
    diffs.push({ field: 'localidad', label: 'Localidad', current: est.localidad || '', google: geo.localidad });
  if (geo.provincia && norm(geo.provincia) !== norm(est.provincia))
    diffs.push({ field: 'provincia', label: 'Provincia', current: est.provincia || '', google: geo.provincia });
  if (geo.codigoPostal && norm(geo.codigoPostal) !== norm(est.codigoPostal))
    diffs.push({ field: 'codigoPostal', label: 'CP', current: est.codigoPostal || '', google: geo.codigoPostal });
  if (!est.lat && geo.lat)
    diffs.push({ field: 'lat', label: 'Latitud', current: '', google: String(geo.lat) });
  if (!est.lng && geo.lng)
    diffs.push({ field: 'lng', label: 'Longitud', current: '', google: String(geo.lng) });
  if (!est.placeId && geo.placeId)
    diffs.push({ field: 'placeId', label: 'Place ID', current: '', google: geo.placeId });

  return diffs;
};

export function useBulkAddressValidation(
  establecimientos: Establecimiento[],
  onUpdated: () => void,
  onClose: () => void,
) {
  const bg = useBackgroundTasks();
  const task = bg.getTask<AddressValidationRow>(TASK_ID);

  const rows = task?.rows ?? [];
  const running = task?.running ?? false;
  const done = task?.done ?? false;
  const progress = task?.progress ?? { current: 0, total: 0 };
  const filter = (task?.filter ?? 'all') as 'all' | 'diffs' | 'errors';

  const handleStart = useCallback(async () => {
    const active = establecimientos.filter(e => e.activo && e.direccion?.trim());
    const noAddress = establecimientos.filter(e => !e.direccion?.trim());

    const initial: AddressValidationRow[] = [
      ...active.map(e => ({ est: e, status: 'pending' as const, result: null, diffs: [], applied: false })),
      ...noAddress.map(e => ({ est: e, status: 'skipped' as const, result: null, diffs: [], applied: false })),
    ];

    bg.startTask<AddressValidationRow>(TASK_ID, initial, active.length);

    for (let i = 0; i < active.length; i++) {
      if (bg.isCancelled(TASK_ID)) break;
      const est = active[i];

      bg.updateRows<AddressValidationRow>(TASK_ID, prev =>
        prev.map(r => r.est.id === est.id ? { ...r, status: 'validating' } : r)
      );

      try {
        const result = await geocodeAddress(buildSearchAddress(est));
        if (result) {
          const diffs = computeDiffs(est, result);
          bg.updateRows<AddressValidationRow>(TASK_ID, prev =>
            prev.map(r => r.est.id === est.id ? { ...r, status: 'done', result, diffs } : r)
          );
        } else {
          bg.updateRows<AddressValidationRow>(TASK_ID, prev =>
            prev.map(r => r.est.id === est.id ? { ...r, status: 'error', result: null, diffs: [] } : r)
          );
        }
      } catch {
        bg.updateRows<AddressValidationRow>(TASK_ID, prev =>
          prev.map(r => r.est.id === est.id ? { ...r, status: 'error', result: null, diffs: [] } : r)
        );
      }

      bg.setProgress(TASK_ID, i + 1);
      if (i < active.length - 1 && !bg.isCancelled(TASK_ID)) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }

    bg.finishTask(TASK_ID);
  }, [establecimientos, bg]);

  const handleApply = async (row: AddressValidationRow) => {
    if (!row.result || row.diffs.length === 0) return;
    const update: Record<string, any> = {};
    for (const d of row.diffs) {
      update[d.field] = d.field === 'lat' || d.field === 'lng' ? parseFloat(d.google) : d.google;
    }
    try {
      await establecimientosService.update(row.est.id, update);
      bg.updateRows<AddressValidationRow>(TASK_ID, prev =>
        prev.map(r => r.est.id === row.est.id ? { ...r, applied: true, diffs: [] } : r)
      );
    } catch {
      alert('Error al actualizar establecimiento');
    }
  };

  const handleApplyAll = async () => {
    const toApply = rows.filter(r => r.diffs.length > 0 && !r.applied);
    for (const row of toApply) await handleApply(row);
    onUpdated();
  };

  const handleClose = () => {
    if (!running) bg.clearTask(TASK_ID);
    onClose();
  };

  const stats = {
    total: rows.filter(r => r.status !== 'skipped').length,
    ok: rows.filter(r => r.status === 'done' && r.diffs.length === 0 && !r.applied).length,
    diffs: rows.filter(r => r.diffs.length > 0 && !r.applied).length,
    applied: rows.filter(r => r.applied).length,
    errors: rows.filter(r => r.status === 'error').length,
    skipped: rows.filter(r => r.status === 'skipped').length,
  };

  const filteredRows = rows.filter(r => {
    if (filter === 'diffs') return r.diffs.length > 0 && !r.applied;
    if (filter === 'errors') return r.status === 'error';
    return true;
  });

  const setFilter = (f: string) => bg.setFilter(TASK_ID, f);
  const cancelTask = () => bg.cancelTask(TASK_ID);

  return {
    rows, running, done, progress, filter, stats, filteredRows,
    handleStart, handleApply, handleApplyAll, handleClose,
    setFilter, cancelTask, establecimientos, onUpdated,
  };
}
