import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { categoriasPresupuestoService } from '../../services/firebaseService';
import type { CategoriaPresupuesto } from '@ags/shared';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export const CategoriasPresupuesto = () => {
  const navigate = useNavigate();
  const [categorias, setCategorias] = useState<CategoriaPresupuesto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    incluyeIva: true,
    porcentajeIva: 21,
    incluyeGanancias: false,
    porcentajeGanancias: 0,
    incluyeIIBB: false,
    porcentajeIIBB: 0,
    ivaReduccion: false,
    porcentajeIvaReduccion: 0,
    activo: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const categoriasData = await categoriasPresupuestoService.getAll();
      setCategorias(categoriasData);
    } catch (error) {
      console.error('Error cargando categorías:', error);
      alert('Error al cargar las categorías');
    } finally {
      setLoading(false);
    }
  };

  const handleNew = () => {
    setFormData({
      nombre: '',
      descripcion: '',
      incluyeIva: true,
      porcentajeIva: 21,
      incluyeGanancias: false,
      porcentajeGanancias: 0,
      incluyeIIBB: false,
      porcentajeIIBB: 0,
      ivaReduccion: false,
      porcentajeIvaReduccion: 0,
      activo: true,
    });
    setEditingId(null);
    setShowForm(true);
  };

  const handleEdit = (categoria: CategoriaPresupuesto) => {
    setFormData({
      nombre: categoria.nombre,
      descripcion: categoria.descripcion || '',
      incluyeIva: categoria.incluyeIva,
      porcentajeIva: categoria.porcentajeIva || 21,
      incluyeGanancias: categoria.incluyeGanancias,
      porcentajeGanancias: categoria.porcentajeGanancias || 0,
      incluyeIIBB: categoria.incluyeIIBB,
      porcentajeIIBB: categoria.porcentajeIIBB || 0,
      ivaReduccion: categoria.ivaReduccion || false,
      porcentajeIvaReduccion: categoria.porcentajeIvaReduccion || 0,
      activo: categoria.activo,
    });
    setEditingId(categoria.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar esta categoría?')) return;
    
    try {
      await categoriasPresupuestoService.delete(id);
      await loadData();
      alert('Categoría eliminada exitosamente');
    } catch (error) {
      console.error('Error eliminando categoría:', error);
      alert('Error al eliminar la categoría');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nombre.trim()) {
      alert('El nombre es obligatorio');
      return;
    }

    try {
      setSaving(true);
      
      if (editingId) {
        await categoriasPresupuestoService.update(editingId, formData);
        alert('Categoría actualizada exitosamente');
      } else {
        await categoriasPresupuestoService.create(formData);
        alert('Categoría creada exitosamente');
      }
      
      setShowForm(false);
      setEditingId(null);
      await loadData();
    } catch (error) {
      console.error('Error guardando categoría:', error);
      alert('Error al guardar la categoría');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-400">Cargando categorías...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Categorías de Presupuesto</h2>
          <p className="text-sm text-slate-500 mt-1">Gestión de categorías y reglas tributarias</p>
        </div>
        <div className="flex gap-3">
          {!showForm && (
            <Button onClick={handleNew}>
              + Nueva Categoría
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
                {editingId ? 'Editar Categoría' : 'Nueva Categoría'}
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
                  placeholder="Ej: Servicios técnicos"
                  required
                />
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
                  placeholder="Descripción de la categoría..."
                />
              </div>

              <div className="border-t pt-4 md:col-span-2">
                <h4 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-3">IVA</h4>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.incluyeIva}
                      onChange={(e) => setFormData({ ...formData, incluyeIva: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-slate-700">Incluye IVA</span>
                  </label>
                  
                  {formData.incluyeIva && (
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Porcentaje IVA (%)
                      </label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.porcentajeIva}
                        onChange={(e) => setFormData({ ...formData, porcentajeIva: parseFloat(e.target.value) || 0 })}
                        placeholder="21"
                      />
                    </div>
                  )}

                  {formData.incluyeIva && (
                    <>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.ivaReduccion}
                          onChange={(e) => setFormData({ ...formData, ivaReduccion: e.target.checked })}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-slate-700">Aplica reducción de IVA</span>
                      </label>
                      
                      {formData.ivaReduccion && (
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Porcentaje IVA Reducción (%)
                          </label>
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.porcentajeIvaReduccion}
                            onChange={(e) => setFormData({ ...formData, porcentajeIvaReduccion: parseFloat(e.target.value) || 0 })}
                            placeholder="10.5"
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="border-t pt-4 md:col-span-2">
                <h4 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-3">Ganancias</h4>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.incluyeGanancias}
                      onChange={(e) => setFormData({ ...formData, incluyeGanancias: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-slate-700">Incluye Ganancias</span>
                  </label>
                  
                  {formData.incluyeGanancias && (
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Porcentaje Ganancias (%)
                      </label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.porcentajeGanancias}
                        onChange={(e) => setFormData({ ...formData, porcentajeGanancias: parseFloat(e.target.value) || 0 })}
                        placeholder="6"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t pt-4 md:col-span-2">
                <h4 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-3">Ingresos Brutos (IIBB)</h4>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.incluyeIIBB}
                      onChange={(e) => setFormData({ ...formData, incluyeIIBB: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-slate-700">Incluye IIBB</span>
                  </label>
                  
                  {formData.incluyeIIBB && (
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Porcentaje IIBB (%)
                      </label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.porcentajeIIBB}
                        onChange={(e) => setFormData({ ...formData, porcentajeIIBB: parseFloat(e.target.value) || 0 })}
                        placeholder="3"
                      />
                    </div>
                  )}
                </div>
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
          {categorias.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400 mb-4">No hay categorías configuradas</p>
              <Button onClick={handleNew}>Crear primera categoría</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 tracking-wider">Nombre</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 tracking-wider">IVA</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 tracking-wider">Ganancias</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 tracking-wider">IIBB</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 tracking-wider">Estado</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-slate-400 tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {categorias.map((cat) => (
                    <tr key={cat.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{cat.nombre}</div>
                        {cat.descripcion && (
                          <div className="text-xs text-slate-500 mt-0.5">{cat.descripcion}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {cat.incluyeIva ? (
                          <span className="text-xs font-medium text-slate-700">
                            {cat.porcentajeIva}%
                            {cat.ivaReduccion && cat.porcentajeIvaReduccion && (
                              <span className="text-slate-400 ml-1">(Red: {cat.porcentajeIvaReduccion}%)</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">No aplica</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {cat.incluyeGanancias ? (
                          <span className="text-xs font-medium text-slate-700">{cat.porcentajeGanancias}%</span>
                        ) : (
                          <span className="text-xs text-slate-400">No aplica</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {cat.incluyeIIBB ? (
                          <span className="text-xs font-medium text-slate-700">{cat.porcentajeIIBB}%</span>
                        ) : (
                          <span className="text-xs text-slate-400">No aplica</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-bold rounded-full ${
                          cat.activo 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {cat.activo ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            onClick={() => handleEdit(cat)}
                            className="text-xs px-3 py-1"
                          >
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => handleDelete(cat.id)}
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
