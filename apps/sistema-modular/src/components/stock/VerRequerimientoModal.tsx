/**
 * Detalle de un requerimiento de compra (UAT 2026-07-16: el "Ver" de la lista
 * no hacía nada — no existe página de detalle). Muestra todos los campos y
 * linkea al presupuesto y a la OC vinculados.
 */
import { Link } from 'react-router-dom';
import type { RequerimientoCompra, UrgenciaRequerimiento } from '@ags/shared';
import { ESTADO_REQUERIMIENTO_COLORS, ESTADO_REQUERIMIENTO_LABELS, ORIGEN_REQUERIMIENTO_LABELS } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { URGENCIA_COLORS, URGENCIA_LABELS } from '../../pages/stock/RequerimientoRow';

interface Props {
  req: RequerimientoCompra | null;
  onClose: () => void;
}

const lbl = 'text-[10px] font-mono font-medium text-slate-400 uppercase tracking-wide';

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <p className={lbl}>{label}</p>
    <div className="text-xs text-slate-700 mt-0.5">{children ?? '—'}</div>
  </div>
);

const fmtFecha = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

export const VerRequerimientoModal: React.FC<Props> = ({ req, onClose }) => {
  if (!req) return null;
  return (
    <Modal open onClose={onClose} title={req.numero} maxWidth="md"
      subtitle={`${req.articuloCodigo ?? ''} — ${req.articuloDescripcion}`.trim()}
      footer={<Button variant="outline" size="sm" onClick={onClose}>Cerrar</Button>}>
      <div className="space-y-4 py-1">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_REQUERIMIENTO_COLORS[req.estado] ?? 'bg-slate-100 text-slate-500'}`}>
            {ESTADO_REQUERIMIENTO_LABELS[req.estado] ?? req.estado}
          </span>
          {req.urgencia && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${URGENCIA_COLORS[req.urgencia as UrgenciaRequerimiento]}`}>
              {URGENCIA_LABELS[req.urgencia as UrgenciaRequerimiento]}
            </span>
          )}
          {(req as { condicional?: boolean }).condicional && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700">Condicional</span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Cantidad">{req.cantidad} {req.unidadMedida}</Field>
          <Field label="Origen">{ORIGEN_REQUERIMIENTO_LABELS[req.origen] ?? req.origen}</Field>
          <Field label="Proveedor sugerido">{req.proveedorSugeridoNombre}</Field>
          <Field label="Solicitado por">{req.solicitadoPor}</Field>
          <Field label="Fecha solicitud">{fmtFecha(req.fechaSolicitud)}</Field>
          <Field label="Fecha aprobación">{fmtFecha(req.fechaAprobacion)}</Field>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
          <Field label="Presupuesto">
            {req.presupuestoId ? (
              <Link to={`/presupuestos/${req.presupuestoId}`} className="text-teal-700 hover:underline font-mono">
                {req.presupuestoNumero ?? req.presupuestoId}
              </Link>
            ) : '—'}
          </Field>
          <Field label="Orden de compra">
            {req.ordenCompraId ? (
              <Link to={`/stock/ordenes-compra/${req.ordenCompraId}`} className="text-teal-700 hover:underline font-mono">
                {req.ordenCompraNumero ?? req.ordenCompraId}
              </Link>
            ) : (req.ordenCompraNumero ?? '—')}
          </Field>
        </div>

        {(req.motivo || req.notas) && (
          <div className="space-y-2 border-t border-slate-100 pt-3">
            {req.motivo && <Field label="Motivo">{req.motivo}</Field>}
            {req.notas && <Field label="Notas">{req.notas}</Field>}
          </div>
        )}
      </div>
    </Modal>
  );
};
