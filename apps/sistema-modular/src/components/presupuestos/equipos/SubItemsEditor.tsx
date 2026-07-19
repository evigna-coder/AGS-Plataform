import { useEffect, useState } from 'react';
import type { PresupuestoItem, PresupuestoSubItem } from '@ags/shared';
import { Button } from '../../ui/Button';
import { articulosService } from '../../../services/firebaseService';
import type { ArticuloMini } from '../contrato/ArticuloInlineAutocomplete';
import { SubItemEquipoRow } from './SubItemEquipoRow';
import { SubItemDetalleModal } from './SubItemDetalleModal';

interface Props {
  item: PresupuestoItem;
  /** Numeración del item padre en la lista (1-based) para mostrar N.1, N.2… */
  itemNumero: number;
  presupuestoId?: string | null;
  onChangeSubItems: (subs: PresupuestoSubItem[]) => void;
}

/** Sub-ítem nuevo: todos los opcionales en null explícito — nunca undefined (Firestore). */
function nuevoSubItem(): PresupuestoSubItem {
  return {
    id: crypto.randomUUID(),
    codigo: '',
    cantidad: 1,
    descripcion: '',
    precioUnitario: null,
    detalleLargo: null,
    fotos: null,
    stockArticuloId: null,
  };
}

// Catálogo de artículos compartido entre instancias del editor (se carga una vez).
let articulosCatalogCache: ArticuloMini[] | null = null;

/**
 * Editor de sub-ítems de un item de presupuesto tipo 'ventas' (Equipos).
 * Filas N.1, N.2… con código libre (+ autocomplete de stock), cantidad,
 * descripción corta y precio opcional. El botón "Detalle" abre el editor del
 * detalle largo + fotos para "Detalles de Configuración" del PDF.
 */
export const SubItemsEditor = ({ item, itemNumero, presupuestoId, onChangeSubItems }: Props) => {
  const [catalog, setCatalog] = useState<ArticuloMini[]>(articulosCatalogCache || []);
  const [detalleSubId, setDetalleSubId] = useState<string | null>(null);
  const subs = item.subItems || [];

  useEffect(() => {
    if (articulosCatalogCache) return;
    articulosService.getAll({ activoOnly: true })
      .then(arts => {
        articulosCatalogCache = arts.map(a => ({ id: a.id, codigo: a.codigo, descripcion: a.descripcion }));
        setCatalog(articulosCatalogCache);
      })
      .catch(() => setCatalog([]));
  }, []);

  const updateSub = (subId: string, patch: Partial<PresupuestoSubItem>) => {
    onChangeSubItems(subs.map(s => (s.id === subId ? { ...s, ...patch } : s)));
  };

  const moveSub = (subId: string, dir: -1 | 1) => {
    const idx = subs.findIndex(s => s.id === subId);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= subs.length) return;
    const next = [...subs];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChangeSubItems(next);
  };

  const detalleSub = detalleSubId ? subs.find(s => s.id === detalleSubId) : null;

  return (
    <div className="space-y-1.5">
      {subs.length > 0 && (
        <div className="grid grid-cols-[36px_150px_52px_1fr_92px_150px] gap-1.5 items-center">
          {['#', 'Código', 'Cant.', 'Descripción', 'Precio unit.', ''].map((h, i) => (
            <span key={i} className={`text-[9px] font-mono font-semibold text-slate-400 uppercase tracking-wider ${i === 2 ? 'text-center' : i === 4 ? 'text-right' : ''}`}>
              {h}
            </span>
          ))}
        </div>
      )}

      {subs.map((sub, i) => (
        <SubItemEquipoRow
          key={sub.id}
          sub={sub}
          numero={`${itemNumero}.${i + 1}`}
          articulosCatalog={catalog}
          isFirst={i === 0}
          isLast={i === subs.length - 1}
          onUpdate={(patch) => updateSub(sub.id, patch)}
          onMove={(dir) => moveSub(sub.id, dir)}
          onOpenDetalle={() => setDetalleSubId(sub.id)}
          onRemove={() => onChangeSubItems(subs.filter(s => s.id !== sub.id))}
        />
      ))}

      <div className="flex items-center gap-2 pt-0.5">
        <Button size="sm" variant="outline" onClick={() => onChangeSubItems([...subs, nuevoSubItem()])}>
          + Sub-ítem
        </Button>
        {subs.length === 0 && (
          <span className="text-[10px] text-slate-400">
            Componentes del sistema (van numerados {itemNumero}.1, {itemNumero}.2… bajo "Detalles:" en el PDF)
          </span>
        )}
      </div>

      {detalleSub && (
        <SubItemDetalleModal
          subItem={detalleSub}
          presupuestoId={presupuestoId}
          onSave={(patch) => updateSub(detalleSub.id, patch)}
          onClose={() => setDetalleSubId(null)}
        />
      )}
    </div>
  );
};
