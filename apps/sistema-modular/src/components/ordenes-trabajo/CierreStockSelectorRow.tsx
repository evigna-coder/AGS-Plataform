import type { Part, StockSelection } from '@ags/shared';
import type { PartStockInfo } from '../../hooks/useCierreStockUnits';
import { SearchableSelect } from '../ui/SearchableSelect';
import { aporteDeOpcion, buildOptions, patchFromOption, selectionResumen, selectionValue } from './cierreStockOptions';

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
          {necesarias > 1 && i < selections.length && (
            <span className="text-[10px] font-mono text-slate-400 w-6 text-right shrink-0">
              ×{selections[i].cantidad ?? 1}
            </span>
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
