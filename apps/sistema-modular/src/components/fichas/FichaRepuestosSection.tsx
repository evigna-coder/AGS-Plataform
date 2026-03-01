import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { fichasService } from '../../services/firebaseService';
import type { FichaPropiedad, RepuestoPendiente } from '@ags/shared';

interface Props {
  ficha: FichaPropiedad;
  onUpdate: () => void;
}

export function FichaRepuestosSection({ ficha, onUpdate }: Props) {
  const [adding, setAdding] = useState(false);
  const [desc, setDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!desc.trim()) return;
    setSaving(true);
    try {
      const newItem: RepuestoPendiente = {
        id: crypto.randomUUID(),
        descripcion: desc.trim(),
        estado: 'pendiente',
        leadId: null,
        leadDescripcion: null,
        ordenCompraId: null,
        ordenCompraNumero: null,
      };
      await fichasService.update(ficha.id, {
        repuestosPendientes: [...ficha.repuestosPendientes, newItem],
      });
      setDesc('');
      setAdding(false);
      onUpdate();
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateEstado = async (idx: number, estado: 'pendiente' | 'en_proceso' | 'recibido') => {
    const updated = [...ficha.repuestosPendientes];
    updated[idx] = { ...updated[idx], estado };
    await fichasService.update(ficha.id, { repuestosPendientes: updated });
    onUpdate();
  };

  const handleRemove = async (idx: number) => {
    const updated = ficha.repuestosPendientes.filter((_, i) => i !== idx);
    await fichasService.update(ficha.id, { repuestosPendientes: updated });
    onUpdate();
  };

  return (
    <Card
      title="Repuestos pendientes"
      actions={
        ficha.estado !== 'entregado' && !adding && (
          <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>+ Agregar</Button>
        )
      }
    >
      {ficha.repuestosPendientes.length === 0 && !adding && (
        <p className="text-sm text-slate-400">Sin repuestos pendientes</p>
      )}

      <div className="space-y-2">
        {ficha.repuestosPendientes.map((r, idx) => (
          <div key={r.id} className="flex items-center gap-3 p-2 bg-slate-50 rounded border border-slate-100">
            <div className="flex-1">
              <p className="text-sm text-slate-700">{r.descripcion}</p>
              <div className="flex gap-2 mt-1 text-xs text-slate-400">
                {r.leadId && <Link to={`/leads/${r.leadId}`} className="text-indigo-600 hover:underline">Lead: {r.leadDescripcion || r.leadId}</Link>}
                {r.ordenCompraId && <span>OC: {r.ordenCompraNumero || r.ordenCompraId}</span>}
              </div>
            </div>
            <select
              className="text-xs border border-slate-200 rounded px-2 py-1"
              value={r.estado}
              onChange={e => handleUpdateEstado(idx, e.target.value as any)}
            >
              <option value="pendiente">Pendiente</option>
              <option value="en_proceso">En proceso</option>
              <option value="recibido">Recibido</option>
            </select>
            <button className="text-xs text-red-400 hover:text-red-600" onClick={() => handleRemove(idx)}>Quitar</button>
          </div>
        ))}

        {adding && (
          <div className="flex items-center gap-2">
            <input
              className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="Descripcion del repuesto necesario"
              autoFocus
            />
            <Button variant="primary" size="sm" onClick={handleAdd} disabled={saving}>Agregar</Button>
            <Button variant="secondary" size="sm" onClick={() => { setAdding(false); setDesc(''); }}>Cancelar</Button>
          </div>
        )}
      </div>
    </Card>
  );
}
