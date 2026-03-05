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

export const ImportacionEmbarqueSection: React.FC<Props> = ({ imp, onUpdate }) => {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    puertoOrigen: imp.puertoOrigen || '',
    puertoDestino: imp.puertoDestino || '',
    naviera: imp.naviera || '',
    booking: imp.booking || '',
    contenedor: imp.contenedor || '',
    fechaEmbarque: imp.fechaEmbarque ? imp.fechaEmbarque.slice(0, 10) : '',
    fechaEstimadaArribo: imp.fechaEstimadaArribo ? imp.fechaEstimadaArribo.slice(0, 10) : '',
    fechaArriboReal: imp.fechaArriboReal ? imp.fechaArriboReal.slice(0, 10) : '',
  });

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSave = async () => {
    try {
      setSaving(true);
      await importacionesService.update(imp.id, {
        puertoOrigen: form.puertoOrigen || null,
        puertoDestino: form.puertoDestino || null,
        naviera: form.naviera || null,
        booking: form.booking || null,
        contenedor: form.contenedor || null,
        fechaEmbarque: form.fechaEmbarque || null,
        fechaEstimadaArribo: form.fechaEstimadaArribo || null,
        fechaArriboReal: form.fechaArriboReal || null,
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
      title="Embarque"
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
          <Input inputSize="sm" label="Puerto de origen" value={form.puertoOrigen} onChange={set('puertoOrigen')} />
          <Input inputSize="sm" label="Puerto de destino" value={form.puertoDestino} onChange={set('puertoDestino')} />
          <Input inputSize="sm" label="Naviera" value={form.naviera} onChange={set('naviera')} />
          <Input inputSize="sm" label="Booking" value={form.booking} onChange={set('booking')} />
          <Input inputSize="sm" label="Contenedor" value={form.contenedor} onChange={set('contenedor')} />
          <Input inputSize="sm" label="Fecha embarque" type="date" value={form.fechaEmbarque} onChange={set('fechaEmbarque')} />
          <Input inputSize="sm" label="ETA" type="date" value={form.fechaEstimadaArribo} onChange={set('fechaEstimadaArribo')} />
          <Input inputSize="sm" label="Arribo real" type="date" value={form.fechaArriboReal} onChange={set('fechaArriboReal')} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <div><label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Puerto de origen</label><p className="text-xs text-slate-700">{imp.puertoOrigen || '-'}</p></div>
          <div><label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Puerto de destino</label><p className="text-xs text-slate-700">{imp.puertoDestino || '-'}</p></div>
          <div><label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Naviera</label><p className="text-xs text-slate-700">{imp.naviera || '-'}</p></div>
          <div><label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Booking</label><p className="text-xs text-slate-700">{imp.booking || '-'}</p></div>
          <div><label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Contenedor</label><p className="text-xs text-slate-700">{imp.contenedor || '-'}</p></div>
          <div><label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Fecha embarque</label><p className="text-xs text-slate-700">{formatDate(imp.fechaEmbarque)}</p></div>
          <div><label className="text-[11px] font-medium text-slate-400 mb-0.5 block">ETA</label><p className="text-xs text-slate-700">{formatDate(imp.fechaEstimadaArribo)}</p></div>
          <div><label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Arribo real</label><p className="text-xs text-slate-700">{formatDate(imp.fechaArriboReal)}</p></div>
        </div>
      )}
    </Card>
  );
};
