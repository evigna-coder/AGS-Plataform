import { useState, useEffect } from 'react';
import { marcasService } from '../../services/firebaseService';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { PageHeader } from '../../components/ui/PageHeader';
import type { Marca } from '@ags/shared';

export const MarcasPage = () => {
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);

  // Inline create
  const [showCreate, setShowCreate] = useState(false);
  const [nuevaMarca, setNuevaMarca] = useState('');
  const [creating, setCreating] = useState(false);

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNombre, setEditingNombre] = useState('');

  const reload = async () => {
    setLoading(true);
    try {
      const data = await marcasService.getAll(!showInactive);
      setMarcas(data);
    } catch (err) {
      console.error('Error cargando marcas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, [showInactive]);

  const handleCreate = async () => {
    if (!nuevaMarca.trim()) return;
    setCreating(true);
    try {
      await marcasService.create(nuevaMarca);
      setNuevaMarca('');
      setShowCreate(false);
      reload();
    } catch {
      alert('Error al crear la marca');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editingNombre.trim()) return;
    try {
      await marcasService.update(id, { nombre: editingNombre.trim() });
      setEditingId(null);
      reload();
    } catch {
      alert('Error al actualizar la marca');
    }
  };

  const handleToggleActivo = async (marca: Marca) => {
    try {
      await marcasService.update(marca.id, { activo: !marca.activo });
      reload();
    } catch {
      alert('Error al cambiar el estado');
    }
  };

  const handleDelete = async (marca: Marca) => {
    if (!confirm(`¿Eliminar permanentemente "${marca.nombre}"?`)) return;
    try {
      await marcasService.delete(marca.id);
      reload();
    } catch {
      alert('Error al eliminar la marca');
    }
  };

  const startEdit = (marca: Marca) => {
    setEditingId(marca.id);
    setEditingNombre(marca.nombre);
  };

  return (
    <div className="-m-6 h-[calc(100%+3rem)] flex flex-col bg-slate-50">
      <PageHeader
        title="Marcas"
        subtitle="Catálogo de marcas compartido entre instrumentos, equipos y stock"
        count={marcas.length}
        actions={
          <Button size="sm" onClick={() => setShowCreate(v => !v)}>
            {showCreate ? 'Cancelar' : '+ Agregar'}
          </Button>
        }
      >
        {showCreate && (
          <Card>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <Input
                  label="Nombre de la marca"
                  value={nuevaMarca}
                  onChange={e => setNuevaMarca(e.target.value)}
                  placeholder="Ej: Agilent, Waters, Shimadzu..."
                  onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setShowCreate(false); setNuevaMarca(''); } }}
                  autoFocus
                />
              </div>
              <Button size="sm" onClick={handleCreate} disabled={creating || !nuevaMarca.trim()}>
                {creating ? 'Creando...' : 'Agregar'}
              </Button>
            </div>
          </Card>
        )}
      </PageHeader>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
        <div className="flex justify-end">
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)}
              className="w-3.5 h-3.5 accent-indigo-600" />
            Mostrar inactivas
          </label>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><p className="text-xs text-slate-400">Cargando...</p></div>
        ) : marcas.length === 0 ? (
          <Card>
            <div className="text-center py-8">
              <p className="text-xs text-slate-400">No hay marcas registradas.</p>
            </div>
          </Card>
        ) : (
          <Card>
            <div className="divide-y divide-slate-50">
              {marcas.map(m => (
                <div key={m.id} className={`flex items-center justify-between py-2 px-2 ${!m.activo ? 'opacity-50' : ''}`}>
                  {editingId === m.id ? (
                    <div className="flex gap-2 items-center flex-1 mr-4">
                      <input
                        type="text"
                        value={editingNombre}
                        onChange={e => setEditingNombre(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleUpdate(m.id); if (e.key === 'Escape') setEditingId(null); }}
                        className="flex-1 border border-slate-300 rounded px-2 py-1 text-xs"
                        autoFocus
                      />
                      <button onClick={() => handleUpdate(m.id)}
                        className="text-green-600 hover:underline font-medium text-[11px]">Guardar</button>
                      <button onClick={() => setEditingId(null)}
                        className="text-slate-500 hover:underline text-[11px]">Cancelar</button>
                    </div>
                  ) : (
                    <span className="font-medium text-slate-900 text-xs">{m.nombre}</span>
                  )}
                  {editingId !== m.id && (
                    <div className="flex gap-2">
                      <button onClick={() => startEdit(m)}
                        className="text-blue-600 hover:underline font-medium text-[11px]">Editar</button>
                      <button onClick={() => handleToggleActivo(m)}
                        className={`font-medium text-[11px] ${m.activo ? 'text-amber-600 hover:underline' : 'text-green-600 hover:underline'}`}>
                        {m.activo ? 'Desactivar' : 'Activar'}
                      </button>
                      <button onClick={() => handleDelete(m)}
                        className="text-red-600 hover:underline font-medium text-[11px]">Eliminar</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
