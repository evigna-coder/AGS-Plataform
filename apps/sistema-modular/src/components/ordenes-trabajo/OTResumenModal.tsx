import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ordenesTrabajoService } from '../../services/firebaseService';
import { OT_ESTADO_LABELS } from '@ags/shared';
import type { WorkOrder } from '@ags/shared';

interface Props {
  open: boolean;
  otNumber: string | null;
  onClose: () => void;
}

const ESTADO_COLORS: Record<string, string> = {
  CREADA: 'bg-slate-100 text-slate-600',
  ASIGNADA: 'bg-blue-100 text-blue-700',
  COORDINADA: 'bg-violet-100 text-violet-700',
  EN_CURSO: 'bg-amber-100 text-amber-700',
  CIERRE_TECNICO: 'bg-orange-100 text-orange-700',
  CIERRE_ADMINISTRATIVO: 'bg-cyan-100 text-cyan-700',
  FINALIZADO: 'bg-emerald-100 text-emerald-700',
};

const fmtFecha = (v?: string | null): string => {
  if (!v) return '';
  const d = new Date(v.length <= 10 ? `${v}T12:00:00` : v);
  return isNaN(d.getTime()) ? v : d.toLocaleDateString('es-AR');
};

/** Etiqueta monospace uppercase + valor. Oculta la fila si no hay valor. */
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
 * Vista de SOLO LECTURA y compacta de una OT, pensada para consultarla desde un
 * ticket sin abrir el panel de edición completo. Para editar, "Abrir OT completa"
 * navega a /ordenes-trabajo/:n (que recuerda el ticket como referrer para el back).
 */
export function OTResumenModal({ open, otNumber, onClose }: Props) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [ot, setOt] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !otNumber) return;
    let cancelled = false;
    setLoading(true);
    setOt(null);
    ordenesTrabajoService.getByOtNumber(otNumber)
      .then(data => { if (!cancelled) setOt(data); })
      .catch(err => console.error('Error cargando OT:', err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, otNumber]);

  const abrirCompleta = () => {
    if (!otNumber) return;
    onClose();
    navigate(`/ordenes-trabajo/${otNumber}`, { state: { from: pathname } });
  };

  const ubicacion = ot
    ? [ot.direccion, ot.localidad, ot.provincia].filter(Boolean).join(', ')
    : '';
  const moduloDesc = ot
    ? [ot.moduloModelo, ot.moduloDescripcion].filter(Boolean).join(' · ')
    : '';
  const articulos = ot?.articulos ?? [];
  const presupuestos = (ot?.budgets ?? []).filter(Boolean);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={otNumber ? `OT-${otNumber}` : 'OT'}
      subtitle={ot?.razonSocial || undefined}
      maxWidth="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cerrar</Button>
          <Button size="sm" onClick={abrirCompleta} disabled={!otNumber}>Abrir OT completa →</Button>
        </div>
      }
    >
      {loading && <p className="text-slate-400 text-sm py-6 text-center">Cargando orden de trabajo…</p>}
      {!loading && !ot && <p className="text-slate-400 text-sm py-6 text-center">No se encontró la orden de trabajo.</p>}

      {!loading && ot && (
        <div className="space-y-3">
          {/* Estado + fechas + ingeniero */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${ESTADO_COLORS[ot.estadoAdmin ?? ''] ?? 'bg-slate-100 text-slate-600'}`}>
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
              <Field label="Tiempo de viaje" value={ot.tiempoViaje} />
              <Field label="Orden de compra" value={ot.ordenCompra} />
            </div>
          </Section>

          {(ot.problemaFallaInicial || ot.reporteTecnico || ot.accionesTomar || ot.materialesParaServicio) && (
            <Section title="Detalle técnico">
              <div className="space-y-2">
                <Field label="Problema / falla inicial" value={ot.problemaFallaInicial} />
                <Field label="Reporte técnico" value={ot.reporteTecnico} />
                <Field label="Acciones a tomar" value={ot.accionesTomar} />
                <Field label="Materiales para el servicio" value={ot.materialesParaServicio} />
              </div>
            </Section>
          )}

          {articulos.length > 0 && (
            <Section title={`Ítems (${articulos.length})`}>
              <div className="rounded-lg border border-slate-100 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-400">
                    <tr>
                      <th className="text-left font-medium px-2 py-1">Código</th>
                      <th className="text-left font-medium px-2 py-1">Descripción</th>
                      <th className="text-right font-medium px-2 py-1 w-16">Cant.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {articulos.map(a => (
                      <tr key={a.id} className="border-t border-slate-100">
                        <td className="px-2 py-1 font-mono text-slate-600">{a.codigo || '—'}</td>
                        <td className="px-2 py-1 text-slate-800">{a.descripcion || '—'}</td>
                        <td className="px-2 py-1 text-right text-slate-700">{a.cantidadTexto || a.cantidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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

          {(ot.pdfUrl || ot.protocolPdfUrl) && (
            <Section title="Reporte">
              <div className="flex flex-wrap gap-3">
                {ot.pdfUrl && (
                  <a href={ot.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-600 hover:text-teal-800 font-medium">
                    Ver PDF del reporte →
                  </a>
                )}
                {ot.protocolPdfUrl && (
                  <a href={ot.protocolPdfUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-600 hover:text-teal-800 font-medium">
                    Ver PDF del protocolo →
                  </a>
                )}
              </div>
            </Section>
          )}
        </div>
      )}
    </Modal>
  );
}
