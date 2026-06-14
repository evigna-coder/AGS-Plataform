import type { GastoImportacion } from '@ags/shared';
import { CONCEPTOS_GASTO_IMPORTACION } from '@ags/shared';
import { MoneyInput } from '../ui/MoneyInput';

interface Props {
  gastos: GastoImportacion[];
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<GastoImportacion>) => void;
  onRemove: (id: string) => void;
}

const ctrl = 'w-full text-xs border border-slate-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500';
const conceptoLabel = (key: string) =>
  CONCEPTOS_GASTO_IMPORTACION.find(c => c.key === key)?.label ?? key;

/** Editor de gastos manuales de la importación (flete, seguro, despachante, etc.). */
export const ImportacionGastosEditor: React.FC<Props> = ({ gastos, onAdd, onUpdate, onRemove }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-mono uppercase tracking-wide text-slate-500">Gastos</span>
      <button type="button" onClick={onAdd} className="text-[11px] text-teal-600 hover:underline">+ Agregar gasto</button>
    </div>
    <div className="grid grid-cols-[1.3fr_1.6fr_90px_70px_24px] gap-1.5 items-center">
      <span className="text-[9px] font-mono uppercase tracking-wide text-slate-400">Concepto</span>
      <span className="text-[9px] font-mono uppercase tracking-wide text-slate-400">Detalle</span>
      <span className="text-[9px] font-mono uppercase tracking-wide text-slate-400 text-right">Monto</span>
      <span className="text-[9px] font-mono uppercase tracking-wide text-slate-400">Moneda</span>
      <span />
      {gastos.map(g => (
        <Row key={g.id} g={g} onUpdate={onUpdate} onRemove={onRemove} />
      ))}
    </div>
  </div>
);

function Row({ g, onUpdate, onRemove }: { g: GastoImportacion; onUpdate: Props['onUpdate']; onRemove: Props['onRemove'] }) {
  const isStd = CONCEPTOS_GASTO_IMPORTACION.some(c => c.key === g.concepto);
  return (
    <>
      {isStd ? (
        <span className="text-xs text-slate-700 truncate">{conceptoLabel(g.concepto)}</span>
      ) : (
        <input className={ctrl} value={g.concepto} placeholder="Concepto..."
          onChange={e => onUpdate(g.id, { concepto: e.target.value })} />
      )}
      <input className={ctrl} value={g.descripcion ?? ''} placeholder="Detalle / comprobante..."
        onChange={e => onUpdate(g.id, { descripcion: e.target.value })} />
      <MoneyInput value={g.monto} onChange={v => onUpdate(g.id, { monto: v ?? 0 })} className={ctrl + ' text-right'} />
      <select className={ctrl} value={g.moneda} onChange={e => onUpdate(g.id, { moneda: e.target.value as GastoImportacion['moneda'] })}>
        <option value="ARS">ARS</option>
        <option value="USD">USD</option>
        <option value="EUR">EUR</option>
      </select>
      <button type="button" onClick={() => onRemove(g.id)} className="text-red-400 hover:text-red-600 text-sm">&times;</button>
    </>
  );
}
