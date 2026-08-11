import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { RemitoTransportistaPicker } from '../remitos/RemitoTransportistaPicker';
import type { DatosTransportista } from '../../services/stockService';
import type { Proveedor } from '@ags/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Ejecuta la asignación; el caller cierra el modal si devuelve true. */
  onConfirm: () => Promise<boolean>;
  saving: boolean;
  itemCount: number;
  ingenieroCount: number;
  proveedores: Proveedor[];
  transportistaId: string;
  transportista: DatosTransportista;
  onTransportistaChange: (next: { id: string; datos: DatosTransportista }) => void;
}

/**
 * Paso de confirmación de la asignación rápida (2026-08-11): acá nace el
 * remito de salida a campo, así que el transportista se pide en este momento
 * — antes vivía fijo en el footer del panel y parecía un dato de la página.
 */
export function ConfirmarAsignacionModal({
  open, onClose, onConfirm, saving, itemCount, ingenieroCount,
  proveedores, transportistaId, transportista, onTransportistaChange,
}: Props) {
  const handleConfirmar = async () => {
    if (await onConfirm()) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Remito de salida a campo"
      subtitle={`${itemCount} item${itemCount === 1 ? '' : 's'} → ${ingenieroCount} IST`}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button size="sm" onClick={handleConfirmar} disabled={saving}>
            {saving ? 'Procesando...' : 'Confirmar asignación'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          Se genera un remito de salida por cada ingeniero con lo que se lleva.
          El transportista es opcional y sale impreso en el recuadro del papel.
        </p>
        <RemitoTransportistaPicker
          proveedores={proveedores}
          selectedId={transportistaId}
          value={transportista}
          onChange={onTransportistaChange}
        />
      </div>
    </Modal>
  );
}
