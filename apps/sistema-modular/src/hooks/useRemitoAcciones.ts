import { useState } from 'react';
import { usePrompt } from '../components/ui/PromptDialog';
import { remitosService, ordenesTrabajoService } from '../services/firebaseService';
import {
  movimientosAplicarService, remitoMueveStock, itemRemitoConEfectoAplicado,
} from '../services/movimientosAplicar';
import { remitoFirmaStorageService } from '../services/remitoFirmaStorageService';
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
 * - "Anular" revierte la salida completa: el stock vuelve de donde salió y el
 *   remito queda `cancelado` con motivo (2026-08-17).
 */
export function useRemitoAcciones(id: string | undefined, remito: Remito | null) {
  const [acting, setActing] = useState(false);
  const promptText = usePrompt();

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

  /** Sube el escaneo del remito firmado por el cliente y lo marca firmado. */
  const subirFirma = async (file: File) => {
    if (!id || !remito) return;
    setActing(true);
    try {
      if (remito.remitoFirmadoPath) await remitoFirmaStorageService.remove(remito.remitoFirmadoPath);
      const { storagePath, url } = await remitoFirmaStorageService.upload(id, file, file.name);
      await remitosService.update(id, {
        firmado: true,
        fechaFirma: new Date().toISOString(),
        remitoFirmadoUrl: url,
        remitoFirmadoPath: storagePath,
      });
      // Auto-release (circuito B): las OTs de este remito retenidas por 'remito_firmado'
      // quedan liberadas para facturación al llegar el remito firmado. Best-effort.
      for (const otNumber of remito.otNumbers ?? []) {
        try {
          const ot = await ordenesTrabajoService.getByOtNumber(otNumber);
          if (ot?.retenidaFacturacion && ot.requisitoFacturacionPendiente === 'remito_firmado') {
            await ordenesTrabajoService.liberarParaFacturacion(otNumber);
          }
        } catch (err) {
          console.warn('[subirFirma] auto-release de OT falló:', otNumber, err);
        }
      }
    } catch (e) {
      console.error('Error subiendo remito firmado:', e);
      alert(e instanceof Error ? e.message : 'Error al subir el remito firmado');
    } finally { setActing(false); }
  };

  /** Quita la firma (borra el escaneo de Storage y limpia los campos). */
  const quitarFirma = async () => {
    if (!id || !remito) return;
    setActing(true);
    try {
      if (remito.remitoFirmadoPath) await remitoFirmaStorageService.remove(remito.remitoFirmadoPath);
      await remitosService.update(id, {
        firmado: false,
        fechaFirma: null,
        remitoFirmadoUrl: null,
        remitoFirmadoPath: null,
      });
    } catch (e) {
      console.error('Error quitando firma:', e);
      alert(e instanceof Error ? e.message : 'Error al quitar la firma');
    } finally { setActing(false); }
  };

  /**
   * Anula el remito devolviendo el stock a su posición de origen. Pide el
   * motivo y es obligatorio: un remito anulado sin razón es indistinguible de
   * un error de carga cuando alguien lo mira seis meses después.
   */
  const anularRemito = async () => {
    if (!id || !remito) return;
    const motivo = await promptText({
      title: `Anular remito ${remito.numero}`,
      label: 'Motivo de la anulación',
      placeholder: 'Ej: se cargó como entrega y en realidad vuelve',
      required: true,
      multiline: true,
      confirmLabel: 'Anular y devolver el stock',
    });
    if (motivo === null) return;
    setActing(true);
    try {
      const revertidas = await movimientosAplicarService.anularRemito({
        remito, motivo, creadoPor: nombreUsuarioActual(),
      });
      alert(revertidas === 0
        ? 'Remito anulado. No había stock que devolver (remito documental).'
        : `Remito anulado. ${revertidas} unidad(es) devueltas a su posición de origen.`);
    } catch (e) {
      console.error('Error anulando remito:', e);
      alert(e instanceof Error ? e.message : 'Error al anular el remito');
    } finally { setActing(false); }
  };

  return { acting, transition, confirmarRemito, toggleDevuelto, subirFirma, quitarFirma, anularRemito };
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
