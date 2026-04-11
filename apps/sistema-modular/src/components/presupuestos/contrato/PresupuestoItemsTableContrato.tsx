import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '../../ui/Button';
import type { PresupuestoItem, Sistema, ModuloSistema, MonedaPresupuesto } from '@ags/shared';
import { ContratoSistemaGroup } from './ContratoSistemaGroup';
import { AgregarSistemaContratoModal } from './AgregarSistemaContratoModal';
import { groupItemsForContrato, nextGrupoNumber, nextSubForGrupo, makeSubItem } from './contratoItemHelpers';
import { articulosService } from '../../../services/firebaseService';
import type { ArticuloMini } from './ArticuloInlineAutocomplete';

interface Props {
  items: PresupuestoItem[];
  moneda: MonedaPresupuesto;
  sistemas: Sistema[];
  loadModulos: (sistemaId: string) => Promise<ModuloSistema[]>;
  onAddItems: (items: PresupuestoItem[]) => void;
  onUpdateItem: (itemId: string, field: keyof PresupuestoItem, value: any) => void;
  onRemoveItem: (itemId: string) => void;
  onRemoveSistema: (sistemaId: string | null, grupo: number) => void;
}

/**
 * Items table for presupuestos de tipo 'contrato'. Replaces the standard
 * PresupuestoItemsTable when tipo === 'contrato'. Renders a hierarchical
 * Sector → Sistema → (components S/L + priced services) layout with inline
 * editing and per-sistema subtotals.
 */
