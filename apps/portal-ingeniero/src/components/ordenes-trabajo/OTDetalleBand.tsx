import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { WorkOrder } from '@ags/shared';
import { OT_ESTADO_LABELS } from '@ags/shared';
import { misOTService } from '../../services/misOTService';

function fmtFecha(f?: string): { big: string; small: string } | null {
  if (!f) return null;
  const hoy = new Date().toISOString().slice(0, 10);
  const d = new Date(f + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  const big = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
  const small = f === hoy ? 'Hoy' : d.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '');
  return { big, small };
}

const NAV_LINK_CLS = 'font-mono text-[11px] uppercase tracking-widest opacity-80 py-1 hover:opacity-100';

/**
 * Banda teal del detalle de OT. Mobile: compacta (una línea por dato, todo
 * truncado) para no robarle alto al contenido. Desktop (md+): una sola línea
 * OT + tipo | cliente | fecha + estado.
 */
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

  // Datos del establecimiento: la OT solo trae el id (una lectura puntual).
  const [estab, setEstab] = useState<{ nombre: string | null; lat: number | null; lng: number | null; placeId: string | null } | null>(null);
  useEffect(() => {
    setEstab(null);
    if (!ot?.establecimientoId) return;
    let active = true;
    misOTService.getEstablecimientoInfo(ot.establecimientoId)
      .then(e => { if (active) setEstab(e); })
      .catch(() => {});
    return () => { active = false; };
  }, [ot?.establecimientoId]);
  const estabNombre = estab?.nombre ?? null;

  const direccionCompleta = [ot?.direccion, ot?.localidad].filter(Boolean).join(', ');

  // Link a Google Maps para el GPS: coordenadas validadas si las hay (con
  // placeId para caer en el lugar exacto), texto de la dirección como fallback.
  const mapsUrl = estab?.lat != null && estab?.lng != null
    ? `https://www.google.com/maps/search/?api=1&query=${estab.lat},${estab.lng}${estab.placeId ? `&query_place_id=${estab.placeId}` : ''}`
    : direccionCompleta
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccionCompleta)}`
      : null;

  const estadoChip = (
    <span className="inline-block font-mono text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/15 border border-white/35 shrink-0">
      {estadoLabel}
    </span>
  );

  return (
    <div className="shrink-0 bg-gradient-to-br from-teal-700 to-teal-900 text-white px-4 pt-1.5 pb-2.5 sm:px-5">
      <div className="max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-5">
          <button onClick={onBack} className={NAV_LINK_CLS}>← Mis OT</button>
          <Link to="/agenda" className={NAV_LINK_CLS}>Agenda</Link>
        </div>

        {/* Mobile: ficha completa en el título — OT, cliente, servicio,
            establecimiento, dirección, sector y contacto (UAT 2026-07-20:
            nada truncado, la dirección se lee entera). */}
        <div className="md:hidden">
          <div className="flex items-center justify-between gap-3 mt-0.5">
            <h1 className="font-serif text-xl font-medium leading-none">OT {otNumber}</h1>
            {estadoChip}
          </div>
          {ot?.razonSocial && (
            <p className="font-serif text-base font-medium leading-tight mt-1.5">{ot.razonSocial}</p>
          )}
          <p className="text-xs opacity-90 mt-0.5">
            {[ot?.tipoServicio, fecha ? `${fecha.small} ${fecha.big}` : null].filter(Boolean).join(' · ') || '—'}
          </p>
          {(estabNombre || direccionCompleta) && (
            mapsUrl ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-[11px] opacity-90 mt-1 leading-snug underline decoration-white/50 underline-offset-2 active:opacity-70"
                title="Abrir en Google Maps"
              >
                📍 {[estabNombre, direccionCompleta].filter(Boolean).join(' — ')}
              </a>
            ) : (
              <p className="text-[11px] opacity-80 mt-1 leading-snug">
                {[estabNombre, direccionCompleta].filter(Boolean).join(' — ')}
              </p>
            )
          )}
          {(ot?.sector || ot?.contacto) && (
            <p className="text-[11px] opacity-75 mt-0.5 leading-snug">
              {[ot?.sector, ot?.contacto].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>

        {/* Desktop: una sola línea */}
        <div className="hidden md:flex items-center justify-between gap-8">
          <div className="shrink-0">
            <h1 className="font-serif text-[22px] font-medium leading-none">OT {otNumber}</h1>
            {ot?.tipoServicio && <p className="text-xs opacity-90 mt-1">{ot.tipoServicio}</p>}
          </div>
          {ot?.razonSocial && (
            <div className="flex-1 min-w-0">
              <p className="font-serif text-base font-medium leading-tight truncate">
                {[ot.razonSocial, estabNombre].filter(Boolean).join(' · ')}
              </p>
              {contactoLinea && (
                <p className="text-xs opacity-80 mt-0.5 truncate">
                  {contactoLinea}
                  {mapsUrl && (
                    <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                      className="ml-2 underline decoration-white/50 underline-offset-2 hover:opacity-100"
                      title="Abrir en Google Maps">
                      Maps ↗
                    </a>
                  )}
                </p>
              )}
            </div>
          )}
          <div className="flex items-center gap-3 shrink-0">
            {fecha && (
              <span className="font-mono text-sm font-semibold">
                <span className="uppercase text-[9px] tracking-widest opacity-75 mr-1.5">{fecha.small}</span>
                {fecha.big}
              </span>
            )}
            {estadoChip}
          </div>
        </div>
      </div>
    </div>
  );
}
