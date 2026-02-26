import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { sistemasService, modulosService, categoriasEquipoService, categoriasModuloService, clientesService, establecimientosService } from '../../services/firebaseService';
import type { Sistema, ModuloSistema, CategoriaEquipo, CategoriaModulo, Cliente, Establecimiento } from '@ags/shared';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SearchableSelect } from '../../components/ui/SearchableSelect';

export const EquipoDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [sistema, setSistema] = useState<Sistema | null>(null);
  const [establecimiento, setEstablecimiento] = useState<Establecimiento | null>(null);
  const [modulos, setModulos] = useState<ModuloSistema[]>([]);
  const [categorias, setCategorias] = useState<CategoriaEquipo[]>([]);
  const [categoriasModulos, setCategoriasModulos] = useState<CategoriaModulo[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<any>(null);
  const [showModuloModal, setShowModuloModal] = useState(false);
  const [editingModulo, setEditingModulo] = useState<ModuloSistema | null>(null);
  const [moduloForm, setModuloForm] = useState({
    categoriaModuloId: '',
    modeloCodigo: '',
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
      const [sistemaData, modulosData, categoriasData, categoriasModulosData, clientesData] = await Promise.all([
        sistemasService.getById(id),
        modulosService.getBySistema(id),
        categoriasEquipoService.getAll(),
        categoriasModuloService.getAll(),
        clientesService.getAll(true),
      ]);
      if (sistemaData) {
        setSistema(sistemaData);
        let est: Establecimiento | null = null;
        if (sistemaData.establecimientoId) {
          est = await establecimientosService.getById(sistemaData.establecimientoId);
          setEstablecimiento(est);
        } else {
          setEstablecimiento(null);
        }
        const clienteCuit = est?.clienteCuit ?? sistemaData.clienteId ?? '';
        if (clienteCuit) {
          const list = await establecimientosService.getByCliente(clienteCuit);
          setEstablecimientos(list);
        } else {
          setEstablecimientos([]);
        }
        setFormData({
          clienteId: clienteCuit,
          establecimientoId: sistemaData.establecimientoId || '',
          categoriaId: sistemaData.categoriaId,
          nombre: sistemaData.nombre,
          codigoInternoCliente: sistemaData.codigoInternoCliente,
          software: sistemaData.software || '',
          observaciones: sistemaData.observaciones || '',
          activo: sistemaData.activo,
        });
      } else {
        alert('Sistema no encontrado');
        navigate('/equipos');
      }
      setModulos(modulosData);
      setCategorias(categoriasData);
      setCategoriasModulos(categoriasModulosData);
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
      const { descripcion, ...dataToSave } = formData;
      await sistemasService.update(id, {
        ...dataToSave,
        establecimientoId: formData.establecimientoId || undefined,
        clienteId: formData.clienteId || undefined,
      });
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
    
    // Si se seleccionó un modelo de categoría, usar esos datos
    let nombreFinal = moduloForm.nombre;
    let descripcionFinal = moduloForm.descripcion;
    
    if (moduloForm.categoriaModuloId && moduloForm.modeloCodigo) {
      const categoria = categoriasModulos.find(c => c.id === moduloForm.categoriaModuloId);
      const modelo = categoria?.modelos.find(m => m.codigo === moduloForm.modeloCodigo);
      if (modelo) {
        nombreFinal = modelo.codigo;
        descripcionFinal = modelo.descripcion;
      }
    }
    
    if (!nombreFinal.trim()) {
      alert('Por favor seleccione un modelo o ingrese el nombre del módulo');
      return;
    }
    
    // Helper para limpiar campos vacíos y evitar undefined en Firestore
    const cleanValue = (value: any): any => {
      if (value === '' || value === null || value === undefined) {
        return null; // Firestore acepta null pero no undefined
      }
      return value;
    };
    
    const moduloData = {
      nombre: nombreFinal,
      descripcion: cleanValue(descripcionFinal),
      serie: cleanValue(moduloForm.serie),
      firmware: cleanValue(moduloForm.firmware),
      observaciones: cleanValue(moduloForm.observaciones),
      ubicaciones: [],
      otIds: [],
    };
    
    try {
      if (editingModulo) {
        await modulosService.update(id, editingModulo.id, moduloData);
        alert('Módulo actualizado exitosamente');
      } else {
        await modulosService.create(id, moduloData);
        alert('Módulo agregado exitosamente');
      }
      await loadData();
      setShowModuloModal(false);
      setEditingModulo(null);
      setModuloForm({ categoriaModuloId: '', modeloCodigo: '', nombre: '', descripcion: '', serie: '', firmware: '', observaciones: '' });
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
    // Intentar encontrar la categoría y modelo que coincida con este módulo
    let categoriaId = '';
    let modeloCodigo = '';
    
    for (const cat of categoriasModulos) {
      const modelo = cat.modelos.find(m => m.codigo === modulo.nombre);
      if (modelo) {
        categoriaId = cat.id;
        modeloCodigo = modelo.codigo;
        break;
      }
    }
    
    setModuloForm({
      categoriaModuloId: categoriaId,
      modeloCodigo: modeloCodigo,
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

  const cliente = clientes.find(c => c.id === (establecimiento?.clienteCuit ?? sistema.clienteId));
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
            {cliente?.razonSocial}
            {establecimiento && ` • ${establecimiento.nombre}`}
            {categoria && ` • ${categoria.nombre}`}
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
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Cliente</label>
                <SearchableSelect
                  value={formData.clienteId}
                  onChange={async (value) => {
                    setFormData({ ...formData, clienteId: value, establecimientoId: '' });
                    const list = value ? await establecimientosService.getByCliente(value) : [];
                    setEstablecimientos(list);
                  }}
                  options={clientes.map(c => ({ value: c.id, label: `${c.razonSocial}${c.cuit ? ` (${c.cuit})` : ''}` }))}
                  placeholder="Seleccionar..."
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Establecimiento *</label>
                <SearchableSelect
                  value={formData.establecimientoId}
                  onChange={(value) => setFormData({ ...formData, establecimientoId: value })}
                  options={establecimientos.map(e => ({ value: e.id, label: e.nombre }))}
                  placeholder={formData.clienteId ? 'Seleccionar...' : 'Primero seleccione cliente'}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Categoría *</label>
                <SearchableSelect
                  value={formData.categoriaId}
                  onChange={(value) => setFormData({ ...formData, categoriaId: value })}
                  options={categorias.map(cat => ({ value: cat.id, label: cat.nombre }))}
                  placeholder="Seleccionar..."
                  required
                />
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
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Software *</label>
                <Input
                  value={formData.software}
                  onChange={(e) => setFormData({ ...formData, software: e.target.value })}
                  placeholder="Ej: OpenLab, ChemStation, MassHunter..."
                  required
                />
              </div>
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
              <p className="text-slate-400 text-xs uppercase font-bold mb-1">Software</p>
              <p className="text-slate-600 font-semibold">{sistema.software || '-'}</p>
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
                setModuloForm({ categoriaModuloId: '', modeloCodigo: '', nombre: '', descripcion: '', serie: '', firmware: '', observaciones: '' });
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
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Categoría de Módulo</label>
                <SearchableSelect
                  value={moduloForm.categoriaModuloId}
                  onChange={(value) => {
                    setModuloForm({ ...moduloForm, categoriaModuloId: value, modeloCodigo: '', nombre: '', descripcion: '' });
                  }}
                  options={categoriasModulos.map(cat => ({ value: cat.id, label: cat.nombre }))}
                  placeholder="Seleccionar categoría (opcional)..."
                />
                <p className="mt-1 text-xs text-slate-500">O deje vacío para escribir manualmente</p>
              </div>

              {moduloForm.categoriaModuloId ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Modelo *</label>
                    <SearchableSelect
                      value={moduloForm.modeloCodigo}
                      onChange={(value) => {
                        const categoria = categoriasModulos.find(c => c.id === moduloForm.categoriaModuloId);
                        const modelo = categoria?.modelos.find(m => m.codigo === value);
                        setModuloForm({
                          ...moduloForm,
                          modeloCodigo: value,
                          nombre: modelo?.codigo || '',
                          descripcion: modelo?.descripcion || '',
                        });
                      }}
                      options={categoriasModulos
                        .find(c => c.id === moduloForm.categoriaModuloId)
                        ?.modelos.map(m => ({ value: m.codigo, label: `${m.codigo} - ${m.descripcion}` })) || []}
                      placeholder="Seleccionar modelo..."
                      required
                    />
                  </div>
                  {moduloForm.modeloCodigo && (() => {
                    const categoria = categoriasModulos.find(c => c.id === moduloForm.categoriaModuloId);
                    const modelo = categoria?.modelos.find(m => m.codigo === moduloForm.modeloCodigo);
                    if (modelo) {
                      return (
                        <>
                          <div>
                            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Código del Modelo</label>
                            <Input
                              value={modelo.codigo}
                              disabled
                              className="bg-slate-100 text-slate-600 cursor-not-allowed"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Descripción</label>
                            <Input
                              value={modelo.descripcion}
                              disabled
                              className="bg-slate-100 text-slate-600 cursor-not-allowed"
                            />
                          </div>
                        </>
                      );
                    }
                    return null;
                  })()}
                </>
              ) : (
                <>
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
                </>
              )}

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
