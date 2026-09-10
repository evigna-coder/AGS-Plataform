import { useCallback } from 'react';
import type { CierreAdministrativo, StockSelection } from '@ags/shared';
import { reversionCierreService } from '../services/reversionCierreService';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { notify } from '../utils/notify';

/**
 * Reversión por línea de un consumo del cierre de OT (2026-09-10, fase 2 de la
 * reapertura): confirma, genera el contra-asiento vía el service (que persiste
 * la OT) y refleja las selecciones resultantes en el formulario del cierre.
 */
export function useRevertirConsumoCierre(
  otNumber: string | undefined,
  cierreAdmin: CierreAdministrativo,
  onChange: (field: keyof CierreAdministrativo, value: unknown) => void,
) {
  const confirmar = useConfirm();
  return useCallback(async (sel: StockSelection) => {
    if (!otNumber) return;
    const ok = await confirmar({
      title: 'Revertir consumo',
      message: `Se repone ${sel.cantidadDeducida ?? sel.cantidad} × ${sel.partCodigo} a ${sel.origenNombre || 'su origen'} con un contra-asiento y la línea vuelve a quedar sin origen elegido. No se borra ningún asiento del kardex.`,
      confirmLabel: 'Revertir',
    });
    if (!ok) return;
    try {
      const r = await reversionCierreService.revertirSeleccion({ otNumber, cierreAdmin }, sel);
      onChange('stockSelections', r.selecciones);
      notify.success(`Consumo revertido (${r.contraAsientos.length} contra-asiento${r.contraAsientos.length === 1 ? '' : 's'})`);
      for (const a of r.avisos) notify.warning(a);
    } catch (err) {
      console.error('[useRevertirConsumoCierre]', err);
      notify.error(err instanceof Error ? err.message : 'No se pudo revertir el consumo');
    }
  }, [otNumber, cierreAdmin, onChange, confirmar]);
}
