import { useState, useEffect } from 'react';
import { tiposEquipoService } from '../../services/tiposEquipoService';
import type { TipoEquipoPlantilla, TipoEquipoComponente, TipoEquipoServicio } from '@ags/shared';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { ComponentesEditor, ServiciosEditor } from './TipoEquipoNestedEditors';
import { seedPlantillasIniciales } from './seedPlantillas';

interface FormData {
  nombre: string;
  descripcion: string;
  activo: boolean;
  componentes: TipoEquipoComponente[];
  servicios: TipoEquipoServicio[];
}

const EMPTY_FORM: FormData = { nombre: '', descripcion: '', activo: true, componentes: [], servicios: [] };

export const TiposEquipoList = () => {
  const goBack = useNavigateBack();
  const confirm = useConfirm();
  const [plantillas, setPlantillas] = useState<TipoEquipoPlantilla[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const handleSeed = async () => {
    if (!await confirm('Cargar 7 plantillas iniciales (HPLC 1100/1200/1260, UV/VIS 8453/G6860A, GC 6890/8890A). Podés editarlas después. ¿Continuar?')) return;
    try {
      setSeeding(true);
      const n = await seedPlantillasIniciales();
      alert(`${n} plantillas cargadas correctamente.`);
      await load();
    } catch (err) {
      console.error('Error seed:', err);
      alert('Error cargando las plantillas iniciales');
    } finally {
      setSeeding(false);
    }
  };

  const load = async () => {
    try {
      setLoading(true);
      setPlantillas(await tiposEquipoService.getAll());
    } catch (err) {
      console.error('Error cargando tipos de equipo:', err);
      alert('Error al cargar los tipos de equipo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleNew = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  const handleEdit = (p: TipoEquipoPlantilla) => {
    setForm({
      nombre: p.nombre,
      descripcion: p.descripcion || '',
      activo: p.activo,
      componentes: p.componentes.map(c => ({ ...c })),
      servicios: p.servicios.map(s => ({ ...s })),
    });
    setEditingId(p.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string, nombre: string) => {
    if (!await confirm(`¿Eliminar la plantilla "${nombre}"? Los presupuestos existentes no se ven afectados.`)) return;
    try {
      await tiposEquipoService.delete(id);
      await load();
    } catch (err) {
      console.error('Error eliminando:', err);
      alert('Error al eliminar la plantilla');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim()) { alert('El nombre es obligatorio'); return; }
    try {
      setSaving(true);
      const payload = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || null,
        activo: form.activo,
        componentes: form.componentes.sort((a, b) => a.orden - b.orden),
        servicios: form.servicios.sort((a, b) => a.orden - b.orden),
      };
      if (editingId) {
        await tiposEquipoService.update(editingId, payload);
      } else {
        await tiposEquipoService.create(payload);
      }
      setShowForm(false);
      setEditingId(null);
      await load();
    } catch (err) {
      console.error('Error guardando:', err);
      alert('Error al guardar la plantilla');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Tipos de Equipo — Plantillas</h2>
          <p className="text-sm text-slate-500 mt-1">Catálogo de plantillas usadas en presupuestos de contrato para autogenerar items</p>
        </div>
        <div className="flex gap-3">
          {!showForm && <Button onClick={handleNew}>+ Nueva Plantilla</Button>}
          <Button variant="outline" onClick={() => goBack()}>Volver</Button>
        </div>
      </div>

      {showForm ? (
        <Card>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">{editingId ? 'Editar plantilla' : 'Nueva plantilla'}</h3>
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancelar</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
                <Input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="HPLC 1100" required />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.activo} onChange={e => setForm({ ...form, activo: e.target.checked })} className="w-4 h-4 text-teal-600 rounded" />
                  <span className="text-sm text-slate-700">Activa</span>
                </label>
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
                <Input value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="Cromatógrafo Agilent 1100 Series" />
              </div>
            </div>

            <ComponentesEditor componentes={form.componentes} onChange={c => setForm(f => ({ ...f, componentes: c }))} />
            <ServiciosEditor servicios={form.servicios} onChange={s => setForm(f => ({ ...f, servicios: s }))} />

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : (editingId ? 'Actualizar' : 'Crear')}</Button>
            </div>
          </form>
        </Card>
      ) : (
        <Card>
          {plantillas.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-slate-400">Sin plantillas de tipo de equipo.</p>
              <div className="flex gap-3 justify-center">
                <Button onClick={handleNew}>Crear primera plantilla</Button>
                <Button variant="outline" onClick={handleSeed} disabled={seeding}>
                  {seeding ? 'Cargando...' : 'Cargar plantillas iniciales (7 equipos)'}
                </Button>
              </div>
              <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                Las plantillas iniciales cubren los tipos de equipo más comunes (HPLC, UV/VIS, GC) con sus componentes S/L y servicios estándar basados en presupuestos reales de contrato.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-mono uppercase tracking-wider text-slate-500">Nombre</th>
                  <th className="px-3 py-2 text-left text-[10px] font-mono uppercase tracking-wider text-slate-500">Descripción</th>
                  <th className="px-3 py-2 text-center text-[10px] font-mono uppercase tracking-wider text-slate-500">Componentes</th>
                  <th className="px-3 py-2 text-center text-[10px] font-mono uppercase tracking-wider text-slate-500">Servicios</th>
                  <th className="px-3 py-2 text-center text-[10px] font-mono uppercase tracking-wider text-slate-500">Estado</th>
                  <th className="px-3 py-2 text-right text-[10px] font-mono uppercase tracking-wider text-slate-500">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {plantillas.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-semibold text-slate-900">{p.nombre}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">{p.descripcion || <span className="text-slate-400">—</span>}</td>
                    <td className="px-3 py-2.5 text-center text-xs text-slate-700">{p.componentes.length}</td>
                    <td className="px-3 py-2.5 text-center text-xs text-slate-700">{p.servicios.length}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${p.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {p.activo ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => handleEdit(p)} className="text-xs px-3 py-1">Editar</Button>
                        <Button variant="outline" onClick={() => handleDelete(p.id, p.nombre)} className="text-xs px-3 py-1 text-red-600 hover:text-red-700 hover:border-red-300">Eliminar</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
};
