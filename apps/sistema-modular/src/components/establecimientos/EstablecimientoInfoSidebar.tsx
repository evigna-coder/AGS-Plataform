import type { Establecimiento, CondicionPago, Cliente, TipoServicioCliente } from '@ags/shared';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';
import { AddressAutocomplete, AutocompleteResult } from '../AddressAutocomplete';
import { Link } from 'react-router-dom';

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

interface EstablecimientoInfoSidebarProps {
  est: Establecimiento;
  cliente: Cliente | null;
  condicionesPago: CondicionPago[];
  editing: boolean;
  formData: any;
  setFormData: (data: any) => void;
}

const LabelValue = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-[11px] font-medium text-slate-400 mb-0.5">{label}</p>
    <p className="text-xs text-slate-700">{value || '--'}</p>
  </div>
);

export const EstablecimientoInfoSidebar = ({
  est, cliente, condicionesPago, editing, formData, setFormData,
}: EstablecimientoInfoSidebarProps) => (
  <div className="w-72 shrink-0 space-y-4">
    {/* Ubicacion */}
    <Card compact>
      <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-3">Ubicacion</h3>
      {editing ? (
        <div className="space-y-3">
          <Input
            inputSize="sm"
            label="Nombre *"
            value={formData.nombre}
            onChange={e => setFormData({ ...formData, nombre: e.target.value })}
            required
          />
          <AddressAutocomplete
            label="Direccion *"
            value={formData.direccion}
            onChange={e => setFormData({ ...formData, direccion: e.target.value })}
            onSelectAddress={(res: AutocompleteResult) => {
              setFormData((prev: any) => ({
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
          />
          <Input
            inputSize="sm"
            label="Localidad *"
            value={formData.localidad}
            onChange={e => setFormData({ ...formData, localidad: e.target.value })}
            required
          />
          <Input
            inputSize="sm"
            label="Provincia *"
            value={formData.provincia}
            onChange={e => setFormData({ ...formData, provincia: e.target.value })}
            required
          />
          <Input
            inputSize="sm"
            label="Pais"
            value={formData.pais}
            onChange={e => setFormData({ ...formData, pais: e.target.value })}
          />
          <Input
            inputSize="sm"
            label="Codigo postal"
            value={formData.codigoPostal}
            onChange={e => setFormData({ ...formData, codigoPostal: e.target.value })}
          />
        </div>
      ) : (
        <div className="space-y-2.5">
          <LabelValue label="Direccion" value={`${est.direccion}, ${est.localidad}`} />
          <LabelValue label="Provincia" value={est.provincia} />
          {est.pais && <LabelValue label="Pais" value={est.pais} />}
          {est.codigoPostal && <LabelValue label="Codigo postal" value={est.codigoPostal} />}
        </div>
      )}
    </Card>

    {/* Clasificacion */}
    <Card compact>
      <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-3">Clasificacion</h3>
      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-0.5">Tipo</label>
            <SearchableSelect
              value={formData.tipo ?? ''}
              onChange={v => setFormData({ ...formData, tipo: (v as Establecimiento['tipo']) || '' })}
              options={[{ value: '', label: 'Sin tipo' }, ...TIPOS.map(t => ({ value: t.value ?? '', label: t.label }))]}
              placeholder="Opcional"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-0.5">Tipo de servicio</label>
            <SearchableSelect
              value={formData.tipoServicio ?? ''}
              onChange={v => setFormData({ ...formData, tipoServicio: v as TipoServicioCliente | '' })}
              options={[{ value: '', label: 'Sin especificar' }, ...TIPOS_SERVICIO.map(t => ({ value: t.value ?? '', label: t.label }))]}
              placeholder="Opcional"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.activo}
              onChange={e => setFormData({ ...formData, activo: e.target.checked })}
              className="w-3.5 h-3.5"
            />
            <span className="text-xs text-slate-600">Activo</span>
          </label>
        </div>
      ) : (
        <div className="space-y-2.5">
          {est.tipo && (
            <LabelValue label="Tipo" value={TIPOS.find(t => t.value === est.tipo)?.label || est.tipo} />
          )}
          {est.tipoServicio && (
            <LabelValue label="Tipo servicio" value={est.tipoServicio === 'contrato' ? 'Contrato' : 'Per Incident'} />
          )}
          <div>
            <p className="text-[11px] font-medium text-slate-400 mb-0.5">Estado</p>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${est.activo ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
              {est.activo ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </div>
      )}
    </Card>

    {/* Pagos */}
    <Card compact>
      <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-3">Pagos</h3>
      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-0.5">Condicion de pago</label>
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
          <Input
            inputSize="sm"
            label="Info pagos"
            value={formData.infoPagos}
            onChange={e => setFormData({ ...formData, infoPagos: e.target.value })}
            placeholder="Notas"
          />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.pagaEnTiempo}
              onChange={e => setFormData({ ...formData, pagaEnTiempo: e.target.checked })}
              className="w-3.5 h-3.5"
            />
            <span className="text-xs text-slate-600">Paga en tiempo</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.sueleDemorarse}
              onChange={e => setFormData({ ...formData, sueleDemorarse: e.target.checked })}
              className="w-3.5 h-3.5"
            />
            <span className="text-xs text-slate-600">Suele demorarse</span>
          </label>
        </div>
      ) : (
        <div className="space-y-2.5">
          {est.condicionPagoId && (
            <LabelValue
              label="Condicion de pago"
              value={condicionesPago.find(c => c.id === est.condicionPagoId)?.nombre ?? est.condicionPagoId}
            />
          )}
          {est.infoPagos && <LabelValue label="Info pagos" value={est.infoPagos} />}
          <div className="flex gap-3">
            {est.pagaEnTiempo && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-50 text-green-700">Paga en tiempo</span>
            )}
            {est.sueleDemorarse && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">Suele demorarse</span>
            )}
          </div>
        </div>
      )}
    </Card>

    {/* Cliente */}
    {cliente && (
      <Card compact>
        <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-3">Cliente</h3>
        <div className="space-y-2.5">
          <div>
            <p className="text-[11px] font-medium text-slate-400 mb-0.5">Razon Social</p>
            <Link to={`/clientes/${est.clienteCuit}`} className="text-xs text-indigo-600 hover:underline font-medium">
              {cliente.razonSocial}
            </Link>
          </div>
          {cliente.cuit && <LabelValue label="CUIT" value={cliente.cuit} />}
          <LabelValue label="Rubro" value={cliente.rubro} />
        </div>
      </Card>
    )}
  </div>
);
