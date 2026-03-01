import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { minikitsService } from '../../services/firebaseService';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { PageHeader } from '../../components/ui/PageHeader';
import type { Minikit, EstadoMinikit } from '@ags/shared';

const ESTADO_LABELS: Record<EstadoMinikit, string> = {
  en_base: 'En base', en_campo: 'En campo', en_transito: 'En tránsito', en_revision: 'En revisión',
};
const ESTADO_COLORS: Record<EstadoMinikit, string> = {
  en_base: 'bg-green-100 text-green-700', en_campo: 'bg-blue-100 text-blue-700',
  en_transito: 'bg-amber-100 text-amber-700', en_revision: 'bg-purple-100 text-purple-700',
};

export const MinikitsList = () => {
  const [minikits, setMinikits] = useState<Minikit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);

  // Inline create
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ codigo: '', nombre: '', descripcion: '' });
  const [creating, setCreating] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const data = await minikitsService.getAll(showInactive ? false : true);
      setMinikits(data);
    } catch (err) {
      console.error('Error cargando minikits:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, [showInactive]);

  const handleCreate = async () => {
    if (!form.codigo.trim() || !form.nombre.trim()) return;
    setCreating(true);
    try {
      await minikitsService.create({
        codigo: form.codigo.trim(),
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || null,
        estado: 'en_base',
        asignadoA: null,
        activo: true,
      });
      setForm({ codigo: '', nombre: '', descripcion: '' });
      setShowCreate(false);
      reload();
    } catch {
      alert('Error al crear el minikit');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActivo = async (mk: Minikit) => {
    try {
      await minikitsService.update(mk.id, { activo: !mk.activo });
      reload();
    } catch {
      alert('Error al cambiar el estado');
    }
  };

  const handleDelete = async (mk: Minikit) => {
    if (!confirm(`¿Eliminar permanentemente "${mk.codigo} - ${mk.nombre}"?`)) return;
    try {
      await minikitsService.delete(mk.id);
      reload();
    } catch {
      alert('Error al eliminar el minikit');
    }
  };

  return (
    <div className="-m-6 h-[calc(100%+3rem)] flex flex-col bg-slate-50">
      <PageHeader
        title="Minikits"
        subtitle="Kits portables asignables a ingenieros con unidades de stock"
        count={minikits.length}
        actions={
          <Button size="sm" onClick={() => setShowCreate(v => !v)}>
            {showCreate ? 'Cancelar' : '+ Nuevo minikit'}
          </Button>
        }
      />

      {showCreate && (
        <div className="shrink-0 px-5 py-3 bg-white border-b border-slate-100">
          <Card>
            <div className="grid grid-cols-3 gap-3 items-end">
              <Input
                label="Codigo"
                value={form.codigo}
                onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))}
                placeholder="Ej: MKGC1"
                autoFocus
              />
              <Input
                label="Nombre"
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej: Kit GC campo"
              />
              <Input
                label="Descripcion (opcional)"
                value={form.descripcion}
                onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                placeholder="Breve descripcion..."
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreate();
                  if (e.key === 'Escape') { setShowCreate(false); setForm({ codigo: '', nombre: '', descripcion: '' }); }
                }}
              />
            </div>
            <div className="flex justify-end mt-3">
              <Button size="sm" onClick={handleCreate} disabled={creating || !form.codigo.trim() || !form.nombre.trim()}>
                {creating ? 'Creando...' : 'Agregar minikit'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-xs text-slate-400">{minikits.length} minikit(s)</p>
          <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)}
              className="w-3.5 h-3.5 accent-indigo-600" />
            Mostrar inactivos
          </label>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><p className="text-slate-400">Cargando...</p></div>
        ) : minikits.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-slate-400">No hay minikits registrados. Use el botón "+ Nuevo minikit" para agregar.</p>
            </div>
          </Card>
        ) : (
          <Card>
            <div className="divide-y divide-slate-100">
              {minikits.map(mk => (
                <div key={mk.id} className={`flex items-center justify-between py-2 px-2 ${!mk.activo ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="font-mono font-semibold text-indigo-600 text-xs whitespace-nowrap">
                      {mk.codigo}
                    </span>
                    <span className="text-xs text-slate-900 truncate">{mk.nombre}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${ESTADO_COLORS[mk.estado]}`}>
                      {ESTADO_LABELS[mk.estado]}
                    </span>
                    {mk.asignadoA && (
                      <span className="text-[10px] text-slate-500 truncate">
                        {mk.asignadoA.tipo === 'ingeniero' ? 'Ing.' : 'OT'} {mk.asignadoA.nombre}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3 shrink-0 ml-4">
                    <Link to={`/stock/minikits/${mk.id}`}
                      className="text-blue-600 hover:underline font-medium text-[10px]">Ver</Link>
                    <button onClick={() => handleToggleActivo(mk)}
                      className={`font-medium text-[10px] ${mk.activo ? 'text-amber-600 hover:underline' : 'text-green-600 hover:underline'}`}>
                      {mk.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    <button onClick={() => handleDelete(mk)}
                      className="text-red-600 hover:underline font-medium text-[10px]">Eliminar</button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
