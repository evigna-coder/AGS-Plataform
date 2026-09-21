import { useState } from 'react';
import type { Part, StockSelection } from '@ags/shared';
import type { PartStockInfo } from '../../hooks/useCierreStockUnits';
import { SearchableSelect } from '../ui/SearchableSelect';
import { aporteDeOpcion, disponibleDeOpcion, buildOptions, opcionDeSeleccion, seleccionesDeOpcion, selectionResumen, selectionValue } from './cierreStockOptions';
import { agruparSelecciones } from '../../utils/cierreOrigenAgrupado';
import { parseDecimal } from '../../utils/parseDecimal';

interface Props {
  part: Part;
  stock: PartStockInfo;
  /** Selecciones de ESTA parte, en orden. Una por origen elegido. */
  selections: StockSelection[];
  /** Devuelve la lista completa de selecciones de esta parte tras el cambio. */
  onChange: (next: StockSelection[]) => void;
  disabled?: boolean;
  /** Reversión por línea de una selección ya descontada (2026-09-10). Sin esto la línea se muestra bloqueada. */
  onRevertir?: (sel: StockSelection) => void;
}

const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });

/**
 * Línea ya DESCONTADA del stock: no se edita ni se re-elige; se muestra qué
 * salió y cuándo, y se ofrece revertirla (contra-asiento) si el caller lo
 * permite. Las líneas legacy (cierre viejo sin asientos) no se revierten acá.
 */
const LineaDescontada = ({ sel, onRevertir }: { sel: StockSelection; onRevertir?: (s: StockSelection) => void }) => (
  <div className="flex items-center gap-1.5 text-[11px]">
    <span className="flex-1 min-w-0 truncate text-slate-600">{selectionResumen(sel)}</span>
    <span className="font-mono text-slate-500">×{sel.cantidadDeducida ?? sel.cantidad ?? 1}</span>
    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 whitespace-nowrap"
      title={sel.deducidoLegacy ? 'Descontado en un cierre anterior al registro por línea' : `Descontado el ${new Date(sel.deducidoAt!).toLocaleString('es-AR')}`}>
      Descontado {sel.deducidoAt ? fechaCorta(sel.deducidoAt) : ''}
    </span>
    {onRevertir && !sel.deducidoLegacy && (sel.movimientoIds?.length ?? 0) > 0 && (
      <button type="button" onClick={() => onRevertir(sel)}
        className="text-[10px] font-medium text-amber-700 hover:underline whitespace-nowrap"
        title="Genera el contra-asiento, repone la unidad y quita esta línea del cierre">
        Revertir
      </button>
    )}
  </div>
);

/**
 * Una fila del cuadro de origen de materiales. Un material puede necesitar VARIOS
 * orígenes (2026-08-25): 3 u. de un artículo serializado son 3 unidades distintas,
 * y antes el selector solo dejaba elegir una — había que cargar el artículo tres
 * veces. Ahora se muestra un selector por origen elegido más uno vacío mientras
 * falte cubrir cantidad, y las unidades ya tomadas no se vuelven a ofrecer.
 *
 * Origen agrupado (2026-09-21): dos unidades del mismo remito son dos líneas
 * del remito y dos selecciones guardadas, pero acá son UNA fila con ×2. Al
 * elegir o cambiar la cantidad se reparte entre las líneas reales.
 */
