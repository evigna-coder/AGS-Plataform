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

export const ImportacionAduanaSection: React.FC<Props> = ({ imp, onUpdate }) => {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    despachante: imp.despachante || '',
    despachoNumero: imp.despachoNumero || '',
    fechaDespacho: imp.fechaDespacho ? imp.fechaDespacho.slice(0, 10) : '',
  });

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSave = async () => {
    try {
      setSaving(true);
      await importacionesService.update(imp.id, {
        despachante: form.despachante || null,
        despachoNumero: form.despachoNumero || null,
        fechaDespacho: form.fechaDespacho || null,
      });
      setEditing(false);
      onUpdate();
    } catch (err) {
      alert('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (d?: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <Card
      title="Aduana"
      compact
      actions={
        editing ? (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancelar</Button>
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
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <div><label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Despachante</label><p className="text-xs text-slate-700">{imp.despachante || '-'}</p></div>
          <div><label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Numero de despacho</label><p className="text-xs text-slate-700">{imp.despachoNumero || '-'}</p></div>
          <div><label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Fecha de despacho</label><p className="text-xs text-slate-700">{formatDate(imp.fechaDespacho)}</p></div>
        </div>
      )}
    </Card>
  );
};
