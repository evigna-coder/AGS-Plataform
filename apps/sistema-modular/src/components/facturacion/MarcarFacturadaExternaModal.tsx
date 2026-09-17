import { useState } from 'react';
import type { Presupuesto, PresupuestoCuota } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { facturacionService } from '../../services/facturacionService';
import { notify } from '../../utils/notify';
import { hoyLocalISO } from '../../utils/cuotasContrato';

interface Props {
  ppto: Presupuesto;
  cuota: PresupuestoCuota;
  clienteNombre: string;
  actor: { uid: string; name?: string };
  onClose: () => void;
  onDone: () => void;
}

/**
 * Cuota de contrato facturada FUERA del sistema (2026-09-16, caso TEVA:
 * la cuota 1 salió por el sistema viejo). Registra una solicitud ya
 * `facturada` con la referencia, así la cuota deja de aparecer como pendiente
 * y el aviso automático no la vuelve a generar.
 */
export function MarcarFacturadaExternaModal({ ppto, cuota, clienteNombre, actor, onClose, onDone }: Props) {
  const [fecha, setFecha] = useState(hoyLocalISO());
  const [referencia, setReferencia] = useState('');
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!fecha) { notify.warning('Indicá la fecha de la factura'); return; }
    setSaving(true);
    try {
      await facturacionService.registrarFacturadaExterna({
        presupuesto: ppto, cuota, clienteNombre, fecha, referencia: referencia.trim() || null, actor,
      });
      notify.success(`${cuota.descripcion || `Cuota ${cuota.numero}`} (${cuota.moneda}) marcada como facturada fuera del sistema.`);
      onDone();
    } catch (err) {
      console.error('[MarcarFacturadaExterna]', err);
      notify.error(err instanceof Error ? err.message : 'No se pudo registrar');
    } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title="Facturada fuera del sistema" maxWidth="sm"
      subtitle={`${ppto.numero} · ${cuota.descripcion || `Cuota ${cuota.numero}`} · ${cuota.moneda} ${cuota.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button size="sm" onClick={() => void handleConfirm()} disabled={saving}>{saving ? 'Guardando…' : 'Confirmar'}</Button>
        </div>
      }
    >
      <div className="space-y-3 py-1">
        <p className="text-xs text-slate-500">
          Queda registrada como facturada con la referencia que cargues. No sale aviso a facturación ni se genera de nuevo.
        </p>
        <Input inputSize="sm" label="Fecha de la factura" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
        <Input inputSize="sm" label="Referencia (N° de factura, sistema viejo…)" value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="opcional" />
      </div>
    </Modal>
  );
}
