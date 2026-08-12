import { useState, useCallback } from 'react';
import { ordenesCompraService, requerimientosService, presupuestosService, leadsService, proveedoresService } from '../services/firebaseService';
import type { RequerimientoCompra, ItemOC, Proveedor } from '@ags/shared';

/**
 * Línea de nota por requerimiento para las notas de la OC (2026-08-12):
 * cantidad, artículo y de dónde sale (cliente/presupuesto o stock mínimo),
 * usando el desglose consolidado si existe. Queda consultable entrando a la
 * OC y desde "Notas" en el listado.
 */
function reqToNotaLinea(r: RequerimientoCompra): string {
  const cab = `• ${r.articuloCodigo ?? r.articuloDescripcion} — ${r.cantidad} ${r.unidadMedida} (${r.numero})`;
  const partes = (r.desglose ?? []).map(d =>
    d.concepto === 'cliente'
      ? `${d.cantidad} para ${d.clienteNombre || 'cliente'}${d.presupuestoNumero ? ` (Ppto ${d.presupuestoNumero})` : ''}`
      : `${d.cantidad} stock mínimo${d.consolidaNumeros?.length ? ` (consolida ${d.consolidaNumeros.join(', ')})` : ''}`);
  if (partes.length > 0) return `${cab}: ${partes.join(' + ')}`;
  if (r.origen === 'stock_minimo') return `${cab}: stock mínimo`;
  if (r.presupuestoNumero) return `${cab}: Ppto ${r.presupuestoNumero}`;
  return cab;
}

/** Mapea un requerimiento a un ItemOC (mismo shape para OC nueva o existente). */
function reqToItemOC(r: RequerimientoCompra): ItemOC {
  return {
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
  };
}

export function useGenerarOC() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generadas, setGeneradas] = useState(0);

  /**
   * Suma requerimientos a una OC EXISTENTE (pedido 2026-07-31): agrega los items
   * al final de la OC y marca los reqs en_compra vinculados a ella (salen de la
   * vista "Abiertos" del listado). Mismo avance de tickets que generar OC nueva.
   */
  const agregarAOCExistente = useCallback(async (ocId: string, selected: RequerimientoCompra[]): Promise<boolean> => {
    if (selected.length === 0) return false;
    setLoading(true);
    setError(null);
    try {
      const oc = await ordenesCompraService.getById(ocId);
      if (!oc) throw new Error('Orden de compra no encontrada');
      const nuevos = selected.map(reqToItemOC);
      // Las notas acumulan el detalle de lo agregado (no pisan lo que el comprador escribió).
      const notas = [oc.notas?.trim() || null, `Agregado desde ${selected.length} requerimiento(s):`, ...selected.map(reqToNotaLinea)]
        .filter(Boolean).join('\n');
      await ordenesCompraService.update(ocId, { items: [...(oc.items ?? []), ...nuevos], notas });
      await Promise.all(selected.map(r =>
        requerimientosService.update(r.id, {
          estado: 'en_compra',
          ordenCompraId: ocId,
          ordenCompraNumero: oc.numero ?? null,
        })
      ));
      await advanceTicketsToMateriales(selected);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error agregando a la OC';
      setError(msg);
      console.error('[useGenerarOC] agregarAOCExistente:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

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

        // Tipo y moneda se derivan del proveedor (UAT 2026-07-16: quedaba
        // hardcodeado nacional/ARS aunque el proveedor fuera internacional).
        let prov: Proveedor | null = null;
        if (!isSinProveedor) {
          prov = await proveedoresService.getById(provId).catch(() => null);
        }
        const esImportacion = prov?.tipo === 'internacional';
        const tipoOC = esImportacion ? 'importacion' as const : 'nacional' as const;
        const monedaOC = (prov?.moneda as 'ARS' | 'USD' | 'EUR' | undefined) ?? (esImportacion ? 'USD' : 'ARS');

        // Build ItemOC list from requirements
        const items: ItemOC[] = reqs.map(reqToItemOC);

        // Create OC as borrador — user will complete prices from OCDetail
        const ocId = await ordenesCompraService.create({
          tipo: tipoOC,
          proveedorId: isSinProveedor ? '' : provId,
          proveedorNombre: isSinProveedor ? 'Sin proveedor asignado' : (prov?.nombre ?? firstReq.proveedorSugeridoNombre ?? ''),
          moneda: monedaOC,
          proformaNumero: null,
          fechaProforma: null,
          condicionesPago: null,
          fechaEntregaEstimada: null,
          notas: [`Generada desde ${reqs.length} requerimiento(s):`, ...reqs.map(reqToNotaLinea)].join('\n'),
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

  return { generarOCs, agregarAOCExistente, loading, error, generadas };
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
