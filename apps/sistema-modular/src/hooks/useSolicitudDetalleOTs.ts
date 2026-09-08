import { useEffect, useState } from 'react';
import type { ParteCertificada, SolicitudFacturacion } from '@ags/shared';
import { itemsDeCertificacion } from '@ags/shared';
import { ordenesTrabajoService, establecimientosService } from '../services/firebaseService';
import { certificacionesService } from '../services/certificacionesService';

export interface DetalleOTFila {
  otNumber: string;
  establecimiento: string;
  equipo: string;
  /** ID del equipo para el cliente (código interno de la carátula). */
  equipoId: string;
  servicio: string;
  /** Partes declaradas en la certificación (2026-09-07). */
  partes: ParteCertificada[];
  /** ISO o YYYY-MM-DD; se formatea al mostrar. */
  fecha: string | null;
}

/**
 * Detalle por OT de una solicitud de facturación (2026-09-07): el mismo cuadro
 * que ve el cliente en el PDF de certificación — establecimiento, OT, equipo,
 * servicio y fecha. Si la solicitud viene de un lote de certificación se usan
 * los textos redactados para el cliente; si no, los de la OT.
 */
export function useSolicitudDetalleOTs(solicitud: SolicitudFacturacion | null) {
  const [filas, setFilas] = useState<DetalleOTFila[]>([]);
  const [loading, setLoading] = useState(true);
  const solicitudId = solicitud?.id;

  useEffect(() => {
    if (!solicitud) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const otNums = solicitud.otNumbers ?? [];
        const ots = await Promise.all(otNums.map(n => ordenesTrabajoService.getByOtNumber(n).catch(() => null)));
        const loteIds = [...new Set([solicitud.certificacionId, ...ots.map(o => o?.certificacionId)].filter((x): x is string => !!x))];
        const lotes = await Promise.all(loteIds.map(id => certificacionesService.getById(id).catch(() => null)));
        const itemPorOt = new Map<string, ReturnType<typeof itemsDeCertificacion>[number]>();
        for (const l of lotes) for (const it of (l ? itemsDeCertificacion(l) : [])) itemPorOt.set(it.otNumber, it);

        const estIds = [...new Set(ots.map(o => o?.establecimientoId).filter((x): x is string => !!x))];
        const ests = await Promise.all(estIds.map(id => establecimientosService.getById(id).catch(() => null)));
        const nombreEst = new Map(estIds.map((id, i) => [id, ests[i]?.nombre ?? '']));

        const out: DetalleOTFila[] = otNums.map((n, i) => {
          const ot = ots[i];
          const it = itemPorOt.get(n);
          return {
            otNumber: n,
            establecimiento: it?.establecimientoNombre || (ot?.establecimientoId ? nombreEst.get(ot.establecimientoId) ?? '' : ''),
            equipo: it?.equipo || [ot?.sistema, ot?.moduloSerie ? `S/N ${ot.moduloSerie}` : null].filter(Boolean).join(' · '),
            equipoId: it?.equipoId || ot?.codigoInternoCliente || '',
            servicio: it?.descripcionServicio || ot?.tipoServicio || '',
            partes: it?.partes ?? [],
            fecha: it?.fechaServicio || ot?.fechaInicio || ot?.fechaServicioAprox || null,
          };
        });
        if (!cancelled) setFilas(out);
      } catch (err) {
        console.error('[useSolicitudDetalleOTs]', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solicitudId]);

  const establecimientos = [...new Set(filas.map(f => f.establecimiento).filter(Boolean))];
  return { filas, establecimientos, loading };
}
