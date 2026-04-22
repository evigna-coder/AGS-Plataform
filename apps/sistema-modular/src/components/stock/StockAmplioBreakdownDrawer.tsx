import type { StockAmplio, StockAmplioBreakdownEntry } from '@ags/shared';

interface Props {
  articuloCodigo: string;
  articuloDescripcion: string;
  stockAmplio: StockAmplio;
  open: boolean;
  onClose: () => void;
}

/**
 * Slide-over drawer showing the breakdown of the extended stock position.
 *
 * IMPORTANT: Renders exactly TWO sections — OCs pendientes + Requerimientos condicionales.
 * The `breakdown.reservas` field is OPTIONAL per @ags/shared StockAmplio type and is
 * explicitly deferred until a later phase (reservas tracking not yet implemented in
 * computeStockAmplioAdmin). Do NOT add a Reservas section until that phase lands.
 */
export function StockAmplioBreakdownDrawer({
  articuloCodigo,
  articuloDescripcion,
  stockAmplio,
  open,
  onClose,
}: Props) {
  if (!open) return null;

  const { breakdown } = stockAmplio;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/30 flex justify-end"
      onClick={onClose}
    >
      <aside
        className="w-[480px] h-full bg-white shadow-xl p-6 overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <header className="mb-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-semibold text-slate-900">{articuloCodigo}</h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1"
              title="Cerrar"
            >
              ✕
            </button>
          </div>
          <p className="text-xs text-slate-500 truncate">{articuloDescripcion}</p>
        </header>

        {/* Section 1: OCs abiertas */}
        <BreakdownSection
          title="OCs pendientes"
          entries={breakdown.ocsAbiertas}
          emptyMsg="No hay órdenes de compra abiertas para este artículo"
        />

        {/* Section 2: Requerimientos condicionales */}
        <BreakdownSection
          title="Requerimientos condicionales"
          entries={breakdown.requerimientosCondicionales}
          emptyMsg="No hay requerimientos condicionales activos"
        />

        {/*
          Reservas section is deliberately OMITTED.
          breakdown.reservas is optional in StockAmplio (see packages/shared/src/types/index.ts).
          It will be populated in a future phase when reservas tracking is wired server-side.
        */}

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded border border-slate-200 hover:bg-slate-50 text-slate-600"
          >
            Cerrar
          </button>
        </div>
      </aside>
    </div>
  );
}

function BreakdownSection({
  title,
  entries,
  emptyMsg,
}: {
  title: string;
  entries: StockAmplioBreakdownEntry[];
  emptyMsg: string;
}) {
  return (
    <section className="mb-6">
      <h3 className="text-[10px] font-mono uppercase tracking-wide text-slate-400 mb-2">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-xs text-slate-400 italic">{emptyMsg}</p>
      ) : (
        <ul className="space-y-1">
          {entries.map(e => (
            <li
              key={e.id}
              className="flex justify-between items-baseline text-xs border-b border-slate-100 py-1.5"
            >
              <span className="text-slate-600 truncate max-w-[320px]">
                {e.referencia ?? e.id}
              </span>
              <span className="font-mono text-slate-900 ml-2 shrink-0">{e.cantidad}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
