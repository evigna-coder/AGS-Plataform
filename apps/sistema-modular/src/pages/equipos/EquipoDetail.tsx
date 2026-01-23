import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { sistemasService, modulosService, categoriasEquipoService, clientesService } from '../../services/firebaseService';
import type { Sistema, ModuloSistema, CategoriaEquipo, Cliente } from '@ags/shared';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export const EquipoDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [sistema, setSistema] = useState<Sistema | null>(null);
  const [modulos, setModulos] = useState<ModuloSistema[]>([]);
  const [categorias, setCategorias] = useState<CategoriaEquipo[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<any>(null);
  const [showModuloModal, setShowModuloModal] = useState(false);
  const [editingModulo, setEditingModulo] = useState<ModuloSistema | null>(null);
  const [moduloForm, setModuloForm] = useState({
    nombre: '',
    descripcion: '',
    serie: '',
    firmware: '',
    observaciones: '',
  });

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [sistemaData, modulosData, categoriasData, clientesData] = await Promise.all([
        sistemasService.getById(id),
        modulosService.getBySistema(id),
        categoriasEquipoService.getAll(),
        clientesService.getAll(true),
      ]);
      if (sistemaData) {
        setSistema(sistemaData);
        setFormData({
          clienteId: sistemaData.clienteId,
          categoriaId: sistemaData.categoriaId,
          nombre: sistemaData.nombre,
          descripcion: sistemaData.descripcion,
          codigoInternoCliente: sistemaData.codigoInternoCliente,
          observaciones: sistemaData.observaciones || '',
          activo: sistemaData.activo,
        });
      } else {
        alert('Sistema no encontrado');
        navigate('/equipos');
      }
      setModulos(modulosData);
      setCategorias(categoriasData);
      setClientes(clientesData);
    } catch (error) {
      console.error('Error cargando datos:', error);
      alert('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!id || !formData) return;
    try {
      setSaving(true);
      await sistemasService.update(id, formData);
      await loadData();
      setEditing(false);
      alert('Sistema actualizado exitosamente');
    } catch (error) {
      console.error('Error guardando sistema:', error);
      alert('Error al guardar el sistema');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveModulo = async () => {
    if (!id) return;
    
    // Validación básica
    if (!moduloForm.nombre.trim()) {
      alert('Por favor ingrese el nombre del módulo');
      return;
    }
    
    try {
      if (editingModulo) {
        await modulosService.update(id, editingModulo.id, moduloForm);
        alert('Módulo actualizado exitosamente');
      } else {
        await modulosService.create(id, moduloForm);
        alert('Módulo agregado exitosamente');
      }
      await loadData();
      setShowModuloModal(false);
      setEditingModulo(null);
      setModuloForm({ nombre: '', descripcion: '', serie: '', firmware: '', observaciones: '' });
    } catch (error) {
      console.error('Error guardando módulo:', error);
      alert('Error al guardar el módulo. Verifique la consola para más detalles.');
    }
  };

  const handleDeleteModulo = async (moduloId: string) => {
    if (!id) return;
    if (!confirm('¿Está seguro de eliminar este módulo?')) return;
    try {
      await modulosService.delete(id, moduloId);
      await loadData();
    } catch (error) {
      console.error('Error eliminando módulo:', error);
      alert('Error al eliminar el módulo');
    }
  };

  const handleEditModulo = (modulo: ModuloSistema) => {
    setEditingModulo(modulo);
    setModuloForm({
      nombre: modulo.nombre,
      descripcion: modulo.descripcion || '',
      serie: modulo.serie || '',
      firmware: modulo.firmware || '',
      observaciones: modulo.observaciones || '',
    });
    setShowModuloModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-400">Cargando sistema...</p>
      </div>
    );
  }

  if (!sistema) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Sistema no encontrado</p>
        <Link to="/equipos" className="text-blue-600 hover:underline mt-2 inline-block">
          Volver a Equipos
        </Link>
      </div>
    );
  }

  const cliente = clientes.find(c => c.id === sistema.clienteId);
  const categoria = categorias.find(c => c.id === sistema.categoriaId);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
            {sistema.nombre}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {cliente?.razonSocial} {categoria && `• ${categoria.nombre}`}
            {sistema.activo ? (
              <span className="ml-2 text-green-600 font-bold">● Activo</span>
            ) : (
              <span className="ml-2 text-slate-400 font-bold">● Inactivo</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {!editing && (
            <>
              <Button variant="outline" onClick={() => setEditing(true)}>
                Editar
              </Button>
              <Button variant="outline" onClick={() => navigate('/equipos')}>
                Volver
              </Button>
            </>
          )}
          {editing && (
            <>
              <Button variant="outline" onClick={() => { setEditing(false); loadData(); }}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Datos del Sistema */}
      <Card>
        <h3 className="text-sm font-black text-slate-600 uppercase mb-4">Datos del Sistema</h3>
        {editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Cliente *</label>
                <select
                  value={formData.clienteId}
                  onChange={(e) => setFormData({ ...formData, clienteId: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  required
                >
                  <option value="">Seleccionar...</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.razonSocial}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Categoría *</label>
                <select
                  value={formData.categoriaId}
                  onChange={(e) => setFormData({ ...formData, categoriaId: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  required
                >
                  <option value="">Seleccionar...</option>
                  {categorias.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Nombre *</label>
                <Input
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Código Interno Cliente</label>
                <Input
                  value={formData.codigoInternoCliente}
                  onChange={(e) => setFormData({ ...formData, codigoInternoCliente: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Descripción *</label>
              <Input
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
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
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-400 text-xs uppercase font-bold mb-1">Cliente</p>
              <p className="font-bold text-slate-900">{cliente?.razonSocial || '-'}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs uppercase font-bold mb-1">Categoría</p>
              <p className="text-slate-600">{categoria?.nombre || '-'}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs uppercase font-bold mb-1">Código Interno</p>
              <p className="font-mono text-slate-600">{sistema.codigoInternoCliente || '-'}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs uppercase font-bold mb-1">Descripción</p>
              <p className="text-slate-600">{sistema.descripcion}</p>
            </div>
            {sistema.observaciones && (
              <div className="md:col-span-2">
                <p className="text-slate-400 text-xs uppercase font-bold mb-1">Observaciones</p>
                <p className="text-slate-600 italic">{sistema.observaciones}</p>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Módulos */}
      <Card className="border-2 border-blue-200 bg-blue-50/30">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-black text-slate-900 uppercase mb-2">Módulos del Sistema</h3>
            <p className="text-sm text-slate-600 mb-3">
              Agrega los módulos que componen este sistema (ej: Bomba, Inyector, Detector, etc.)
            </p>
          </div>
          <Button
            onClick={() => {
              setEditingModulo(null);
              setModuloForm({ nombre: '', descripcion: '', serie: '', firmware: '', observaciones: '' });
              setShowModuloModal(true);
            }}
            className="ml-4"
          >
            + Agregar Módulo
          </Button>
        </div>
        {modulos.length > 0 ? (
          <div className="space-y-3">
            {modulos.map((modulo) => (
              <div
                key={modulo.id}
                className="flex justify-between items-start p-4 bg-white rounded-lg border-2 border-slate-200 shadow-sm hover:border-blue-300 transition-colors"
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
                    onClick={() => handleEditModulo(modulo)}
                    className="text-blue-600 hover:underline text-xs font-bold uppercase px-2 py-1 hover:bg-blue-50 rounded"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDeleteModulo(modulo.id)}
                    className="text-red-600 hover:underline text-xs font-bold uppercase px-2 py-1 hover:bg-red-50 rounded"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-white rounded-lg border-2 border-dashed border-slate-300">
            <p className="text-slate-400 text-sm mb-3">No hay módulos registrados para este sistema</p>
            <Button
              variant="outline"
              onClick={() => {
                setEditingModulo(null);
                setModuloForm({ nombre: '', descripcion: '', serie: '', firmware: '', observaciones: '' });
                setShowModuloModal(true);
              }}
            >
              + Agregar Primer Módulo
            </Button>
          </div>
        )}
      </Card>

      {/* Ubicaciones (placeholder) */}
      <Card>
        <h3 className="text-sm font-black text-slate-600 uppercase mb-4">Ubicaciones</h3>
        <p className="text-slate-400 text-sm">Historial de ubicaciones (próximamente)</p>
      </Card>

      {/* Historial OT (placeholder) */}
      <Card>
        <h3 className="text-sm font-black text-slate-600 uppercase mb-4">Órdenes de Trabajo</h3>
        <p className="text-slate-400 text-sm">
          {sistema.otIds && sistema.otIds.length > 0
            ? `${sistema.otIds.length} OT(s) vinculada(s)`
            : 'No hay OTs vinculadas'}
        </p>
      </Card>

      {/* Modal Módulo */}
      {showModuloModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <h3 className="text-lg font-black text-slate-900 uppercase mb-4">
              {editingModulo ? 'Editar Módulo' : 'Nuevo Módulo'}
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
                  setEditingModulo(null);
                }}
              >
                Cancelar
              </Button>
              <Button onClick={handleSaveModulo}>
                Guardar
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
