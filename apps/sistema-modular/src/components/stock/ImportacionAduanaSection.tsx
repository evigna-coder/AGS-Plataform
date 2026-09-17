import { useState } from 'react';
import { importacionesService } from '../../services/firebaseService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { Importacion } from '@ags/shared';

import { notify } from '../../utils/notify';
interface Props {
  imp: Importacion;
  onUpdate: () => void;
}

export const ImportacionAduanaSection: React.FC<Props> = ({ imp, onUpdate }) => {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const desdeImp = () => ({
    despachante: imp.despachante || '',
    despachoNumero: imp.despachoNumero || '',
    fechaDespacho: imp.fechaDespacho ? imp.fechaDespacho.slice(0, 10) : '',
    numeroGuia: imp.numeroGuia || '',
    // Según despacho (2026-09-16), en USD: reemplazan al estimado en el costeo.
    derechosDespacho: imp.derechosDespacho != null ? String(imp.derechosDespacho) : '',
    estadisticaDespacho: imp.estadisticaDespacho != null ? String(imp.estadisticaDespacho) : '',
    motivoAjusteDespacho: imp.motivoAjusteDespacho || '',
  });
  const [form, setForm] = useState(desdeImp);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSave = async () => {
    try {
      setSaving(true);
      await importacionesService.update(imp.id, {
        despachante: form.despachante || null,
        despachoNumero: form.despachoNumero || null,
        fechaDespacho: form.fechaDespacho || null,
        numeroGuia: form.numeroGuia || null,
        derechosDespacho: form.derechosDespacho ? Number(form.derechosDespacho) : null,
        estadisticaDespacho: form.estadisticaDespacho ? Number(form.estadisticaDespacho) : null,
        motivoAjusteDespacho: form.motivoAjusteDespacho.trim() || null,
      });
      setEditing(false);
      onUpdate();
    } catch (err) {
      notify.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm(desdeImp());
    setEditing(false);
  };
  const fmtUsd = (n?: number | null) => n == null ? '-' : `USD ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatDate = (d?: string | null) => {
    if (!d) return '-';
    // Del TEXTO ISO, no de Date+toLocaleDateString: los datos viejos guardados a
    // medianoche UTC retrocedían un día al formatear en huso argentino.
    const [y, m, dd] = d.slice(0, 10).split('-');
    return `${dd}/${m}/${y}`;
  };

  return (
    <Card
      title="Aduana"
      compact
      actions={
        editing ? (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleCancel}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Editar</Button>
        )
      }
    >
      {editing ? (
        <div className="grid grid-cols-2 gap-3">
          <Input inputSize="sm" label="Despachante" value={form.despachante} onChange={set('despachante')} />
          <Input inputSize="sm" label="Numero de despacho" value={form.despachoNumero} onChange={set('despachoNumero')} />
          <Input inputSize="sm" label="Fecha de despacho" type="date" value={form.fechaDespacho} onChange={set('fechaDespacho')} />
          <Input inputSize="sm" label="Guia" value={form.numeroGuia} onChange={set('numeroGuia')} />
          <Input inputSize="sm" label="Derechos s/ despacho (USD)" type="number" step="0.01" min="0" value={form.derechosDespacho} onChange={set('derechosDespacho')} />
          <Input inputSize="sm" label="Estadística s/ despacho (USD)" type="number" step="0.01" min="0" value={form.estadisticaDespacho} onChange={set('estadisticaDespacho')} />
          <div className="col-span-2">
            <Input inputSize="sm" label="Motivo del ajuste (opcional)" value={form.motivoAjusteDespacho} onChange={set('motivoAjusteDespacho')} placeholder="ajuste de valor en aduana, diferencia de cambio…" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <div>
            <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Despachante</label>
            <p className="text-xs text-slate-700">{imp.despachante || (imp.esCourier ? 'Courier' : '-')}</p>
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Numero de despacho</label>
            <p className="text-xs text-slate-700">{imp.despachoNumero || '-'}</p>
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Fecha de despacho</label>
            <p className="text-xs text-slate-700">{formatDate(imp.fechaDespacho)}</p>
          </div>
          <div>
            <label className="font-mono uppercase tracking-wide text-[10px] font-medium text-slate-400 mb-0.5 block">GUÍA</label>
            <p className="text-xs text-slate-700">{imp.numeroGuia || '-'}</p>
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Derechos s/ despacho</label>
            <p className="text-xs text-slate-700 font-mono">{fmtUsd(imp.derechosDespacho)}</p>
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Estadística s/ despacho</label>
            <p className="text-xs text-slate-700 font-mono">{fmtUsd(imp.estadisticaDespacho)}</p>
          </div>
          {imp.motivoAjusteDespacho && (
            <div className="col-span-2">
              <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Motivo del ajuste</label>
              <p className="text-xs text-slate-700">{imp.motivoAjusteDespacho}</p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
