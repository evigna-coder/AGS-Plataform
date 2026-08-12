import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { OrdenCompra } from '@ags/shared';

interface Props {
  oc: OrdenCompra | null;
  onClose: () => void;
}

/**
 * Notas de una orden de compra en modal liviano (2026-08-12): el comprador
 * documenta cómo está armada la OC (y el sistema vuelca el detalle de los
 * requerimientos al generarla). Accesible desde "Notas" en el listado de OC
 * sin tener que abrir la orden completa.
 */
export const OCNotasModal: React.FC<Props> = ({ oc, onClose }) => {
  if (!oc) return null;
  return (
    <Modal open onClose={onClose} title={`Notas — ${oc.numero}`} maxWidth="md"
      subtitle={oc.proveedorNombre}
      footer={<Button size="sm" onClick={onClose}>Cerrar</Button>}>
      {oc.notas ? (
        <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed py-1">{oc.notas}</p>
      ) : (
        <p className="text-xs text-slate-400 py-1">Esta orden de compra no tiene notas.</p>
      )}
    </Modal>
  );
};
