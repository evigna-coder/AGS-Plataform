import { useMemo } from 'react';
import type { Remito, TipoRemito } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';
import { RemitoItemsEditor } from './RemitoItemsEditor';
import { useRemitoForm } from '../../hooks/useRemitoForm';
import { imprimirRemitoStock } from '../../utils/remitoImprimir';

const TIPOS: { value: TipoRemito; label: string }[] = [
  { value: 'entrega_cliente', label: 'Entrega a cliente' },
  { value: 'salida_campo', label: 'Salida a campo' },
  { value: 'devolucion', label: 'Devolución' },
  { value: 'interno', label: 'Interno' },
];

const lbl = 'block text-[11px] font-medium text-slate-500 mb-1';

interface Props {
  open: boolean;
  /** null = crear; con remito = editar (solo borrador sin imprimir). */
  remito: Remito | null;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Modal ÚNICO de remito de stock (rework 2026-07-31): crea y edita con todo
 * adentro — ingeniero opcional, cliente → establecimiento (autoselección de
 * único), OTs del cliente, items con serie/cantidad/observaciones. Dos cierres:
 * Guardar (borrador editable) o Guardar e imprimir (queda impreso → solo
 * reimpresión desde la lista).
 */
export function RemitoFormModal({ open, remito, onClose, onSaved }: Props) {
  const h = useRemitoForm(open, remito);

  const clienteOptions = useMemo(() => h.clientes.map(c => ({ value: c.id, label: c.razonSocial })), [h.clientes]);

  const handleGuardar = async (imprimir: boolean) => {
    const guardado = await h.guardar();
    if (!guardado) return;
    if (imprimir) {
      await imprimirRemitoStock(guardado).catch(err => {
        console.error('[RemitoFormModal] imprimir falló:', err);
        alert('El remito se guardó pero la impresión falló — reintentá desde la lista.');
      });
    }
    onSaved();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} maxWidth="xl"
      title={remito ? `Editar remito ${remito.numero}` : 'Nuevo remito'}
      subtitle={remito ? undefined : 'El número se asigna al guardar'}
      footer={<>
        <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
        <Button variant="secondary" size="sm" onClick={() => void handleGuardar(false)} disabled={h.saving}>
          {h.saving ? 'Guardando…' : 'Guardar'}
        </Button>
        <Button size="sm" onClick={() => void handleGuardar(true)} disabled={h.saving}>
          Guardar e imprimir
        </Button>
      </>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Tipo</label>
            <SearchableSelect value={h.form.tipo} onChange={v => h.set('tipo', v as TipoRemito)}
              options={TIPOS} placeholder="Tipo de remito…" />
          </div>
          <div>
            <label className={lbl}>Ingeniero / transporta <span className="text-slate-300">(opcional)</span></label>
            <SearchableSelect value={h.form.ingenieroId} onChange={v => h.set('ingenieroId', v)}
              options={[{ value: '', label: 'Sin ingeniero (retira transporte / cliente)' },
                ...h.ingenieros.map(i => ({ value: i.id, label: i.nombre }))]}
              placeholder="Seleccionar…" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Cliente {h.form.tipo === 'entrega_cliente' && <span className="text-red-500">*</span>}</label>
            <SearchableSelect value={h.form.clienteId} onChange={h.selectCliente}
              options={clienteOptions} placeholder="Seleccionar cliente…" />
          </div>
          <div>
            <label className={lbl}>Establecimiento</label>
            <SearchableSelect value={h.form.establecimientoId} onChange={v => h.set('establecimientoId', v)}
              options={[{ value: '', label: 'Sin establecimiento' },
                ...h.establecimientosFiltrados.map(e => ({
                  value: e.id, label: `${e.nombre}${e.localidad ? ` — ${e.localidad}` : ''}`,
                }))]}
              placeholder={h.form.clienteId ? 'Seleccionar…' : 'Seleccioná cliente primero'}
              disabled={!h.form.clienteId} />
          </div>
        </div>

        {/* OTs asociadas — solo OTs del cliente elegido */}
        <div>
          <label className={lbl}>OTs asociadas</label>
          <SearchableSelect value="" onChange={h.addOt}
            options={h.otsCliente.filter(n => !h.form.otNumbers.includes(n)).map(n => ({ value: n, label: `OT-${n}` }))}
            placeholder={h.form.clienteId ? 'Agregar OT del cliente…' : 'Seleccioná cliente primero'}
            disabled={!h.form.clienteId || h.otsCliente.length === 0} />
          {h.form.otNumbers.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {h.form.otNumbers.map(n => (
                <span key={n} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 text-[10px] font-mono font-medium">
                  OT-{n}
                  <button onClick={() => h.removeOt(n)} className="text-teal-400 hover:text-teal-700">×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Fecha de salida</label>
            <input type="date" value={h.form.fechaSalida} onChange={e => h.set('fechaSalida', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div>
            <label className={lbl}>Observaciones</label>
            {/* Se imprimen en un recuadro debajo del detalle de items (2026-08-04). */}
            <textarea value={h.form.observaciones} onChange={e => h.set('observaciones', e.target.value)}
              placeholder="Ej.: Contacto, entregar de 8 a 17 hs, pendiente entrega de… (sale impreso en un recuadro debajo del detalle)"
              rows={2}
              className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
          </div>
        </div>

        <div className="border-t border-slate-200 pt-3">
          <RemitoItemsEditor
            items={h.items}
            unidades={h.unidades}
            maxCantidad={h.maxCantidad}
            onAdd={h.addUnidad}
            onAddManual={h.addManual}
            onUpdate={h.updateItem}
            onRemove={h.removeItem}
            onNormalizeCantidad={h.normalizarCantidad}
          />
        </div>
      </div>
    </Modal>
  );
}
