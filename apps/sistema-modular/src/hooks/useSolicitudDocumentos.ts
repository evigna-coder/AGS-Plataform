import { useState, useEffect, useCallback } from 'react';
import type { SolicitudFacturacion, OrdenCompraCliente } from '@ags/shared';
import { ordenesCompraClienteService } from '../services/ordenesCompraClienteService';
import { ordenesTrabajoService, presupuestosService } from '../services/firebaseService';
import { abrirPresupuestoPdf } from '../utils/abrirPresupuestoPdf';
import { certificacionesService } from '../services/certificacionesService';
import { recibidasDeCertificacion } from '@ags/shared';

export interface ReporteOTAcceso {
  otNumber: string;
  /** URL del PDF definitivo del reporte, o null si la OT no se finalizó / falló el upload. */
  pdfUrl: string | null;
}

/** Un archivo de certificación del cliente, listo para abrir desde la factura. */
export interface CertificacionAcceso {
  loteId: string;
  /** N° del documento del cliente (o del lote), o null si no tiene. */
  numero: string | null;
  periodo: string | null;
  url: string;
  nombre: string | null;
}

/**
 * Carga los accesos a documentos de una solicitud de facturación (aviso):
 * - OCs del cliente (colección `ordenesCompraCliente`, adjuntos con URL en Storage).
 *   Fuente primaria: `solicitud.ordenesCompraIds` (back-ref del cierre admin).
 *   Fallback (solicitudes viejas de SolicitarFacturaModal): `presupuesto.ordenesCompraIds`.
 * - Reportes de OT (`reportes/{otNumber}` → `pdfUrl`), uno por OT del aviso.
 * - PDF del presupuesto: se genera on-demand con @react-pdf (`verPresupuestoPDF`
 *   → `abrirPresupuestoPdf`), el mismo camino que usa el visor de entregas.
 *   Solo lecturas.
 */
export function useSolicitudDocumentos(solicitud: SolicitudFacturacion | null) {
  const [ocs, setOcs] = useState<OrdenCompraCliente[]>([]);
  const [reportes, setReportes] = useState<ReporteOTAcceso[]>([]);
  const [certificaciones, setCertificaciones] = useState<CertificacionAcceso[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [generandoPdf, setGenerandoPdf] = useState(false);

  const solicitudId = solicitud?.id;

  useEffect(() => {
    if (!solicitud) return;
    let cancelled = false;
    (async () => {
      setLoadingDocs(true);
      try {
        // ── OCs del cliente ──────────────────────────────────────────────
        // Hay DOS formas de cargar la OC y hasta ahora sólo se leía una
        // (2026-08-09): la colección `ordenesCompraCliente` (FLOW-02) y los
        // ADJUNTOS del presupuesto con `tipo: 'orden_compra'`. Con la OC subida
        // como adjunto, el chip decía "OC: sin cargar" aunque el PDF estuviera ahí.
        let ocIds = solicitud.ordenesCompraIds || [];
        const pres = solicitud.presupuestoId
          ? await presupuestosService.getById(solicitud.presupuestoId).catch(() => null)
          : null;
        if (ocIds.length === 0) {
          // Solicitudes viejas sin back-ref: leer del presupuesto.
          ocIds = pres?.ordenesCompraIds || [];
        }
        const ocDocs = await Promise.all(
          ocIds.map(id => ordenesCompraClienteService.getById(id).catch(() => null)),
        );

        // Adjuntos del presupuesto tipo "orden de compra" → se exponen con la
        // misma forma que una OC de la colección, para que la tarjeta los liste
        // igual. `id` prefijado para no chocar con ids reales.
        const adjuntosOC: OrdenCompraCliente[] = (pres?.adjuntos ?? [])
          .filter(a => a.tipo === 'orden_compra')
          .map(a => ({
            id: `adjunto:${a.id}`,
            numero: pres?.ordenCompraNumero || a.nombre,
            fecha: a.fechaCarga,
            clienteId: pres?.clienteId ?? '',
            presupuestosIds: pres ? [pres.id] : [],
            adjuntos: [{ id: a.id, url: a.url, tipo: 'pdf', nombre: a.nombre, fechaCarga: a.fechaCarga }],
            notas: a.notas ?? null,
            createdAt: a.fechaCarga,
            updatedAt: a.fechaCarga,
          }));

        // ── Reportes de OT ───────────────────────────────────────────────
        const otNums = solicitud.otNumbers || [];
        const ots = await Promise.all(otNums.map(n => ordenesTrabajoService.getByOtNumber(n).catch(() => null)));
        const reps: ReporteOTAcceso[] = otNums.map((n, i) => ({ otNumber: n, pdfUrl: ots[i]?.pdfUrl || null }));

        // ── Certificaciones del cliente (2026-09-07) ─────────────────────
        // Fuente primaria: `solicitud.certificacionId`. Fallback para los
        // avisos generados antes de ese campo: las OTs llevan `certificacionId`
        // estampado al liberarse, así que el papel se encuentra igual.
        const loteIds = [...new Set([
          solicitud.certificacionId,
          ...ots.map(o => o?.certificacionId),
        ].filter((x): x is string => !!x))];
        const lotes = await Promise.all(loteIds.map(id => certificacionesService.getById(id).catch(() => null)));
        const certs: CertificacionAcceso[] = [];
        for (const lote of lotes) {
          if (!lote) continue;
          for (const r of recibidasDeCertificacion(lote)) {
            const archivos = r.archivos?.length
              ? r.archivos
              : r.archivoUrl ? [{ url: r.archivoUrl, path: r.archivoPath ?? '', nombre: '' }] : [];
            for (const a of archivos) {
              certs.push({ loteId: lote.id, numero: r.numero || lote.numero || null, periodo: lote.periodo ?? null, url: a.url, nombre: a.nombre || null });
            }
          }
        }

        if (!cancelled) {
          setOcs([...ocDocs.filter((o): o is OrdenCompraCliente => !!o), ...adjuntosOC]);
          setReportes(reps);
          setCertificaciones(certs);
        }
      } catch (err) {
        console.error('[useSolicitudDocumentos] Error cargando documentos:', err);
      } finally {
        if (!cancelled) setLoadingDocs(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solicitudId]);

  /** Genera el PDF del presupuesto con los datos frescos y lo abre en preview. */
  const verPresupuestoPDF = useCallback(async () => {
    if (!solicitud) return;
    setGenerandoPdf(true);
    try {
      await abrirPresupuestoPdf(solicitud.presupuestoId);
    } catch (err) {
      console.error('[useSolicitudDocumentos] Error generando PDF del presupuesto:', err);
      alert('Error al generar el PDF del presupuesto');
    } finally {
      setGenerandoPdf(false);
    }
  }, [solicitud]);

  return { ocs, reportes, certificaciones, loadingDocs, generandoPdf, verPresupuestoPDF };
}
