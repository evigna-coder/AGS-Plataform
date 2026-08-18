import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { OT_ESTADO_COLORS, OT_ESTADO_LABELS } from '@ags/shared';
import type { WorkOrder } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { otService } from '../../services/firebaseService';

interface Props {
  open: boolean;
  otNumber: string | null;
  onClose: () => void;
}

const fmtFecha = (v?: string | null): string => {
  if (!v) return '';
  const d = new Date(v.length <= 10 ? `${v}T12:00:00` : v);
  return isNaN(d.getTime()) ? v : d.toLocaleDateString('es-AR');
};

const Field = ({ label, value }: { label: string; value?: string | null }) => {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <span className="block text-[10px] font-mono uppercase tracking-wide text-slate-400">{label}</span>
      <span className="block text-xs text-slate-800 break-words whitespace-pre-wrap">{value}</span>
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="border-t border-slate-100 pt-3 first:border-t-0 first:pt-0">
    <h4 className="text-[10px] font-mono uppercase tracking-wide text-teal-700 mb-2">{title}</h4>
    {children}
  </div>
);

/**
 * Resumen de SOLO LECTURA de una OT para consultarla desde un ticket sin ir a
 * la ficha completa de Mis OT (2026-08-05 — antes el link navegaba y se perdía
 * el contexto del ticket). "Abrir OT completa" navega a la ficha.
 */
export function OTResumenModal({ open, otNumber, onClose }: Props) {
  const navigate = useNavigate();
  const [ot, setOt] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !otNumber) return;
    let cancelled = false;
    setLoading(true);
    setOt(null);
    otService.getByOtNumber(otNumber)
      .then(data => { if (!cancelled) setOt(data); })
      .catch(err => console.error('Error cargando OT:', err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, otNumber]);

  const abrirCompleta = () => {
    if (!otNumber) return;
    onClose();
    navigate(`/ordenes-trabajo/${otNumber}`);
  };

  const ubicacion = ot ? [ot.direccion, ot.localidad, ot.provincia].filter(Boolean).join(', ') : '';
  const moduloDesc = ot ? [ot.moduloModelo, ot.moduloDescripcion].filter(Boolean).join(' · ') : '';
  const presupuestos = (ot?.budgets ?? []).filter(Boolean);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={otNumber ? `OT-${otNumber}` : 'OT'}
      maxWidth="lg"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
            Cerrar
          </button>
          <button onClick={abrirCompleta} disabled={!otNumber}
            className="px-3 py-1.5 text-xs font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-600 disabled:opacity-50">
            Abrir OT completa →
          </button>
        </div>
      }
    >
      {loading && <p className="text-slate-400 text-sm py-6 text-center">Cargando orden de trabajo…</p>}
      {!loading && !ot && <p className="text-slate-400 text-sm py-6 text-center">No se encontró la orden de trabajo.</p>}

      {!loading && ot && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${OT_ESTADO_COLORS[ot.estadoAdmin ?? ''] ?? 'bg-slate-100 text-slate-600'}`}>
              {OT_ESTADO_LABELS[ot.estadoAdmin as keyof typeof OT_ESTADO_LABELS] ?? ot.estadoAdmin ?? 'Sin estado'}
            </span>
            {ot.esFacturable && <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">Facturable</span>}
            {ot.tieneContrato && <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-700">Contrato</span>}
            {ot.esGarantia && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Garantía</span>}
          </div>

          <Section title="Cliente">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <Field label="Razón social" value={ot.razonSocial} />
              <Field label="Contacto" value={ot.contacto} />
              <Field label="Email" value={ot.emailPrincipal} />
              <Field label="Ubicación" value={ubicacion} />
            </div>
          </Section>

          <Section title="Equipo / sistema">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <Field label="Sistema" value={ot.sistema} />
              <Field label="Módulo" value={moduloDesc} />
              <Field label="N° de serie" value={ot.moduloSerie} />
              <Field label="Cód. interno cliente" value={ot.codigoInternoCliente} />
              <Field label="Tipo de servicio" value={ot.tipoServicio} />
            </div>
          </Section>

          <Section title="Servicio">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <Field label="Ingeniero" value={ot.ingenieroAsignadoNombre} />
              <Field label="Fecha aprox." value={fmtFecha(ot.fechaServicioAprox)} />
              <Field label="Inicio" value={fmtFecha(ot.fechaInicio)} />
              <Field label="Fin" value={fmtFecha(ot.fechaFin)} />
              <Field label="Horas trabajadas" value={ot.horasTrabajadas} />
            </div>
          </Section>

          {(ot.problemaFallaInicial || ot.reporteTecnico || ot.accionesTomar) && (
            <Section title="Detalle técnico">
              <div className="space-y-2">
                <Field label="Problema / falla inicial" value={ot.problemaFallaInicial} />
                <Field label="Reporte técnico" value={ot.reporteTecnico} />
                <Field label="Acciones a tomar" value={ot.accionesTomar} />
              </div>
            </Section>
          )}

          {presupuestos.length > 0 && (
            <Section title="Presupuestos vinculados">
              <div className="flex flex-wrap gap-1.5">
                {presupuestos.map(num => (
                  <span key={num} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-violet-50 text-violet-700">{num}</span>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}
    </Modal>
  );
}
