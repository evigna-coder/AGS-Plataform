import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { establecimientosService, clientesService, condicionesPagoService } from '../../services/firebaseService';
import type { Establecimiento, Cliente, TipoServicioCliente } from '@ags/shared';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { AddressAutocomplete, AutocompleteResult } from '../../components/AddressAutocomplete';

const TIPOS: { value: Establecimiento['tipo']; label: string }[] = [
  { value: 'planta', label: 'Planta' },
  { value: 'sucursal', label: 'Sucursal' },
  { value: 'oficina', label: 'Oficina' },
  { value: 'laboratorio', label: 'Laboratorio' },
  { value: 'otro', label: 'Otro' },
];

const TIPOS_SERVICIO: { value: TipoServicioCliente; label: string }[] = [
  { value: 'contrato', label: 'Contrato' },
  { value: 'per_incident', label: 'Per Incident' },
];

export const EstablecimientoNew = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const clienteParam = searchParams.get('cliente');

  const isEditMode = !!id;

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [condicionesPago, setCondicionesPago] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [clienteCuit, setClienteCuit] = useState(clienteParam || '');
  const [formData, setFormData] = useState({
    nombre: '',
    direccion: '',
    localidad: '',
    provincia: '',
    pais: 'Argentina',
    codigoPostal: '',
    lat: null as number | null,
    lng: null as number | null,
    placeId: '',
    tipo: '' as Establecimiento['tipo'] | '',
    condicionPagoId: '' as string | null,
    tipoServicio: '' as TipoServicioCliente | '',
    infoPagos: '',
    pagaEnTiempo: false,
    sueleDemorarse: false,
    activo: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    clientesService.getAll(true).then(setClientes);
    condicionesPagoService.getAll().then(setCondicionesPago);

    if (isEditMode) {
      setLoading(true);
      establecimientosService.getById(id!).then(data => {
        if (data) {
          setClienteCuit(data.clienteCuit);
          setFormData({
            nombre: data.nombre || '',
            direccion: data.direccion || '',
            localidad: data.localidad || '',
            provincia: data.provincia || '',
            pais: data.pais || '',
            codigoPostal: data.codigoPostal || '',
            lat: data.lat || null,
            lng: data.lng || null,
            placeId: data.placeId || '',
            tipo: data.tipo || '',
            condicionPagoId: data.condicionPagoId || null,
            tipoServicio: data.tipoServicio || '',
            infoPagos: data.infoPagos || '',
            pagaEnTiempo: data.pagaEnTiempo || false,
            sueleDemorarse: data.sueleDemorarse || false,
            activo: data.activo === undefined ? true : data.activo,
          });
        }
        setLoading(false);
      }).catch(err => {
        console.error(err);
        setLoading(false);
      });
    }
  }, [id, isEditMode]);

  useEffect(() => {
    if (!isEditMode && clienteParam) setClienteCuit(clienteParam);
  }, [clienteParam, isEditMode]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!clienteCuit) e.cliente = 'Seleccione un cliente';
    if (!formData.nombre.trim()) e.nombre = 'El nombre es obligatorio';
    if (!formData.direccion.trim()) e.direccion = 'La dirección es obligatoria';
    if (!formData.localidad.trim()) e.localidad = 'La localidad es obligatoria';
    if (!formData.provincia.trim()) e.provincia = 'La provincia es obligatoria';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      setLoading(true);
      const payload = {
        nombre: formData.nombre.trim(),
        direccion: formData.direccion.trim(),
        localidad: formData.localidad.trim(),
        provincia: formData.provincia.trim(),
        pais: formData.pais?.trim() || null,
        codigoPostal: formData.codigoPostal?.trim() || null,
        lat: formData.lat || null,
        lng: formData.lng || null,
        placeId: formData.placeId?.trim() || null,
        tipo: formData.tipo || null,
        condicionPagoId: formData.condicionPagoId || null,
        tipoServicio: formData.tipoServicio || null,
        infoPagos: formData.infoPagos?.trim() || null,
        pagaEnTiempo: formData.pagaEnTiempo,
        sueleDemorarse: formData.sueleDemorarse,
        activo: formData.activo,
      };

      if (isEditMode) {
        // En update NO actualizamos clienteCuit para evitar cambios no intencionales
        await establecimientosService.update(id!, payload);
        alert('Establecimiento actualizado correctamente');
        navigate(`/establecimientos/${id}`);
      } else {
        const newId = await establecimientosService.create(clienteCuit, payload);
        alert('Establecimiento creado correctamente');
        navigate(`/establecimientos/${newId}`);
      }
    } catch (err) {
      console.error(err);
      alert(`Error al ${isEditMode ? 'actualizar' : 'crear'} el establecimiento`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 tracking-tight">
          {isEditMode ? 'Editar Establecimiento' : 'Nuevo Establecimiento'}
        </h2>
        <p className="text-sm text-slate-500 mt-1">Sede o planta del cliente</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Cliente *</label>
            <SearchableSelect
              value={clienteCuit}
              onChange={setClienteCuit}
              options={[
                { value: '', label: 'Seleccionar cliente...' },
                ...clientes.map(c => ({ value: c.id, label: `${c.razonSocial}${c.cuit ? ` (${c.cuit})` : ''}` })),
              ]}
              placeholder="Cliente"
              disabled={isEditMode}
            />
            {errors.cliente && <p className="text-red-600 text-xs mt-1">{errors.cliente}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
            <Input
              value={formData.nombre}
              onChange={e => setFormData({ ...formData, nombre: e.target.value })}
              placeholder="Ej: Planta CABA, Sede Tortuguitas"
            />
            {errors.nombre && <p className="text-red-600 text-xs mt-1">{errors.nombre}</p>}
          </div>

          <div>
            <AddressAutocomplete
              label="Dirección *"
              value={formData.direccion}
              onChange={e => setFormData({ ...formData, direccion: e.target.value })}
              onSelectAddress={(res: AutocompleteResult) => {
                setFormData(prev => ({
                  ...prev,
                  direccion: res.street ? (res.number ? `${res.street} ${res.number}` : res.street) : res.formattedAddress,
                  localidad: res.localidad || prev.localidad,
                  provincia: res.provincia || prev.provincia,
                  pais: res.pais || prev.pais,
                  codigoPostal: res.codigoPostal || prev.codigoPostal,
                  lat: res.lat ?? null,
                  lng: res.lng ?? null,
                  placeId: res.placeId ?? '',
                }));
              }}
              error={errors.direccion}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Localidad *</label>
              <Input
                value={formData.localidad}
                onChange={e => setFormData({ ...formData, localidad: e.target.value })}
              />
              {errors.localidad && <p className="text-red-600 text-xs mt-1">{errors.localidad}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Provincia *</label>
              <Input
                value={formData.provincia}
                onChange={e => setFormData({ ...formData, provincia: e.target.value })}
              />
              {errors.provincia && <p className="text-red-600 text-xs mt-1">{errors.provincia}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">País</label>
              <Input
                value={formData.pais}
                onChange={e => setFormData({ ...formData, pais: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Código postal</label>
              <Input
                value={formData.codigoPostal}
                onChange={e => setFormData({ ...formData, codigoPostal: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
            <SearchableSelect
              value={formData.tipo ?? ''}
              onChange={v => setFormData({ ...formData, tipo: (v as Establecimiento['tipo']) || '' })}
              options={[{ value: '', label: 'Sin tipo' }, ...TIPOS.map(t => ({ value: t.value ?? '', label: t.label }))]}
              placeholder="Opcional"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Condición de pago</label>
            <SearchableSelect
              value={formData.condicionPagoId ?? ''}
              onChange={v => setFormData({ ...formData, condicionPagoId: (v || null) as string | null })}
              options={[
                { value: '', label: 'Sin especificar' },
                ...condicionesPago.filter(c => c.activo !== false).map(c => ({ value: c.id, label: c.nombre })),
              ]}
              placeholder="Opcional"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de servicio</label>
            <SearchableSelect
              value={formData.tipoServicio ?? ''}
              onChange={v => setFormData({ ...formData, tipoServicio: v as TipoServicioCliente | '' })}
              options={[{ value: '', label: 'Sin especificar' }, ...TIPOS_SERVICIO.map(t => ({ value: t.value ?? '', label: t.label }))]}
              placeholder="Contrato / Per Incident"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Info pagos (notas)</label>
            <Input
              value={formData.infoPagos}
              onChange={e => setFormData({ ...formData, infoPagos: e.target.value })}
              placeholder="Observaciones sobre pagos"
            />
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.pagaEnTiempo}
                onChange={e => setFormData({ ...formData, pagaEnTiempo: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium text-slate-600">Paga en tiempo</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.sueleDemorarse}
                onChange={e => setFormData({ ...formData, sueleDemorarse: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium text-slate-600">Suele demorarse</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="activo"
              checked={formData.activo}
              onChange={e => setFormData({ ...formData, activo: e.target.checked })}
              className="w-4 h-4"
            />
            <label htmlFor="activo" className="text-sm font-medium text-slate-600">Activo</label>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : (isEditMode ? 'Actualizar establecimiento' : 'Crear establecimiento')}
            </Button>
            <Link to={clienteCuit ? `/establecimientos?cliente=${clienteCuit}` : '/establecimientos'}>
              <Button type="button" variant="outline">Cancelar</Button>
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
};