export const CierreStockSelectorRow: React.FC<Props> = ({ part, stock, selections, onChange, disabled, onRevertir }) => {
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

  // Filas visibles: las selecciones de un mismo origen agrupado van juntas.
  const filas = agruparSelecciones(selections, s => opcionDeSeleccion(s, options)?.value ?? selectionValue(s));
  const opcionDe = (f: number) => (filas[f] ? options.find(o => o.value === filas[f].value) : undefined);

  /** Tope de una fila: lo que tiene su origen. */
  const maxDe = (f: number): number => {
    const opt = opcionDe(f);
    return opt ? disponibleDeOpcion(opt) : Infinity;
  };

  /** Reemplaza las selecciones de la fila `f` por `nuevas`, en su lugar (o las agrega si la fila es nueva). */
  const reemplazar = (f: number, nuevas: StockSelection[]) => {
    const fila = filas[f];
    if (!fila) { onChange([...selections, ...nuevas]); return; }
    const quitar = new Set(fila.indices);
    const next = selections.filter((_, i) => !quitar.has(i));
    next.splice(fila.indices[0], 0, ...nuevas);
    onChange(next);
  };

  const setCantidad = (f: number, cantidad: number) => {
    const fila = filas[f];
    if (!fila) return;
    const opt = opcionDe(f);
    if (opt) { reemplazar(f, seleccionesDeOpcion(opt, stock, cantidad, base)); return; }
    // Selección sin opción vigente (stock que cambió): se edita tal cual.
    const next = [...selections];
    next[fila.indices[0]] = { ...next[fila.indices[0]], cantidad };
    onChange(next);
  };

  /** Reemplaza (o borra, con value vacío) el origen de la fila `f`. */
  const setOrigen = (f: number, value: string) => {
    if (!value) { reemplazar(f, []); return; }
    const opt = options.find(o => o.value === value);
    if (!opt) return;
    // El aporte se calcula sobre lo que falta SIN contar la fila que se reemplaza.
    const otras = filas.reduce((acc, fila, i) => (i === f ? acc : acc + fila.cantidad), 0);
    reemplazar(f, seleccionesDeOpcion(opt, stock, aporteDeOpcion(opt, necesarias - otras), base));
  };

  if (disabled) {
    return (
      <span className="text-[11px] text-slate-600">
        {selections.length === 0 ? '—' : selections.map((sel, i) => (
          <span key={i} className="block">
            {selectionResumen(sel)}
            {necesarias > 1 && <span className="text-slate-400"> ×{sel.cantidad ?? 1}</span>}
            {sel.deducidoAt && <span className="ml-1.5 text-[10px] text-green-700">descontado {fechaCorta(sel.deducidoAt)}</span>}
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

  /** Opciones ofrecidas en la fila `f`: sin las ya tomadas por las otras filas. */
  const opcionesPara = (f: number) => {
    const tomadas = new Set(filas.filter((_, i) => i !== f).map(fila => fila.value));
    const libre = (o: { value: string }) => !tomadas.has(o.value);
    // Aplanadas para el SearchableSelect (no soporta optgroups): el grupo
    // Patrón/Remito/Stock queda en subLabel. "Quitar origen" solo si esta fila
    // ya tiene algo elegido — cuando está vacía manda el placeholder.
    return [
      ...(f < filas.length ? [{ value: '', label: '— Quitar origen —' }] : []),
      ...patronGroup.filter(libre).map(o => ({ value: o.value, label: o.label, subLabel: o.sub ? `Patrón (activo) · ${o.sub}` : 'Patrón (activo)' })),
      ...remitoGroup.filter(libre).map(o => ({ value: o.value, label: o.label, subLabel: o.sub ? `En campo (remito) · ${o.sub}` : 'En campo (remito)' })),
      ...asignacionGroup.filter(libre).map(o => ({ value: o.value, label: o.label, subLabel: o.sub ? `En campo (asignación) · ${o.sub}` : 'En campo (asignación)' })),
      ...stockGroup.filter(libre).map(o => ({ value: o.value, label: o.label, subLabel: o.sub ? `Stock · ${o.sub}` : 'Stock' })),
    ];
  };

  // Un selector por origen ya elegido, más uno vacío mientras falte cubrir y
  // queden opciones libres para ofrecer.
  const visibles = filas.map((_, i) => i);
  const hayLibres = opcionesPara(filas.length).some(o => o.value !== '');
  if (pendiente > 0 && hayLibres) visibles.push(filas.length);

  return (
    <div className="space-y-1">
      {visibles.map(i => (
        i < filas.length && filas[i].deducida
          ? <LineaDescontada key={i} sel={selections[filas[i].indices[0]]} onRevertir={onRevertir} />
          : <div key={i} className="flex items-center gap-1.5">
          <div className="flex-1 min-w-0">
            <SearchableSelect
              value={i < filas.length ? filas[i].value : ''}
              onChange={v => setOrigen(i, v)}
              options={opcionesPara(i)}
              placeholder={i === 0 ? 'Buscar origen…' : 'Agregar otro origen…'}
              size="sm"
            />
          </div>
          {i < filas.length && (
            // Cantidad editable, con decimales (2026-09-03): antes era una
            // etiqueta fija calculada al elegir el origen, asi que no se podia
            // consumir 0,5 ni corregir cuanto se toma de cada origen.
            <input
              type="text" inputMode="decimal"
              value={cantStr[i] ?? String(filas[i].cantidad)}
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
