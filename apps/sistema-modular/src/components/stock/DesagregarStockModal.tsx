import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';
import { useDesagregarStock } from '../../hooks/useDesagregarStock';
import type { Articulo } from '@ags/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  articulo: Articulo | null;
  onSuccess?: (movimientoId: string) => void;
}

const lbl =
  'block text-[10px] font-mono font-medium text-slate-500 mb-0.5 uppercase tracking-wide';
const inputCls =
  'w-full border border-[#E5E5E5] rounded-md px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-700';

export function DesagregarStockModal({ open, onClose, articulo, onSuccess }: Props) {
  const h = useDesagregarStock({ articulo, open });
  const eq = articulo?.equivalencias?.[0];

  const handleClose = () => {
    h.reset();
    onClose();
  };

  const handleSuccessClose = () => {
    if (h.successMessage) onSuccess?.(h.successMessage.movimientoId);
    handleClose();
  };

  // Nothing to do without an equivalencia
  if (!articulo || !eq) return null;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Desagregar artículo"
      subtitle={`${articulo.codigo} → ${eq.articuloCodigoDestino}`}
      maxWidth="md"
      footer={
        h.successMessage ? (
          <Button size="sm" onClick={handleSuccessClose}>
            Cerrar
          </Button>
        ) : (
          <>
            <Button variant="secondary" size="sm" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={h.confirm}
              disabled={!h.canConfirm || h.confirming}
              data-testid="desagregar-confirm"
            >
              {h.confirming ? 'Procesando…' : 'Confirmar conversión'}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-3" data-testid="desagregar-modal">
        {/* Info header: from/to/factor */}
        <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-700 space-y-0.5">
          <div>
            <span className="font-mono uppercase text-[10px] text-slate-500">DESDE</span>{' '}
            {articulo.codigo} — {articulo.descripcion}
          </div>
          <div>
            <span className="font-mono uppercase text-[10px] text-slate-500">HACIA</span>{' '}
            {eq.articuloCodigoDestino} — {eq.articuloDescripcionDestino}
          </div>
          <div>
            <span className="font-mono uppercase text-[10px] text-slate-500">FACTOR</span>{' '}
            ×{eq.factor}
          </div>
        </div>

        {h.successMessage ? (
          /* Success block replaces form after confirm */
          <div
            className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900"
            data-testid="desagregar-success"
          >
            <p className="font-semibold mb-1">Conversión completada</p>
            <p>Origen: {h.successMessage.cantidadOrigen} unidades consumidas</p>
            <p>Destino: {h.successMessage.cantidadDestino} nuevas unidades disponibles</p>
            <a
              href={`/stock/movimientos?id=${h.successMessage.movimientoId}`}
              className="underline text-teal-700 mt-1 inline-block"
            >
              Ver movimiento
            </a>
          </div>
        ) : (
          <>
            {/* Ubicacion selector */}
            <div>
              <label className={lbl}>Ubicación origen *</label>
              <SearchableSelect
                options={h.ubicacionOptions.map(u => ({ value: u.value, label: u.label }))}
                value={h.selectedUbicacionId}
                onChange={h.setSelectedUbicacionId}
                placeholder={
                  h.loadingUbicaciones
                    ? 'Cargando…'
                    : h.ubicacionOptions.length === 0
                    ? 'Sin stock disponible'
                    : 'Seleccionar ubicación'
                }
              />
            </div>

            {/* Cantidad input */}
            <div>
              <label className={lbl}>Cantidad a desagregar *</label>
              <input
                type="number"
                min="1"
                step="1"
                className={inputCls}
                value={h.cantidad}
                onChange={e => h.setCantidad(e.target.value)}
                placeholder="0"
              />
              {h.selectedUbicacion && (
                <p className="text-[10px] text-slate-500 mt-1">
                  Máximo: {h.selectedUbicacion.stockDisponible} disponibles
                </p>
              )}
            </div>

            {/* Preview */}
            <div
              className="rounded-md bg-teal-50/50 border border-teal-200 px-3 py-2 text-xs text-teal-900"
              data-testid="desagregar-preview"
            >
              <span className="font-mono text-[10px] text-teal-700/70 uppercase tracking-widest">
                RESULTADO
              </span>
              <p className="mt-1">
                {h.cantidadNum || '0'} × {h.factor} ={' '}
                <span className="font-semibold">{h.cantidadDestinoPreview}</span> unidades de{' '}
                {eq.articuloCodigoDestino}
              </p>
            </div>
          </>
        )}

        {/* Inline error — visible in both states */}
        {h.error && (
          <p className="text-rose-600 text-xs mt-1" data-testid="desagregar-error">
            {h.error}
          </p>
        )}
      </div>
    </Modal>
  );
}
