/**
 * Row subcomponent para AccionesPendientesPage — extraído para respetar el
 * budget de 250 líneas del parent.
 *
 * Presentacional puro: el padre maneja el state global + los services.
 */
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import type { PendingAction } from '@ags/shared';

export type AccionPendienteRow = {
  presupuestoId: string;
  presupuestoNumero: string;
  clienteId: string;
  action: PendingAction;
};

export const TYPE_LABELS: Record<PendingAction['type'], string> = {
  crear_ticket_seguimiento: 'Crear ticket seguimiento',
  derivar_comex: 'Derivar a Comex',
  enviar_mail_facturacion: 'Enviar mail facturación',
  notificar_coordinador_ot: 'Notificar coordinador OT',
};

const TYPE_BADGE: Record<PendingAction['type'], string> = {
  crear_ticket_seguimiento: 'bg-teal-50 text-teal-800 border-teal-200',
  derivar_comex: 'bg-amber-50 text-amber-800 border-amber-200',
  enviar_mail_facturacion: 'bg-orange-50 text-orange-800 border-orange-200',
  notificar_coordinador_ot: 'bg-indigo-50 text-indigo-800 border-indigo-200',
};

export function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = ms / 86_400_000;
  if (days < 1) return 'hoy';
  if (days < 7) return `hace ${Math.floor(days)}d`;
  if (days < 30) return `hace ${Math.floor(days / 7)}sem`;
  return `hace ${Math.floor(days / 30)}m`;
}

export function matchesAntiguedad(createdAt: string, filter: string): boolean {
  if (!filter) return true;
  const days = (Date.now() - new Date(createdAt).getTime()) / 86_400_000;
  if (filter === 'nuevo') return days < 1;
  if (filter === 'mediana') return days >= 1 && days <= 7;
  if (filter === 'vieja') return days > 7;
  return true;
}

interface Props {
  row: AccionPendienteRow;
  actingId: string | null;
  onRetry: (row: AccionPendienteRow) => void;
  onResolve: (row: AccionPendienteRow) => void;
}

export function AccionesPendientesRow({ row, actingId, onRetry, onResolve }: Props) {
  const isActing = actingId === row.action.id;
  const label = TYPE_LABELS[row.action.type] || row.action.type;
  const badge = TYPE_BADGE[row.action.type] || 'bg-slate-50 text-slate-700 border-slate-200';
  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
      <td className="px-4 py-2.5">
        <span className={`inline-block px-2 py-0.5 rounded border text-[11px] font-medium ${badge}`}>
          {label}
        </span>
      </td>
      <td className="px-4 py-2.5">
        <Link to={`/presupuestos/${row.presupuestoId}`} className="text-teal-700 hover:underline font-medium">
          {row.presupuestoNumero}
        </Link>
      </td>
      <td className="px-4 py-2.5 text-slate-700">{row.clienteId || '—'}</td>
      <td className="px-4 py-2.5 text-slate-700 max-w-xs truncate" title={row.action.reason}>{row.action.reason}</td>
      <td className="px-4 py-2.5 text-slate-600 text-[12px]">{relativeTime(row.action.createdAt)}</td>
      <td className="px-4 py-2.5 text-center text-slate-600">{row.action.attempts || 0}</td>
      <td className="px-4 py-2.5 text-right">
        <div className="inline-flex gap-1.5">
          <Button variant="secondary" size="sm" onClick={() => onRetry(row)} disabled={isActing}>
            {isActing ? '…' : 'Reintentar'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onResolve(row)} disabled={isActing}>
            Marcar resuelta
          </Button>
        </div>
      </td>
    </tr>
  );
}
