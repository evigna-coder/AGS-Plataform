import { useState } from 'react';
import type { ItemOC, ItemImportacion } from '@ags/shared';

interface SelectedItem {
  itemOCId: string;
  cantidadPedida: number;
}

interface Props {
  items: ItemOC[];
  onChange: (items: ItemImportacion[]) => void;
}

export const ItemEmbarqueSelector = ({ items, onChange }: Props) => {
  const [selected, setSelected] = useState<Record<string, SelectedItem>>({});

  const toggleItem = (item: ItemOC) => {
    setSelected(prev => {
      const next = { ...prev };
      if (next[item.id]) {
        delete next[item.id];
      } else {
        next[item.id] = { itemOCId: item.id, cantidadPedida: item.cantidad };
      }
      notify(next, items);
      return next;
    });
  };

  const updateQty = (itemId: string, qty: number) => {
    setSelected(prev => {
      const next = { ...prev, [itemId]: { ...prev[itemId], cantidadPedida: qty } };
      notify(next, items);
      return next;
    });
  };

  const notify = (sel: Record<string, SelectedItem>, ocItems: ItemOC[]) => {
    const mapped: ItemImportacion[] = Object.values(sel).map(s => {
      const oci = ocItems.find(i => i.id === s.itemOCId)!;
      return {
        id: crypto.randomUUID(),
        itemOCId: oci.id,
        articuloId: oci.articuloId ?? null,
        articuloCodigo: oci.articuloCodigo ?? null,
        descripcion: oci.descripcion,
        cantidadPedida: s.cantidadPedida,
        cantidadRecibida: null,
        unidadMedida: oci.unidadMedida ?? '',
        precioUnitario: oci.precioUnitario ?? null,
        moneda: oci.moneda ?? null,
        costoUnitarioConGastos: null,
        requerimientoId: oci.requerimientoId ?? null,
      };
    });
    onChange(mapped);
  };

  if (items.length === 0) {
    return <p className="text-xs text-slate-400">La OC no tiene items.</p>;
  }

  return (
    <div className="space-y-1">
      <p className="text-[11px] text-slate-400 mb-2">Selecciona los items que van en este embarque</p>
      <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
        {items.map(item => {
          const isChecked = !!selected[item.id];
          return (
            <div key={item.id} className="flex items-center gap-3 px-3 py-2 bg-white">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggleItem(item)}
                className="accent-teal-600 w-4 h-4 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-700 truncate">{item.descripcion}</p>
                {item.articuloCodigo && (
                  <p className="text-[10px] text-slate-400">{item.articuloCodigo}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <input
                  type="number"
                  min={1}
                  max={item.cantidad}
                  disabled={!isChecked}
                  value={isChecked ? (selected[item.id]?.cantidadPedida ?? item.cantidad) : item.cantidad}
                  onChange={e => updateQty(item.id, Math.min(item.cantidad, Math.max(1, Number(e.target.value))))}
                  className="w-20 text-xs border border-slate-300 rounded px-1.5 py-0.5 text-center disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
                <span className="text-[10px] text-slate-400">{item.unidadMedida}</span>
                <span className="text-[10px] text-slate-400">/ {item.cantidad}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
