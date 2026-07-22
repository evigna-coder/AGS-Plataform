import { useState } from 'react';
import { remitosService } from '../services/firebaseService';
import {
  movimientosAplicarService, remitoMueveStock, itemRemitoConEfectoAplicado,
} from '../services/movimientosAplicar';
import { nombreUsuarioActual } from '../services/asignacionesStockHelpers';
import type { Remito, RemitoItem, EstadoRemito } from '@ags/shared';

/**
 * Acciones del detalle de remito (fix I4 auditoría de stock):
 * - Confirmar un remito con items de stock propio APLICA el efecto real sobre
 *   `unidades` + MovimientoStock (vía `movimientosAplicarService`), en una tx.
 * - Confirmar un remito documental (items de ficha del cliente o de asignación,
 *   cuyo stock ya se movió en su propio flujo) solo cambia el estado.
 * - "Marcar devuelto" de un item 'sale_y_vuelve' con efecto aplicado registra
 *   el retorno real (unidad vuelve a su ubicación de origen + movimiento).
 */
export function useRemitoAcciones(id: string | undefined, remito: Remito | null) {
  const [acting, setActing] = useState(false);

  const transition = async (estado: EstadoRemito, extra?: Partial<Remito>) => {
    if (!id || !remito) return;
    setActing(true);
    try { await remitosService.update(id, { estado, ...extra }); }
    catch (e) { console.error('Error updating remito:', e); alert('Error al actualizar remito'); }
    finally { setActing(false); }
  };

  const confirmarRemito = async () => {
    if (!id || !remito) return;
    setActing(true);
    try {
      if (remitoMueveStock(remito)) {
        await movimientosAplicarService.aplicarSalidaRemito({ remito, creadoPor: nombreUsuarioActual() });
      } else {
        // Remito documental: no referencia unidades de stock propias — no mueve existencias.
        await remitosService.update(id, { estado: 'confirmado' });
      }
    } catch (e) {
      console.error('Error confirmando remito:', e);
      alert(e instanceof Error ? e.message : 'Error al confirmar el remito');
    } finally { setActing(false); }
  };

  const toggleDevuelto = async (item: RemitoItem, current: boolean) => {
    if (!id || !remito) return;
    setActing(true);
    try {
      if (itemRemitoConEfectoAplicado(item) && item.tipoItem === 'sale_y_vuelve') {
        // Retorno real: la unidad vuelve del ingeniero a su ubicación de origen.
        await movimientosAplicarService.marcarRetornoRemitoItem({
          remito, itemId: item.id, devuelto: !current, creadoPor: nombreUsuarioActual(),
        });
      } else {
        // Item documental (ficha / asignación): solo se actualiza el papel; la
        // devolución física de items asignados pasa por el inventario del ingeniero.
        const updatedItems = remito.items.map(it =>
          it.id === item.id
            ? { ...it, devuelto: !current, fechaDevolucion: !current ? new Date().toISOString() : null }
            : it,
        );
        await remitosService.update(id, { items: updatedItems });
      }
    } catch (e) {
      console.error('Error registrando devolución:', e);
      alert(e instanceof Error ? e.message : 'Error al registrar la devolución');
    } finally { setActing(false); }
  };

  return { acting, transition, confirmarRemito, toggleDevuelto };
}

/** Leyenda del efecto de stock del remito, para el detalle. */
export function stockRemitoLabel(remito: Remito): string {
  const aplicado = remito.items.some(itemRemitoConEfectoAplicado);
  if (aplicado) return 'Stock aplicado al confirmar';
  if (!remitoMueveStock(remito)) return 'Documental — no mueve stock';
  return remito.estado === 'borrador'
    ? 'Mueve stock al confirmar'
    : 'Sin efecto de stock (confirmado antes del cambio)';
}
