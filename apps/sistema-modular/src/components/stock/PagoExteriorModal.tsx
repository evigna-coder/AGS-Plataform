import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { pagosExteriorService } from '../../services/pagosExteriorService';
import type { PagoExterior } from '@ags/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Pago existente para editar; null = alta. */
  pago?: PagoExterior | null;
}

const lbl = 'block text-[11px] font-medium text-slate-500 mb-1';
const ctrl = 'w-full text-xs border border-slate-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500';

/**
 * Alta/edición de un pago al exterior cargado a mano (2026-08-06): giros al
 * proveedor (o VEPs) de OCs que todavía no están en el sistema. Entra al flujo
 * de fondos igual que los que derivan de una importación.
 */
export const PagoExteriorModal: React.FC<Props> = ({ open, onClose, onSaved, pago = null }) => {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    tipo: 'giro' as 'giro' | 'vep',
    fecha: new Date().toISOString().slice(0, 10),
    proveedorNombre: '',
    referencia: '',
    monto: '',
    moneda: 'USD' as 'USD' | 'EUR' | 'ARS',
    pagado: false,
    notas: '',
  });

  useEffect(() => {
    if (!open) return;
    setForm(pago ? {
      tipo: pago.tipo, fecha: pago.fecha.slice(0, 10),
      proveedorNombre: pago.proveedorNombre ?? '',
      referencia: pago.referencia ?? '',
      monto: pago.monto != null ? String(pago.monto) : '',
      moneda: pago.moneda ?? 'USD',
      pagado: pago.pagado === true,
      notas: pago.notas ?? '',
    } : {
      tipo: 'giro', fecha: new Date().toISOString().slice(0, 10),
      proveedorNombre: '', referencia: '', monto: '', moneda: 'USD', pagado: false, notas: '',
    });
  }, [open, pago]);

  const canSave = form.proveedorNombre.trim() !== '' && Number(form.monto) > 0 && !!form.fecha;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = {
        tipo: form.tipo,
        fecha: form.fecha,
        proveedorNombre: form.proveedorNombre.trim(),
        referencia: form.referencia.trim() || null,
        monto: Number(form.monto),
        moneda: form.moneda,
        pagado: form.pagado,
        notas: form.notas.trim() || null,
      };
      if (pago) await pagosExteriorService.update(pago.id, payload);
      else await pagosExteriorService.create(payload);
      onSaved();
      onClose();
    } catch (err) {
      console.error('[PagoExteriorModal] guardar falló:', err);
      alert('Error al guardar el pago');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!pago || !confirm('¿Eliminar este pago del flujo?')) return;
    setSaving(true);
    try {
      await pagosExteriorService.delete(pago.id);
      onSaved();
      onClose();
    } catch {
      alert('Error al eliminar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} maxWidth="md"
      title={pago ? 'Editar pago al exterior' : 'Nuevo pago al exterior'}
      subtitle="Carga manual — para OCs que todavía no están en el sistema"
      footer={<>
        {pago && <Button variant="danger" size="sm" onClick={handleDelete} disabled={saving}>Eliminar</Button>}
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
        <Button size="sm" onClick={handleSave} disabled={saving || !canSave}>
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </>}>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={lbl}>Tipo *</label>
            <select className={ctrl} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as 'giro' | 'vep' }))}>
              <option value="giro">Giro al proveedor</option>
              <option value="vep">VEP (aduana)</option>
            </select>
          </div>
          <Input inputSize="sm" label="Fecha de pago *" type="date" value={form.fecha}
            onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
          <div>
            <label className={lbl}>Moneda</label>
            <select className={ctrl} value={form.moneda} onChange={e => setForm(f => ({ ...f, moneda: e.target.value as 'USD' | 'EUR' | 'ARS' }))}>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="ARS">ARS</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input inputSize="sm" label="Proveedor *" value={form.proveedorNombre}
            onChange={e => setForm(f => ({ ...f, proveedorNombre: e.target.value }))}
            placeholder="A quién se le paga" />
          <Input inputSize="sm" label="Monto *" type="number" value={form.monto}
            onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} placeholder="0.00" />
        </div>

        <Input inputSize="sm" label="Referencia" value={form.referencia}
          onChange={e => setForm(f => ({ ...f, referencia: e.target.value }))}
          placeholder="N° de OC, factura o lo que identifique el pago" />

        <Input inputSize="sm" label="Notas" value={form.notas}
          onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
          placeholder="Opcional" />

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.pagado}
            onChange={e => setForm(f => ({ ...f, pagado: e.target.checked }))}
            className="w-3.5 h-3.5 accent-teal-600" />
          <span className="text-xs text-slate-700">Ya pagado <span className="text-slate-400">(sale del flujo de pendientes)</span></span>
        </label>
      </div>
    </Modal>
  );
};
