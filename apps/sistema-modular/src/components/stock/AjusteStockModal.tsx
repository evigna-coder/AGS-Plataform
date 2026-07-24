import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { movimientosService, unidadesService } from '../../services/stockService';
import type { UnidadStock } from '@ags/shared';

interface Props { unidad: UnidadStock; onClose: () => void; onSuccess: () => void; }

const LBL = 'text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block';
const FIELD = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500';

export const AjusteStockModal = ({ unidad, onClose, onSuccess }: Props) => {
  // Input como string para permitir tipear el signo "-" (Number('-') es NaN y reseteaba).
  const [deltaStr, setDeltaStr] = useState('');
  const delta = Number(deltaStr) || 0;
  const [justificacion, setJustificacion] = useState('');
  const [justifError, setJustifError] = useState('');
  const [saving, setSaving] = useState(false);

  const cantidadActual = unidad.cantidad ?? 1;
  const nuevaCantidad = cantidadActual + delta;

  const handleSubmit = async () => {
    setJustifError('');
    if (!justificacion.trim()) { setJustifError('La justificacion es obligatoria.'); return; }
    if (delta === 0) { setJustifError('El ajuste no puede ser cero.'); return; }
    if (unidad.estado !== 'disponible') {
      setJustifError(`Solo se ajustan unidades disponibles (esta esta '${unidad.estado}'). Para reservas usa liberar/entregar.`);
      return;
    }
    if (unidad.nroSerie && delta > 0) {
      setJustifError('Articulo serializado: las unidades nuevas se cargan con su n° de serie desde "Cargar stock".');
      return;
    }
    if (nuevaCantidad < 0) {
      setJustifError(`El ajuste deja la cantidad en negativo (actual: ${cantidadActual}).`);
      return;
    }
    setSaving(true);
    try {
      // Primero se aplica el ajuste real sobre la unidad; recien despues se
      // registra el movimiento (antes solo se registraba y el stock no cambiaba).
      await unidadesService.update(unidad.id, nuevaCantidad === 0
        ? { cantidad: 0, estado: 'baja', activo: false }
        : { cantidad: nuevaCantidad });
    } catch (err) {
      setJustifError('Error al aplicar el ajuste. Intente nuevamente.');
      console.error('[AjusteStockModal]', err);
      setSaving(false);
      return;
    }
    try {
      await movimientosService.create({
        tipo: 'ajuste',
        unidadId: unidad.id,
        articuloId: unidad.articuloId,
        articuloCodigo: unidad.articuloCodigo,
        articuloDescripcion: unidad.articuloDescripcion,
        cantidad: delta,
        origenTipo: unidad.ubicacion.tipo as 'posicion' | 'minikit' | 'ingeniero' | 'cliente' | 'proveedor' | 'consumo_ot' | 'baja' | 'ajuste',
        origenId: unidad.ubicacion.referenciaId,
        origenNombre: unidad.ubicacion.referenciaNombre,
        destinoTipo: 'ajuste',
        destinoId: '',
        destinoNombre: 'Ajuste de stock',
        remitoId: null,
        otNumber: null,
        motivo: justificacion.trim(),
        creadoPor: 'Admin',
      });
      onSuccess();
    } catch (err) {
      // El ajuste YA se aplico; solo fallo el registro del movimiento.
      setJustifError('El ajuste se aplico, pero fallo el registro del movimiento (revisar historial).');
      console.error('[AjusteStockModal]', err);
    } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title="Ajuste de stock"
      subtitle={`${unidad.articuloCodigo} — ${unidad.articuloDescripcion}`} maxWidth="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving}>{saving ? 'Guardando...' : 'Confirmar ajuste'}</Button>
        </div>
      }
    >
      <div className="space-y-4 py-2">
        <div className="bg-slate-50 rounded-lg px-3 py-2 text-xs text-slate-600 space-y-0.5">
          {unidad.nroSerie && <p><span className="text-slate-400">Serie:</span> {unidad.nroSerie}</p>}
          <p><span className="text-slate-400">Ubicacion:</span> {unidad.ubicacion.referenciaNombre || unidad.ubicacion.tipo}</p>
          <p><span className="text-slate-400">Estado:</span> {unidad.estado}</p>
        </div>
        <div>
          <label className={LBL}>Ajuste (+ ingreso / - salida)</label>
          <input type="text" inputMode="numeric" value={deltaStr} placeholder="0"
            onFocus={e => e.currentTarget.select()}
            onChange={e => { const v = e.target.value; if (/^-?\d*$/.test(v)) setDeltaStr(v); }}
            className={FIELD} />
          <p className="text-[11px] text-slate-500 mt-1">
            Cantidad actual: <span className="font-mono">{cantidadActual}</span>
            {delta !== 0 && (
              <> → quedara: <span className={`font-mono ${nuevaCantidad < 0 ? 'text-red-500' : 'font-semibold'}`}>{nuevaCantidad}</span>{nuevaCantidad === 0 && ' (la unidad se da de baja)'}</>
            )}
          </p>
        </div>
        <div>
          <label className={LBL}>Justificacion obligatoria</label>
          <textarea value={justificacion} onChange={e => setJustificacion(e.target.value)} rows={3}
            className={`${FIELD} resize-none`} placeholder="Motivo del ajuste..." />
          {justifError && <p className="text-xs text-red-500 mt-1">{justifError}</p>}
        </div>
      </div>
    </Modal>
  );
};
