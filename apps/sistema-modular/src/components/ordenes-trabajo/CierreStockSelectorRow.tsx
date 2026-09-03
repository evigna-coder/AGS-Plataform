import { useState } from 'react';
import type { Part, StockSelection } from '@ags/shared';
import type { PartStockInfo } from '../../hooks/useCierreStockUnits';
import { SearchableSelect } from '../ui/SearchableSelect';
import { aporteDeOpcion, disponibleDeOpcion, buildOptions, patchFromOption, selectionResumen, selectionValue } from './cierreStockOptions';
import { parseDecimal } from '../../utils/parseDecimal';

interface Props {
  part: Part;
  stock: PartStockInfo;
  /** Selecciones de ESTA parte, en orden. Una por origen elegido. */
  selections: StockSelection[];
  /** Devuelve la lista completa de selecciones de esta parte tras el cambio. */
  onChange: (next: StockSelection[]) => void;
  disabled?: boolean;
}

/**
 * Una fila del cuadro de origen de materiales. Un material puede necesitar VARIOS
 * orígenes (2026-08-25): 3 u. de un artículo serializado son 3 unidades distintas,
 * y antes el selector solo dejaba elegir una — había que cargar el artículo tres
 * veces. Ahora se muestra un selector por origen elegido más uno vacío mientras
 * falte cubrir cantidad, y las unidades ya tomadas no se vuelven a ofrecer.
 */
