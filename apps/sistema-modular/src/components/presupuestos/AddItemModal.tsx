import { useEffect, useRef, useState } from 'react';
import type { Disponibilidad, PresupuestoItem, CategoriaPresupuesto, ConceptoServicio, Sistema, ModuloSistema, Articulo } from '@ags/shared';
import { MONEDA_SIMBOLO } from '@ags/shared';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';
import { EquipoLinkPanel } from './EquipoLinkPanel';
import { ArticuloPickerPanel } from './ArticuloPickerPanel';
import { PresupuestoDisponibilidadFields } from './PresupuestoDisponibilidadFields';
import { computeStockAmplio } from '../../services/stockAmplioService';
import { useTabs } from '../../contexts/TabsContext';
import { useFloatingPresupuesto } from '../../contexts/FloatingPresupuestoContext';

const categoriaOptions = (cats: CategoriaPresupuesto[]) => [
  { value: '', label: 'Sin categoria' },
  ...cats.filter(c => c.activo).map(c => ({ value: c.id, label: c.nombre })),
];

function TaxPreview({ categoria, subtotal, sym }: {
  categoria: CategoriaPresupuesto;
  subtotal: number;
  sym: string;
}) {
  let iva = 0, ganancias = 0, iibb = 0;
  if (categoria.incluyeIva && categoria.porcentajeIva) {
    iva = categoria.ivaReduccion && categoria.porcentajeIvaReduccion
      ? subtotal * (categoria.porcentajeIvaReduccion / 100)
      : subtotal * (categoria.porcentajeIva / 100);
  }
  if (categoria.incluyeGanancias && categoria.porcentajeGanancias) ganancias = (subtotal + iva) * (categoria.porcentajeGanancias / 100);
  if (categoria.incluyeIIBB && categoria.porcentajeIIBB) iibb = (subtotal + iva) * (categoria.porcentajeIIBB / 100);
  const total = subtotal + iva + ganancias + iibb;
  return (
    <div className="mt-2 bg-teal-50 p-3 rounded-lg text-xs">
      <p className="font-semibold text-slate-700 mb-1">Calculo con "{categoria.nombre}":</p>
      <div className="space-y-0.5 text-slate-600">
        <p>Subtotal: {sym} {subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
        {iva > 0 && <p>IVA ({categoria.ivaReduccion && categoria.porcentajeIvaReduccion ? categoria.porcentajeIvaReduccion : categoria.porcentajeIva}%): {sym} {iva.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>}
        {ganancias > 0 && <p>Ganancias ({categoria.porcentajeGanancias}%): {sym} {ganancias.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>}
        {iibb > 0 && <p>IIBB ({categoria.porcentajeIIBB}%): {sym} {iibb.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>}
        <p className="font-semibold text-teal-700 mt-1">Total: {sym} {total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
      </div>
    </div>
  );
}

interface AddItemModalProps {
  newItem: Partial<PresupuestoItem>;
  setNewItem: (v: Partial<PresupuestoItem>) => void;
  categoriasPresupuesto: CategoriaPresupuesto[];
  conceptosServicio: ConceptoServicio[];
  moneda?: string;
  onAdd: () => void;
  onClose: () => void;
  /** Sistemas del cliente — enables equipo selector for contratos (gated by tipoPresupuesto) */
  sistemas?: Sistema[];
  /** Cargar módulos de un sistema */
  loadModulos?: (sistemaId: string) => Promise<ModuloSistema[]>;
  /** Tipo de presupuesto — shows equipo fields when 'contrato' */
  tipoPresupuesto?: string;
  /** Full catalog de articulos. Solo se usa cuando tipo ∈ {partes, mixto, ventas}. */
  articulos?: Articulo[];
}

export const AddItemModal = ({
  newItem, setNewItem, categoriasPresupuesto, conceptosServicio, moneda,
  onAdd, onClose, sistemas, loadModulos, tipoPresupuesto, articulos,
}: AddItemModalProps) => {
  const { navigateInActiveTab } = useTabs();
  const { minimize } = useFloatingPresupuesto();

  // Phase 16 — disponibilidad auto-default by ATP
  const [disponibilidadTouched, setDisponibilidadTouched] = useState(false);
  const [atpHint, setAtpHint] = useState<{ atp: number } | null>(null);
  const prevArticuloId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const artId = newItem.stockArticuloId ?? null;
    if (artId === prevArticuloId.current) return; // unchanged — skip
    prevArticuloId.current = artId;
    if (disponibilidadTouched) return; // operator already set manually
    if (!artId) {
      setAtpHint(null);
      setNewItem({ ...newItem, disponibilidad: 'post_facturacion', etaDiasEstimados: null });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const stock = await computeStockAmplio(artId);
        if (cancelled) return;
        const atp = stock.atp ?? 0;
        setAtpHint({ atp });
        const disp = atp > 0 ? 'stock' : 'a_importar';
        const eta = atp > 0 ? 0 : 30;
        setNewItem({ ...newItem, stockArticuloId: artId, disponibilidad: disp, etaDiasEstimados: eta });
      } catch {
        if (!cancelled) { setAtpHint(null); setNewItem({ ...newItem, stockArticuloId: artId, disponibilidad: 'a_importar', etaDiasEstimados: 30 }); }
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newItem.stockArticuloId]);

  const base = (newItem.cantidad || 0) * (newItem.precioUnitario || 0);
  const subtotal = newItem.descuento ? base * (1 - newItem.descuento / 100) : base;
  const categoria = categoriasPresupuesto.find(c => c.id === newItem.categoriaPresupuestoId);
  const sym = MONEDA_SIMBOLO[(moneda as keyof typeof MONEDA_SIMBOLO) || 'USD'] || '$';

  const handleManageCategorias = () => {
    minimize();              // pill el modal flotante para que se vea la pagina
    onClose();               // cierra AddItem
    navigateInActiveTab('/presupuestos/categorias');
  };

  const handleSelectConcepto = (conceptoId: string) => {
    const concepto = conceptosServicio.find(c => c.id === conceptoId);
    if (!concepto) return;
    // FLOW-03: servicios sin stockArticuloId → itemRequiereImportacion false
    setNewItem({ ...newItem,
      descripcion: concepto.descripcion, precioUnitario: concepto.valorBase * concepto.factorActualizacion,
      codigoProducto: concepto.codigo || newItem.codigoProducto || null,
      categoriaPresupuestoId: concepto.categoriaPresupuestoId || newItem.categoriaPresupuestoId,
      conceptoServicioId: concepto.id, itemRequiereImportacion: false,
    });
  };

  const handleSelectArticulo = (art: Articulo | null, meta: { itemRequiereImportacion: boolean }) => {
    if (!art) { setNewItem({ ...newItem, stockArticuloId: null, itemRequiereImportacion: false }); return; }
    setNewItem({ ...newItem,
      stockArticuloId: art.id, codigoProducto: art.codigo || newItem.codigoProducto || null,
      descripcion: newItem.descripcion || art.descripcion,
      precioUnitario: newItem.precioUnitario || art.precioReferencia || 0,
      categoriaPresupuestoId: newItem.categoriaPresupuestoId || categoriasPresupuesto.find(c => c.activo && c.nombre.trim().toLowerCase() === 'iva 21%')?.id || undefined,
      itemRequiereImportacion: meta.itemRequiereImportacion,
    });
  };

  const showArticuloPicker = (
    (tipoPresupuesto === 'partes' ||
     tipoPresupuesto === 'mixto' ||
     tipoPresupuesto === 'ventas') &&
    !!articulos && articulos.length > 0
  );

  const conceptoOptions = conceptosServicio.filter(c => c.activo).map(c => ({
    value: c.id,
    label: `${c.codigo ? `[${c.codigo}] ` : ''}${c.descripcion} — ${MONEDA_SIMBOLO[c.moneda]} ${(c.valorBase * c.factorActualizacion).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
  }));

  const showEquipoPanel = tipoPresupuesto === 'contrato' && sistemas && sistemas.length > 0 && !!loadModulos;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <Card compact className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-sm font-semibold text-slate-900 tracking-tight mb-3">Agregar item</h3>
        <div className="space-y-3">
          {/* Concepto picker */}
          {conceptoOptions.length > 0 && (
            <div>
              <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Seleccionar del catalogo</label>
              <SearchableSelect value="" onChange={handleSelectConcepto} options={[{ value: '', label: 'Carga manual...' }, ...conceptoOptions]} placeholder="Buscar concepto..." />
            </div>
          )}
          {/* Equipo selector — solo contrato */}
          {showEquipoPanel && (
            <EquipoLinkPanel
              newItem={newItem}
              setNewItem={setNewItem}
              sistemas={sistemas!}
              loadModulos={loadModulos!}
            />
          )}
          {/* Article picker — partes/mixto/ventas */}
          {showArticuloPicker && (
            <ArticuloPickerPanel
              articulos={articulos!}
              articuloSeleccionadoId={newItem.stockArticuloId || null}
              onSelect={handleSelectArticulo}
            />
          )}

          <div>
            <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Código artículo</label>
            <input value={newItem.codigoProducto || ''} onChange={(e) => setNewItem({ ...newItem, codigoProducto: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs" placeholder="Ej: G1312-60067" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Descripcion *</label>
            <textarea value={newItem.descripcion} onChange={(e) => setNewItem({ ...newItem, descripcion: e.target.value })}
              rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs" placeholder="Descripcion del item..." />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Cantidad *</label>
              <input type="number" min="0" step="0.01" value={newItem.cantidad || ''} onChange={(e) => setNewItem({ ...newItem, cantidad: Number(e.target.value) || 0 })}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Unidad</label>
              <input value={newItem.unidad || 'unidad'} onChange={(e) => setNewItem({ ...newItem, unidad: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Precio unit. *</label>
              <input type="number" min="0" step="0.01" value={newItem.precioUnitario || ''} onChange={(e) => setNewItem({ ...newItem, precioUnitario: Number(e.target.value) || 0 })}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Dto %</label>
              <input type="number" min="0" max="100" step="0.5" value={newItem.descuento || ''} onChange={(e) => setNewItem({ ...newItem, descuento: Number(e.target.value) || 0 })}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs" placeholder="0" />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Categoria (reglas tributarias)</label>
            <SearchableSelect value={newItem.categoriaPresupuestoId || ''} onChange={(v) => setNewItem({ ...newItem, categoriaPresupuestoId: v || undefined })}
              options={categoriaOptions(categoriasPresupuesto)} placeholder="Seleccionar categoria..." />
            <button type="button" onClick={handleManageCategorias} className="text-[11px] text-teal-600 hover:underline mt-0.5 inline-block text-left">Gestionar categorias →</button>
            {newItem.categoriaPresupuestoId && categoria && (
              <TaxPreview categoria={categoria} subtotal={subtotal} sym={sym} />
            )}
          </div>
          {newItem.cantidad && newItem.precioUnitario && !newItem.categoriaPresupuestoId && (
            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="text-xs font-semibold text-slate-700">Subtotal: {sym} {subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Seleccione una categoria para ver impuestos</p>
            </div>
          )}
          {/* Phase 16 — campos de entrega (disponibilidad + ETA) */}
          <div className="border-t border-slate-200 pt-3">
            <PresupuestoDisponibilidadFields
              disponibilidad={(newItem.disponibilidad as Disponibilidad | null | undefined) ?? null}
              etaDiasEstimados={newItem.etaDiasEstimados ?? null}
              onChange={(next) => {
                setNewItem({ ...newItem, disponibilidad: next.disponibilidad, etaDiasEstimados: next.etaDiasEstimados });
                setDisponibilidadTouched(true);
              }}
              variant="modal"
              atpHint={atpHint}
            />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={onAdd}>Agregar</Button>
        </div>
      </Card>
    </div>
  );
};
