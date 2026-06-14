import { useState, useCallback } from 'react';
import { ordenesCompraService, requerimientosService, presupuestosService, leadsService } from '../services/firebaseService';
import type { RequerimientoCompra, ItemOC } from '@ags/shared';

export function useGenerarOC() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generadas, setGeneradas] = useState(0);

  const generarOCs = useCallback(async (selected: RequerimientoCompra[]): Promise<string[]> => {
    if (selected.length === 0) return [];
    setLoading(true);
    setError(null);
    setGeneradas(0);
    const ocIds: string[] = [];

    try {
      // Group by proveedorSugeridoId (null/empty = '__sin_proveedor__')
      const groups = new Map<string, RequerimientoCompra[]>();
      for (const req of selected) {
        const key = req.proveedorSugeridoId ?? '__sin_proveedor__';
        const existing = groups.get(key) ?? [];
        existing.push(req);
        groups.set(key, existing);
      }

      for (const [provId, reqs] of groups.entries()) {
        const isSinProveedor = provId === '__sin_proveedor__';
        const firstReq = reqs[0];

        // Build ItemOC list from requirements
        const items: ItemOC[] = reqs.map(r => ({
          id: crypto.randomUUID(),
          articuloId: r.articuloId ?? null,
          articuloCodigo: r.articuloCodigo ?? null,
          descripcion: r.articuloDescripcion,
          cantidad: r.cantidad,
          cantidadRecibida: 0,
          unidadMedida: r.unidadMedida,
          precioUnitario: null,
          moneda: null,
          requerimientoId: r.id,
          notas: r.notas ?? null,
        }));

        // Create OC as borrador — user will complete prices from OCDetail
        const ocId = await ordenesCompraService.create({
          tipo: 'nacional',
          proveedorId: isSinProveedor ? '' : provId,
          proveedorNombre: isSinProveedor ? 'Sin proveedor asignado' : (firstReq.proveedorSugeridoNombre ?? ''),
          moneda: 'ARS',
          proformaNumero: null,
          fechaProforma: null,
          condicionesPago: null,
          fechaEntregaEstimada: null,
          notas: `Generada desde ${reqs.length} requerimiento(s)`,
          items,
          estado: 'borrador',
          presupuestoIds: [],
        });

        // Get the OC numero for linking
        const oc = await ordenesCompraService.getById(ocId).catch(() => null);

        // Update all requerimientos in this group to en_compra
        await Promise.all(reqs.map(r =>
          requerimientosService.update(r.id, {
            estado: 'en_compra',
            ordenCompraId: ocId,
            ordenCompraNumero: oc?.numero ?? null,
          })
        ));

        ocIds.push(ocId);
      }

      // Flujo de tickets: creada la OC, el ticket de origen pasa a "Materiales"
      // para disparar la importación. Cadena req → presupuesto → origen (ticket).
      await advanceTicketsToMateriales(selected);

      setGeneradas(ocIds.length);
      return ocIds;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error generando OC(s)';
      setError(msg);
      console.error('[useGenerarOC]', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return { generarOCs, loading, error, generadas };
}

/** Mueve a "Materiales" los tickets de origen de los presupuestos detrás de estos requerimientos. */
async function advanceTicketsToMateriales(reqs: RequerimientoCompra[]): Promise<void> {
  try {
    const presupuestoIds = [...new Set(reqs.map(r => r.presupuestoId).filter(Boolean) as string[])];
    if (presupuestoIds.length === 0) return;
    const ticketIds = new Set<string>();
    for (const pid of presupuestoIds) {
      const pres = await presupuestosService.getById(pid).catch(() => null);
      if (pres?.origenTipo === 'lead' && pres.origenId) ticketIds.add(pres.origenId);
    }
    await Promise.all([...ticketIds].map(tid =>
      leadsService.moverAArea(tid, 'materiales').catch(err =>
        console.error(`Error moviendo ticket ${tid} a Materiales:`, err),
      ),
    ));
  } catch (err) {
    console.error('[advanceTicketsToMateriales]', err);
  }
}
