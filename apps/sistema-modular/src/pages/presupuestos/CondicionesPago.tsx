import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { condicionesPagoService } from '../../services/firebaseService';
import type { CondicionPago } from '@ags/shared';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export const CondicionesPago = () => {
  const navigate = useNavigate();
  const [condiciones, setCondiciones] = useState<CondicionPago[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    dias: 0,
    descripcion: '',
    activo: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const condicionesData = await condicionesPagoService.getAll();
      setCondiciones(condicionesData);
    } catch (error) {
      console.error('Error cargando condiciones:', error);
      alert('Error al cargar las condiciones de pago');
    } finally {
      setLoading(false);
    }
  };

  const handleNew = () => {
    setFormData({
      nombre: '',
      dias: 0,
      descripcion: '',
      activo: true,
    });
    setEditingId(null);
    setShowForm(true);
  };

  const handleEdit = (condicion: CondicionPago) => {
    setFormData({
      nombre: condicion.nombre,
      dias: condicion.dias,
      descripcion: condicion.descripcion || '',
      activo: condicion.activo,
    });
    setEditingId(condicion.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar esta condición de pago?')) return;
    
    try {
      await condicionesPagoService.delete(id);
      await loadData();
      alert('Condición de pago eliminada exitosamente');
    } catch (error) {
      console.error('Error eliminando condición:', error);
      alert('Error al eliminar la condición de pago');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nombre.trim()) {
      alert('El nombre es obligatorio');
      return;
    }

    if (formData.dias < 0) {
      alert('Los días no pueden ser negativos');
      return;
    }

    try {
      setSaving(true);
      
      if (editingId) {
        await condicionesPagoService.update(editingId, formData);
        alert('Condición de pago actualizada exitosamente');
      } else {
        await condicionesPagoService.create(formData);
        alert('Condición de pago creada exitosamente');
      }
      
      setShowForm(false);
      setEditingId(null);
      await loadData();
    } catch (error) {
      console.error('Error guardando condición:', error);
      alert('Error al guardar la condición de pago');
    } finally {
      setSaving(false);
    }
  };

  const getDiasTexto = (dias: number): string => {
    if (dias === 0) return 'Contado';
    if (dias === 1) return '1 día';
    return `${dias} días`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-400">Cargando condiciones...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Condiciones de Pago</h2>
          <p className="text-sm text-slate-500 mt-1">Gestión de condiciones de pago precargadas</p>
        </div>
        <div className="flex gap-3">
          {!showForm && (
            <Button onClick={handleNew}>
              + Nueva Condición
            </Button>
          )}
          <Button variant="outline" onClick={() => navigate('/presupuestos')}>
            Volver
          </Button>
        </div>
      </div>

      {showForm ? (
        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                {editingId ? 'Editar Condición de Pago' : 'Nueva Condición de Pago'}
              </h3>
              <Button type="button" variant="outline" onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}>
                Cancelar
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Nombre *
                </label>
                <Input
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Ej: Contado contra entrega, Diferido 30 días fecha factura"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Días de Plazo *
                </label>
                <Input
                  type="number"
                  min="0"
                  value={formData.dias}
                  onChange={(e) => setFormData({ ...formData, dias: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                  required
                />
                <p className="text-xs text-slate-400 mt-1">
                  {formData.dias === 0 
                    ? 'Contado (pago inmediato)' 
                    : `Plazo: ${getDiasTexto(formData.dias)} desde la fecha de factura`
                  }
                </p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Descripción
                </label>
                <textarea
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Descripción adicional de la condición de pago..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.activo}
                    onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Activa</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear'}
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <Card>
          {condiciones.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400 mb-4">No hay condiciones de pago configuradas</p>
              <Button onClick={handleNew}>Crear primera condición</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 tracking-wider">Nombre</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 tracking-wider">Plazo</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 tracking-wider">Descripción</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 tracking-wider">Estado</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-slate-400 tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {condiciones.map((cond) => (
                    <tr key={cond.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{cond.nombre}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-slate-700">
                          {getDiasTexto(cond.dias)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {cond.descripcion ? (
                          <span className="text-xs text-slate-600">{cond.descripcion}</span>
                        ) : (
                          <span className="text-xs text-slate-400">Sin descripción</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-bold rounded-full ${
                          cond.activo 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {cond.activo ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            onClick={() => handleEdit(cond)}
                            className="text-xs px-3 py-1"
                          >
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => handleDelete(cond.id)}
                            className="text-xs px-3 py-1 text-red-600 hover:text-red-700 hover:border-red-300"
                          >
                            Eliminar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
