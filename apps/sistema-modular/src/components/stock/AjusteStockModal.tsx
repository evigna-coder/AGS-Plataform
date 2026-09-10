import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { movimientosService, unidadesService } from '../../services/stockService';
import type { UnidadStock } from '@ags/shared';
import { parseDecimal } from '../../utils/parseDecimal';

interface Props {
  /**
   * Una unidad, o TODAS las tandas de una fila agrupada (2026-09-10): el
   * ajuste se ingresa sobre el total y se reparte entre los documentos — al
   * restar, de la tanda más vieja a la más nueva (mismo criterio que el cierre
   * de OT); al sumar, a la más nueva. Cada tanda conserva su costo y factor.
   */
  unidades: UnidadStock[];
  onClose: () => void;
  onSuccess: () => void;
}

const LBL = 'text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block';
const FIELD = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500';

/** Reparte el delta entre las tandas. Devuelve [unidad, delta] por documento tocado. */
export function repartirAjuste(unidades: UnidadStock[], delta: number): Array<[UnidadStock, number]> {
  const porFecha = [...unidades].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  if (delta > 0) return [[porFecha[porFecha.length - 1], delta]];
  const out: Array<[UnidadStock, number]> = [];
  let restante = -delta;
  for (const u of porFecha) {
    if (restante <= 0) break;
    const qty = u.cantidad ?? 1;
    const saca = Math.min(qty, restante);
    if (saca > 0) out.push([u, -saca]);
    restante -= saca;
  }
  return out;
}

export const AjusteStockModal = ({ unidades, onClose, onSuccess }: Props) => {
  const unidad = unidades[0];
  const esGrupo = unidades.length > 1;
  // Input como string para permitir tipear el signo "-" (Number('-') es NaN y reseteaba).
  const [deltaStr, setDeltaStr] = useState('');
  // parseDecimal (2026-09-03): acepta coma y punto; Number('2,5') daba NaN → 0
  // y el ajuste "no se podia hacer con decimales" sin ningun aviso.
  const delta = parseDecimal(deltaStr) || 0;
  const [justificacion, setJustificacion] = useState('');
  const [justifError, setJustifError] = useState('');
  const [saving, setSaving] = useState(false);

  const cantidadActual = unidades.reduce((s, u) => s + (u.cantidad ?? 1), 0);
  const nuevaCantidad = cantidadActual + delta;
  const reparto = delta !== 0 ? repartirAjuste(unidades, delta) : [];

  const aplicarUno = async (u: UnidadStock, d: number) => {
    const nueva = (u.cantidad ?? 1) + d;
    // Primero se aplica el ajuste real sobre la unidad; recien despues se
    // registra el movimiento (antes solo se registraba y el stock no cambiaba).
    await unidadesService.update(u.id, nueva === 0
      ? { cantidad: 0, estado: 'baja', activo: false }
      : { cantidad: nueva });
    await movimientosService.create({
      tipo: 'ajuste',
      unidadId: u.id,
      articuloId: u.articuloId,
      articuloCodigo: u.articuloCodigo,
      articuloDescripcion: u.articuloDescripcion,
      cantidad: d,
      origenTipo: u.ubicacion.tipo as 'posicion' | 'minikit' | 'ingeniero' | 'cliente' | 'proveedor' | 'consumo_ot' | 'baja' | 'ajuste',
      origenId: u.ubicacion.referenciaId,
      origenNombre: u.ubicacion.referenciaNombre,
      destinoTipo: 'ajuste',
      destinoId: '',
      destinoNombre: 'Ajuste de stock',
      remitoId: null,
      otNumber: null,
      motivo: justificacion.trim(),
      creadoPor: 'Admin',
    });
  };

  const handleSubmit = async () => {
    setJustifError('');
    if (!justificacion.trim()) { setJustifError('La justificacion es obligatoria.'); return; }
    if (delta === 0) { setJustifError('El ajuste no puede ser cero.'); return; }
    const noDisponible = unidades.find(u => u.estado !== 'disponible');
    if (noDisponible) {
      setJustifError(`Solo se ajustan unidades disponibles (hay una '${noDisponible.estado}'). Para reservas usa liberar/entregar.`);
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
    let hechos = 0;
    try {
      for (const [u, d] of reparto) {
        await aplicarUno(u, d);
        hechos++;
      }
      onSuccess();
    } catch (err) {
      console.error('[AjusteStockModal]', err);
      setJustifError(hechos > 0
        ? `Se ajustaron ${hechos} de ${reparto.length} tandas y falló la siguiente: revisar el historial antes de reintentar.`
        : 'Error al aplicar el ajuste. Intente nuevamente.');
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
          {esGrupo && <p><span className="text-slate-400">Tandas:</span> {unidades.length} (el ajuste se reparte solo)</p>}
        </div>
        <div>
          <label className={LBL}>Ajuste (+ ingreso / - salida)</label>
          {/* inputMode="decimal" + regex con separador (2026-09-03): "numeric"
              en tablet no ofrece el punto, y el regex rechazaba cualquier
              decimal — el ajuste quedaba forzado a enteros. */}
          <input type="text" inputMode="decimal" value={deltaStr} placeholder="0"
            onFocus={e => e.currentTarget.select()}
            onChange={e => { const v = e.target.value; if (/^-?\d*[.,]?\d*$/.test(v)) setDeltaStr(v); }}
            className={FIELD} />
          <div className="flex gap-3 mt-1">
            {/* Atajos al maximo (pedido 2026-09-03): "utilizar/ajustar el
                maximo disponible" sin tener que copiar el numero a mano. */}
            {cantidadActual > 0 && (
              <button type="button" onClick={() => setDeltaStr(String(-cantidadActual))}
                className="text-[11px] text-teal-700 hover:underline">
                Sacar todo (−{cantidadActual})
              </button>
            )}
            <button type="button" onClick={() => setDeltaStr('')}
              className="text-[11px] text-slate-400 hover:underline">
              Limpiar
            </button>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Cantidad actual: <span className="font-mono">{cantidadActual}</span>
            {delta !== 0 && (
              <> → quedara: <span className={`font-mono ${nuevaCantidad < 0 ? 'text-red-500' : 'font-semibold'}`}>{nuevaCantidad}</span>{nuevaCantidad === 0 && ' (se da de baja)'}</>
            )}
          </p>
          {esGrupo && reparto.length > 0 && (
            <p className="text-[11px] text-slate-500 mt-1">
              Se reparte así: {reparto.map(([u, d]) => `${d > 0 ? '+' : ''}${d} en la tanda de ${u.cantidad ?? 1}${u.importacionNumero ? ` (${u.importacionNumero})` : ''}`).join(' · ')}
            </p>
          )}
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
