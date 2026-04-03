import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { movimientosService } from '../../services/stockService';
import type { UnidadStock } from '@ags/shared';

interface Props { unidad: UnidadStock; onClose: () => void; onSuccess: () => void; }

const LBL = 'text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block';
const FIELD = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500';

export const AjusteStockModal = ({ unidad, onClose, onSuccess }: Props) => {
  const [delta, setDelta] = useState<number>(0);
  const [justificacion, setJustificacion] = useState('');
  const [justifError, setJustifError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setJustifError('');
    if (!justificacion.trim()) { setJustifError('La justificacion es obligatoria.'); return; }
    if (delta === 0) { setJustifError('El ajuste no puede ser cero.'); return; }
    setSaving(true);
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
      setJustifError('Error al guardar el ajuste. Intente nuevamente.');
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
          <input type="number" value={delta} onChange={e => setDelta(Number(e.target.value))} className={FIELD} />
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
