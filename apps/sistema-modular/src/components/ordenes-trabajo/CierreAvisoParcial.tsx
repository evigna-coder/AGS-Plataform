import { useState } from 'react';
import type { Presupuesto } from '@ags/shared';
import { Button } from '../ui/Button';
import { SolicitarFacturaModal } from '../presupuestos/SolicitarFacturaModal';
import { condicionesPagoService } from '../../services/presupuestosService';

interface Props {
  presupuesto: Presupuesto;
  otNumber: string;
  clienteNombre: string;
  disabled: boolean;
  onCreated: (solicitudId?: string) => void;
}

/**
 * Aviso PARCIAL por esta OT desde el cierre administrativo (2026-09-07).
 *
 * Un presupuesto por N visitas se factura visita a visita: cada cierre informa
 * su parte con el mismo modal que usa el presupuesto (por ítems o por % del
 * total), sin esperar a la última OT ni ir a informarlo a mano desde el
 * presupuesto. La solicitud queda vinculada a la OT.
 */
export function CierreAvisoParcial({ presupuesto, otNumber, clienteNombre, disabled, onCreated }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [condicionPagoNombre, setCondicionPagoNombre] = useState('No especificada');

  const abrir = async () => {
    const cpId = presupuesto.condicionPagoId;
    const cp = cpId ? await condicionesPagoService.getById(cpId).catch(() => null) : null;
    setCondicionPagoNombre(cp ? `${cp.nombre}${cp.dias > 0 ? ` (${cp.dias} días)` : ''}` : 'No especificada');
    setAbierto(true);
  };

  return (
    <>
      <div className="flex items-center justify-between gap-2 pt-1">
        <p className="text-[10px] text-slate-500">
          Informar solo lo de esta OT (por ítems o por % del presupuesto).
        </p>
        <Button size="sm" variant="outline" onClick={() => void abrir()} disabled={disabled}>
          Aviso parcial por OT-{otNumber}
        </Button>
      </div>
      {abierto && (
        <SolicitarFacturaModal
          open
          presupuesto={presupuesto}
          clienteNombre={clienteNombre}
          condicionPagoNombre={condicionPagoNombre}
          otNumbers={[otNumber]}
          observacionesInicial={`Aviso parcial desde cierre OT-${otNumber}`}
          onClose={() => setAbierto(false)}
          onCreated={id => { setAbierto(false); onCreated(id); }}
        />
      )}
    </>
  );
}
