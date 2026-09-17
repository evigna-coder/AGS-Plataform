import { useState } from 'react';
import type { SolicitudFacturacion } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { facturacionService } from '../../services/facturacionService';
import { notify } from '../../utils/notify';
import { hoyLocalISO } from '../../utils/cuotasContrato';

interface Props {
  solicitud: SolicitudFacturacion;
  titulo: string;
  onClose: () => void;
  onDone: () => void;
}

/**
 * Número de factura desde "Cuotas por facturar" (2026-09-16): el aviso de la
 * cuota queda pendiente en esa pantalla hasta que Contable lo carga acá (o en
 * Facturación, es la misma solicitud).
 */
export function RegistrarFacturaCuotaModal({ solicitud, titulo, onClose, onDone }: Props) {
  const [numeroFactura, setNumeroFactura] = useState(solicitud.numeroFactura ?? '');
  const [fechaFactura, setFechaFactura] = useState((solicitud.fechaFactura ?? '').slice(0, 10) || hoyLocalISO());
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!numeroFactura.trim()) { notify.warning('Indicá el número de factura'); return; }
    if (!fechaFactura) { notify.warning('Indicá la fecha de la factura'); return; }
    setSaving(true);
    try {
      await facturacionService.registrarFactura(solicitud.id, { numeroFactura: numeroFactura.trim(), fechaFactura });
      notify.success(`Factura ${numeroFactura.trim()} registrada.`);
      onDone();
    } catch (err) {
      console.error('[RegistrarFacturaCuota]', err);
      notify.error(err instanceof Error ? err.message : 'No se pudo registrar la factura');
    } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title="Registrar factura" subtitle={titulo} maxWidth="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button size="sm" onClick={() => void handleConfirm()} disabled={saving}>{saving ? 'Guardando…' : 'Registrar'}</Button>
        </div>
      }
    >
      <div className="space-y-3 py-1">
        <Input inputSize="sm" label="N° de factura" value={numeroFactura} onChange={e => setNumeroFactura(e.target.value)} placeholder="0001-00001234" autoFocus />
        <Input inputSize="sm" label="Fecha de la factura" type="date" value={fechaFactura} onChange={e => setFechaFactura(e.target.value)} />
      </div>
    </Modal>
  );
}
