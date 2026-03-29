import { useState } from 'react';
import { importacionesService } from '../../services/firebaseService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import type { Importacion, GastoImportacion } from '@ags/shared';

interface Props {
  imp: Importacion;
  onUpdate: () => void;
}

const MONEDAS = ['ARS', 'USD', 'EUR'] as const;

export const ImportacionGastosSection: React.FC<Props> = ({ imp, onUpdate }) => {
  const [saving, setSaving] = useState(false);
  const [newGasto, setNewGasto] = useState<Partial<GastoImportacion> | null>(null);

  const handleAdd = () => {
    setNewGasto({ concepto: '', descripcion: '', monto: 0, moneda: 'USD', fecha: '' });
  };

  const handleSaveNew = async () => {
    if (!newGasto?.concepto) { alert('Ingresa un concepto'); return; }
    try {
      setSaving(true);
      const gasto: GastoImportacion = {
        id: crypto.randomUUID(),
        concepto: newGasto.concepto || '',
        descripcion: newGasto.descripcion || null,
        monto: Number(newGasto.monto) || 0,
        moneda: (newGasto.moneda as 'ARS' | 'USD' | 'EUR') || 'USD',
        fecha: newGasto.fecha || null,
      };
      await importacionesService.update(imp.id, {
        gastos: [...(imp.gastos || []), gasto],
      });
      setNewGasto(null);
      onUpdate();
    } catch (err) {
      alert('Error al agregar gasto');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (gastoId: string) => {
    if (!confirm('Eliminar este gasto?')) return;
    try {
      setSaving(true);
      await importacionesService.update(imp.id, {
        gastos: (imp.gastos || []).filter(g => g.id !== gastoId),
      });
      onUpdate();
    } catch (err) {
      alert('Error al eliminar gasto');
    } finally {
      setSaving(false);
    }
  };

  const totals = (imp.gastos || []).reduce((acc, g) => {
    acc[g.moneda] = (acc[g.moneda] || 0) + g.monto;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Card
      title="Gastos de importacion"
      compact
      actions={<Button variant="ghost" size="sm" onClick={handleAdd}>+ Agregar</Button>}
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-center text-[11px] font-medium text-slate-400 tracking-wider py-2 pr-3">Concepto</th>
              <th className="text-center text-[11px] font-medium text-slate-400 tracking-wider py-2 pr-3">Descripcion</th>
              <th className="text-center text-[11px] font-medium text-slate-400 tracking-wider py-2 pr-3">Monto</th>
              <th className="text-center text-[11px] font-medium text-slate-400 tracking-wider py-2 pr-3">Moneda</th>
              <th className="text-center text-[11px] font-medium text-slate-400 tracking-wider py-2 pr-3">Fecha</th>
              <th className="text-center text-[11px] font-medium text-slate-400 tracking-wider py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(imp.gastos || []).map(g => (
              <tr key={g.id} className="border-b border-slate-50">
                <td className="text-xs py-2 pr-3 text-slate-700">{g.concepto}</td>
                <td className="text-xs py-2 pr-3 text-slate-500">{g.descripcion || '-'}</td>
                <td className="text-xs py-2 pr-3 text-slate-700 text-right tabular-nums">{g.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                <td className="text-xs py-2 pr-3 text-slate-500">{g.moneda}</td>
                <td className="text-xs py-2 pr-3 text-slate-500">{g.fecha ? new Date(g.fecha).toLocaleDateString('es-AR') : '-'}</td>
                <td className="text-xs py-2 text-right">
                  <button onClick={() => handleDelete(g.id)} className="text-red-500 hover:text-red-700 text-[10px]" disabled={saving}>Eliminar</button>
                </td>
              </tr>
            ))}
            {newGasto && (
              <tr className="border-b border-slate-50 bg-teal-50/30">
                <td className="py-2 pr-2">
                  <input className="w-full text-xs border border-slate-300 rounded px-2 py-1" placeholder="Concepto" value={newGasto.concepto || ''} onChange={e => setNewGasto(p => ({ ...p, concepto: e.target.value }))} />
                </td>
                <td className="py-2 pr-2">
                  <input className="w-full text-xs border border-slate-300 rounded px-2 py-1" placeholder="Descripcion" value={newGasto.descripcion || ''} onChange={e => setNewGasto(p => ({ ...p, descripcion: e.target.value }))} />
                </td>
                <td className="py-2 pr-2">
                  <input type="number" step="0.01" className="w-full text-xs border border-slate-300 rounded px-2 py-1 text-right" value={newGasto.monto || ''} onChange={e => setNewGasto(p => ({ ...p, monto: parseFloat(e.target.value) || 0 }))} />
                </td>
                <td className="py-2 pr-2">
                  <select className="text-xs border border-slate-300 rounded px-2 py-1" value={newGasto.moneda || 'USD'} onChange={e => setNewGasto(p => ({ ...p, moneda: e.target.value as any }))}>
                    {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </td>
                <td className="py-2 pr-2">
                  <input type="date" className="text-xs border border-slate-300 rounded px-2 py-1" value={newGasto.fecha || ''} onChange={e => setNewGasto(p => ({ ...p, fecha: e.target.value }))} />
                </td>
                <td className="py-2 text-right">
                  <div className="flex gap-1 justify-end">
                    <button onClick={handleSaveNew} className="text-teal-600 hover:text-teal-800 text-[10px] font-medium" disabled={saving}>Guardar</button>
                    <button onClick={() => setNewGasto(null)} className="text-slate-400 hover:text-slate-600 text-[10px]">Cancelar</button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {Object.keys(totals).length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex gap-4 justify-end">
          {Object.entries(totals).map(([moneda, total]) => (
            <div key={moneda} className="text-right">
              <span className="text-[11px] font-medium text-slate-400 mr-2">Total {moneda}:</span>
              <span className="text-xs font-semibold text-slate-700 tabular-nums">
                {total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