export const CierreStockSelectorRow: React.FC<Props> = ({ part, stock, selections, onChange, disabled }) => {
  const options = buildOptions(stock);
  // Cantidad a cubrir en unidades BASE: si la parte está expresada en un envase
  // (presentación), lo que se descuenta del stock es cantidad × factor.
  const factor = stock.presentacionFactor ?? 1;
  const necesarias = part.cantidad * factor;
  const cubiertas = selections.reduce((acc, s) => acc + (s.cantidad ?? 1), 0);
  const pendiente = Math.max(0, necesarias - cubiertas);

  const base = (cantidad: number): StockSelection => ({
    partId: part.id, partCodigo: part.codigo, partDescripcion: part.descripcion, cantidad,
    origenTipo: 'posicion', origenId: '', origenNombre: '',
  });

  // Texto crudo mientras se tipea (permite "0," sin que se pise a 0).
  const [cantStr, setCantStr] = useState<Record<number, string>>({});

  /** Tope de una fila: lo que tiene su origen. */
  const maxDe = (index: number): number => {
    const sel = selections[index];
    const opt = sel ? options.find(o => o.value === selectionValue(sel)) : undefined;
    return opt ? disponibleDeOpcion(opt) : Infinity;
  };

  const setCantidad = (index: number, cantidad: number) => {
    const next = [...selections];
    if (!next[index]) return;
    next[index] = { ...next[index], cantidad };
    onChange(next);
  };

  /** Reemplaza (o borra, con value vacío) el origen de la fila `index`. */
  const setOrigen = (index: number, value: string) => {
    const next = [...selections];
    if (!value) {
      next.splice(index, 1);
      onChange(next);
      return;
    }
    const opt = options.find(o => o.value === value);
    if (!opt) return;
    // El aporte se calcula sobre lo que falta SIN contar la fila que se reemplaza.
    const otras = selections.reduce((acc, s, i) => (i === index ? acc : acc + (s.cantidad ?? 1)), 0);
    const cantidad = aporteDeOpcion(opt, necesarias - otras);
    const sel = { ...base(cantidad), ...patchFromOption(opt, stock) };
    if (index >= next.length) next.push(sel); else next[index] = sel;
    onChange(next);
  };

  if (disabled) {
    return (
      <span className="text-[11px] text-slate-600">
        {selections.length === 0 ? '—' : selections.map((sel, i) => (
          <span key={i} className="block">
            {selectionResumen(sel)}
            {necesarias > 1 && <span className="text-slate-400"> ×{sel.cantidad ?? 1}</span>}
            {/* La OT cerrada sigue diciendo que el repuesto salió de un loaner. */}
            {sel.origenLoanerCodigo && (
              <span className="block text-[10px] text-amber-700">de {sel.origenLoanerCodigo}</span>
            )}
          </span>
        ))}
      </span>
    );
  }

  if (options.length === 0) return <span className="text-[11px] text-amber-600">Sin stock disponible</span>;

  const patronGroup = options.filter(o => o.kind === 'patron');
  const remitoGroup = options.filter(o => o.kind === 'remito');
  const asignacionGroup = options.filter(o => o.kind === 'asignacion');
  const stockGroup = options.filter(o => o.kind === 'unidad' || o.kind === 'posicion');

  /** Opciones ofrecidas en la fila `index`: sin las ya tomadas por las otras filas. */
  const opcionesPara = (index: number) => {
    const tomadas = new Set(selections.filter((_, i) => i !== index).map(selectionValue));
    const libre = (o: { value: string }) => !tomadas.has(o.value);
    // Aplanadas para el SearchableSelect (no soporta optgroups): el grupo
    // Patrón/Remito/Stock queda en subLabel. "Quitar origen" solo si esta fila
    // ya tiene algo elegido — cuando está vacía manda el placeholder.
    return [
      ...(index < selections.length ? [{ value: '', label: '— Quitar origen —' }] : []),
      ...patronGroup.filter(libre).map(o => ({ value: o.value, label: o.label, subLabel: o.sub ? `Patrón (activo) · ${o.sub}` : 'Patrón (activo)' })),
      ...remitoGroup.filter(libre).map(o => ({ value: o.value, label: o.label, subLabel: o.sub ? `En campo (remito) · ${o.sub}` : 'En campo (remito)' })),
      ...asignacionGroup.filter(libre).map(o => ({ value: o.value, label: o.label, subLabel: o.sub ? `En campo (asignación) · ${o.sub}` : 'En campo (asignación)' })),
      ...stockGroup.filter(libre).map(o => ({ value: o.value, label: o.label, subLabel: o.sub ? `Stock · ${o.sub}` : 'Stock' })),
    ];
  };

  // Un selector por origen ya elegido, más uno vacío mientras falte cubrir y
  // queden opciones libres para ofrecer.
  const filas = [...selections.map((_, i) => i)];
  const hayLibres = opcionesPara(selections.length).some(o => o.value !== '');
  if (pendiente > 0 && hayLibres) filas.push(selections.length);

  return (
    <div className="space-y-1">
      {filas.map(i => (
        <div key={i} className="flex items-center gap-1.5">
          <div className="flex-1 min-w-0">
            <SearchableSelect
              value={i < selections.length ? selectionValue(selections[i]) : ''}
              onChange={v => setOrigen(i, v)}
              options={opcionesPara(i)}
              placeholder={i === 0 ? 'Buscar origen…' : 'Agregar otro origen…'}
              size="sm"
            />
          </div>
          {i < selections.length && (
            // Cantidad editable, con decimales (2026-09-03): antes era una
            // etiqueta fija calculada al elegir el origen, asi que no se podia
            // consumir 0,5 ni corregir cuanto se toma de cada origen.
            <input
              type="text" inputMode="decimal"
              value={cantStr[i] ?? String(selections[i].cantidad ?? 1)}
              title={`Maximo desde este origen: ${maxDe(i)}`}
              onFocus={e => e.currentTarget.select()}
              onChange={e => {
                const v = e.target.value;
                if (!/^\d*[.,]?\d*$/.test(v)) return;
                setCantStr(prev => ({ ...prev, [i]: v }));
                const n = parseDecimal(v);
                if (n > 0) setCantidad(i, Math.min(n, maxDe(i)));
              }}
              onBlur={() => setCantStr(prev => { const c = { ...prev }; delete c[i]; return c; })}
              className="w-14 text-[11px] font-mono text-right border border-slate-200 rounded px-1 py-0.5 shrink-0"
            />
          )}
        </div>
      ))}
      {factor > 1 && (
        <p className="text-[10px] text-slate-400">
          {part.cantidad} × {part.codigo} = {necesarias} u. de {stock.presentacionBaseCodigo}
        </p>
      )}
      {necesarias > 1 && (
        <p className={`text-[10px] ${pendiente > 0 ? 'text-amber-600' : 'text-teal-700'}`}>
          {cubiertas} de {necesarias} cubiertas
          {pendiente > 0 && (hayLibres ? ` · falta${pendiente > 1 ? 'n' : ''} ${pendiente}` : ' · sin más stock para elegir')}
        </p>
      )}
    </div>
  );
};
