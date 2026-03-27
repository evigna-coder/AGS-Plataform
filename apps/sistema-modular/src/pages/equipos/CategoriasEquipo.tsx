import { useState, useEffect } from 'react';
import { categoriasEquipoService, categoriasModuloService } from '../../services/firebaseService';
import type { CategoriaEquipo, CategoriaModulo, ModeloModulo } from '@ags/shared';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useNavigateBack } from '../../hooks/useNavigateBack';

type TabType = 'sistemas' | 'modulos';

export const CategoriasEquipo = () => {
  const goBack = useNavigateBack();
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
  const [nuevoModelo, setNuevoModelo] = useState({ codigo: '', descripcion: '', marca: '' });
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [sistemasData, modulosData] = await Promise.all([
        categoriasEquipoService.getAll(),
        categoriasModuloService.getAll(),
      ]);
      setCategoriasSistemas(sistemasData);
      setCategoriasModulos(modulosData);
    } catch (error) {
      console.error('Error cargando categorías:', error);
      if (!silent) alert('Error al cargar categorías');
    } finally {
      if (!silent) setLoading(false);
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
      await loadAll(true);
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
      await loadAll(true);
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
        descripcion: nuevoModelo.descripcion.trim() || nuevoModelo.codigo.trim(),
        ...(nuevoModelo.marca.trim() ? { marca: nuevoModelo.marca.trim() } : {}),
      }]
    });
    setNuevoModelo({ codigo: '', descripcion: '', marca: '' });
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
      await loadAll(true);
      setShowModalModulos(false);
      setEditingModulo(null);
      setFormDataModulos({ nombre: '', modelos: [] });
      setNuevoModelo({ codigo: '', descripcion: '', marca: '' });
    } catch (error) {
      console.error('Error guardando categoría de módulo:', error);
      alert('Error al guardar la categoría de módulo');
    }
  };

  const handleEditModulo = (categoria: CategoriaModulo) => {
    setEditingModulo(categoria);
    setFormDataModulos({ nombre: categoria.nombre, modelos: [...categoria.modelos] });
    setNuevoModelo({ codigo: '', descripcion: '', marca: '' });
    setShowModalModulos(true);
  };

  const handleDeleteModulo = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar esta categoría de módulo?')) return;
    try {
      await categoriasModuloService.delete(id);
      await loadAll(true);
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
        <Button variant="outline" onClick={() => goBack()}>
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
            <Button onClick={() => { setEditingModulo(null); setFormDataModulos({ nombre: '', modelos: [] }); setNuevoModelo({ codigo: '', descripcion: '', marca: '' }); setShowModalModulos(true); }}>
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
      <Modal
        open={showModalSistemas}
        onClose={() => { setShowModalSistemas(false); setEditingSistema(null); }}
        title={editingSistema ? 'Editar Categoría de Sistema' : 'Nueva Categoría de Sistema'}
        maxWidth="sm"
        minimizable={false}
        footer={
          <>
            <Button variant="outline" onClick={() => { setShowModalSistemas(false); setEditingSistema(null); }}>
              Cancelar
            </Button>
            <Button onClick={handleSaveSistema}>Guardar</Button>
          </>
        }
      >
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
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              placeholder={"Ej:\nHPLC 1200\nHPLC 1100\nHPLC IONICO"}
            />
            <p className="mt-1 text-xs text-slate-500">
              Estos modelos se usarán como "Nombre" al crear un Sistema dentro de la categoría.
            </p>
          </div>
        </div>
      </Modal>

      {/* Modal Categorías de Módulos */}
      <Modal
        open={showModalModulos}
        onClose={() => { setShowModalModulos(false); setEditingModulo(null); setFormDataModulos({ nombre: '', modelos: [] }); setNuevoModelo({ codigo: '', descripcion: '', marca: '' }); }}
        title={editingModulo ? 'Editar Categoría de Módulo' : 'Nueva Categoría de Módulo'}
        maxWidth="lg"
        minimizable={false}
        footer={
          <>
            <Button variant="outline" onClick={() => { setShowModalModulos(false); setEditingModulo(null); setFormDataModulos({ nombre: '', modelos: [] }); setNuevoModelo({ codigo: '', descripcion: '', marca: '' }); }}>
              Cancelar
            </Button>
            <Button onClick={handleSaveModulo}>Guardar</Button>
          </>
        }
      >
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

            {/* Lista de modelos existentes (editable inline) */}
            {formDataModulos.modelos.length > 0 && (
              <div className="space-y-2 mb-4">
                {formDataModulos.modelos.map((modelo, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200"
                  >
                    <input
                      type="text"
                      value={modelo.codigo}
                      onChange={(e) => {
                        const updated = [...formDataModulos.modelos];
                        updated[index] = { ...updated[index], codigo: e.target.value };
                        setFormDataModulos({ ...formDataModulos, modelos: updated });
                      }}
                      className="w-32 shrink-0 font-mono font-bold text-slate-900 bg-white border border-slate-200 rounded px-2 py-1 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-200 outline-none"
                    />
                    <span className="text-slate-400 text-sm">-</span>
                    <input
                      type="text"
                      value={modelo.descripcion}
                      onChange={(e) => {
                        const updated = [...formDataModulos.modelos];
                        updated[index] = { ...updated[index], descripcion: e.target.value };
                        setFormDataModulos({ ...formDataModulos, modelos: updated });
                      }}
                      className="flex-1 text-slate-600 bg-white border border-slate-200 rounded px-2 py-1 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-200 outline-none"
                      placeholder="Descripción"
                    />
                    <span className="text-slate-400 text-sm">-</span>
                    <input
                      type="text"
                      value={modelo.marca || ''}
                      onChange={(e) => {
                        const updated = [...formDataModulos.modelos];
                        updated[index] = { ...updated[index], marca: e.target.value };
                        setFormDataModulos({ ...formDataModulos, modelos: updated });
                      }}
                      className="w-28 shrink-0 text-slate-600 bg-white border border-slate-200 rounded px-2 py-1 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-200 outline-none"
                      placeholder="Marca"
                    />
                    <button
                      onClick={() => handleRemoveModelo(index)}
                      className="text-red-600 hover:text-red-800 font-bold text-sm px-2 shrink-0"
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
              <div className="grid grid-cols-3 gap-2 mb-2">
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
                <div>
                  <Input
                    value={nuevoModelo.marca}
                    onChange={(e) => setNuevoModelo({ ...nuevoModelo, marca: e.target.value })}
                    placeholder="Marca (ej: Agilent)"
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
      </Modal>
    </div>
  );
};
