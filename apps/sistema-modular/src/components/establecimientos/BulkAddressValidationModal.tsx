import { useCallback } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { geocodeAddress, type GeocodingResult } from '../../services/geocodingService';
import { establecimientosService } from '../../services/firebaseService';
import { useBackgroundTasks } from '../../contexts/BackgroundTasksContext';
import type { Establecimiento } from '@ags/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  establecimientos: Establecimiento[];
  clienteMap: Record<string, string>;
  onUpdated: () => void;
}

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

export const BulkAddressValidationModal: React.FC<Props> = ({ open, onClose, establecimientos, clienteMap, onUpdated }) => {
  const bg = useBackgroundTasks();
  const task = bg.getTask<AddressValidationRow>(TASK_ID);

  const rows = task?.rows ?? [];
  const running = task?.running ?? false;
  const done = task?.done ?? false;
  const progress = task?.progress ?? { current: 0, total: 0 };
  const filter = (task?.filter ?? 'all') as 'all' | 'diffs' | 'errors';

  const buildSearchAddress = (est: Establecimiento): string => {
    const parts = [est.direccion, est.localidad, est.provincia].filter(Boolean);
    return parts.join(', ') + ', Argentina';
  };

  const computeDiffs = (est: Establecimiento, geo: GeocodingResult): FieldDiff[] => {
    const diffs: FieldDiff[] = [];
    const norm = (s: string | null | undefined) => (s || '').trim().toLowerCase();

    if (geo.direccion && norm(geo.direccion) !== norm(est.direccion)) {
      diffs.push({ field: 'direccion', label: 'Dirección', current: est.direccion || '', google: geo.direccion });
    }
    if (geo.localidad && norm(geo.localidad) !== norm(est.localidad)) {
      diffs.push({ field: 'localidad', label: 'Localidad', current: est.localidad || '', google: geo.localidad });
    }
    if (geo.provincia && norm(geo.provincia) !== norm(est.provincia)) {
      diffs.push({ field: 'provincia', label: 'Provincia', current: est.provincia || '', google: geo.provincia });
    }
    if (geo.codigoPostal && norm(geo.codigoPostal) !== norm(est.codigoPostal)) {
      diffs.push({ field: 'codigoPostal', label: 'CP', current: est.codigoPostal || '', google: geo.codigoPostal });
    }
    if (!est.lat && geo.lat) {
      diffs.push({ field: 'lat', label: 'Latitud', current: '', google: String(geo.lat) });
    }
    if (!est.lng && geo.lng) {
      diffs.push({ field: 'lng', label: 'Longitud', current: '', google: String(geo.lng) });
    }
    if (!est.placeId && geo.placeId) {
      diffs.push({ field: 'placeId', label: 'Place ID', current: '', google: geo.placeId });
    }

    return diffs;
  };

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
      if (d.field === 'lat' || d.field === 'lng') {
        update[d.field] = parseFloat(d.google);
      } else {
        update[d.field] = d.google;
      }
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
    for (const row of toApply) {
      await handleApply(row);
    }
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

  return (
    <Modal open={open} onClose={handleClose} title="Validación masiva de direcciones"
      subtitle={`${establecimientos.length} establecimientos`} maxWidth="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-[10px] text-slate-400">
            {done && <>
              Correctas: <span className="text-green-600 font-medium">{stats.ok + stats.applied}</span>
              {stats.diffs > 0 && <> · Con diferencias: <span className="text-amber-600 font-medium">{stats.diffs}</span></>}
              {stats.applied > 0 && <> · Corregidas: <span className="text-blue-600 font-medium">{stats.applied}</span></>}
              {stats.errors > 0 && <> · Errores: <span className="text-red-500 font-medium">{stats.errors}</span></>}
              {stats.skipped > 0 && <> · Sin dirección: {stats.skipped}</>}
            </>}
          </div>
          <div className="flex gap-2">
            {!running && !done && (
              <Button size="sm" onClick={handleStart}>Iniciar validación</Button>
            )}
            {running && (
              <>
                <Button size="sm" variant="ghost" onClick={onClose}>Minimizar</Button>
                <Button size="sm" variant="outline" onClick={() => bg.cancelTask(TASK_ID)}>Detener</Button>
              </>
            )}
            {done && stats.diffs > 0 && (
              <Button size="sm" onClick={handleApplyAll}>Corregir todos ({stats.diffs})</Button>
            )}
            {done && (
              <Button size="sm" variant="outline" onClick={() => { onUpdated(); handleClose(); }}>Cerrar</Button>
            )}
          </div>
        </div>
      }>

      {/* Info */}
      <div className="mb-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-[10px] text-blue-700">
        Consulta Google Geocoding para cada establecimiento y compara dirección, localidad, provincia, código postal y coordenadas. Podés corregir individualmente o todos juntos.
        {running && <span className="block mt-1 font-medium">Podés cerrar este modal y seguir trabajando. El proceso continuará en segundo plano.</span>}
      </div>

      {/* Progress */}
      {(running || done) && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-slate-500">
              {running ? `Validando ${progress.current} de ${progress.total}...` : `Completado: ${progress.current} de ${progress.total}`}
            </span>
            <span className="text-[10px] text-slate-400">{progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${done ? 'bg-green-500' : 'bg-indigo-500'}`}
              style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Filter tabs */}
      {done && (
        <div className="flex gap-1.5 mb-3">
          {([
            { value: 'all', label: `Todos (${rows.length})` },
            { value: 'diffs', label: `Con diferencias (${stats.diffs})` },
            { value: 'errors', label: `Errores (${stats.errors})` },
          ] as const).map(tab => (
            <button key={tab.value} onClick={() => bg.setFilter(TASK_ID, tab.value)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${
                filter === tab.value ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {rows.length > 0 && (
        <div className="max-h-[400px] overflow-y-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50 z-10">
              <tr className="border-b border-slate-200">
                <th className="px-2 py-1.5 text-left text-[10px] font-medium text-slate-400">Establecimiento</th>
                <th className="px-2 py-1.5 text-left text-[10px] font-medium text-slate-400">Dirección actual</th>
                <th className="px-2 py-1.5 text-left text-[10px] font-medium text-slate-400">Google sugiere</th>
                <th className="px-2 py-1.5 text-left text-[10px] font-medium text-slate-400">Diferencias</th>
                <th className="px-2 py-1.5 text-right text-[10px] font-medium text-slate-400">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map(row => (
                <tr key={row.est.id} className={
                  row.applied ? 'bg-blue-50' :
                  row.diffs.length > 0 ? 'bg-amber-50' :
                  row.status === 'error' ? 'bg-red-50' : ''
                }>
                  <td className="px-2 py-1.5 align-top">
                    <div className="text-xs text-slate-700 font-medium truncate max-w-[140px]" title={row.est.nombre}>
                      {row.est.nombre}
                    </div>
                    <div className="text-[9px] text-slate-400 truncate max-w-[140px]">
                      {clienteMap[row.est.clienteCuit] || ''}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <div className="text-[10px] text-slate-600 max-w-[160px]">
                      {row.est.direccion}
                      {(row.est.localidad || row.est.provincia) && (
                        <div className="text-slate-400">{[row.est.localidad, row.est.provincia].filter(Boolean).join(', ')}</div>
                      )}
                      {row.est.codigoPostal && <div className="text-slate-400">CP: {row.est.codigoPostal}</div>}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    {row.status === 'validating' && <span className="text-[9px] text-indigo-500 animate-pulse">Consultando...</span>}
                    {row.status === 'pending' && <span className="text-[9px] text-slate-300">pendiente</span>}
                    {row.status === 'skipped' && <span className="text-[9px] text-slate-300">sin dirección</span>}
                    {row.status === 'error' && <span className="text-[9px] text-red-500">No encontrada</span>}
                    {row.status === 'done' && row.result && (
                      <div className="text-[10px] text-slate-600 max-w-[180px]">
                        {row.result.formattedAddress}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    {row.applied && (
                      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">Corregido</span>
                    )}
                    {row.status === 'done' && !row.applied && row.diffs.length === 0 && (
                      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">OK</span>
                    )}
                    {row.diffs.length > 0 && !row.applied && (
                      <div className="space-y-0.5">
                        {row.diffs.filter(d => !['lat', 'lng', 'placeId'].includes(d.field)).map(d => (
                          <div key={d.field} className="text-[9px]">
                            <span className="text-slate-400">{d.label}:</span>{' '}
                            <span className="text-red-500 line-through">{d.current || '(vacío)'}</span>{' → '}
                            <span className="text-green-700 font-medium">{d.google}</span>
                          </div>
                        ))}
                        {row.diffs.some(d => ['lat', 'lng', 'placeId'].includes(d.field)) && (
                          <div className="text-[9px] text-slate-400">+ coordenadas/placeId</div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right align-top whitespace-nowrap">
                    {row.diffs.length > 0 && !row.applied && (
                      <button onClick={() => handleApply(row)}
                        className="text-[9px] font-medium text-amber-600 hover:text-amber-800 px-1.5 py-0.5 rounded hover:bg-amber-100">
                        Corregir
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {rows.length === 0 && !running && !done && (
        <div className="text-center py-8 text-slate-400 text-xs">
          Presioná "Iniciar validación" para verificar todas las direcciones con Google Maps.
          <br />
          <span className="text-[10px] text-slate-300 mt-1 block">
            Se validarán {establecimientos.filter(e => e.activo && e.direccion?.trim()).length} establecimientos con dirección cargada.
          </span>
        </div>
      )}
    </Modal>
  );
};
