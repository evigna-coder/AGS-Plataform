import type { WorkOrder } from '@ags/shared';
import { OT_ESTADO_LABELS } from '@ags/shared';

function fmtFecha(f?: string): { big: string; small: string } | null {
  if (!f) return null;
  const hoy = new Date().toISOString().slice(0, 10);
  const d = new Date(f + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  const big = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
  const small = f === hoy ? 'Hoy' : d.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '');
  return { big, small };
}

/** Banda teal del detalle de OT (mockup mix A+B). */
export default function OTDetalleBand({ ot, otNumber, onBack }: {
  ot: WorkOrder | null;
  otNumber: string;
  onBack: () => void;
}) {
  const estadoLabel = ot?.estadoAdmin
    ? OT_ESTADO_LABELS[ot.estadoAdmin]
    : ot?.status === 'FINALIZADO' ? 'Finalizada' : 'Borrador';
  const fecha = fmtFecha(ot?.fechaServicioAprox);
  const contactoLinea = [ot?.contacto, ot?.sector, [ot?.direccion, ot?.localidad].filter(Boolean).join(', ')]
    .filter(Boolean).join(' · ');

  return (
    <div className="shrink-0 bg-gradient-to-br from-teal-700 to-teal-900 text-white px-4 pt-3 pb-4 sm:px-5">
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <button
            onClick={onBack}
            className="font-mono text-[11px] uppercase tracking-widest opacity-80 py-1.5 hover:opacity-100"
          >
            ← Mis OT
          </button>
          <div className="mt-1">
            <span className="block font-mono text-[9px] font-semibold uppercase tracking-[0.2em] opacity-75 mb-1">
              Orden de trabajo
            </span>
            <h1 className="font-serif text-[26px] font-medium leading-none">OT {otNumber}</h1>
          </div>
          {ot?.tipoServicio && <p className="text-[13.5px] opacity-90 mt-1.5">{ot.tipoServicio}</p>}
        </div>
        <div className="text-right pt-1 shrink-0">
          <span className="inline-block font-mono text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/15 border border-white/35">
            {estadoLabel}
          </span>
          {fecha && (
            <div className="font-mono text-[15px] font-semibold mt-3">
              <span className="block text-[9px] uppercase tracking-widest opacity-75 font-semibold mb-0.5">{fecha.small}</span>
              {fecha.big}
            </div>
          )}
        </div>
      </div>
      {ot?.razonSocial && (
        <div className="mt-3.5 pt-3 border-t border-white/20">
          <p className="font-serif text-lg font-medium leading-tight">{ot.razonSocial}</p>
          {contactoLinea && <p className="text-xs opacity-80 mt-1">{contactoLinea}</p>}
        </div>
      )}
    </div>
  );
}
