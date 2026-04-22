import type { StockAmplio } from '@ags/shared';

interface Props {
  stockAmplio: StockAmplio | null;
  loading?: boolean;
  size?: 'sm' | 'md';
  source?: 'firestore' | 'computed' | null;
  onShowBreakdown?: () => void;
}

/**
 * Compact 4-bucket stock position display: Disp | Tráns | Reserv | Comprom | ATP neto.
 * ATP < 0 renders red + tooltip. source='computed' shows ~ indicator (CF fallback path).
 * Reusable across PlanificacionStockPage, reserva modal, AddItemModal.
 */
export function StockAmplioIndicator({
  stockAmplio,
  loading,
  size = 'md',
  source,
  onShowBreakdown,
}: Props) {
  if (loading) {
    return <span className="text-[10px] text-slate-400">Cargando...</span>;
  }
  if (!stockAmplio) {
    return <span className="text-[10px] text-slate-300">—</span>;
  }

  const { disponible, enTransito, reservado, comprometido } = stockAmplio;
  const atpNeto = disponible + enTransito - reservado - comprometido;
  const numClass = size === 'sm' ? 'text-xs' : 'text-sm';
  const atpClass = atpNeto < 0 ? 'text-red-600 font-semibold' : 'text-slate-900';

  return (
    <div className="flex items-center gap-3">
      <Cell label="DISP" value={disponible} className={numClass} />
      <Cell label="TRANS" value={enTransito} className={numClass} />
      <Cell label="RESERV" value={reservado} className={numClass} />
      <Cell label="COMPROM" value={comprometido} className={numClass} />
      <div
        className={`pl-3 border-l border-slate-200 ${atpClass} ${numClass}`}
        title={atpNeto < 0 ? 'ATP negativo — requiere importación, crear requerimiento' : 'ATP neto'}
      >
        ATP: {atpNeto}
      </div>
      {source === 'computed' && (
        <span
          className="text-[10px] text-slate-400 italic"
          title="Calculado en cliente — esperando sync server-side"
        >
          ~
        </span>
      )}
      {onShowBreakdown && (
        <button
          type="button"
          onClick={onShowBreakdown}
          className="text-[10px] font-medium text-teal-700 hover:text-teal-900 px-1.5 py-0.5 rounded hover:bg-teal-50"
        >
          Ver detalle
        </button>
      )}
    </div>
  );
}

function Cell({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[9px] font-mono uppercase tracking-wide text-slate-400">{label}</span>
      <span className={className}>{value}</span>
    </div>
  );
}
