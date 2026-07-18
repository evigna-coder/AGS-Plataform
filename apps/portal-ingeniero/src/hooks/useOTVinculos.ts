import { useEffect, useState } from 'react';
import type { Pendiente, Presupuesto, PresupuestoItem, UnidadStock, WorkOrder } from '@ags/shared';
import { misOTService } from '../services/misOTService';

export interface PresupuestoVinculado {
  id: string;
  numero: string;
  estado: string;
  /** Números de OC del cliente vinculadas al presupuesto. */
  ocNumeros: string[];
}

export interface MaterialServicio {
  cantidad: number;
  descripcion: string;
  codigo: string | null;
  presupuestoNumero: string;
}

export interface ReservaServicio {
  descripcion: string;
  nroSerie: string | null;
  nroLote: string | null;
  cantidad: number;
}

/**
 * Datos vinculados a la OT para el detalle:
 * - tareas pendientes del equipo (colección `pendientes` por equipoId=sistemaId)
 * - presupuestos de budgets[] + sus OCs de cliente (ordenesCompraIds → ordenesCompraCliente)
 * - materiales del servicio: items con stockArticuloId de esos presupuestos +
 *   unidades reservadas (reservadoParaPresupuestoId)
 */
export function useOTVinculos(ot: (WorkOrder & { id?: string }) | null) {
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [presupuestos, setPresupuestos] = useState<PresupuestoVinculado[]>([]);
  const [materiales, setMateriales] = useState<MaterialServicio[]>([]);
  const [reservas, setReservas] = useState<ReservaServicio[]>([]);
  const [loading, setLoading] = useState(false);

  const sistemaId = ot?.sistemaId ?? null;
  const budgetsKey = (ot?.budgets ?? []).filter(Boolean).join('|');

  useEffect(() => {
    if (!sistemaId) { setPendientes([]); return; }
    let active = true;
    misOTService.getPendientesDeEquipo(sistemaId)
      .then(p => { if (active) setPendientes(p); })
      .catch(() => {});
    return () => { active = false; };
  }, [sistemaId]);

  useEffect(() => {
    const numeros = budgetsKey ? budgetsKey.split('|') : [];
    if (numeros.length === 0) {
      setPresupuestos([]); setMateriales([]); setReservas([]);
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      const vinculados: PresupuestoVinculado[] = [];
      const mats: MaterialServicio[] = [];
      const resvs: ReservaServicio[] = [];
      for (const numero of numeros) {
        const pres: Presupuesto | null = await misOTService.getPresupuestoByNumero(numero).catch(() => null);
        if (!pres) {
          vinculados.push({ id: '', numero, estado: '', ocNumeros: [] });
          continue;
        }
        const ocNumeros: string[] = [];
        for (const ocId of pres.ordenesCompraIds ?? []) {
          const oc = await misOTService.getOrdenCompraCliente(ocId).catch(() => null);
          if (oc?.numero) ocNumeros.push(oc.numero);
        }
        if (pres.ordenCompraNumero && !ocNumeros.includes(pres.ordenCompraNumero)) {
          ocNumeros.push(pres.ordenCompraNumero);
        }
        vinculados.push({ id: pres.id, numero: pres.numero, estado: pres.estado, ocNumeros });

        (pres.items ?? []).forEach((item: PresupuestoItem) => {
          if (!item.stockArticuloId) return;
          mats.push({
            cantidad: item.cantidad,
            descripcion: item.descripcion,
            codigo: item.codigoProducto ?? null,
            presupuestoNumero: pres.numero,
          });
        });

        const unidades: UnidadStock[] = pres.id
          ? await misOTService.getUnidadesReservadas(pres.id).catch(() => [])
          : [];
        unidades.forEach(u => resvs.push({
          descripcion: u.articuloDescripcion,
          nroSerie: u.nroSerie ?? null,
          nroLote: u.nroLote ?? null,
          cantidad: u.cantidad ?? 1,
        }));
      }
      if (!active) return;
      setPresupuestos(vinculados);
      setMateriales(mats);
      setReservas(resvs);
    })().catch(err => {
      console.warn('[useOTVinculos] failed:', err);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [budgetsKey]);

  return { pendientes, presupuestos, materiales, reservas, loading };
}
