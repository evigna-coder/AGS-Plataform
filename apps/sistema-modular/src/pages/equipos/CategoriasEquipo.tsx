import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { categoriasEquipoService, categoriasModuloService } from '../../services/firebaseService';
import type { CategoriaEquipo, CategoriaModulo, ModeloModulo } from '@ags/shared';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

type TabType = 'sistemas' | 'modulos';

export const CategoriasEquipo = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('sistemas');
  
  // Estados para categorías de sistemas
  const [categoriasSistemas, setCategoriasSistemas] = useState<CategoriaEquipo[]>([]);
  const [showModalSistemas, setShowModalSistemas] = useState(false);
  const [editingSistema, setEditingSistema] = useState<CategoriaEquipo | null>(null);
  const [formDataSistemas, setFormDataSistemas] = useState({ nombre: '', modelosText: '' });
  
  // Estados para categorías de módulos
  const [categoriasModulos, setCategoriasModulos] = useState<CategoriaModulo[]>([]);
  const [showModalModulos, setShowModalModulos] = useState(false);
  const [editingModulo, setEditingModulo] = useState<CategoriaModulo | null>(null);
  const [formDataModulos, setFormDataModulos] = useState({ nombre: '', modelos: [] as ModeloModulo[] });
  const [nuevoModelo, setNuevoModelo] = useState({ codigo: '', descripcion: '' });
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [sistemasData, modulosData] = await Promise.all([
        categoriasEquipoService.getAll(),
        categoriasModuloService.getAll(),
      ]);
      setCategoriasSistemas(sistemasData);
      setCategoriasModulos(modulosData);
    } catch (error) {
      console.error('Error cargando categorías:', error);
      alert('Error al cargar categorías');
    } finally {
      setLoading(false);
    }
  };

  // Handlers para categorías de sistemas
  const handleSaveSistema = async () => {
    if (!formDataSistemas.nombre.trim()) {
      alert('El nombre es obligatorio');
      return;
    }
    try {
      const modelos = formDataSistemas.modelosText
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);
      const modelosUniq: string[] = [];
      for (const m of modelos) if (!modelosUniq.includes(m)) modelosUniq.push(m);

      if (editingSistema) {
        await categoriasEquipoService.update(editingSistema.id, { nombre: formDataSistemas.nombre.trim(), modelos: modelosUniq });
      } else {
        await categoriasEquipoService.create({ nombre: formDataSistemas.nombre.trim(), modelos: modelosUniq });
      }
      await loadAll();
      setShowModalSistemas(false);
      setEditingSistema(null);
      setFormDataSistemas({ nombre: '', modelosText: '' });
    } catch (error) {
      console.error('Error guardando categoría:', error);
      alert('Error al guardar la categoría');
    }
  };

  const handleEditSistema = (categoria: CategoriaEquipo) => {
    setEditingSistema(categoria);
    setFormDataSistemas({ nombre: categoria.nombre, modelosText: (categoria.modelos || []).join('\n') });
    setShowModalSistemas(true);
  };

  const handleDeleteSistema = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar esta categoría?')) return;
    try {
      await categoriasEquipoService.delete(id);
      await loadAll();
    } catch (error) {
      console.error('Error eliminando categoría:', error);
      alert('Error al eliminar la categoría');
    }
  };

  // Handlers para categorías de módulos
  const handleAddModelo = () => {
    if (!nuevoModelo.codigo.trim()) {
      alert('El código del modelo es obligatorio');
      return;
    }
    
    // Verificar que no exista ya un modelo con ese código
    if (formDataModulos.modelos.some(m => m.codigo === nuevoModelo.codigo.trim())) {
      alert('Ya existe un modelo con ese código');
      return;
    }
    
    setFormDataModulos({
      ...formDataModulos,
      modelos: [...formDataModulos.modelos, {
        codigo: nuevoModelo.codigo.trim(),
        descripcion: nuevoModelo.descripcion.trim() || nuevoModelo.codigo.trim()
      }]
    });
    setNuevoModelo({ codigo: '', descripcion: '' });
  };

  const handleRemoveModelo = (index: number) => {
    const nuevosModelos = [...formDataModulos.modelos];
    nuevosModelos.splice(index, 1);
    setFormDataModulos({ ...formDataModulos, modelos: nuevosModelos });
  };

  const handleSaveModulo = async () => {
    if (!formDataModulos.nombre.trim()) {
      alert('El nombre es obligatorio');
      return;
    }
    
    if (formDataModulos.modelos.length === 0) {
      alert('Debe agregar al menos un modelo');
      return;
    }

    try {
      if (editingModulo) {
        await categoriasModuloService.update(editingModulo.id, { 
          nombre: formDataModulos.nombre.trim(), 
          modelos: formDataModulos.modelos 
        });
      } else {
        await categoriasModuloService.create({ 
          nombre: formDataModulos.nombre.trim(), 
          modelos: formDataModulos.modelos 
        });
      }
      await loadAll();
      setShowModalModulos(false);
      setEditingModulo(null);
      setFormDataModulos({ nombre: '', modelos: [] });
      setNuevoModelo({ codigo: '', descripcion: '' });
    } catch (error) {
      console.error('Error guardando categoría de módulo:', error);
      alert('Error al guardar la categoría de módulo');
    }
  };

  const handleEditModulo = (categoria: CategoriaModulo) => {
    setEditingModulo(categoria);
    setFormDataModulos({ nombre: categoria.nombre, modelos: [...categoria.modelos] });
    setNuevoModelo({ codigo: '', descripcion: '' });
    setShowModalModulos(true);
  };

  const handleDeleteModulo = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar esta categoría de módulo?')) return;
    try {
      await categoriasModuloService.delete(id);
      await loadAll();
    } catch (error) {
      console.error('Error eliminando categoría de módulo:', error);
      alert('Error al eliminar la categoría de módulo');
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
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Categorías</h2>
          <p className="text-sm text-slate-500 mt-1">Gestionar categorías de sistemas y módulos</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/equipos')}>
          Volver a Equipos
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('sistemas')}
          className={`px-4 py-2 font-medium text-xs transition-colors ${
            activeTab === 'sistemas'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          Categorías de Sistemas
        </button>
        <button
          onClick={() => setActiveTab('modulos')}
          className={`px-4 py-2 font-medium text-xs transition-colors ${
            activeTab === 'modulos'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          Categorías de Módulos
        </button>
      </div>

      {/* Tab: Categorías de Sistemas */}
      {activeTab === 'sistemas' && (
        <Card>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-slate-900">Categorías de Sistemas</h3>
            <Button onClick={() => { setEditingSistema(null); setFormDataSistemas({ nombre: '', modelosText: '' }); setShowModalSistemas(true); }}>
              + Nueva Categoría
            </Button>
          </div>
          {categoriasSistemas.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400">No hay categorías registradas</p>
            </div>
          ) : (
            <div className="space-y-2">
              {categoriasSistemas.map((categoria) => (
                <div
                  key={categoria.id}
                  className="flex justify-between items-center p-4 bg-slate-50 rounded-lg border border-slate-200"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{categoria.nombre}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Modelos: {(categoria.modelos || []).length}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditSistema(categoria)}
                      className="text-blue-600 hover:underline text-xs font-medium"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDeleteSistema(categoria.id)}
                      className="text-red-600 hover:underline text-xs font-medium"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Tab: Categorías de Módulos */}
      {activeTab === 'modulos' && (
        <Card>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-slate-900">Categorías de Módulos</h3>
            <Button onClick={() => { setEditingModulo(null); setFormDataModulos({ nombre: '', modelos: [] }); setNuevoModelo({ codigo: '', descripcion: '' }); setShowModalModulos(true); }}>
              + Nueva Categoría
            </Button>
          </div>
          {categoriasModulos.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400">No hay categorías de módulos registradas</p>
            </div>
          ) : (
            <div className="space-y-2">
              {categoriasModulos.map((categoria) => (
                <div
                  key={categoria.id}
                  className="flex justify-between items-center p-4 bg-slate-50 rounded-lg border border-slate-200"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{categoria.nombre}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Modelos: {categoria.modelos.length}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditModulo(categoria)}
                      className="text-blue-600 hover:underline text-xs font-medium"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDeleteModulo(categoria.id)}
                      className="text-red-600 hover:underline text-xs font-medium"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Modal Categorías de Sistemas */}
      {showModalSistemas && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">
              {editingSistema ? 'Editar Categoría de Sistema' : 'Nueva Categoría de Sistema'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
                <Input
                  value={formDataSistemas.nombre}
                  onChange={(e) => setFormDataSistemas({ ...formDataSistemas, nombre: e.target.value })}
                  placeholder="Ej: Osmómetros, Cromatógrafos..."
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Modelos (1 por línea)
                </label>
                <textarea
                  value={formDataSistemas.modelosText}
                  onChange={(e) => setFormDataSistemas({ ...formDataSistemas, modelosText: e.target.value })}
                  rows={6}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  placeholder={"Ej:\nHPLC 1200\nHPLC 1100\nHPLC IONICO"}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Estos modelos se usarán como “Nombre” al crear un Sistema dentro de la categoría.
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowModalSistemas(false);
                  setEditingSistema(null);
                }}
              >
                Cancelar
              </Button>
              <Button onClick={handleSaveSistema}>
                Guardar
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Modal Categorías de Módulos */}
      {showModalModulos && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">
              {editingModulo ? 'Editar Categoría de Módulo' : 'Nueva Categoría de Módulo'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
                <Input
                  value={formDataModulos.nombre}
                  onChange={(e) => setFormDataModulos({ ...formDataModulos, nombre: e.target.value })}
                  placeholder="Ej: Bombas, Detectores, Inyectores..."
                  required
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">
                  Modelos ({formDataModulos.modelos.length})
                </label>
                
                {/* Lista de modelos existentes */}
                {formDataModulos.modelos.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {formDataModulos.modelos.map((modelo, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200"
                      >
                        <div className="flex-1">
                          <span className="font-mono font-bold text-slate-900">{modelo.codigo}</span>
                          {modelo.descripcion && (
                            <span className="text-slate-600 ml-2">- {modelo.descripcion}</span>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoveModelo(index)}
                          className="text-red-600 hover:text-red-800 font-bold text-sm px-2"
                          type="button"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Formulario para agregar nuevo modelo */}
                <div className="border border-slate-300 rounded-lg p-3 bg-white">
                  <p className="text-xs font-medium text-slate-600 mb-2">Agregar Nuevo Modelo</p>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <Input
                        value={nuevoModelo.codigo}
                        onChange={(e) => setNuevoModelo({ ...nuevoModelo, codigo: e.target.value })}
                        placeholder="Código (ej: G1311A)"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddModelo();
                          }
                        }}
                      />
                    </div>
                    <div>
                      <Input
                        value={nuevoModelo.descripcion}
                        onChange={(e) => setNuevoModelo({ ...nuevoModelo, descripcion: e.target.value })}
                        placeholder="Descripción (ej: Bomba Cuaternaria)"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddModelo();
                          }
                        }}
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={handleAddModelo}
                    className="w-full"
                    size="sm"
                  >
                    + Agregar Modelo
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowModalModulos(false);
                  setEditingModulo(null);
                  setFormDataModulos({ nombre: '', modelos: [] });
                  setNuevoModelo({ codigo: '', descripcion: '' });
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
