import { Fragment, useMemo, useRef, useState } from 'react';
import type { PresupuestoItem, CategoriaPresupuesto, ConceptoServicio, MonedaPresupuesto } from '@ags/shared';
import { MONEDA_SIMBOLO } from '@ags/shared';
import { Button } from '../ui/Button';
import { PresupuestoAddItemWizard } from './PresupuestoAddItemWizard';

// ─── Main component ─────────────────────────────────────────────────────────

interface Props {
  items: PresupuestoItem[];
  onAdd: (item: PresupuestoItem) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: keyof PresupuestoItem, value: any) => void;
  categoriasPresupuesto: CategoriaPresupuesto[];
  conceptosServicio: ConceptoServicio[];
  moneda: MonedaPresupuesto;
  /** Fila extra bajo cada item (Equipos: editor de sub-ítems). `index` es 1-based. */
  renderSubRow?: (item: PresupuestoItem, index: number) => React.ReactNode;
}

export const CreatePresupuestoItems = ({ items, onAdd, onRemove, onUpdate, categoriasPresupuesto, conceptosServicio, moneda, renderSubRow }: Props) => {
  const [showWizard, setShowWizard] = useState(false);
  // Loop de teclado: al confirmar el alta en el wizard con Enter, el foco vuelve a este
  // botón — Enter sobre el botón reabre el wizard y se encadena la carga sin mouse.
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const wizardAddedRef = useRef(false);
  const isMixta = moneda === 'MIXTA';
  const symFor = (m: string) => MONEDA_SIMBOLO[m] || '$';
  const sym = isMixta ? '' : (MONEDA_SIMBOLO[moneda] || '$');
  const fmtMoney = (n: number, m?: string | null) => `${m ? symFor(m) : sym} ${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

  // Per-currency totals for MIXTA mode
  const totalsByCurrency = useMemo(() => {
    if (!isMixta) return null;
    const map: Record<string, number> = {};
    items.forEach(i => {
      const m = i.moneda || 'USD';
      map[m] = (map[m] || 0) + (i.subtotal || 0);
    });
    return map;
  }, [items, isMixta]);

  const totalItems = items.reduce((s, i) => s + (i.subtotal || 0), 0);

  const addFromWizard = (p: Partial<PresupuestoItem>) => {
    const cantidad = p.cantidad || 1;
    const precioUnitario = p.precioUnitario || 0;
    const descuento = p.descuento || 0;
    const base = cantidad * precioUnitario;
    wizardAddedRef.current = true;
    onAdd({
      id: `item-${Date.now()}`,
      descripcion: p.descripcion || '',
      cantidad,
      unidad: p.unidad || 'unidad',
      precioUnitario,
      descuento,
      categoriaPresupuestoId: p.categoriaPresupuestoId,
      factor: p.factor ?? null,
      codigoProducto: p.codigoProducto ?? null,
      conceptoServicioId: p.conceptoServicioId ?? null,
      servicioCode: null,
      stockArticuloId: p.stockArticuloId ?? null,
      subtotal: descuento ? base * (1 - descuento / 100) : base,
      ...(isMixta ? { moneda: 'USD' } : {}),
    });
  };

  const closeWizard = () => {
    setShowWizard(false);
    // Solo al cerrar-con-alta: devolver el foco al botón (rAF: espera al desmontaje del portal).
    if (wizardAddedRef.current) {
      wizardAddedRef.current = false;
      requestAnimationFrame(() => addBtnRef.current?.focus());
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wide">Items</span>
        <Button ref={addBtnRef} size="sm" onClick={() => setShowWizard(true)}>+ Agregar artículo</Button>
      </div>
      {showWizard && (
        <PresupuestoAddItemWizard
          conceptosServicio={conceptosServicio}
          categoriasPresupuesto={categoriasPresupuesto}
          moneda={moneda}
          onAdd={addFromWizard}
          onClose={closeWizard}
        />
      )}

      {/* Items table */}
      {items.length > 0 && (
        <div className="border border-[#E5E5E5] rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#F0F0F0]">
                <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wider py-2 px-3 text-center w-24">Codigo</th>
                <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wider py-2 px-3 text-center">Descripcion</th>
                <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wider py-2 px-2 text-center w-14">Cant.</th>
                {isMixta && <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wider py-2 px-2 text-center w-14">Mon.</th>}
                <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wider py-2 px-2 text-center w-20">P.Unit.</th>
                <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wider py-2 px-2 text-center w-14">Dto %</th>
                <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wider py-2 px-2 text-center w-14" title="Factor de venta — referencia interna, no se muestra en el PDF">Factor</th>
                <th className="text-[8px] font-mono font-semibold text-slate-500 uppercase tracking-wider py-2 px-2 text-center w-20">Subtotal</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, idx) => (
                <Fragment key={item.id}>
                <tr>
                  <td className="px-2 py-1 text-xs text-slate-500 font-mono">{item.servicioCode || item.codigoProducto || '—'}</td>
                  <td className="px-2 py-1">
                    <input value={item.descripcion}
                      onChange={e => onUpdate(item.id, 'descripcion', e.target.value)}
                      className="w-full outline-none bg-transparent text-xs text-slate-700" />
                  </td>
                  <td className="px-1 py-1">
                    <input type="number" min="0" step="0.01" value={item.cantidad}
                      onChange={e => onUpdate(item.id, 'cantidad', Number(e.target.value) || 0)}
                      className="w-full outline-none bg-transparent text-xs text-center" />
                  </td>
                  {isMixta && <td className="px-2 py-1 text-[10px] text-center font-mono text-slate-500">{item.moneda || 'USD'}</td>}
                  <td className="px-1 py-1">
                    <input type="number" min="0" step="0.01" value={item.precioUnitario}
                      onChange={e => onUpdate(item.id, 'precioUnitario', Number(e.target.value) || 0)}
                      className="w-full outline-none bg-transparent text-xs text-right font-mono" />
                  </td>
                  <td className="px-1 py-1">
                    <input type="number" min="0" max="100" step="0.5" value={item.descuento || 0}
                      onChange={e => onUpdate(item.id, 'descuento', Number(e.target.value) || 0)}
                      className="w-full outline-none bg-transparent text-xs text-center" />
                  </td>
                  <td className="px-1 py-1">
                    <input type="number" min="0" step="0.01" value={item.factor ?? ''} placeholder="—"
                      onChange={e => onUpdate(item.id, 'factor', e.target.value === '' ? null : Number(e.target.value))}
                      className="w-full outline-none bg-transparent text-xs text-center text-slate-500" />
                  </td>
                  <td className="px-2 py-1 text-xs text-center font-mono font-semibold text-teal-700">{fmtMoney(item.subtotal, isMixta ? item.moneda : null)}</td>
                  <td className="text-center">
                    <button onClick={() => onRemove(item.id)} className="text-red-400 hover:text-red-600 font-medium">&times;</button>
                  </td>
                </tr>
                {renderSubRow?.(item, idx + 1)}
                </Fragment>
              ))}
            </tbody>
            <tfoot className="bg-[#F0F0F0] border-t border-[#E5E5E5]">
              {isMixta && totalsByCurrency ? (
                Object.entries(totalsByCurrency).map(([m, total]) => (
                  <tr key={m}>
                    <td colSpan={7} className="px-3 py-1 text-right text-[9px] font-mono font-semibold text-slate-500 uppercase">Total {m}</td>
                    <td className="px-2 py-1 text-center text-xs font-mono font-semibold text-teal-700">{fmtMoney(total, m)}</td>
                    <td></td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-3 py-1.5 text-center text-[9px] font-mono font-semibold text-slate-500 uppercase">Total</td>
                  <td className="px-2 py-1.5 text-center text-xs font-mono font-semibold text-teal-700">{fmtMoney(totalItems)}</td>
                  <td></td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};
