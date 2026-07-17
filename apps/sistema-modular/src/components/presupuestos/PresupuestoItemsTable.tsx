import { useRef, useState } from 'react';
import type { Disponibilidad, PresupuestoItem, CategoriaPresupuesto, ConceptoServicio, MonedaPresupuesto } from '@ags/shared';
import { MONEDA_SIMBOLO } from '@ags/shared';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { PresupuestoAddItemWizard } from './PresupuestoAddItemWizard';
import { PresupuestoItemRow } from './PresupuestoItemRow';
import { BulkAplicarDisponibilidadButton } from './BulkAplicarDisponibilidadButton';
import type { GrupoSistema } from '../../hooks/usePresupuestoSistemas';

interface PresupuestoTotals {
  subtotal: number;
  iva: number;
  ganancias: number;
  iibb: number;
  totalImpuestos: number;
  total: number;
}

interface PresupuestoItemsTableProps {
  items: PresupuestoItem[];
  categoriasPresupuesto: CategoriaPresupuesto[];
  conceptosServicio: ConceptoServicio[];
  moneda: MonedaPresupuesto;
  totals: PresupuestoTotals;
  notasTecnicas: string;
  condicionesComerciales: string;
  onAddItem: (item: PresupuestoItem) => void;
  onUpdateItem: (itemId: string, field: keyof PresupuestoItem, value: any) => void;
  onRemoveItem: (itemId: string) => void;
  onNotasTecnicasChange: (v: string) => void;
  onCondicionesChange: (v: string) => void;
  calculateItemTaxes: (item: PresupuestoItem) => { iva: number; ganancias: number; iibb: number; totalImpuestos: number };
  itemsByGrupo?: GrupoSistema[];
  getGrupo?: (sistemaId: string | null | undefined) => number;
}

const TABLE_HEADER = (
  <tr className="bg-slate-50">
    <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 px-2 text-center w-28">Código</th>
    <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 px-3 text-center">Descripcion</th>
    <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 px-2 text-center w-16">Cant.</th>
    <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 px-2 text-center w-20">Unidad</th>
    <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 px-2 text-center w-24">P. Unit.</th>
    <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 px-2 text-center w-16">Dto %</th>
    <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 px-2 text-center w-24">Subtotal</th>
    <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 px-2 text-center w-28">Categoria</th>
    <th className="w-8"></th>
  </tr>
);

