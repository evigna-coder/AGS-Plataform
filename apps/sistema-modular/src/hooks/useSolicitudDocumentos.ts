import { useState, useEffect, useCallback } from 'react';
import type { SolicitudFacturacion, OrdenCompraCliente } from '@ags/shared';
import { ordenesCompraClienteService } from '../services/ordenesCompraClienteService';
import {
  ordenesTrabajoService,
  presupuestosService,
  clientesService,
  contactosService,
  establecimientosService,
  condicionesPagoService,
  categoriasPresupuestoService,
} from '../services/firebaseService';

export interface ReporteOTAcceso {
  otNumber: string;
  /** URL del PDF definitivo del reporte, o null si la OT no se finalizó / falló el upload. */
  pdfUrl: string | null;
}

/**
 * Carga los accesos a documentos de una solicitud de facturación (aviso):
 * - OCs del cliente (colección `ordenesCompraCliente`, adjuntos con URL en Storage).
 *   Fuente primaria: `solicitud.ordenesCompraIds` (back-ref del cierre admin).
 *   Fallback (solicitudes viejas de SolicitarFacturaModal): `presupuesto.ordenesCompraIds`.
 * - Reportes de OT (`reportes/{otNumber}` → `pdfUrl`), uno por OT del aviso.
 * - PDF del presupuesto: se genera on-demand con @react-pdf (`verPresupuestoPDF`),
 *   reusando el mismo generador que la pantalla de presupuestos. Solo lecturas.
 */
export function useSolicitudDocumentos(solicitud: SolicitudFacturacion | null) {
  const [ocs, setOcs] = useState<OrdenCompraCliente[]>([]);
  const [reportes, setReportes] = useState<ReporteOTAcceso[]>([]);
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
        let ocIds = solicitud.ordenesCompraIds || [];
        if (ocIds.length === 0 && solicitud.presupuestoId) {
          // Solicitudes viejas sin back-ref: leer del presupuesto.
          const p = await presupuestosService.getById(solicitud.presupuestoId).catch(() => null);
          ocIds = p?.ordenesCompraIds || [];
        }
        const ocDocs = await Promise.all(
          ocIds.map(id => ordenesCompraClienteService.getById(id).catch(() => null)),
        );

        // ── Reportes de OT ───────────────────────────────────────────────
        const otNums = solicitud.otNumbers || [];
        const reps = await Promise.all(
          otNums.map(async (n): Promise<ReporteOTAcceso> => {
            const ot = await ordenesTrabajoService.getByOtNumber(n).catch(() => null);
            return { otNumber: n, pdfUrl: ot?.pdfUrl || null };
          }),
        );

        if (!cancelled) {
          setOcs(ocDocs.filter((o): o is OrdenCompraCliente => !!o));
          setReportes(reps);
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
      const p = await presupuestosService.getById(solicitud.presupuestoId);
      if (!p) throw new Error('Presupuesto no encontrado');

      const [cliente, establecimiento, contactos, condiciones, categorias] = await Promise.all([
        p.clienteId ? clientesService.getById(p.clienteId).catch(() => null) : Promise.resolve(null),
        p.establecimientoId ? establecimientosService.getById(p.establecimientoId).catch(() => null) : Promise.resolve(null),
        p.clienteId ? contactosService.getByCliente(p.clienteId).catch(() => []) : Promise.resolve([]),
        condicionesPagoService.getAll().catch(() => []),
        categoriasPresupuestoService.getAll().catch(() => []),
      ]);

      const { previewPresupuestoPDF } = await import('../components/presupuestos/pdf');
      await previewPresupuestoPDF({
        presupuesto: p,
        cliente,
        establecimiento,
        contacto: (contactos.find(c => c.id === p.contactoId) as any) || null,
        condicionPago: condiciones.find(c => c.id === p.condicionPagoId) || null,
        categorias,
      });
    } catch (err) {
      console.error('[useSolicitudDocumentos] Error generando PDF del presupuesto:', err);
      alert('Error al generar el PDF del presupuesto');
    } finally {
      setGenerandoPdf(false);
    }
  }, [solicitud]);

  return { ocs, reportes, loadingDocs, generandoPdf, verPresupuestoPDF };
}
