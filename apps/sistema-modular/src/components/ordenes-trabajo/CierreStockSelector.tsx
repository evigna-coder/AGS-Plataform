import { useState, useEffect } from 'react';
import type { Part, StockSelection, Ingeniero } from '@ags/shared';
import { ingenierosService } from '../../services/personalService';

interface Props {
  articulos: Part[];
  selections: StockSelection[];
  onChange: (selections: StockSelection[]) => void;
  disabled?: boolean;
}

export const CierreStockSelector: React.FC<Props> = ({ articulos, selections, onChange, disabled }) => {
  const [ingenieros, setIngenieros] = useState<Ingeniero[]>([]);

  useEffect(() => {
    ingenierosService.getAll(true).then(setIngenieros);
  }, []);

  const getSelection = (partId: string) => selections.find(s => s.partId === partId);

  const updateSelection = (part: Part, origenTipo: 'posicion' | 'ingeniero', origenId: string, origenNombre: string) => {
    const existing = selections.filter(s => s.partId !== part.id);
    const sel: StockSelection = {
      partId: part.id,
      partCodigo: part.codigo,
      partDescripcion: part.descripcion,
      cantidad: part.cantidad,
      origenTipo,
      origenId,
      origenNombre,
    };
    onChange([...existing, sel]);
  };

  const removeSelection = (partId: string) => {
    onChange(selections.filter(s => s.partId !== partId));
  };

  if (articulos.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Origen de materiales</p>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-white/60">
            <tr>
              <th className="text-[10px] font-medium text-slate-400 py-1.5 px-2 text-left">Material</th>
              <th className="text-[10px] font-medium text-slate-400 py-1.5 px-2 text-center w-12">Cant.</th>
              <th className="text-[10px] font-medium text-slate-400 py-1.5 px-2 text-left w-40">Origen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {articulos.map(part => {
              const sel = getSelection(part.id);
              return (
                <tr key={part.id} className="bg-white/40">
                  <td className="px-2 py-1.5">
                    <p className="text-xs text-slate-700">{part.descripcion}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{part.codigo || '—'}</p>
                  </td>
                  <td className="px-2 py-1.5 text-center text-xs text-slate-600">{part.cantidad}</td>
                  <td className="px-2 py-1.5">
                    {disabled ? (
                      sel ? <span className="text-[11px] text-slate-600">{sel.origenNombre}</span> : <span className="text-[11px] text-slate-400">—</span>
                    ) : (
                      <select
                        value={sel ? `${sel.origenTipo}:${sel.origenId}` : ''}
                        onChange={e => {
                          if (!e.target.value) { removeSelection(part.id); return; }
                          const [tipo, id] = e.target.value.split(':');
                          const nombre = tipo === 'ingeniero'
                            ? ingenieros.find(i => i.id === id)?.nombre || id
                            : `Posicion ${id}`;
                          updateSelection(part, tipo as 'posicion' | 'ingeniero', id, nombre);
                        }}
                        className="w-full border border-slate-200 rounded px-1.5 py-0.5 text-[11px]"
                      >
                        <option value="">Sin asignar</option>
                        <optgroup label="Ingeniero">
                          {ingenieros.map(ing => (
                            <option key={ing.id} value={`ingeniero:${ing.id}`}>{ing.nombre}</option>
                          ))}
                        </optgroup>
                      </select>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
