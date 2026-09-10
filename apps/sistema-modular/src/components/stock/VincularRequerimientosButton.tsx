import { useState } from 'react';
import type { OrdenCompra } from '@ags/shared';
import { Button } from '../ui/Button';
import { ConciliarRequerimientosModal } from './ConciliarRequerimientosModal';

interface Props {
  oc: OrdenCompra;
  /** Se vincularon requerimientos (o se omitió): refrescar la OC. */
  onDone: () => void;
}

/**
 * Conciliación a demanda (2026-09-10): el paso que aparece al enviar la OC,
 * pero para una OC que YA está enviada o embarcada y se armó sin pasar por
 * la planilla (caso JAS045). Oculto en estados terminales.
 */
export const VincularRequerimientosButton: React.FC<Props> = ({ oc, onDone }) => {
  const [open, setOpen] = useState(false);
  if (oc.estado === 'cancelada' || oc.estado === 'recibida') return null;
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Vincular requerimientos</Button>
      <ConciliarRequerimientosModal
        open={open}
        oc={oc}
        avisarSiVacio
        onResuelto={() => { setOpen(false); onDone(); }}
        onCancelar={() => setOpen(false)}
      />
    </>
  );
};