export const PresupuestoItemsTable = ({
  items, categoriasPresupuesto, conceptosServicio, moneda,
  totals, notasTecnicas, condicionesComerciales,
  onAddItem, onUpdateItem, onRemoveItem,
  onNotasTecnicasChange, onCondicionesChange, calculateItemTaxes,
  itemsByGrupo, getGrupo,
}: PresupuestoItemsTableProps) => {
  const [showWizard, setShowWizard] = useState(false);
  // Loop de teclado: al confirmar el alta en el wizard con Enter, el foco vuelve a este
  // botón — Enter sobre el botón reabre el wizard y se encadena la carga sin mouse.
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const wizardAddedRef = useRef(false);
  const sym = MONEDA_SIMBOLO[moneda] || '$';
  const fmtMoney = (n: number) => `${sym} ${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  const hasGrupos = itemsByGrupo && itemsByGrupo.some(g => g.grupo > 0);

  // Alta desde el wizard "Agregar artículo" (servicios + artículos): completa el item con defaults.
  const addFromWizard = (p: Partial<PresupuestoItem>) => {
    wizardAddedRef.current = true;
    const cantidad = p.cantidad || 1;
    const precioUnitario = p.precioUnitario || 0;
    const descuento = p.descuento || 0;
    const base = cantidad * precioUnitario;
    onAddItem({
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
      stockArticuloId: p.stockArticuloId ?? null,
      sistemaId: null, sistemaNombre: null, sistemaCodigoInterno: null,
      moduloId: null, moduloNombre: null, moduloSerie: null, moduloMarca: null,
      servicioCode: null, subItem: null, esBonificacion: false,
      grupo: getGrupo ? getGrupo(null) : null,
      subtotal: descuento ? base * (1 - descuento / 100) : base,
      disponibilidad: p.disponibilidad ?? null,
      etaDiasEstimados: p.etaDiasEstimados ?? null,
      otNumeroVinculada: null,
      itemRequiereImportacion: p.itemRequiereImportacion ?? false,
    });
  };

  const openAdd = () => setShowWizard(true);

  const closeWizard = () => {
    setShowWizard(false);
    // Solo al cerrar-con-alta: devolver el foco al botón (rAF: espera al desmontaje del portal).
    if (wizardAddedRef.current) {
      wizardAddedRef.current = false;
      requestAnimationFrame(() => addBtnRef.current?.focus());
    }
  };

  const renderRows = (rowItems: PresupuestoItem[]) =>
    rowItems.map(item => (
      <PresupuestoItemRow key={item.id} item={item} categoriasPresupuesto={categoriasPresupuesto}
        fmtMoney={fmtMoney} taxes={calculateItemTaxes(item)} onUpdateItem={onUpdateItem} onRemoveItem={onRemoveItem} />
    ));

  return (
    <div className="flex-1 min-w-0 space-y-4">
      <Card compact>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase">Items</h3>
          <div className="flex items-center gap-2">
            {/* Phase 16: bulk-set disponibilidad+eta; null = leave as-is */}
            <BulkAplicarDisponibilidadButton itemsCount={items.length} onApplyAll={({ disponibilidad, etaDiasEstimados }) => {
              items.forEach(it => {
                if (disponibilidad !== null) onUpdateItem(it.id, 'disponibilidad', disponibilidad as Disponibilidad);
                if (etaDiasEstimados !== null) onUpdateItem(it.id, 'etaDiasEstimados', etaDiasEstimados);
              });
            }} />
            <Button ref={addBtnRef} onClick={openAdd} size="sm">+ Agregar artículo</Button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-xs text-slate-400">Sin items</p>
            <Button className="mt-3" onClick={openAdd} size="sm">+ Agregar artículo</Button>
          </div>
        ) : (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>{TABLE_HEADER}</thead>
              <tbody className="divide-y divide-slate-100">
                {hasGrupos ? (
                  itemsByGrupo!.map(grupo => {
                    const grupoSub = grupo.items.reduce((s, i) => s + (i.subtotal || 0), 0);
                    return (
                      <GroupRows key={grupo.grupo} grupo={grupo} grupoSubtotal={grupoSub}
                        renderRows={renderRows} fmtMoney={fmtMoney} />
                    );
                  })
                ) : renderRows(items)}
              </tbody>
              <TotalsFooter totals={totals} fmtMoney={fmtMoney} />
            </table>
          </div>
        )}
      </Card>

      <Card compact>
        <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-3">Notas tecnicas</h3>
        <textarea value={notasTecnicas} onChange={(e) => onNotasTecnicasChange(e.target.value)}
          rows={3} placeholder="Notas tecnicas, observaciones..."
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none bg-white focus:ring-1 focus:ring-teal-500" />
      </Card>

      <Card compact>
        <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-3">Condiciones comerciales</h3>
        <textarea value={condicionesComerciales} onChange={(e) => onCondicionesChange(e.target.value)}
          rows={3} placeholder="Condiciones comerciales, forma de pago, etc..."
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none bg-white focus:ring-1 focus:ring-teal-500" />
      </Card>

      {showWizard && (
        <PresupuestoAddItemWizard
          conceptosServicio={conceptosServicio}
          categoriasPresupuesto={categoriasPresupuesto}
          moneda={moneda}
          onAdd={addFromWizard}
          onClose={closeWizard}
        />
      )}
    </div>
  );
};

function GroupRows({ grupo, grupoSubtotal, renderRows, fmtMoney }: {
  grupo: GrupoSistema; grupoSubtotal: number;
  renderRows: (items: PresupuestoItem[]) => React.ReactNode;
  fmtMoney: (n: number) => string;
}) {
  return (
    <>
      <tr className="bg-teal-50/70">
        <td colSpan={9} className="px-3 py-1.5">
          <span className="text-[11px] font-semibold text-teal-800 tracking-wide">
            {grupo.grupo > 0 ? `${grupo.grupo}. ` : ''}{grupo.sistemaNombre}
          </span>
          <span className="text-[10px] text-teal-500 ml-2">
            ({grupo.items.length} items — {fmtMoney(grupoSubtotal)})
          </span>
        </td>
      </tr>
      {renderRows(grupo.items)}
    </>
  );
}

function TotalsFooter({ totals, fmtMoney }: { totals: PresupuestoTotals; fmtMoney: (n: number) => string }) {
  return (
    <tfoot className="bg-slate-50 border-t border-slate-200">
      <tr>
        <td colSpan={6} className="px-3 py-2 text-center text-[11px] font-medium text-slate-400">Subtotal</td>
        <td className="px-2 py-2 text-center text-xs font-semibold text-slate-700">{fmtMoney(totals.subtotal)}</td>
        <td colSpan={2}></td>
      </tr>
      {totals.iva > 0 && (
        <tr>
          <td colSpan={6} className="px-3 py-1.5 text-center text-[11px] font-medium text-slate-400">IVA</td>
          <td className="px-2 py-1.5 text-center text-xs text-slate-600">{fmtMoney(totals.iva)}</td>
          <td colSpan={2}></td>
        </tr>
      )}
      {totals.ganancias > 0 && (
        <tr>
          <td colSpan={6} className="px-3 py-1.5 text-center text-[11px] font-medium text-slate-400">Ganancias</td>
          <td className="px-2 py-1.5 text-center text-xs text-slate-600">{fmtMoney(totals.ganancias)}</td>
          <td colSpan={2}></td>
        </tr>
      )}
      {totals.iibb > 0 && (
        <tr>
          <td colSpan={6} className="px-3 py-1.5 text-center text-[11px] font-medium text-slate-400">IIBB</td>
          <td className="px-2 py-1.5 text-center text-xs text-slate-600">{fmtMoney(totals.iibb)}</td>
          <td colSpan={2}></td>
        </tr>
      )}
      <tr className="bg-teal-50">
        <td colSpan={6} className="px-3 py-2 text-center text-xs font-semibold text-teal-900">Total</td>
        <td className="px-2 py-2 text-center text-sm font-semibold text-teal-700">{fmtMoney(totals.total)}</td>
        <td colSpan={2}></td>
      </tr>
    </tfoot>
  );
}
