import { useState } from 'react';
import { importacionesService } from '../../services/firebaseService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { Importacion } from '@ags/shared';

interface Props {
  imp: Importacion;
  onUpdate: () => void;
}

export const ImportacionVEPSection: React.FC<Props> = ({ imp, onUpdate }) => {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    vepNumero: imp.vepNumero || '',
    vepMonto: imp.vepMonto != null ? String(imp.vepMonto) : '',
    vepMoneda: imp.vepMoneda || 'ARS',
    vepFechaPago: imp.vepFechaPago ? imp.vepFechaPago.slice(0, 10) : '',
  });

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSave = async () => {
    try {
      setSaving(true);
      await importacionesService.update(imp.id, {
        vepNumero: form.vepNumero || null,
        vepMonto: form.vepMonto ? parseFloat(form.vepMonto) : null,
        vepMoneda: (form.vepMoneda as 'ARS' | 'USD') || null,
        vepFechaPago: form.vepFechaPago || null,
      });
      setEditing(false);
      onUpdate();
    } catch (err) {
      alert('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  // Confirmación explícita del pago (2026-08-27): estampa la fecha efectiva y
  // saca el VEP de los pendientes del flujo de fondos (vista Pagos VEP).
  const setPagado = async (pagado: boolean) => {
    try {
      setSaving(true);
      await importacionesService.update(imp.id, {
        vepPagado: pagado,
        vepFechaPagado: pagado ? new Date().toISOString().slice(0, 10) : null,
      });
      onUpdate();
    } catch {
      alert('Error al confirmar el pago');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (d?: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatMonto = (monto?: number | null, moneda?: string | null) => {
    if (monto == null) return '-';
    return `${moneda || 'ARS'} ${monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  };

  return (
    <Card
      title="VEP (Volante Electronico de Pago)"
      compact
      actions={
        editing ? (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {imp.vepPagado ? (
              <>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                  Pagado{imp.vepFechaPagado ? ` el ${formatDate(imp.vepFechaPagado)}` : ''}
                </span>
                <button onClick={() => void setPagado(false)} disabled={saving}
                  className="text-[10px] text-slate-400 hover:text-slate-600 hover:underline">deshacer</button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => void setPagado(true)} disabled={saving}>
                Confirmar pago
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Editar</Button>
          </div>
        )
      }
    >
      {editing ? (
        <div className="grid grid-cols-2 gap-3">
          <Input inputSize="sm" label="Numero VEP" value={form.vepNumero} onChange={set('vepNumero')} />
          <Input inputSize="sm" label="Monto" type="number" step="0.01" value={form.vepMonto} onChange={set('vepMonto')} />
          <div>
            <label className="text-[11px] font-medium text-slate-700 mb-1 block">Moneda</label>
            <select
              value={form.vepMoneda}
              onChange={set('vepMoneda')}
              className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <Input inputSize="sm" label="Fecha de pago" type="date" value={form.vepFechaPago} onChange={set('vepFechaPago')} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <div><label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Numero VEP</label><p className="text-xs text-slate-700">{imp.vepNumero || '-'}</p></div>
          <div><label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Monto</label><p className="text-xs text-slate-700">{formatMonto(imp.vepMonto, imp.vepMoneda)}</p></div>
          <div><label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Moneda</label><p className="text-xs text-slate-700">{imp.vepMoneda || '-'}</p></div>
          <div><label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Fecha de pago</label><p className="text-xs text-slate-700">{formatDate(imp.vepFechaPago)}</p></div>
        </div>
      )}
    </Card>
  );
};
