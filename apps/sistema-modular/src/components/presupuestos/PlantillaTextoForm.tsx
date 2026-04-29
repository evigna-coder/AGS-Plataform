import { useState, useEffect } from 'react';
import type { PlantillaTextoPresupuesto, TipoPresupuesto, PresupuestoSeccionesVisibles } from '@ags/shared';
import { PRESUPUESTO_SECCIONES_LABELS, TIPO_PRESUPUESTO_LABELS } from '@ags/shared';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { RichTextEditor } from '../ui/RichTextEditor';

type SeccionKey = keyof PresupuestoSeccionesVisibles;

const SECCION_KEYS: SeccionKey[] = [
  'notasTecnicas', 'notasAdministrativas', 'garantia',
  'variacionTipoCambio', 'condicionesComerciales', 'aceptacionPresupuesto',
];
const TIPO_KEYS: TipoPresupuesto[] = ['servicio', 'partes', 'ventas', 'contrato', 'mixto'];

interface FormShape {
  nombre: string;
  tipo: SeccionKey;
  tipoPresupuestoAplica: TipoPresupuesto[];
  esDefault: boolean;
  activo: boolean;
  contenido: string;
}

interface Props {
  plantilla: PlantillaTextoPresupuesto | null; // null = creating; otherwise editing
  onSave: (data: FormShape) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

const INITIAL: FormShape = {
  nombre: '',
  tipo: 'condicionesComerciales',
  tipoPresupuestoAplica: ['servicio'],
  esDefault: false,
  activo: true,
  contenido: '',
};

export const PlantillaTextoForm: React.FC<Props> = ({ plantilla, onSave, onCancel, saving }) => {
  const [form, setForm] = useState<FormShape>(INITIAL);

  useEffect(() => {
    if (plantilla) {
      setForm({
        nombre: plantilla.nombre,
        tipo: plantilla.tipo,
        tipoPresupuestoAplica: plantilla.tipoPresupuestoAplica,
        esDefault: plantilla.esDefault,
        activo: plantilla.activo,
        contenido: plantilla.contenido,
      });
    } else {
      setForm(INITIAL);
    }
  }, [plantilla]);

  const isValid = form.nombre.trim().length > 0 && form.tipoPresupuestoAplica.length > 0;
  const lbl = 'block text-[10px] font-mono font-medium text-slate-500 mb-0.5 uppercase tracking-wide';

  const toggleTipo = (tipo: TipoPresupuesto) => {
    setForm(f => ({
      ...f,
      tipoPresupuestoAplica: f.tipoPresupuestoAplica.includes(tipo)
        ? f.tipoPresupuestoAplica.filter(t => t !== tipo)
        : [...f.tipoPresupuestoAplica, tipo],
    }));
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
      <p className="text-xs font-semibold text-slate-700">
        {plantilla ? 'Editar plantilla' : 'Nueva plantilla'}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Nombre *</label>
          <Input
            inputSize="sm"
            value={form.nombre}
            onChange={e => setForm({ ...form, nombre: e.target.value })}
            placeholder="Ej: Condiciones — Servicio estándar"
          />
        </div>
        <div>
          <label className={lbl}>Sección *</label>
          <select
            value={form.tipo}
            onChange={e => setForm({ ...form, tipo: e.target.value as SeccionKey })}
            className="w-full border border-[#E5E5E5] rounded-md px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
          >
            {SECCION_KEYS.map(k => (
              <option key={k} value={k}>{PRESUPUESTO_SECCIONES_LABELS[k]}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={lbl}>Tipos de presupuesto que aplica *</label>
        <div className="flex flex-wrap gap-3 pt-1">
          {TIPO_KEYS.map(t => (
            <label key={t} className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={form.tipoPresupuestoAplica.includes(t)}
                onChange={() => toggleTipo(t)}
                className="rounded border-slate-300"
              />
              {TIPO_PRESUPUESTO_LABELS[t]}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={form.esDefault}
            onChange={e => setForm({ ...form, esDefault: e.target.checked })}
            className="rounded border-slate-300"
          />
          Default (auto-aplica al crear)
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={form.activo}
            onChange={e => setForm({ ...form, activo: e.target.checked })}
            className="rounded border-slate-300"
          />
          Activa
        </label>
      </div>

      <div>
        <label className={lbl}>Contenido *</label>
        <RichTextEditor
          value={form.contenido}
          onChange={html => setForm({ ...form, contenido: html })}
          placeholder="Escriba el contenido de la plantilla con formato (negritas, listas, alineación)..."
          minHeight={280}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
        <Button variant="secondary" size="sm" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button size="sm" onClick={() => onSave(form)} disabled={saving || !isValid}>
          {saving ? 'Guardando...' : plantilla ? 'Guardar' : 'Crear'}
        </Button>
      </div>
    </div>
  );
};
