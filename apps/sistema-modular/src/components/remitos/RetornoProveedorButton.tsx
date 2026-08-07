import { useState } from 'react';
import type { RemitoItem } from '@ags/shared';
import { remitosService } from '../../services/stockService';
import { useConfirm } from '../ui/ConfirmDialog';

interface Props {
  item: RemitoItem;
}

/**
 * Registra el retorno de una parte propia que estaba en el proveedor
 * (2026-08-07): la unidad vuelve a la ubicación de la que salió, queda
 * disponible y la línea del remito se marca como devuelta.
 *
 * Solo aparece en líneas con `unidadId` de un remito de derivación: los items
 * de ficha vuelven por el circuito de la ficha, no por acá.
 */
export function RetornoProveedorButton({ item }: Props) {
  const confirm = useConfirm();
  const [acting, setActing] = useState(false);

  const handle = async () => {
    if (!item.unidadId) return;
    const label = item.articuloCodigo || item.articuloDescripcion || 'la parte';
    if (!await confirm(`¿Registrar el retorno de ${label}? Vuelve al depósito del que salió y queda disponible.`)) return;
    try {
      setActing(true);
      await remitosService.registrarRetornoUnidad(item.unidadId);
    } catch (err) {
      console.error('[RetornoProveedorButton]', err);
      alert(err instanceof Error ? err.message : 'No se pudo registrar el retorno');
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
      {acting ? 'Registrando…' : 'Registrar retorno'}
    </button>
  );
}
