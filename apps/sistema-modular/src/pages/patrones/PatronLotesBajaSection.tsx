/**
 * Historial de lotes dados de baja de un patrón (vencidos / agotados / baja
 * manual). Espejo del "Historial de certificados" de instrumentos: los lotes
 * no se borran, se archivan acá con su certificado consultable para siempre.
 */
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { MOTIVO_BAJA_LOTE_LABELS, type PatronLoteBajaEntry } from '@ags/shared';

const MOTIVO_CLS: Record<string, string> = {
  vencido: 'bg-red-100 text-red-800',
  agotado: 'bg-slate-200 text-slate-600',
  baja_manual: 'bg-amber-100 text-amber-800',
};

function fechaAR(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

export function PatronLotesBajaSection({ entries }: { entries: PatronLoteBajaEntry[] }) {
  if (entries.length === 0) return null;
  // Más recientes primero
  const sorted = [...entries].sort((a, b) => b.fechaBaja.localeCompare(a.fechaBaja));
  return (
    <Card>
      <h2 className="text-sm font-semibold text-slate-700 mb-3">
        Historial de bajas
        <span className="ml-2 text-xs font-normal text-slate-500">({entries.length})</span>
      </h2>
      <div className="space-y-1.5">
        {sorted.map(e => (
          <div key={e.id} className="flex items-center gap-3 text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50 flex-wrap">
            <span className="font-mono px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
              {e.lote.lote}
            </span>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${MOTIVO_CLS[e.motivo] ?? 'bg-slate-100 text-slate-500'}`}>
              {MOTIVO_BAJA_LOTE_LABELS[e.motivo] ?? e.motivo}
            </span>
            <span className="text-slate-500">
              Vencía: <span className="font-mono text-slate-700">{fechaAR(e.lote.fechaVencimiento)}</span>
            </span>
            <span className="text-slate-500">
              Baja: <span className="font-mono text-slate-700">{fechaAR(e.fechaBaja)}</span>
              {e.bajaPorNombre ? <span className="text-slate-400"> · {e.bajaPorNombre}</span> : null}
            </span>
            {typeof e.lote.cantidad === 'number' && (
              <span className="text-slate-500">Cant: <span className="font-mono text-slate-700">{e.lote.cantidad}</span></span>
            )}
            <span className="ml-auto flex items-center gap-3">
              {e.ticketId && (
                <Link to={`/leads/${e.ticketId}`} className="text-teal-600 hover:text-teal-800 hover:underline">
                  Ticket descarte
                </Link>
              )}
              {e.lote.certificadoUrl && (
                <a href={e.lote.certificadoUrl} target="_blank" rel="noopener noreferrer"
                  className="text-teal-600 hover:text-teal-800 hover:underline">
                  Certificado
                </a>
              )}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
