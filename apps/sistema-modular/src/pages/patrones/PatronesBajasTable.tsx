/**
 * Pestaña "Historial de bajas" del listado de patrones: tabla plana con todos
 * los lotes dados de baja (vencidos / agotados / baja manual), más recientes
 * primero. Los certificados quedan consultables acá para siempre sin ensuciar
 * la vista de lotes activos.
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { MOTIVO_BAJA_LOTE_LABELS, type Patron, type PatronLoteBajaEntry } from '@ags/shared';

const thClass = 'px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';

const MOTIVO_CLS: Record<string, string> = {
  vencido: 'bg-red-100 text-red-800',
  agotado: 'bg-slate-200 text-slate-600',
  baja_manual: 'bg-amber-100 text-amber-800',
};

interface BajaRow {
  patron: Patron;
  entry: PatronLoteBajaEntry;
}

export function PatronesBajasTable({
  patrones, formatFechaAR,
}: { patrones: Patron[]; formatFechaAR: (iso: string | null | undefined) => string }) {
  const rows = useMemo<BajaRow[]>(() => {
    const all: BajaRow[] = [];
    for (const patron of patrones) {
      for (const entry of patron.lotesBaja ?? []) all.push({ patron, entry });
    }
    all.sort((a, b) => b.entry.fechaBaja.localeCompare(a.entry.fechaBaja));
    return all;
  }, [patrones]);

  if (rows.length === 0) {
    return (
      <Card>
        <div className="text-center py-12">
          <p className="text-slate-400">Sin lotes dados de baja</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto h-full">
      <table className="w-full">
        <thead className="sticky top-0 z-10">
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className={thClass}>Código artículo</th>
            <th className={thClass}>Descripción</th>
            <th className={thClass}>Lote</th>
            <th className={thClass}>Motivo</th>
            <th className={thClass}>Vencimiento</th>
            <th className={thClass}>Fecha baja</th>
            <th className={thClass}>Por</th>
            <th className={`${thClass} text-right`}>Cant.</th>
            <th className={`${thClass} text-center`}>Links</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(({ patron, entry }) => (
            <tr key={entry.id} className="hover:bg-slate-50 transition-colors" data-testid="patron-baja-row">
              <td className="px-3 py-2 text-xs font-semibold text-teal-600 font-mono whitespace-nowrap">
                <Link to={`/patrones/${patron.id}/editar`} className="hover:underline">
                  {patron.codigoArticulo || '—'}
                </Link>
              </td>
              <td className="px-3 py-2 text-xs text-slate-700 truncate max-w-[280px]" title={patron.descripcion}>
                {patron.descripcion || '—'}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                  {entry.lote.lote || '(vacío)'}
                </span>
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${MOTIVO_CLS[entry.motivo] ?? 'bg-slate-100 text-slate-500'}`}>
                  {MOTIVO_BAJA_LOTE_LABELS[entry.motivo] ?? entry.motivo}
                </span>
              </td>
              <td className="px-3 py-2 text-xs font-mono text-slate-600 whitespace-nowrap">
                {entry.lote.fechaVencimiento ? formatFechaAR(entry.lote.fechaVencimiento) : <span className="text-slate-300">—</span>}
              </td>
              <td className="px-3 py-2 text-xs font-mono text-slate-600 whitespace-nowrap">
                {formatFechaAR(entry.fechaBaja)}
              </td>
              <td className="px-3 py-2 text-xs text-slate-500 truncate max-w-[140px]" title={entry.bajaPorNombre ?? undefined}>
                {entry.bajaPorNombre || <span className="text-slate-300">—</span>}
              </td>
              <td className="px-3 py-2 text-xs font-mono text-slate-600 text-right whitespace-nowrap">
                {typeof entry.lote.cantidad === 'number' ? entry.lote.cantidad : <span className="text-slate-300">—</span>}
              </td>
              <td className="px-3 py-2 text-xs text-center whitespace-nowrap">
                <span className="flex items-center justify-center gap-3">
                  {entry.lote.certificadoUrl && (
                    <a href={entry.lote.certificadoUrl} target="_blank" rel="noopener noreferrer"
                      className="text-teal-600 hover:text-teal-800 hover:underline">
                      Certificado
                    </a>
                  )}
                  {entry.ticketId && (
                    <Link to={`/leads/${entry.ticketId}`} className="text-teal-600 hover:text-teal-800 hover:underline">
                      Ticket
                    </Link>
                  )}
                  {!entry.lote.certificadoUrl && !entry.ticketId && <span className="text-slate-300">—</span>}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
