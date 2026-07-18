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

  // Mobile: layout apilado del mockup. Desktop (md+): banda de una línea —
  // OT + tipo | cliente | estado + fecha — sin el eyebrow ni el bloque separado.
  return (
    <div className="shrink-0 bg-gradient-to-br from-teal-700 to-teal-900 text-white px-4 pt-3 pb-4 sm:px-5 md:pt-2 md:pb-3">
      <div className="max-w-5xl mx-auto w-full">
        <button
          onClick={onBack}
          className="font-mono text-[11px] uppercase tracking-widest opacity-80 py-1.5 md:py-0.5 hover:opacity-100"
        >
          ← Mis OT
        </button>
        <div className="md:flex md:items-center md:justify-between md:gap-8">
          <div className="flex justify-between items-start gap-3 md:block md:shrink-0">
            <div className="min-w-0">
              <div className="mt-1 md:mt-0">
                <span className="block font-mono text-[9px] font-semibold uppercase tracking-[0.2em] opacity-75 mb-1 md:hidden">
                  Orden de trabajo
                </span>
                <h1 className="font-serif text-[26px] md:text-[22px] font-medium leading-none">OT {otNumber}</h1>
              </div>
              {ot?.tipoServicio && <p className="text-[13.5px] md:text-xs opacity-90 mt-1.5 md:mt-1">{ot.tipoServicio}</p>}
            </div>
            <div className="text-right pt-1 shrink-0 md:hidden">
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
            <div className="mt-3.5 pt-3 border-t border-white/20 md:mt-0 md:pt-0 md:border-t-0 md:flex-1 md:min-w-0">
              <p className="font-serif text-lg md:text-base font-medium leading-tight md:truncate">{ot.razonSocial}</p>
              {contactoLinea && <p className="text-xs opacity-80 mt-1 md:mt-0.5 md:truncate">{contactoLinea}</p>}
            </div>
          )}

          <div className="hidden md:flex items-center gap-3 shrink-0">
            {fecha && (
              <span className="font-mono text-sm font-semibold">
                <span className="uppercase text-[9px] tracking-widest opacity-75 mr-1.5">{fecha.small}</span>
                {fecha.big}
              </span>
            )}
            <span className="inline-block font-mono text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/15 border border-white/35">
              {estadoLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
