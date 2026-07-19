import type { PresupuestoItem } from '@ags/shared';
import type { GrupoSistema } from '../../hooks/usePresupuestoSistemas';

interface PresupuestoTotals {
  subtotal: number;
  iva: number;
  ganancias: number;
  iibb: number;
  totalImpuestos: number;
  total: number;
}

/** Header de grupo (sistema) + filas del grupo — extraído de PresupuestoItemsTable. */
export function GroupRows({ grupo, grupoSubtotal, renderRows, fmtMoney }: {
  grupo: GrupoSistema; grupoSubtotal: number;
  renderRows: (items: PresupuestoItem[]) => React.ReactNode;
  fmtMoney: (n: number) => string;
}) {
  return (
    <>
      <tr className="bg-teal-50/70">
        <td colSpan={9} className="px-3 py-1.5">
          <span className="text-[11px] font-semibold text-teal-800 tracking-wide">
            {grupo.grupo > 0 ? `${grupo.grupo}. ` : ''}{grupo.sistemaNombre}
          </span>
          <span className="text-[10px] text-teal-500 ml-2">
            ({grupo.items.length} items — {fmtMoney(grupoSubtotal)})
          </span>
        </td>
      </tr>
      {renderRows(grupo.items)}
    </>
  );
}

/** Footer de totales (subtotal / impuestos / total) — extraído de PresupuestoItemsTable. */
export function TotalsFooter({ totals, fmtMoney }: { totals: PresupuestoTotals; fmtMoney: (n: number) => string }) {
  return (
    <tfoot className="bg-slate-50 border-t border-slate-200">
      <tr>
        <td colSpan={6} className="px-3 py-2 text-center text-[11px] font-medium text-slate-400">Subtotal</td>
        <td className="px-2 py-2 text-center text-xs font-semibold text-slate-700">{fmtMoney(totals.subtotal)}</td>
        <td colSpan={2}></td>
      </tr>
      {totals.iva > 0 && (
        <tr>
          <td colSpan={6} className="px-3 py-1.5 text-center text-[11px] font-medium text-slate-400">IVA</td>
          <td className="px-2 py-1.5 text-center text-xs text-slate-600">{fmtMoney(totals.iva)}</td>
          <td colSpan={2}></td>
        </tr>
      )}
      {totals.ganancias > 0 && (
        <tr>
          <td colSpan={6} className="px-3 py-1.5 text-center text-[11px] font-medium text-slate-400">Ganancias</td>
          <td className="px-2 py-1.5 text-center text-xs text-slate-600">{fmtMoney(totals.ganancias)}</td>
          <td colSpan={2}></td>
        </tr>
      )}
      {totals.iibb > 0 && (
        <tr>
          <td colSpan={6} className="px-3 py-1.5 text-center text-[11px] font-medium text-slate-400">IIBB</td>
          <td className="px-2 py-1.5 text-center text-xs text-slate-600">{fmtMoney(totals.iibb)}</td>
          <td colSpan={2}></td>
        </tr>
      )}
      <tr className="bg-teal-50">
        <td colSpan={6} className="px-3 py-2 text-center text-xs font-semibold text-teal-900">Total</td>
        <td className="px-2 py-2 text-center text-sm font-semibold text-teal-700">{fmtMoney(totals.total)}</td>
        <td colSpan={2}></td>
      </tr>
    </tfoot>
  );
}