export const PresupuestoItemsTableContrato: React.FC<Props> = ({
  items, moneda, sistemas, loadModulos,
  onAddItems, onUpdateItem, onRemoveItem, onRemoveSistema,
}) => {
  const [showAdd, setShowAdd] = useState(false);
  const [articulosCatalog, setArticulosCatalog] = useState<ArticuloMini[]>([]);
  const isMixta = moneda === 'MIXTA';

  // Load stock articles catalog once for inline N° de parte autocomplete
  useEffect(() => {
    articulosService.getAll({ activoOnly: true })
      .then(arts => setArticulosCatalog(arts.map(a => ({ id: a.id, codigo: a.codigo, descripcion: a.descripcion }))))
      .catch(() => setArticulosCatalog([]));
  }, []);

  /** Called from ContratoItemRow when user picks an article from the autocomplete.
   *  We need the itemId to know which row to update, so we build a closure per row. */
  const handlePickArticulo = (itemId: string, art: ArticuloMini) => {
    onUpdateItem(itemId, 'stockArticuloId', art.id);
    onUpdateItem(itemId, 'codigoProducto', art.codigo);
    onUpdateItem(itemId, 'descripcion', art.descripcion);
  };

  const grouped = useMemo(() => groupItemsForContrato(items), [items]);

  const sectoresUsados = useMemo(
    () => Array.from(new Set(items.map(i => i.sectorNombre).filter(Boolean) as string[])),
    [items],
  );

  // Global totals by currency
  const totalsByCurrency = useMemo(() => {
    const m: Record<string, number> = {};
    for (const item of items) {
      if (item.esSinCargo) continue;
      const cur = item.moneda || 'USD';
      m[cur] = (m[cur] || 0) + (item.subtotal || 0);
    }
    return m;
  }, [items]);

  const handleAddBonificacion = () => {
    const grupo = nextGrupoNumber(items);
    const bonif: PresupuestoItem = {
      id: crypto.randomUUID(),
      codigoProducto: 'BON_SP',
      descripcion: 'Bonificación',
      cantidad: 1,
      unidad: 'servicio',
      precioUnitario: 0,
      subtotal: 0,
      esBonificacion: true,
      grupo,
      subItem: `${grupo}.1`,
      sistemaNombre: 'Bonificaciones',
      sectorNombre: '',
    };
    onAddItems([bonif]);
  };

  /**
   * Agrega un ítem suelto (sin sistema) — típicamente capacitaciones,
   * viáticos u otros servicios que no están atados a un equipo.
   * Crea su propio grupo para que se renderice como bloque independiente.
   */
  const handleAddItemSuelto = () => {
    const grupo = nextGrupoNumber(items);
    const item: PresupuestoItem = {
      id: crypto.randomUUID(),
      codigoProducto: '',
      descripcion: 'Ítem adicional',
      cantidad: 1,
      unidad: 'servicio',
      precioUnitario: 0,
      subtotal: 0,
      grupo,
      subItem: `${grupo}.1`,
      sistemaNombre: 'Otros / Capacitaciones',
      sectorNombre: '',
    };
    onAddItems([item]);
  };

  /**
   * Agrega un ítem nuevo dentro de un sistema existente (con precio o S/L).
   * Hereda sector, sistemaId, sistemaNombre y sistemaCodigoInterno del bucket.
   */
  const handleAddItemToSistema = (grupo: number, esSinCargo: boolean) => {
    // Buscar un item del grupo para copiar el contexto del sistema
    const ref = items.find(i => (i.grupo || 0) === grupo);
    if (!ref) return;
    const sub = nextSubForGrupo(items, grupo);
    const nuevo: PresupuestoItem = {
      id: crypto.randomUUID(),
      codigoProducto: '',
      descripcion: esSinCargo ? 'Componente adicional' : 'Servicio adicional',
      cantidad: esSinCargo ? 0 : 1,
      unidad: 'servicio',
      precioUnitario: 0,
      subtotal: 0,
      esSinCargo,
      grupo,
      subItem: makeSubItem(grupo, sub),
      sistemaId: ref.sistemaId ?? null,
      sistemaCodigoInterno: ref.sistemaCodigoInterno ?? null,
      sistemaNombre: ref.sistemaNombre ?? null,
      sectorNombre: ref.sectorNombre ?? null,
    };
    onAddItems([nuevo]);
  };

  return (
    <div className="space-y-3">
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Items del contrato</h3>
          <p className="text-[11px] text-slate-400">Agrupados por sector y sistema. Los componentes S/L no suman al total.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleAddItemSuelto}>+ Ítem suelto</Button>
          <Button size="sm" variant="outline" onClick={handleAddBonificacion}>+ Bonificación</Button>
          <Button size="sm" onClick={() => setShowAdd(true)}>+ Agregar sistema</Button>
        </div>
      </div>

      {/* Empty state */}
      {grouped.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-lg py-12 text-center">
          <p className="text-sm text-slate-400 mb-3">Sin sistemas cargados al contrato.</p>
          <Button size="sm" onClick={() => setShowAdd(true)}>Agregar primer sistema</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(sectorBucket => (
            <div key={sectorBucket.sectorNombre || '__none__'}>
              {sectorBucket.sectorNombre && (
                <div className="mb-2">
                  <h4 className="text-[11px] font-mono uppercase tracking-wider text-teal-700 border-b border-teal-200 pb-1">
                    Sector: {sectorBucket.sectorNombre}
                  </h4>
                </div>
              )}
              {sectorBucket.sistemas.map(sistemaBucket => (
                <ContratoSistemaGroup
                  key={`${sectorBucket.sectorNombre}-${sistemaBucket.grupo}`}
                  bucket={sistemaBucket}
                  isMixta={isMixta}
                  articulosCatalog={articulosCatalog}
                  onUpdateItem={onUpdateItem}
                  onPickArticulo={handlePickArticulo}
                  onRemoveItem={onRemoveItem}
                  onRemoveSistema={onRemoveSistema}
                  onAddItem={handleAddItemToSistema}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Grand totals */}
      {items.length > 0 && (
        <div className="border-t border-slate-200 pt-3 mt-3">
          <div className="flex justify-end gap-6">
            {Object.entries(totalsByCurrency).map(([cur, tot]) => (
              <div key={cur} className="text-right">
                <div className="text-[10px] font-mono uppercase tracking-wide text-slate-400">Total {cur}</div>
                <div className="text-base font-semibold text-teal-700">
                  {cur} {tot.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <AgregarSistemaContratoModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        sistemas={sistemas}
        loadModulos={loadModulos}
        existingItems={items}
        sectoresUsados={sectoresUsados}
        onConfirm={onAddItems}
      />
    </div>
  );
};
