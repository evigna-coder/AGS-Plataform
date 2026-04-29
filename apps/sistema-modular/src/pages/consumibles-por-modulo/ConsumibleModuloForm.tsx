import { useState } from 'react';
import type { ConsumibleModulo } from '@ags/shared';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { consumiblesPorModuloService } from '../../services/consumiblesPorModuloService';

const th = 'px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-500 text-left';
const td = 'px-2 py-1';
const input = 'w-full border border-slate-200 rounded px-1.5 py-1 text-xs focus:ring-1 focus:ring-teal-400 focus:border-teal-400';

interface FormState {
  codigoModulo: string;
  descripcion: string;
  activo: boolean;
  consumibles: ConsumibleModulo[];
}

interface Props {
  initial: FormState;
  editingId: string | null;
  onCancel: () => void;
  onSaved: () => void;
}

export const ConsumibleModuloForm: React.FC<Props> = ({ initial, editingId, onCancel, onSaved }) => {
  const [form, setForm] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);

  const updateConsumible = (idx: number, field: keyof ConsumibleModulo, value: string | number) => {
    setForm(f => ({
      ...f,
      consumibles: f.consumibles.map((c, i) => (i === idx ? { ...c, [field]: value } : c)),
    }));
  };

  const addConsumible = () => {
    setForm(f => ({
      ...f,
      consumibles: [...f.consumibles, { codigo: '', descripcion: '', cantidad: 1 }],
    }));
  };

  const removeConsumible = (idx: number) => {
    setForm(f => ({ ...f, consumibles: f.consumibles.filter((_, i) => i !== idx) }));
  };

  const handleCodigoBlur = () => {
    setForm(f => ({ ...f, codigoModulo: f.codigoModulo.trim().toUpperCase() }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const codigoModulo = form.codigoModulo.trim().toUpperCase();
    if (!codigoModulo) {
      alert('El código de módulo es obligatorio');
      return;
    }
    try {
      setSaving(true);

      // Duplicate check on create only (allow update on same doc)
      if (!editingId) {
        const existing = await consumiblesPorModuloService.getByCodigoModulo(codigoModulo);
        if (existing) {
          alert(`Ya existe una entrada para el módulo "${codigoModulo}".`);
          setSaving(false);
          return;
        }
      }

      const payload = {
        codigoModulo,
        descripcion: form.descripcion.trim() || null,
        activo: form.activo,
        consumibles: form.consumibles.map(c => ({
          codigo: (c.codigo || '').trim(),
          descripcion: (c.descripcion || '').trim(),
          cantidad: typeof c.cantidad === 'number' ? c.cantidad : Number(c.cantidad) || 0,
        })),
      };

      if (editingId) {
        await consumiblesPorModuloService.update(editingId, payload);
      } else {
        await consumiblesPorModuloService.create(payload);
      }
      onSaved();
    } catch (err) {
      console.error('Error guardando consumibles por módulo:', err);
      alert('Error al guardar el módulo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            {editingId ? 'Editar módulo' : 'Nuevo módulo'}
          </h3>
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wide text-slate-500 mb-1">Código módulo *</label>
            <Input
              value={form.codigoModulo}
              onChange={e => setForm({ ...form, codigoModulo: e.target.value })}
              onBlur={handleCodigoBlur}
              placeholder="G7129A"
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-[10px] font-mono uppercase tracking-wide text-slate-500 mb-1">Descripción</label>
            <Input
              value={form.descripcion}
              onChange={e => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Inyector Iso Pump"
            />
          </div>
          <div className="md:col-span-3 flex items-center">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.activo}
                onChange={e => setForm({ ...form, activo: e.target.checked })}
                className="w-4 h-4 text-teal-600 rounded"
              />
              <span className="text-sm text-slate-700">Activo</span>
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
              Consumibles <span className="text-slate-400 font-normal">(se adjuntan al PDF anexo)</span>
            </h4>
            <button type="button" onClick={addConsumible} className="text-[11px] text-teal-700 hover:text-teal-900 font-medium">
              + Agregar consumible
            </button>
          </div>
          {form.consumibles.length === 0 ? (
            <p className="text-[11px] text-slate-400 italic px-2">
              Sin consumibles declarados. Agregue al menos uno o deje vacío para indicar
              "este módulo no lleva consumibles" (skip silencioso al generar el anexo).
            </p>
          ) : (
            <table className="w-full border border-slate-200 rounded overflow-hidden">
              <thead className="bg-slate-50">
                <tr>
                  <th className={`${th} w-32`}>Código</th>
                  <th className={th}>Descripción</th>
                  <th className={`${th} w-20`}>Cantidad</th>
                  <th className={`${th} w-8`}></th>
                </tr>
              </thead>
              <tbody>
                {form.consumibles.map((c, idx) => (
                  <tr key={idx} className="border-t border-slate-100">
                    <td className={td}>
                      <input className={input} value={c.codigo} onChange={e => updateConsumible(idx, 'codigo', e.target.value)} placeholder="5061-3361" />
                    </td>
                    <td className={td}>
                      <input className={input} value={c.descripcion} onChange={e => updateConsumible(idx, 'descripcion', e.target.value)} placeholder="Vial 2ml ámbar con tapa" />
                    </td>
                    <td className={td}>
                      <input
                        type="number"
                        className={input}
                        value={c.cantidad}
                        min={0}
                        step="1"
                        onChange={e => updateConsumible(idx, 'cantidad', parseInt(e.target.value) || 0)}
                      />
                    </td>
                    <td className={td}>
                      <button type="button" onClick={() => removeConsumible(idx)} className="text-red-500 hover:text-red-700 text-xs">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : (editingId ? 'Actualizar' : 'Crear')}</Button>
        </div>
      </form>
    </Card>
  );
};
