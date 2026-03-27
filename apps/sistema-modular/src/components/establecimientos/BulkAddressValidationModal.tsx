import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useBulkAddressValidation } from '../../hooks/useBulkAddressValidation';
import { BulkValidationTable } from './BulkValidationTable';
import type { Establecimiento } from '@ags/shared';

// Re-export for consumers
export type { AddressValidationRow } from '../../hooks/useBulkAddressValidation';

interface Props {
  open: boolean;
  onClose: () => void;
  establecimientos: Establecimiento[];
  clienteMap: Record<string, string>;
  onUpdated: () => void;
}

export const BulkAddressValidationModal: React.FC<Props> = ({ open, onClose, establecimientos, clienteMap, onUpdated }) => {
  const h = useBulkAddressValidation(establecimientos, onUpdated, onClose);

  return (
    <Modal open={open} onClose={h.handleClose} title="Validación masiva de direcciones"
      subtitle={`${establecimientos.length} establecimientos`} maxWidth="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-[10px] text-slate-400">
            {h.done && <>
              Correctas: <span className="text-green-600 font-medium">{h.stats.ok + h.stats.applied}</span>
              {h.stats.diffs > 0 && <> · Con diferencias: <span className="text-amber-600 font-medium">{h.stats.diffs}</span></>}
              {h.stats.applied > 0 && <> · Corregidas: <span className="text-blue-600 font-medium">{h.stats.applied}</span></>}
              {h.stats.errors > 0 && <> · Errores: <span className="text-red-500 font-medium">{h.stats.errors}</span></>}
              {h.stats.skipped > 0 && <> · Sin dirección: {h.stats.skipped}</>}
            </>}
          </div>
          <div className="flex gap-2">
            {!h.running && !h.done && (
              <Button size="sm" onClick={h.handleStart}>Iniciar validación</Button>
            )}
            {h.running && (
              <>
                <Button size="sm" variant="ghost" onClick={onClose}>Minimizar</Button>
                <Button size="sm" variant="outline" onClick={h.cancelTask}>Detener</Button>
              </>
            )}
            {h.done && h.stats.diffs > 0 && (
              <Button size="sm" onClick={h.handleApplyAll}>Corregir todos ({h.stats.diffs})</Button>
            )}
            {h.done && (
              <Button size="sm" variant="outline" onClick={() => { onUpdated(); h.handleClose(); }}>Cerrar</Button>
            )}
          </div>
        </div>
      }>

      {/* Info */}
      <div className="mb-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-[10px] text-blue-700">
        Consulta Google Geocoding para cada establecimiento y compara dirección, localidad, provincia, código postal y coordenadas. Podés corregir individualmente o todos juntos.
        {h.running && <span className="block mt-1 font-medium">Podés cerrar este modal y seguir trabajando. El proceso continuará en segundo plano.</span>}
      </div>

      {/* Progress */}
      {(h.running || h.done) && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-slate-500">
              {h.running ? `Validando ${h.progress.current} de ${h.progress.total}...` : `Completado: ${h.progress.current} de ${h.progress.total}`}
            </span>
            <span className="text-[10px] text-slate-400">{h.progress.total > 0 ? Math.round((h.progress.current / h.progress.total) * 100) : 0}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${h.done ? 'bg-green-500' : 'bg-teal-500'}`}
              style={{ width: `${h.progress.total > 0 ? (h.progress.current / h.progress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Filter tabs */}
      {h.done && (
        <div className="flex gap-1.5 mb-3">
          {([
            { value: 'all', label: `Todos (${h.rows.length})` },
            { value: 'diffs', label: `Con diferencias (${h.stats.diffs})` },
            { value: 'errors', label: `Errores (${h.stats.errors})` },
          ] as const).map(tab => (
            <button key={tab.value} onClick={() => h.setFilter(tab.value)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${
                h.filter === tab.value ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {h.rows.length > 0 && (
        <BulkValidationTable filteredRows={h.filteredRows} clienteMap={clienteMap} onApply={h.handleApply} />
      )}

      {/* Empty state */}
      {h.rows.length === 0 && !h.running && !h.done && (
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
