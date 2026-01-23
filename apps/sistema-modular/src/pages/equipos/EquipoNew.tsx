import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { sistemasService, categoriasEquipoService, clientesService } from '../../services/firebaseService';
import type { CategoriaEquipo, Cliente } from '@ags/shared';
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
      
      alert('Sistema creado exitosamente');
      navigate(`/equipos/${sistemaId}`);
    } catch (error) {
      console.error('Error creando sistema:', error);
      alert('Error al crear el sistema');
    } finally {
      setLoading(false);
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

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/equipos')}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Guardando...' : 'Crear Sistema'}
          </Button>
        </div>
      </form>
    </div>
  );
};
