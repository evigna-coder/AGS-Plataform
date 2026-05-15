import { useEquivalenciaSection } from '../../hooks/useEquivalenciaSection';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';

interface Props {
  articuloId: string | null;
  onMutated?: () => void;
}

const lbl = "block text-[10px] font-mono font-medium text-slate-500 mb-0.5 uppercase tracking-wide";
const inputCls = "w-full border border-[#E5E5E5] rounded-md px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-700";
const section = "text-[9px] font-mono font-semibold text-teal-700/70 uppercase tracking-widest";

export function EquivalenciaSection({ articuloId, onMutated }: Props) {
  const h = useEquivalenciaSection({ articuloId, onMutated });

  return (
    <div className="space-y-2" data-testid="equivalencia-section">
      <p className={section}>Equivalencia (código de uso)</p>

      {h.currentEquivalencia ? (
        <div className="flex items-center justify-between rounded-md border border-teal-200 bg-teal-50/40 px-3 py-2">
          <div className="text-xs text-teal-900">
            <span className="font-mono">{h.currentEquivalencia.articuloCodigoDestino}</span>
            <span className="text-slate-500 mx-2">×</span>
            <span className="font-semibold">{h.currentEquivalencia.factor}</span>
            <span className="text-slate-400 ml-2">— {h.currentEquivalencia.articuloDescripcionDestino}</span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={h.unlink}
            disabled={h.unlinking}
          >
            {h.unlinking ? 'Desvinculando…' : 'Desvincular'}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-[2fr_1fr_auto] gap-2 items-end">
          <div>
            <label className={lbl}>Artículo destino (uso) *</label>
            <SearchableSelect
              options={h.articulosDestino.map(a => ({
                value: a.id,
                label: `${a.codigo} — ${a.descripcion}`,
              }))}
              value={h.selectedDestinoId}
              onChange={h.setSelectedDestinoId}
              placeholder={h.loadingArticulos ? 'Cargando…' : 'Seleccionar artículo…'}
              disabled={h.loadingArticulos}
            />
          </div>
          <div>
            <label className={lbl}>Factor *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              className={inputCls}
              value={h.factor}
              onChange={e => h.setFactor(e.target.value)}
              placeholder="10"
            />
          </div>
          <Button
            size="sm"
            onClick={h.link}
            disabled={h.linking || !h.selectedDestinoId || !h.factor}
          >
            {h.linking ? 'Vinculando…' : 'Vincular'}
          </Button>
        </div>
      )}

      {h.error && (
        <p className="text-rose-600 text-xs mt-1" data-testid="equivalencia-error">
          {h.error}
        </p>
      )}
    </div>
  );
}
