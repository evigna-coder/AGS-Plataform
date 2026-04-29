import { useEffect, useMemo, useState } from 'react';
import type { Articulo, CategoriaModulo, ConsumibleModulo, ModeloModulo } from '@ags/shared';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { consumiblesPorModuloService } from '../../services/consumiblesPorModuloService';
import { categoriasModuloService } from '../../services/equiposService';
import { articulosService } from '../../services/stockService';
import { ConsumiblesTableEditor } from './ConsumiblesTableEditor';

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

interface ModeloOption {
  categoriaId: string;
  modelo: ModeloModulo;
}

export const ConsumibleModuloForm: React.FC<Props> = ({ initial, editingId, onCancel, onSaved }) => {
  const [form, setForm] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);
  const [categorias, setCategorias] = useState<CategoriaModulo[]>([]);
  const [categoriaId, setCategoriaId] = useState<string>('');
  const [articulos, setArticulos] = useState<Articulo[]>([]);

  useEffect(() => {
    categoriasModuloService.getAll()
      .then(setCategorias)
      .catch(err => console.error('Error cargando categorías de módulos:', err));
    articulosService.getAll({ activoOnly: true })
      .then(setArticulos)
      .catch(err => console.error('Error cargando artículos de stock:', err));
  }, []);

  const articuloOptions = useMemo(
    () => articulos.map(a => ({ value: a.codigo, label: `${a.codigo} — ${a.descripcion}` })),
    [articulos],
  );
  const articuloByCodigo = useMemo(() => {
    const map = new Map<string, Articulo>();
    articulos.forEach(a => map.set(a.codigo, a));
    return map;
  }, [articulos]);

  const handleArticuloChange = (idx: number, codigo: string) => {
    const articulo = articuloByCodigo.get(codigo);
    setForm(f => ({
      ...f,
      consumibles: f.consumibles.map((c, i) => {
        if (i !== idx) return c;
        return {
          ...c,
          codigo,
          descripcion: articulo ? articulo.descripcion : c.descripcion,
        };
      }),
    }));
  };

  // En edición, derivar la categoría desde el código actual una vez cargadas
  useEffect(() => {
    if (!editingId || !form.codigoModulo || categorias.length === 0 || categoriaId) return;
    const match = categorias.find(c => c.modelos.some(m => m.codigo === form.codigoModulo));
    if (match) setCategoriaId(match.id);
  }, [editingId, form.codigoModulo, categorias, categoriaId]);

  const modelosDeCategoria = useMemo<ModeloOption[]>(() => {
    const cat = categorias.find(c => c.id === categoriaId);
    if (!cat) return [];
    return cat.modelos.map(m => ({ categoriaId: cat.id, modelo: m }));
  }, [categorias, categoriaId]);

  const handleCategoriaChange = (newCatId: string) => {
    setCategoriaId(newCatId);
    if (!editingId) setForm(f => ({ ...f, codigoModulo: '', descripcion: '' }));
  };

  const handleModeloChange = (codigo: string) => {
    const opt = modelosDeCategoria.find(o => o.modelo.codigo === codigo);
    if (!opt) return;
    setForm(f => ({
      ...f,
      codigoModulo: opt.modelo.codigo.trim().toUpperCase(),
      // Solo auto-fill descripción si está vacía o estamos creando — no sobreescribir overrides en edit
      descripcion: !editingId || !f.descripcion ? opt.modelo.descripcion : f.descripcion,
    }));
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const codigoModulo = form.codigoModulo.trim().toUpperCase();
    if (!codigoModulo) {
      alert('Seleccioná categoría y modelo del catálogo');
      return;
    }
    try {
      setSaving(true);

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

  const codigoNoEnCatalogo = !!form.codigoModulo && categorias.length > 0
    && !categorias.some(c => c.modelos.some(m => m.codigo === form.codigoModulo));

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            {editingId ? 'Editar módulo' : 'Nuevo módulo'}
          </h3>
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wide text-slate-500 mb-1">Categoría *</label>
            <SearchableSelect
              value={categoriaId}
              onChange={handleCategoriaChange}
              options={categorias.map(c => ({ value: c.id, label: c.nombre }))}
              placeholder="Seleccionar categoría"
              required
              disabled={!!editingId}
            />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wide text-slate-500 mb-1">Modelo *</label>
            <SearchableSelect
              value={form.codigoModulo}
              onChange={handleModeloChange}
              options={modelosDeCategoria.map(o => ({
                value: o.modelo.codigo,
                label: `${o.modelo.codigo} — ${o.modelo.descripcion}`,
              }))}
              placeholder={categoriaId ? 'Seleccionar modelo' : 'Elegí categoría primero'}
              required
              disabled={!!editingId || !categoriaId}
              emptyMessage="Esta categoría no tiene modelos cargados"
            />
            {codigoNoEnCatalogo && (
              <p className="text-[10px] text-amber-600 mt-1">
                Código <code className="font-mono">{form.codigoModulo}</code> no aparece en el catálogo de categorías.
                Cargalo en "Categorías de módulos" para mantener consistencia.
              </p>
            )}
          </div>
          <div className="md:col-span-2">
            <label className="block text-[10px] font-mono uppercase tracking-wide text-slate-500 mb-1">
              Descripción <span className="text-slate-400 font-normal normal-case">(auto-completada del catálogo, editable)</span>
            </label>
            <Input
              value={form.descripcion}
              onChange={e => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Inyector Iso Pump"
            />
          </div>
          <div className="md:col-span-2 flex items-center">
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

        <ConsumiblesTableEditor
          consumibles={form.consumibles}
          articuloOptions={articuloOptions}
          articuloByCodigo={articuloByCodigo}
          onArticuloChange={handleArticuloChange}
          onUpdate={updateConsumible}
          onAdd={addConsumible}
          onRemove={removeConsumible}
        />

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : (editingId ? 'Actualizar' : 'Crear')}</Button>
        </div>
      </form>
    </Card>
  );
};
