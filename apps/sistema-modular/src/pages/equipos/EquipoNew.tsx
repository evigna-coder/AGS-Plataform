import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { sistemasService, modulosService, categoriasEquipoService, clientesService } from '../../services/firebaseService';
import type { CategoriaEquipo, Cliente, ModuloSistema } from '@ags/shared';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export const EquipoNew = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const clienteIdFromUrl = searchParams.get('cliente');
  
  const [loading, setLoading] = useState(false);
  const [categorias, setCategorias] = useState<CategoriaEquipo[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [formData, setFormData] = useState({
    clienteId: clienteIdFromUrl || '',
    categoriaId: '',
    nombre: '',
    descripcion: '',
    codigoInternoCliente: '',
    observaciones: '',
    activo: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [modulos, setModulos] = useState<Omit<ModuloSistema, 'id' | 'sistemaId'>[]>([]);
  const [showModuloModal, setShowModuloModal] = useState(false);
  const [editingModuloIndex, setEditingModuloIndex] = useState<number | null>(null);
  const [moduloForm, setModuloForm] = useState({
    nombre: '',
    descripcion: '',
    serie: '',
    firmware: '',
    observaciones: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [categoriasData, clientesData] = await Promise.all([
        categoriasEquipoService.getAll(),
        clientesService.getAll(true),
      ]);
      setCategorias(categoriasData);
      setClientes(clientesData);
    } catch (error) {
      console.error('Error cargando datos:', error);
      alert('Error al cargar categorías o clientes');
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.clienteId) {
      newErrors.clienteId = 'El cliente es obligatorio';
    }
    if (!formData.categoriaId) {
      newErrors.categoriaId = 'La categoría es obligatoria';
    }
    if (!formData.nombre.trim()) {
      newErrors.nombre = 'El nombre es obligatorio';
    }
    if (!formData.descripcion.trim()) {
      newErrors.descripcion = 'La descripción es obligatoria';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }

    try {
      setLoading(true);
      const sistemaId = await sistemasService.create({
        clienteId: formData.clienteId,
        categoriaId: formData.categoriaId,
        nombre: formData.nombre,
        descripcion: formData.descripcion,
        codigoInternoCliente: formData.codigoInternoCliente || 'PROV-' + Date.now().toString().slice(-6),
        observaciones: formData.observaciones || undefined,
        activo: formData.activo,
        ubicaciones: [],
        otIds: [],
      });
      
      // Guardar módulos si hay alguno
      if (modulos.length > 0) {
        for (const modulo of modulos) {
          await modulosService.create(sistemaId, modulo);
        }
      }
      
      alert('Sistema creado exitosamente');
      navigate(`/equipos/${sistemaId}`);
    } catch (error) {
      console.error('Error creando sistema:', error);
      alert('Error al crear el sistema');
    } finally {
      setLoading(false);
    }
  };

  const handleAddModulo = () => {
    if (!moduloForm.nombre.trim()) {
      alert('Por favor ingrese el nombre del módulo');
      return;
    }
    
    if (editingModuloIndex !== null) {
      // Editar módulo existente
      const updated = [...modulos];
      updated[editingModuloIndex] = moduloForm;
      setModulos(updated);
      setEditingModuloIndex(null);
    } else {
      // Agregar nuevo módulo
      setModulos([...modulos, moduloForm]);
    }
    
    setModuloForm({ nombre: '', descripcion: '', serie: '', firmware: '', observaciones: '' });
    setShowModuloModal(false);
  };

  const handleEditModulo = (index: number) => {
    setEditingModuloIndex(index);
    setModuloForm(modulos[index]);
    setShowModuloModal(true);
  };

  const handleDeleteModulo = (index: number) => {
    if (confirm('¿Está seguro de eliminar este módulo?')) {
      setModulos(modulos.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Nuevo Sistema</h2>
          <p className="text-sm text-slate-500 mt-1">Complete los datos del sistema</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/equipos')}>
          Cancelar
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <h3 className="text-sm font-black text-slate-600 uppercase mb-4">Datos del Sistema</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Cliente *</label>
                <select
                  value={formData.clienteId}
                  onChange={(e) => setFormData({ ...formData, clienteId: e.target.value })}
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${errors.clienteId ? 'border-red-500' : 'border-slate-300'}`}
                  required
                >
                  <option value="">Seleccionar cliente...</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.razonSocial}</option>
                  ))}
                </select>
                {errors.clienteId && <p className="mt-1 text-xs text-red-600">{errors.clienteId}</p>}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Categoría *</label>
                <select
                  value={formData.categoriaId}
                  onChange={(e) => setFormData({ ...formData, categoriaId: e.target.value })}
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${errors.categoriaId ? 'border-red-500' : 'border-slate-300'}`}
                  required
                >
                  <option value="">Seleccionar categoría...</option>
                  {categorias.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                  ))}
                </select>
                {errors.categoriaId && <p className="mt-1 text-xs text-red-600">{errors.categoriaId}</p>}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Nombre *</label>
                <Input
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Ej: HPLC 1260"
                  error={errors.nombre}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Código Interno Cliente</label>
                <Input
                  value={formData.codigoInternoCliente}
                  onChange={(e) => setFormData({ ...formData, codigoInternoCliente: e.target.value })}
                  placeholder="Si no tiene, se asignará provisorio"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Descripción *</label>
              <Input
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Ej: Cromatógrafo líquido"
                error={errors.descripcion}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Observaciones</label>
              <textarea
                value={formData.observaciones}
                onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                rows={3}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Ej: sistema usa sellos de fase normal..."
              />
            </div>
          </div>
        </Card>

        {/* Módulos - Sección visible para agregar módulos durante la creación */}
        <Card className="bg-blue-50 border-2 border-blue-400 shadow-xl">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h3 className="text-xl font-black text-blue-900 uppercase mb-2">Módulos del Sistema</h3>
              <p className="text-sm text-slate-700 font-medium">Agrega los módulos que componen este sistema (Bomba, Inyector, Detector, etc.)</p>
            </div>
            <Button
              type="button"
              onClick={() => {
                setEditingModuloIndex(null);
                setModuloForm({ nombre: '', descripcion: '', serie: '', firmware: '', observaciones: '' });
                setShowModuloModal(true);
              }}
              className="ml-4 bg-blue-600 hover:bg-blue-700 text-white"
            >
              + Agregar Módulo
            </Button>
          </div>
          {modulos.length > 0 ? (
            <div className="space-y-3">
              {modulos.map((modulo, index) => (
                <div
                  key={index}
                  className="flex justify-between items-start p-4 bg-white rounded-lg border-2 border-blue-200 shadow-sm"
                >
                  <div className="flex-1">
                    <p className="font-black text-lg text-slate-900 uppercase">{modulo.nombre}</p>
                    {modulo.descripcion && <p className="text-sm text-slate-600 mt-1">{modulo.descripcion}</p>}
                    <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-slate-500">
                      {modulo.serie && <p><span className="font-bold">Serie:</span> {modulo.serie}</p>}
                      {modulo.firmware && <p><span className="font-bold">Firmware:</span> {modulo.firmware}</p>}
                    </div>
                    {modulo.observaciones && (
                      <p className="text-xs text-slate-600 italic mt-2">{modulo.observaciones}</p>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      type="button"
                      onClick={() => handleEditModulo(index)}
                      className="text-blue-600 hover:underline text-xs font-bold uppercase px-2 py-1 hover:bg-blue-50 rounded"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteModulo(index)}
                      className="text-red-600 hover:underline text-xs font-bold uppercase px-2 py-1 hover:bg-red-50 rounded"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 bg-white rounded-lg border-2 border-dashed border-blue-300">
              <p className="text-slate-500 text-sm mb-3">No hay módulos agregados aún</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingModuloIndex(null);
                  setModuloForm({ nombre: '', descripcion: '', serie: '', firmware: '', observaciones: '' });
                  setShowModuloModal(true);
                }}
              >
                + Agregar Primer Módulo
              </Button>
            </div>
          )}
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/equipos')}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Guardando...' : 'Crear Sistema'}
          </Button>
        </div>
      </form>

      {/* Modal Módulo */}
      {showModuloModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <h3 className="text-lg font-black text-slate-900 uppercase mb-4">
              {editingModuloIndex !== null ? 'Editar Módulo' : 'Nuevo Módulo'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Nombre *</label>
                <Input
                  value={moduloForm.nombre}
                  onChange={(e) => setModuloForm({ ...moduloForm, nombre: e.target.value })}
                  placeholder="Bomba, Inyector, Detector..."
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Descripción</label>
                <Input
                  value={moduloForm.descripcion}
                  onChange={(e) => setModuloForm({ ...moduloForm, descripcion: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Número de Serie</label>
                <Input
                  value={moduloForm.serie}
                  onChange={(e) => setModuloForm({ ...moduloForm, serie: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Versión Firmware</label>
                <Input
                  value={moduloForm.firmware}
                  onChange={(e) => setModuloForm({ ...moduloForm, firmware: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Observaciones</label>
                <textarea
                  value={moduloForm.observaciones}
                  onChange={(e) => setModuloForm({ ...moduloForm, observaciones: e.target.value })}
                  rows={3}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="Ej: bomba tiene canal c anulado..."
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowModuloModal(false);
                  setEditingModuloIndex(null);
                  setModuloForm({ nombre: '', descripcion: '', serie: '', firmware: '', observaciones: '' });
                }}
              >
                Cancelar
              </Button>
              <Button onClick={handleAddModulo}>
                {editingModuloIndex !== null ? 'Actualizar' : 'Agregar'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
