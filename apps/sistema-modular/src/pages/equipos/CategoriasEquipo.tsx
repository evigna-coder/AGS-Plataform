import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { categoriasEquipoService } from '../../services/firebaseService';
import type { CategoriaEquipo } from '@ags/shared';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export const CategoriasEquipo = () => {
  const navigate = useNavigate();
  const [categorias, setCategorias] = useState<CategoriaEquipo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CategoriaEquipo | null>(null);
  const [formData, setFormData] = useState({ nombre: '' });

  useEffect(() => {
    loadCategorias();
  }, []);

  const loadCategorias = async () => {
    try {
      setLoading(true);
      const data = await categoriasEquipoService.getAll();
      setCategorias(data);
    } catch (error) {
      console.error('Error cargando categorías:', error);
      alert('Error al cargar categorías');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.nombre.trim()) {
      alert('El nombre es obligatorio');
      return;
    }
    try {
      if (editing) {
        await categoriasEquipoService.update(editing.id, formData);
      } else {
        await categoriasEquipoService.create(formData);
      }
      await loadCategorias();
      setShowModal(false);
      setEditing(null);
      setFormData({ nombre: '' });
    } catch (error) {
      console.error('Error guardando categoría:', error);
      alert('Error al guardar la categoría');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar esta categoría?')) return;
    try {
      await categoriasEquipoService.delete(id);
      await loadCategorias();
    } catch (error) {
      console.error('Error eliminando categoría:', error);
      alert('Error al eliminar la categoría');
    }
  };

  const handleEdit = (categoria: CategoriaEquipo) => {
    setEditing(categoria);
    setFormData({ nombre: categoria.nombre });
    setShowModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-400">Cargando categorías...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Categorías de Equipo</h2>
          <p className="text-sm text-slate-500 mt-1">Gestionar categorías (Osmómetros, Cromatógrafos, etc.)</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { setEditing(null); setFormData({ nombre: '' }); setShowModal(true); }}>
            + Nueva Categoría
          </Button>
          <Button variant="outline" onClick={() => navigate('/equipos')}>
            Volver a Equipos
          </Button>
        </div>
      </div>

      <Card>
        {categorias.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-400">No hay categorías registradas</p>
          </div>
        ) : (
          <div className="space-y-2">
            {categorias.map((categoria) => (
              <div
                key={categoria.id}
                className="flex justify-between items-center p-4 bg-slate-50 rounded-lg border border-slate-200"
              >
                <p className="font-black text-slate-900 uppercase">{categoria.nombre}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(categoria)}
                    className="text-blue-600 hover:underline text-xs font-bold uppercase"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(categoria.id)}
                    className="text-red-600 hover:underline text-xs font-bold uppercase"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <h3 className="text-lg font-black text-slate-900 uppercase mb-4">
              {editing ? 'Editar Categoría' : 'Nueva Categoría'}
            </h3>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Nombre *</label>
              <Input
                value={formData.nombre}
                onChange={(e) => setFormData({ nombre: e.target.value })}
                placeholder="Ej: Osmómetros, Cromatógrafos..."
                required
              />
            </div>
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowModal(false);
                  setEditing(null);
                }}
              >
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                Guardar
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
