import { Fragment, useRef, useState } from 'react';
import type { Disponibilidad, PresupuestoItem, CategoriaPresupuesto, ConceptoServicio, MonedaPresupuesto, TipoPresupuesto, Sistema } from '@ags/shared';
import { MONEDA_SIMBOLO } from '@ags/shared';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { RichTextEditor } from '../ui/RichTextEditor';
import { NotasTecnicasPlantillas } from './NotasTecnicasPlantillas';
import { PresupuestoAddItemWizard } from './PresupuestoAddItemWizard';
import { PresupuestoAddItemCompleto } from './PresupuestoAddItemCompleto';
import { PresupuestoItemRow } from './PresupuestoItemRow';
import { numerarItemsPresupuesto } from '../../utils/presupuestoItemNumero';
import { BulkAplicarDisponibilidadButton } from './BulkAplicarDisponibilidadButton';
import { GroupRows, TotalsFooter } from './PresupuestoItemsTableParts';
import type { GrupoSistema } from '../../hooks/usePresupuestoSistemas';
import { useScrollToNewItem } from '../../hooks/useScrollToNewItem';

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
  /** Tipo del presupuesto — filtra las notas técnicas estándar ofrecidas. */
  tipoPresupuesto?: TipoPresupuesto;
  onAddItem: (item: PresupuestoItem) => void;
  onUpdateItem: (itemId: string, field: keyof PresupuestoItem, value: any) => void;
  onRemoveItem: (itemId: string) => void;
  onNotasTecnicasChange: (v: string) => void;
  calculateItemTaxes: (item: PresupuestoItem) => { iva: number; ganancias: number; iibb: number; totalImpuestos: number };
  itemsByGrupo?: GrupoSistema[];
  getGrupo?: (sistemaId: string | null | undefined) => number;
  /** Sistemas del cliente (2026-08-27): habilita elegir el equipo por ítem — multi-sistema. */
  sistemas?: Sistema[];
  /** Fila extra a renderizar bajo cada item (Equipos: editor de sub-ítems). `index` es 1-based sobre `items`. */
  renderSubRow?: (item: PresupuestoItem, index: number) => React.ReactNode;
}

const TABLE_HEADER = (
  <tr className="bg-slate-50">
    <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 px-2 text-center w-10">Item</th>
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
  totals, notasTecnicas, tipoPresupuesto,
  onAddItem, onUpdateItem, onRemoveItem,
  onNotasTecnicasChange, calculateItemTaxes,
  itemsByGrupo, getGrupo, sistemas, renderSubRow,
}: PresupuestoItemsTableProps) => {
  const [showWizard, setShowWizard] = useState(false);
  // Loop de teclado: al confirmar el alta en el wizard con Enter, el foco vuelve a este
  // botón — Enter sobre el botón reabre el wizard y se encadena la carga sin mouse.
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const wizardAddedRef = useRef(false);
  const sym = MONEDA_SIMBOLO[moneda] || '$';
  const fmtMoney = (n: number) => `${sym} ${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  const hasGrupos = itemsByGrupo && itemsByGrupo.some(g => g.grupo > 0);
  // Multi-sistema (2026-08-27): prefill del selector de equipo cuando el ppto ya
  // tiene UN solo sistema vinculado; y número de grupo para sistemas nuevos.
  const gruposConSistema = (itemsByGrupo ?? []).filter(g => g.grupo > 0);
  const defaultSistemaId = gruposConSistema.length === 1 ? gruposConSistema[0].sistemaId : null;
  const grupoDe = (sistemaId: string | null | undefined): number | null => {
    if (!getGrupo) return null;
    if (!sistemaId) return getGrupo(null);
    const g = getGrupo(sistemaId);
    if (g > 0) return g;
    // Sistema que debuta en el ppto: siguiente número de grupo.
    return Math.max(0, ...gruposConSistema.map(g2 => g2.grupo)) + 1;
  };

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
      // Equipo del ítem (multi-sistema 2026-08-27): lo eligió el form de alta.
      sistemaId: p.sistemaId ?? null,
      sistemaNombre: p.sistemaNombre ?? null,
      sistemaCodigoInterno: p.sistemaCodigoInterno ?? null,
      moduloId: null, moduloNombre: null, moduloSerie: null, moduloMarca: null,
      servicioCode: null, subItem: null, esBonificacion: false,
      grupo: grupoDe(p.sistemaId),
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

  // Al agregar un item, la vista va sola hasta él (2026-08-09).
  const lastRowRef = useScrollToNewItem<HTMLTableRowElement>(items.length);
  const ultimoItemId = items[items.length - 1]?.id;

  // Se numera sobre TODOS los items, no sobre los de cada grupo por separado:
  // la etiqueta tiene que ser la misma que imprime el PDF.
  const { etiquetaPorItem } = numerarItemsPresupuesto(items);

  const renderRows = (rowItems: PresupuestoItem[]) =>
    rowItems.map(item => (
      <Fragment key={item.id}>
        <PresupuestoItemRow item={item} numero={etiquetaPorItem.get(item.id)} categoriasPresupuesto={categoriasPresupuesto}
          rowRef={item.id === ultimoItemId ? lastRowRef : undefined}
          fmtMoney={fmtMoney} taxes={calculateItemTaxes(item)} onUpdateItem={onUpdateItem} onRemoveItem={onRemoveItem} />
        {renderSubRow?.(item, items.findIndex(i => i.id === item.id) + 1)}
      </Fragment>
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
            <Button ref={addBtnRef} onClick={openAdd} size="sm" variant="outline">⚡ Carga rápida</Button>
          </div>
        </div>

        {/* Carga completa SIEMPRE desplegada (decisión 2026-07-30): el form con todos
            los campos es el modo por defecto; el wizard queda como carga rápida. */}
        <div className="mb-3">
          <PresupuestoAddItemCompleto
            inline
            conceptosServicio={conceptosServicio}
            categoriasPresupuesto={categoriasPresupuesto}
            moneda={moneda}
            onAdd={addFromWizard}
            sistemas={sistemas}
            defaultSistemaId={defaultSistemaId}
          />
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

      {/* RichTextEditor (no textarea): el contenido es HTML del editor — un textarea
          mostraba los tags crudos y no daba herramientas de formato (UAT 2026-07-29). */}
      <Card compact>
        <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-2">Notas tecnicas</h3>
        {/* Notas estandarizadas: se agregan al final del texto, no lo reemplazan. */}
        <NotasTecnicasPlantillas tipo={tipoPresupuesto} value={notasTecnicas} onChange={onNotasTecnicasChange} />
        <RichTextEditor value={notasTecnicas} onChange={onNotasTecnicasChange}
          placeholder="Notas tecnicas, observaciones..." minHeight={100} />
      </Card>

      {/* Condiciones comerciales: SIN card propia (2026-08-05) — el mismo campo ya
          se edita en la sección colapsable "Condiciones del presupuesto" (con
          plantillas); acá estaba duplicado y comía media pantalla. */}

      {showWizard && (
        <PresupuestoAddItemWizard
          conceptosServicio={conceptosServicio}
          categoriasPresupuesto={categoriasPresupuesto}
          moneda={moneda}
          onAdd={addFromWizard}
          onClose={closeWizard}
          sistemas={sistemas}
          defaultSistemaId={defaultSistemaId}
        />
      )}
    </div>
  );
};

