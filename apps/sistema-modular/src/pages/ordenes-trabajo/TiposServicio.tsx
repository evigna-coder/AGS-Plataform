import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { tiposServicioService } from '../../services/firebaseService';
import type { TipoServicio } from '@ags/shared';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export const TiposServicio = () => {
  const navigate = useNavigate();
  const [tipos, setTipos] = useState<TipoServicio[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<TipoServicio | null>(null);
  const [formData, setFormData] = useState({ nombre: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await tiposServicioService.getAll();
      setTipos(data);
    } catch (error) {
      console.error('Error cargando tipos de servicio:', error);
      alert('Error al cargar tipos de servicio');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.nombre.trim()) {
      alert('El nombre del tipo de servicio es obligatorio');
      return;
    }

    try {
      if (editing) {
        await tiposServicioService.update(editing.id, {
          nombre: formData.nombre.trim(),
          activo: editing.activo,
        });
      } else {
        await tiposServicioService.create({
          nombre: formData.nombre.trim(),
          activo: true,
        });
      }
      await loadData();
      setShowModal(false);
      setEditing(null);
      setFormData({ nombre: '' });
    } catch (error) {
      console.error('Error guardando tipo de servicio:', error);
      alert('Error al guardar el tipo de servicio');
    }
  };

  const handleEdit = (tipo: TipoServicio) => {
    setEditing(tipo);
    setFormData({ nombre: tipo.nombre });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este tipo de servicio?')) return;
    try {
      await tiposServicioService.delete(id);
      await loadData();
    } catch (error) {
      console.error('Error eliminando tipo de servicio:', error);
      alert('Error al eliminar el tipo de servicio');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-400">Cargando tipos de servicio...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Tipos de Servicio</h2>
          <p className="text-sm text-slate-500 mt-1">Gestionar tipos de servicio para OTs</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/ordenes-trabajo')}>
            Volver a OTs
          </Button>
          <Button onClick={() => { setEditing(null); setFormData({ nombre: '' }); setShowModal(true); }}>
            + Nuevo Tipo
          </Button>
        </div>
      </div>

      {tipos.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-slate-400 mb-4">No hay tipos de servicio registrados</p>
            <Button onClick={() => { setEditing(null); setFormData({ nombre: '' }); setShowModal(true); }}>
              Crear primer tipo de servicio
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {tipos.map((tipo) => (
            <Card key={tipo.id}>
              <div className="flex justify-between items-center">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900">{tipo.nombre}</h3>
                  {!tipo.activo && (
                    <span className="text-xs text-slate-400 italic">(Inactivo)</span>
                  )}
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleEdit(tipo)}
                    className="text-blue-600 hover:underline text-xs font-medium"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(tipo.id)}
                    className="text-red-600 hover:underline text-xs font-medium"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">
              {editing ? 'Editar Tipo de Servicio' : 'Nuevo Tipo de Servicio'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Nombre del Tipo de Servicio *
                </label>
                <Input
                  value={formData.nombre}
                  onChange={(e) => setFormData({ nombre: e.target.value })}
                  placeholder="Ej: Mantenimiento preventivo, Calificación de operación..."
                  required
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowModal(false);
                  setEditing(null);
                  setFormData({ nombre: '' });
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
