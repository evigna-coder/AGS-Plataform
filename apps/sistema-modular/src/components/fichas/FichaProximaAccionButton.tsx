import { useState } from 'react';
import type { FichaPropiedad } from '@ags/shared';
import { fichasService } from '../../services/firebaseService';
import { useConfirm } from '../ui/ConfirmDialog';
import type { ProximaAccionFicha } from '../../utils/proximaAccionFicha';

/**
 * El paso siguiente de la ficha, operable desde el listado (2026-08-23).
 *
 * Cuando el paso no es inequívoco no se ofrece: se muestra el motivo apagado y
 * el usuario abre la ficha. Ver `proximaAccionFicha` para la regla.
 *
 * Siempre pide confirmación. Es una acción de una sola tecla sobre una grilla
 * densa —con las filas clickeables— y un roce mueve el estado de un equipo del
 * cliente.
 */

interface Props {
  ficha: FichaPropiedad;
  accion: ProximaAccionFicha;
  onDone: () => void;
}

export const FichaProximaAccionButton: React.FC<Props> = ({ ficha, accion, onDone }) => {
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);

  if (!accion) return null;

  if (accion.tipo === 'ambigua') {
    return (
      <span className="text-[10px] text-slate-300 px-1 py-0.5" title={`${accion.motivo} — abrí la ficha para elegir`}>
        {accion.motivo}
      </span>
    );
  }

  const ejecutar = async () => {
    const ok = await confirm({
      title: accion.label,
      message: `${accion.detalle}. Ficha ${ficha.numero}${ficha.clienteNombre ? ` — ${ficha.clienteNombre}` : ''}.`,
      confirmLabel: accion.label,
    });
    if (!ok) return;
    setBusy(true);
    try {
      if (accion.tipo === 'devolucion') {
        await fichasService.markDerivacionRecibida(ficha.id, accion.itemId, accion.derivacionId);
      } else {
        await fichasService.transitionItem(
          ficha.id, accion.itemId, accion.hacia, `Desde el listado — ${accion.label}`,
        );
      }
      onDone();
    } catch (err) {
      console.error('[FichaProximaAccionButton]', err);
      alert('No se pudo aplicar el cambio.');
    } finally {
      setBusy(false);
    }
  };

  // La devolución se destaca: es la que estaba escondida en el detalle y la que
  // más se demora en registrar.
  const cls = accion.tipo === 'devolucion'
    ? 'text-violet-700 hover:text-violet-900 hover:bg-violet-50'
    : 'text-teal-600 hover:text-teal-800 hover:bg-teal-50';

  return (
    <button onClick={() => void ejecutar()} disabled={busy} title={accion.detalle}
      className={`text-[10px] font-medium px-1 py-0.5 rounded disabled:opacity-50 ${cls}`}>
      {busy ? '...' : accion.label}
    </button>
  );
};
