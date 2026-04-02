import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { Presupuesto, PresupuestoItem, FacturaItem, SolicitudFacturacion } from '@ags/shared';
import { MONEDA_SIMBOLO } from '@ags/shared';
import { facturacionService } from '../../services/facturacionService';
import { presupuestosService } from '../../services/firebaseService';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  open: boolean;
  presupuesto: Presupuesto;
  clienteNombre: string;
  condicionPagoNombre: string;
  onClose: () => void;
  onCreated: () => void;
}

interface ItemSelection {
  selected: boolean;
  cantidad: number;
  cantidadDisponible: number;
  item: PresupuestoItem;
}

export const SolicitarFacturaModal: React.FC<Props> = ({
  open, presupuesto, clienteNombre, condicionPagoNombre, onClose, onCreated,
}) => {
  const { usuario } = useAuth();
  const [selections, setSelections] = useState<ItemSelection[]>([]);
  const [solicitudesPrevias, setSolicitudesPrevias] = useState<SolicitudFacturacion[]>([]);
  const [observaciones, setObservaciones] = useState('');
  const [saving, setSaving] = useState(false);
  const sym = MONEDA_SIMBOLO[presupuesto.moneda] || '$';

  useEffect(() => {
    if (!open) return;
    facturacionService.getByPresupuesto(presupuesto.id).then(previas => {
      setSolicitudesPrevias(previas.filter(s => s.estado !== 'anulada'));
      // Calculate already invoiced quantities per item
      const facturadoMap = new Map<string, number>();
      for (const sol of previas.filter(s => s.estado !== 'anulada')) {
        for (const fi of sol.items) {
          facturadoMap.set(fi.presupuestoItemId, (facturadoMap.get(fi.presupuestoItemId) || 0) + fi.cantidad);
        }
      }
      setSelections(presupuesto.items.map(item => {
        const yaFacturado = facturadoMap.get(item.id) || 0;
        const disponible = Math.max(0, item.cantidad - yaFacturado);
        return {
          selected: disponible > 0,
          cantidad: disponible,
          cantidadDisponible: disponible,
          item,
        };
      }));
    });
  }, [open, presupuesto.id]);

  const toggleItem = (idx: number) => {
    setSelections(prev => prev.map((s, i) => i === idx ? { ...s, selected: !s.selected } : s));
  };

  const setCantidad = (idx: number, cant: number) => {
    setSelections(prev => prev.map((s, i) =>
      i === idx ? { ...s, cantidad: Math.min(Math.max(0, cant), s.cantidadDisponible) } : s
    ));
  };

  const selectedItems = selections.filter(s => s.selected && s.cantidad > 0);
  const montoTotal = selectedItems.reduce((sum, s) => sum + s.cantidad * s.item.precioUnitario, 0);

  const handleSubmit = async () => {
    if (selectedItems.length === 0) { alert('Seleccione al menos un item'); return; }
    try {
      setSaving(true);
      const facturaItems: FacturaItem[] = selectedItems.map(s => ({
        id: crypto.randomUUID(),
        presupuestoItemId: s.item.id,
        descripcion: s.item.descripcion,
        cantidad: s.cantidad,
        cantidadTotal: s.item.cantidad,
        precioUnitario: s.item.precioUnitario,
        subtotal: s.cantidad * s.item.precioUnitario,
      }));

      await facturacionService.create({
        presupuestoId: presupuesto.id,
        presupuestoNumero: presupuesto.numero,
        clienteId: presupuesto.clienteId,
        clienteNombre,
        condicionPago: condicionPagoNombre,
        items: facturaItems,
        montoTotal,
        moneda: presupuesto.moneda,
        estado: 'pendiente',
        observaciones: observaciones || null,
        solicitadoPor: usuario?.id || null,
        solicitadoPorNombre: usuario?.displayName || null,
      });

      // Update facturacionEstado on presupuesto
      const totalFacturado = solicitudesPrevias.reduce((s, sol) => s + sol.montoTotal, 0) + montoTotal;
      const totalPresupuesto = presupuesto.items.reduce((s, i) => s + i.subtotal, 0);
      const estado = totalFacturado >= totalPresupuesto ? 'completa' : 'parcial';
      await presupuestosService.update(presupuesto.id, { facturacionEstado: estado } as any);

      onCreated();
      onClose();
    } catch (err) {
      console.error('Error creando solicitud de facturación:', err);
      alert('Error al crear la solicitud');
    } finally {
      setSaving(false);
    }
  };

  const fmtMoney = (n: number) => `${sym} ${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

  return (
    <Modal open={open} onClose={onClose} title="Solicitar facturacion" subtitle={`${presupuesto.numero} — ${clienteNombre}`} maxWidth="xl">
      <div className="space-y-4">
        {solicitudesPrevias.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            <p className="text-[11px] font-medium text-blue-700">
              Ya existen {solicitudesPrevias.length} solicitud(es) previa(s) para este presupuesto.
              Las cantidades disponibles reflejan lo pendiente.
            </p>
          </div>
        )}

        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="py-2 px-1 w-8"></th>
              <th className="py-2 px-2 text-left text-[10px] font-mono text-slate-400 uppercase">Descripcion</th>
              <th className="py-2 px-2 text-center text-[10px] font-mono text-slate-400 uppercase w-20">Disponible</th>
              <th className="py-2 px-2 text-center text-[10px] font-mono text-slate-400 uppercase w-20">A facturar</th>
              <th className="py-2 px-2 text-right text-[10px] font-mono text-slate-400 uppercase w-24">P. Unit.</th>
              <th className="py-2 px-2 text-right text-[10px] font-mono text-slate-400 uppercase w-24">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {selections.map((sel, idx) => (
              <tr key={sel.item.id} className={`border-b border-slate-100 ${sel.cantidadDisponible === 0 ? 'opacity-40' : ''}`}>
                <td className="py-2 px-1 text-center">
                  <input
                    type="checkbox"
                    checked={sel.selected}
                    disabled={sel.cantidadDisponible === 0}
                    onChange={() => toggleItem(idx)}
                    className="rounded border-slate-300"
                  />
                </td>
                <td className="py-2 px-2 text-slate-700">{sel.item.descripcion}</td>
                <td className="py-2 px-2 text-center text-slate-500">{sel.cantidadDisponible} / {sel.item.cantidad}</td>
                <td className="py-2 px-2 text-center">
                  <input
                    type="number"
                    min={0}
                    max={sel.cantidadDisponible}
                    value={sel.cantidad}
                    disabled={!sel.selected || sel.cantidadDisponible === 0}
                    onChange={e => setCantidad(idx, Number(e.target.value))}
                    className="w-16 text-center border border-slate-200 rounded px-1 py-0.5 text-xs"
                  />
                </td>
                <td className="py-2 px-2 text-right text-slate-600">{fmtMoney(sel.item.precioUnitario)}</td>
                <td className="py-2 px-2 text-right font-medium text-slate-700">
                  {sel.selected ? fmtMoney(sel.cantidad * sel.item.precioUnitario) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div>
          <label className="block text-[10px] font-mono font-medium text-slate-500 mb-1 uppercase tracking-wide">
            Observaciones
          </label>
          <textarea
            value={observaciones}
            onChange={e => setObservaciones(e.target.value)}
            rows={2}
            className="w-full border border-[#E5E5E5] rounded-md px-3 py-2 text-xs"
            placeholder="Notas para admin/contable..."
          />
        </div>
      </div>

      <div className="flex items-center justify-between px-5 py-3 border-t border-[#E5E5E5] bg-[#F0F0F0] rounded-b-xl -mx-5 -mb-4 mt-3">
        <div className="text-xs font-mono text-slate-500">
          {selectedItems.length > 0 && (
            <span>Items: <strong>{selectedItems.length}</strong> — Total: <strong className="text-teal-700">{fmtMoney(montoTotal)}</strong></span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" size="sm" onClick={handleSubmit} disabled={saving || selectedItems.length === 0}>
            {saving ? 'Enviando...' : 'Solicitar facturacion'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
