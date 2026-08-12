import { useState } from 'react';
import type { RemitoItem } from '@ags/shared';
import { remitosService } from '../../services/stockService';
import { useConfirm } from '../ui/ConfirmDialog';

interface Props {
  remitoId: string;
  item: RemitoItem;
}

/**
 * Registra la vuelta de un LOANER derivado a proveedor (2026-08-12): marca la
 * línea del remito como devuelta (cerrando el remito si todo quedó resuelto) y
 * dispara la calificación pendiente del proveedor. Las líneas de loaner son
 * documentales — el loaner no cambia de estado, por eso este botón y no el
 * circuito de préstamos.
 */
export function LoanerRetornoButton({ remitoId, item }: Props) {
  const confirm = useConfirm();
  const [acting, setActing] = useState(false);

  const handle = async () => {
    if (!item.loanerId) return;
    const label = item.loanerCodigo || item.loanerDescripcion || 'el loaner';
    if (!await confirm(`¿Registrar la vuelta de ${label} del proveedor? La línea queda devuelta y se genera la calificación pendiente del proveedor.`)) return;
    try {
      setActing(true);
      await remitosService.marcarLoanerRetornado(remitoId, item.id);
    } catch (err) {
      console.error('[LoanerRetornoButton]', err);
      alert(err instanceof Error ? err.message : 'No se pudo registrar la vuelta');
    } finally {
      setActing(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handle}
      disabled={acting}
      className="text-[10px] font-medium text-teal-700 hover:text-teal-900 underline underline-offset-2 disabled:opacity-50"
    >
      {acting ? 'Registrando…' : 'Registrar vuelta'}
    </button>
  );
}
