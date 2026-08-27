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

/**
 * Giro al exterior en el detalle de la importación (2026-08-27). Antes solo se
 * gestionaba desde el modal de edición; la vista Pagos VEP manda acá al hacer
 * click en el evento, así que la confirmación del pago vive en esta sección.
 */
export const ImportacionGiroSection: React.FC<Props> = ({ imp, onUpdate }) => {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    giroMonto: imp.giroMonto != null ? String(imp.giroMonto) : '',
    giroMoneda: imp.giroMoneda || 'USD',
    giroFechaEstimada: imp.giroFechaEstimada ? imp.giroFechaEstimada.slice(0, 10) : '',
    anticipoPct: imp.anticipoPct != null ? String(imp.anticipoPct) : '',
  });

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSave = async () => {
    try {
      setSaving(true);
      await importacionesService.update(imp.id, {
        giroMonto: form.giroMonto ? parseFloat(form.giroMonto) : null,
        giroMoneda: (form.giroMoneda as 'ARS' | 'USD' | 'EUR') || null,
        giroFechaEstimada: form.giroFechaEstimada || null,
        anticipoPct: form.anticipoPct ? parseFloat(form.anticipoPct) : null,
      });
      setEditing(false);
      onUpdate();
    } catch {
      alert('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  // Confirmación explícita: estampa la fecha efectiva y saca el giro de los
  // pendientes del flujo de fondos. Recibir la mercadería NO lo cierra.
  const setPagado = async (pagado: boolean) => {
    try {
      setSaving(true);
      await importacionesService.update(imp.id, {
        giroPagado: pagado,
        giroFechaPagado: pagado ? new Date().toISOString().slice(0, 10) : null,
      });
      onUpdate();
    } catch {
      alert('Error al confirmar el giro');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (d?: string | null) => {
    if (!d) return '-';
    const [y, m, dd] = d.slice(0, 10).split('-');
    return `${dd}/${m}/${y}`;
  };

  const formatMonto = (monto?: number | null, moneda?: string | null) => {
    if (monto == null) return '-';
    return `${moneda || 'USD'} ${monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  };

  return (
    <Card
      title="Giro al exterior"
      compact
      actions={
        editing ? (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {imp.giroPagado ? (
              <>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                  Pagado{imp.giroFechaPagado ? ` el ${formatDate(imp.giroFechaPagado)}` : ''}
                </span>
                <button onClick={() => void setPagado(false)} disabled={saving}
                  className="text-[10px] text-slate-400 hover:text-slate-600 hover:underline">deshacer</button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => void setPagado(true)} disabled={saving}>
                Confirmar giro
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Editar</Button>
          </div>
        )
      }
    >
      {editing ? (
        <div className="grid grid-cols-2 gap-3">
          <Input inputSize="sm" label="Monto" type="number" step="0.01" value={form.giroMonto} onChange={set('giroMonto')} />
          <div>
            <label className="text-[11px] font-medium text-slate-700 mb-1 block">Moneda</label>
            <select
              value={form.giroMoneda}
              onChange={set('giroMoneda')}
              className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="ARS">ARS</option>
            </select>
          </div>
          <Input inputSize="sm" label="Fecha estimada de giro" type="date" value={form.giroFechaEstimada} onChange={set('giroFechaEstimada')} />
          <Input inputSize="sm" label="% anticipo" type="number" value={form.anticipoPct} onChange={set('anticipoPct')} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <div><label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Monto</label><p className="text-xs text-slate-700">{formatMonto(imp.giroMonto, imp.giroMoneda)}</p></div>
          <div><label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Fecha estimada</label><p className="text-xs text-slate-700">{formatDate(imp.giroFechaEstimada)}</p></div>
          <div><label className="text-[11px] font-medium text-slate-400 mb-0.5 block">% anticipo</label><p className="text-xs text-slate-700">{imp.anticipoPct != null ? `${imp.anticipoPct}%` : '-'}</p></div>
          <div><label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Estado</label><p className="text-xs text-slate-700">{imp.giroPagado ? `Pagado${imp.giroFechaPagado ? ` el ${formatDate(imp.giroFechaPagado)}` : ''}` : 'Pendiente'}</p></div>
        </div>
      )}
    </Card>
  );
};
