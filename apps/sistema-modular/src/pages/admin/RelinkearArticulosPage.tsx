import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useRelinkearArticulos } from './useRelinkearArticulos';
import type { ScannedItem } from './useRelinkearArticulos';

function ItemRow({ item, onToggle, onSelect }: {
  item: ScannedItem;
  onToggle: (id: string, v: boolean) => void;
  onSelect: (id: string, candidateId: string) => void;
}) {
  const candidate = item.candidates.find(c => c.id === item.selectedCandidateId);
  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
      <td className="px-3 py-2 text-[11px] font-mono text-slate-500 whitespace-nowrap">{item.presupuestoNumero}</td>
      <td className="px-3 py-2 text-xs text-slate-700 max-w-[200px] truncate" title={item.descripcion}>{item.descripcion}</td>
      <td className="px-3 py-2 text-[11px] font-mono text-slate-500 whitespace-nowrap">{item.codigoProducto}</td>
      <td className="px-3 py-2 text-xs text-slate-700">
        {item.status === 'matched' && candidate && (
          <span className="font-mono text-teal-700">{candidate.codigo} — {candidate.descripcion}</span>
        )}
        {item.status === 'ambiguous' && (
          <select
            value={item.selectedCandidateId ?? ''}
            onChange={e => onSelect(item.itemId, e.target.value)}
            className="border border-slate-200 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal-700 max-w-[240px]"
          >
            <option value="">— Elegir —</option>
            {item.candidates.map(c => (
              <option key={c.id} value={c.id}>{c.codigo} — {c.descripcion}</option>
            ))}
          </select>
        )}
        {item.status === 'no_match' && <span className="text-slate-400 italic">Sin coincidencia</span>}
      </td>
      <td className="px-3 py-2 text-center">
        {(item.status === 'matched' || item.status === 'ambiguous') && (
          <input
            type="checkbox"
            checked={item.apply}
            disabled={item.status === 'ambiguous' && !item.selectedCandidateId}
            onChange={e => onToggle(item.itemId, e.target.checked)}
            className="rounded border-slate-300 text-teal-700 focus:ring-teal-700"
          />
        )}
      </td>
    </tr>
  );
}

const TH = 'px-3 py-2 text-left text-[10px] font-mono uppercase tracking-wide text-slate-500';

function ResultTable({ items, label, labelColor, onToggle, onSelect }: {
  items: ScannedItem[];
  label: string;
  labelColor: string;
  onToggle: (id: string, v: boolean) => void;
  onSelect: (id: string, candidateId: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <Card>
      <div className="px-4 py-2 border-b border-slate-100">
        <span className={`text-[10px] font-mono uppercase tracking-wide ${labelColor}`}>{label} ({items.length})</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className={TH}>Ppto</th>
              <th className={TH}>Descripción</th>
              <th className={TH}>Código</th>
              <th className={TH}>Artículo candidato</th>
              <th className="px-3 py-2 text-center text-[10px] font-mono uppercase tracking-wide text-slate-500">Aplicar</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <ItemRow key={`${item.presupuestoId}-${item.itemId}`} item={item} onToggle={onToggle} onSelect={onSelect} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function RelinkearArticulosPage() {
  const {
    scanning, applying, items, counts, applyResult, applyProgress,
    selectedCount, scan, toggleApply, selectCandidate, applySelected,
  } = useRelinkearArticulos();

  const matched = items?.filter(i => i.status === 'matched') ?? [];
  const ambiguous = items?.filter(i => i.status === 'ambiguous') ?? [];
  const noMatch = items?.filter(i => i.status === 'no_match') ?? [];

  return (
    <div className="-m-6 h-[calc(100%+3rem)] flex flex-col bg-slate-50">
      <div className="shrink-0 bg-white border-b border-slate-200 px-5 pt-4 pb-4">
        <h1 className="text-xl font-serif text-slate-900 tracking-tight">Re-linkear artículos de stock</h1>
        <p className="text-[11px] text-slate-500 mt-0.5 max-w-2xl">
          Herramienta de remediación: escanea items de presupuesto sin{' '}
          <code className="font-mono">stockArticuloId</code> y los empareja con el catálogo por{' '}
          <code className="font-mono">codigoProducto</code>. El escaneo es de solo lectura; la escritura requiere confirmar "Aplicar".
        </p>
        <div className="mt-3">
          <Button onClick={scan} disabled={scanning || applying} size="sm">
            {scanning ? 'Escaneando...' : 'Escanear presupuestos'}
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
        {counts && (
          <div className="flex flex-wrap gap-3">
            {[
              { label: 'Total', value: counts.total, color: 'border-slate-200 text-slate-700' },
              { label: 'Linkeables', value: counts.linkeable, color: 'border-teal-200 text-teal-800 bg-teal-50' },
              { label: 'Ambiguos', value: counts.ambiguous, color: 'border-amber-200 text-amber-800 bg-amber-50' },
              { label: 'Sin match', value: counts.noMatch, color: 'border-slate-200 text-slate-500' },
              { label: 'Ya linkeados', value: counts.alreadyLinked, color: 'border-slate-200 text-slate-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className={`flex flex-col items-center px-4 py-2 rounded-lg border ${color}`}>
                <span className="text-lg font-semibold">{value}</span>
                <span className="text-[10px] font-mono uppercase tracking-wide">{label}</span>
              </div>
            ))}
          </div>
        )}

        {applyResult && (
          <div className={`rounded-lg border px-4 py-3 text-xs ${applyResult.errors.length > 0 ? 'bg-red-50 border-red-200 text-red-800' : 'bg-teal-50 border-teal-200 text-teal-800'}`}>
            <p className="font-mono">
              {applyResult.linked} items linkeados en {applyResult.presupuestosUpdated} presupuestos.
              {applyResult.errors.length > 0 && ` ${applyResult.errors.length} errores:`}
            </p>
            {applyResult.errors.map((e, i) => <p key={i} className="font-mono mt-1 text-red-700">{e}</p>)}
          </div>
        )}

        {applyProgress && <p className="text-[11px] font-mono text-slate-500">{applyProgress}</p>}

        {items && (
          <>
            {selectedCount > 0 && (
              <div className="flex items-center justify-between bg-teal-700 text-white rounded-lg px-4 py-2">
                <span className="text-xs font-mono">{selectedCount} items seleccionados para linkear</span>
                <Button variant="secondary" size="sm" onClick={applySelected} disabled={applying}>
                  {applying ? 'Aplicando...' : `Aplicar seleccionados (${selectedCount})`}
                </Button>
              </div>
            )}
            <ResultTable items={matched} label="Coincidencia exacta" labelColor="text-teal-700" onToggle={toggleApply} onSelect={selectCandidate} />
            <ResultTable items={ambiguous} label="Ambiguos — elegir manualmente" labelColor="text-amber-700" onToggle={toggleApply} onSelect={selectCandidate} />
            <ResultTable items={noMatch} label="Sin coincidencia" labelColor="text-slate-500" onToggle={toggleApply} onSelect={selectCandidate} />
            {items.length === 0 && (
              <Card>
                <div className="text-center py-10">
                  <p className="text-slate-400 text-xs">No se encontraron items pendientes de linkeo.</p>
                </div>
              </Card>
            )}
          </>
        )}

        {!items && !scanning && (
          <Card>
            <div className="text-center py-10">
              <p className="text-slate-400 text-xs">Presioná "Escanear presupuestos" para iniciar el análisis.</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
