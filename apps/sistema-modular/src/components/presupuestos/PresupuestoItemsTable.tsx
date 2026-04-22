import { useState } from 'react';
import type { PresupuestoItem, CategoriaPresupuesto, ConceptoServicio, MonedaPresupuesto, Sistema, ModuloSistema, Articulo } from '@ags/shared';
import { MONEDA_SIMBOLO } from '@ags/shared';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { AddItemModal } from './AddItemModal';
import { PresupuestoItemRow } from './PresupuestoItemRow';
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
  tipoPresupuesto?: string;
  sistemas?: Sistema[];
  loadModulos?: (sistemaId: string) => Promise<ModuloSistema[]>;
  itemsByGrupo?: GrupoSistema[];
  getGrupo?: (sistemaId: string | null | undefined) => number;
  /** Phase 10 — catalog para ArticuloPickerPanel en AddItemModal (partes/mixto/ventas). */
  articulos?: Articulo[];
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
  tipoPresupuesto, sistemas, loadModulos, itemsByGrupo, getGrupo, articulos,
}: PresupuestoItemsTableProps) => {
  const [showModal, setShowModal] = useState(false);
  const [newItem, setNewItem] = useState<Partial<PresupuestoItem>>({
    descripcion: '', cantidad: 1, unidad: 'unidad', precioUnitario: 0, descuento: 0,
    categoriaPresupuestoId: undefined, codigoProducto: null, conceptoServicioId: null,
  });
  const sym = MONEDA_SIMBOLO[moneda] || '$';
  const fmtMoney = (n: number) => `${sym} ${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  const hasGrupos = itemsByGrupo && itemsByGrupo.some(g => g.grupo > 0);

  const handleAdd = () => {
    if (!newItem.descripcion || !newItem.cantidad || !newItem.precioUnitario) {
      alert('Complete descripcion, cantidad y precio unitario');
      return;
    }
    const base = (newItem.cantidad || 0) * (newItem.precioUnitario || 0);
    const subtotal = newItem.descuento ? base * (1 - newItem.descuento / 100) : base;
    const sistemaId = newItem.sistemaId === '__ALL_SISTEMAS__' ? null : (newItem.sistemaId || null);
    onAddItem({
      id: `item-${Date.now()}`,
      descripcion: newItem.descripcion,
      cantidad: newItem.cantidad || 1,
      unidad: newItem.unidad || 'unidad',
      precioUnitario: newItem.precioUnitario || 0,
      descuento: newItem.descuento || 0,
      categoriaPresupuestoId: newItem.categoriaPresupuestoId,
      codigoProducto: newItem.codigoProducto || null,
      conceptoServicioId: newItem.conceptoServicioId || null,
      sistemaId,
      sistemaNombre: newItem.sistemaId === '__ALL_SISTEMAS__' ? 'Todos los sistemas/equipos' : (newItem.sistemaNombre || null),
      sistemaCodigoInterno: newItem.sistemaCodigoInterno || null,
      moduloId: newItem.moduloId || null,
      moduloNombre: newItem.moduloNombre || null,
      moduloSerie: newItem.moduloSerie || null,
      moduloMarca: newItem.moduloMarca || null,
      servicioCode: newItem.servicioCode || null,
      subItem: newItem.subItem || null,
      esBonificacion: newItem.esBonificacion || false,
      grupo: getGrupo ? getGrupo(sistemaId) : null,
      subtotal,
    });
    setShowModal(false);
  };

  const openModal = () => {
    setNewItem({ descripcion: '', cantidad: 1, unidad: 'unidad', precioUnitario: 0, descuento: 0,
      categoriaPresupuestoId: undefined, codigoProducto: null, conceptoServicioId: null });
    setShowModal(true);
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
          <Button onClick={openModal} size="sm">+ Agregar</Button>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-xs text-slate-400">Sin items</p>
            <Button className="mt-3" onClick={openModal} size="sm">Agregar primer item</Button>
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

      {showModal && (
        <AddItemModal newItem={newItem} setNewItem={setNewItem} categoriasPresupuesto={categoriasPresupuesto}
          conceptosServicio={conceptosServicio} moneda={moneda} onAdd={handleAdd} onClose={() => setShowModal(false)}
          tipoPresupuesto={tipoPresupuesto}
          sistemas={tipoPresupuesto === 'contrato' ? sistemas : undefined}
          loadModulos={tipoPresupuesto === 'contrato' ? loadModulos : undefined}
          articulos={articulos} />
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
