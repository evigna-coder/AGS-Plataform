import { useState, useEffect, useMemo, useCallback } from 'react';
import { establecimientosService } from '../services/firebaseService';
import { establecimientoPerteneceACliente } from '@ags/shared';
import type { Establecimiento } from '@ags/shared';

/**
 * Sufijo " (Establecimiento)" para mostrar al lado del cliente en listas de
 * seguimiento (OTs, presupuestos, tickets, facturación…). Pedido 2026-07-28:
 * SOLO cuando el cliente tiene MÁS DE UN establecimiento activo — para
 * clientes multi-planta el nombre solo es ambiguo; para el resto no suma ruido.
 * Si el registro no tiene establecimiento asignado (legacy), devuelve ''.
 *
 * Uso:
 *   const sufijoEstab = useEstablecimientoSuffix();
 *   <td>{r.clienteNombre}{sufijoEstab(r.clienteId, r.establecimientoId)}</td>
 */
export function useEstablecimientoSuffix() {
  const [estabs, setEstabs] = useState<Establecimiento[]>([]);

  useEffect(() => {
    // getAll pasa por serviceCache (TTL 2 min + invalidación cross-tab) — barato
    // aunque muchas listas monten el hook a la vez.
    establecimientosService.getAll()
      .then(setEstabs)
      .catch(err => console.error('[useEstablecimientoSuffix] error cargando establecimientos:', err));
  }, []);

  const { nombreById, multiPorCliente } = useMemo(() => {
    const nombre = new Map<string, string>();
    const countActivos = new Map<string, number>();
    for (const e of estabs) {
      nombre.set(e.id, e.nombre);
      if (e.activo === false) continue;
      const cid = e.clienteCuit || e.clienteId || '';
      if (cid) countActivos.set(cid, (countActivos.get(cid) ?? 0) + 1);
    }
    const multi = new Set<string>();
    for (const [cid, n] of countActivos) if (n > 1) multi.add(cid);
    return { nombreById: nombre, multiPorCliente: multi };
  }, [estabs]);

  return useCallback((clienteId?: string | null, establecimientoId?: string | null): string => {
    if (!clienteId || !establecimientoId) return '';
    if (!multiPorCliente.has(clienteId)) {
      // Cobertura del vínculo legacy (clienteCuit vs clienteId): si el conteo por id
      // directo no lo marcó multi, verificar por pertenencia solo cuando haga falta.
      const delCliente = estabs.filter(e => e.activo !== false && establecimientoPerteneceACliente(e, clienteId));
      if (delCliente.length <= 1) return '';
    }
    const nombre = nombreById.get(establecimientoId);
    return nombre ? ` (${nombre})` : '';
  }, [estabs, nombreById, multiPorCliente]);
}

/**
 * Mapa establecimientoId → nombre, SIN la regla de "solo si el cliente tiene
 * varios" (2026-09-03).
 *
 * Para MOSTRAR, el sufijo solo aporta en clientes multi-planta. Para BUSCAR es
 * al revés: el nombre de la planta tiene que encontrarse siempre. Caso YPF —
 * las OTs viejas traen "YPF CILP SA" en la razón social y las nuevas el cliente
 * normalizado ("YPF S.A.") con CILP en el establecimiento: buscar "CILP" solo
 * encontraba las viejas, que además eran las finalizadas.
 */
export function useEstablecimientoNombreById(): Map<string, string> {
  const [estabs, setEstabs] = useState<Establecimiento[]>([]);
  useEffect(() => {
    establecimientosService.getAll()
      .then(setEstabs)
      .catch(err => console.error('[useEstablecimientoNombreById] error:', err));
  }, []);
  return useMemo(() => new Map(estabs.map(e => [e.id, e.nombre])), [estabs]);
}
