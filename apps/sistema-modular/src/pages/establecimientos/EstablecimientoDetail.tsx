import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { establecimientosService, clientesService, sistemasService, condicionesPagoService, contactosEstablecimientoService } from '../../services/firebaseService';
import type { Establecimiento, Cliente, Sistema, ContactoEstablecimiento, TipoServicioCliente, CondicionPago } from '@ags/shared';
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

const emptyContactoForm = {
  nombre: '',
  cargo: '',
  sector: '',
  telefono: '',
  interno: '',
  email: '',
  esPrincipal: false,
};

export const EstablecimientoDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [est, setEst] = useState<Establecimiento | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [contactos, setContactos] = useState<ContactoEstablecimiento[]>([]);
  const [condicionesPago, setCondicionesPago] = useState<CondicionPago[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    direccion: '',
    localidad: '',
    provincia: '',
    pais: '',
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
  const [showContactoModal, setShowContactoModal] = useState(false);
  const [editingContacto, setEditingContacto] = useState<ContactoEstablecimiento | null>(null);
  const [contactoForm, setContactoForm] = useState(emptyContactoForm);

  useEffect(() => {
    if (id) load();
  }, [id]);

  const load = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [estData, sistemasData, contactosData, condicionesData] = await Promise.all([
        establecimientosService.getById(id),
        sistemasService.getAll({ establecimientoId: id }),
        contactosEstablecimientoService.getByEstablecimiento(id),
        condicionesPagoService.getAll(),
      ]);
      if (estData) {
        setEst(estData);
        setFormData({
          nombre: estData.nombre,
          direccion: estData.direccion,
          localidad: estData.localidad,
          provincia: estData.provincia,
          pais: estData.pais || '',
          codigoPostal: estData.codigoPostal || '',
          lat: estData.lat || null,
          lng: estData.lng || null,
          placeId: estData.placeId || '',
          tipo: estData.tipo || '',
          condicionPagoId: estData.condicionPagoId ?? '',
          tipoServicio: estData.tipoServicio || '',
          infoPagos: estData.infoPagos || '',
          pagaEnTiempo: estData.pagaEnTiempo ?? false,
          sueleDemorarse: estData.sueleDemorarse ?? false,
          activo: estData.activo,
        });
        setContactos(contactosData);
        setCondicionesPago(condicionesData);
        const clienteData = await clientesService.getById(estData.clienteCuit);
        setCliente(clienteData || null);
        setSistemas(sistemasData);
      } else {
        alert('Establecimiento no encontrado');
        navigate('/establecimientos');
      }
    } catch (e) {
      console.error(e);
      alert('Error al cargar');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!id) return;
    try {
      setSaving(true);
      await establecimientosService.update(id, {
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
      });
      await load();
      setEditing(false);
      alert('Establecimiento actualizado');
    } catch (e) {
      console.error(e);
      alert('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveContacto = async () => {
    if (!id) return;
    if (!contactoForm.nombre.trim() || !contactoForm.telefono.trim() || !contactoForm.email.trim()) {
      alert('Complete Nombre, Teléfono y Email');
      return;
    }
    try {
      if (editingContacto) {
        await contactosEstablecimientoService.update(id, editingContacto.id, contactoForm);
        alert('Contacto actualizado');
      } else {
        await contactosEstablecimientoService.create(id, contactoForm);
        alert('Contacto agregado');
      }
      setShowContactoModal(false);
      setEditingContacto(null);
      setContactoForm(emptyContactoForm);
      const list = await contactosEstablecimientoService.getByEstablecimiento(id);
      setContactos(list);
    } catch (e) {
      console.error(e);
      alert('Error al guardar contacto');
    }
  };

  const handleDeleteContacto = async (contactoId: string) => {
    if (!id || !confirm('¿Eliminar este contacto?')) return;
    try {
      await contactosEstablecimientoService.delete(id, contactoId);
      setContactos(prev => prev.filter(c => c.id !== contactoId));
    } catch (e) {
      console.error(e);
      alert('Error al eliminar');
    }
  };

  const openEditContacto = (c: ContactoEstablecimiento) => {
    setEditingContacto(c);
    setContactoForm({
      nombre: c.nombre,
      cargo: c.cargo,
      sector: c.sector || '',
      telefono: c.telefono,
      interno: c.interno || '',
      email: c.email,
      esPrincipal: c.esPrincipal ?? false,
    });
    setShowContactoModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-400">Cargando...</p>
      </div>
    );
  }

  if (!est) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{est.nombre}</h2>
          <p className="text-sm text-slate-500 mt-1">
            {cliente?.razonSocial && (
              <>
                Cliente: <Link to={`/clientes/${est.clienteCuit}`} className="text-blue-600 hover:underline">{cliente.razonSocial}</Link>
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {!editing ? (
            <>
              <Button variant="outline" onClick={() => setEditing(true)}>Editar</Button>
              <Button variant="outline" onClick={() => navigate('/establecimientos')}>Volver</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => { setEditing(false); load(); }}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <h3 className="text-sm font-black text-slate-600 uppercase mb-4">Datos del establecimiento</h3>
        {editing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Nombre *</label>
              <Input value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} />
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
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Localidad *</label>
                <Input value={formData.localidad} onChange={e => setFormData({ ...formData, localidad: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Provincia *</label>
                <Input value={formData.provincia} onChange={e => setFormData({ ...formData, provincia: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">País</label>
                <Input value={formData.pais} onChange={e => setFormData({ ...formData, pais: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Código postal</label>
                <Input value={formData.codigoPostal} onChange={e => setFormData({ ...formData, codigoPostal: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Tipo</label>
              <SearchableSelect
                value={formData.tipo ?? ''}
                onChange={v => setFormData({ ...formData, tipo: (v as Establecimiento['tipo']) || '' })}
                options={[{ value: '', label: 'Sin tipo' }, ...TIPOS.map(t => ({ value: t.value ?? '', label: t.label }))]}
                placeholder="Opcional"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Condición de pago</label>
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
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Tipo de servicio</label>
              <SearchableSelect
                value={formData.tipoServicio ?? ''}
                onChange={v => setFormData({ ...formData, tipoServicio: v as TipoServicioCliente | '' })}
                options={[{ value: '', label: 'Sin especificar' }, ...TIPOS_SERVICIO.map(t => ({ value: t.value ?? '', label: t.label }))]}
                placeholder="Opcional"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Info pagos</label>
              <Input value={formData.infoPagos} onChange={e => setFormData({ ...formData, infoPagos: e.target.value })} placeholder="Notas" />
            </div>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formData.pagaEnTiempo} onChange={e => setFormData({ ...formData, pagaEnTiempo: e.target.checked })} className="w-4 h-4" />
                <span className="text-sm font-bold text-slate-600">Paga en tiempo</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formData.sueleDemorarse} onChange={e => setFormData({ ...formData, sueleDemorarse: e.target.checked })} className="w-4 h-4" />
                <span className="text-sm font-bold text-slate-600">Suele demorarse</span>
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="activo" checked={formData.activo} onChange={e => setFormData({ ...formData, activo: e.target.checked })} className="w-4 h-4" />
              <label htmlFor="activo" className="text-sm font-bold text-slate-600">Activo</label>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-400 text-xs uppercase font-bold mb-1">Dirección</p>
              <p className="text-slate-700">{est.direccion}, {est.localidad}, {est.provincia}{est.pais ? `, ${est.pais}` : ''}{est.codigoPostal ? ` (${est.codigoPostal})` : ''}</p>
            </div>
            {est.tipo && (
              <div>
                <p className="text-slate-400 text-xs uppercase font-bold mb-1">Tipo</p>
                <p className="text-slate-700">{TIPOS.find(t => t.value === est.tipo)?.label || est.tipo}</p>
              </div>
            )}
            {est.condicionPagoId && (
              <div>
                <p className="text-slate-400 text-xs uppercase font-bold mb-1">Condición de pago</p>
                <p className="text-slate-700">{condicionesPago.find(c => c.id === est.condicionPagoId)?.nombre ?? est.condicionPagoId}</p>
              </div>
            )}
            {est.tipoServicio && (
              <div>
                <p className="text-slate-400 text-xs uppercase font-bold mb-1">Tipo servicio</p>
                <p className="text-slate-700">{est.tipoServicio === 'contrato' ? 'Contrato' : 'Per Incident'}</p>
              </div>
            )}
            {est.infoPagos && (
              <div className="col-span-2">
                <p className="text-slate-400 text-xs uppercase font-bold mb-1">Info pagos</p>
                <p className="text-slate-700">{est.infoPagos}</p>
              </div>
            )}
            <div>
              <p className="text-slate-400 text-xs uppercase font-bold mb-1">Estado</p>
              <span className={`px-2 py-1 rounded-full text-xs font-bold ${est.activo ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                {est.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* Contactos del establecimiento */}
      <Card className="border-2 border-purple-200 bg-purple-50/30">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-black text-slate-900 uppercase">Contactos</h3>
          <Button
            size="sm"
            onClick={() => {
              setEditingContacto(null);
              setContactoForm(emptyContactoForm);
              setShowContactoModal(true);
            }}
          >
            + Agregar contacto
          </Button>
        </div>
        {contactos.length === 0 ? (
          <p className="text-slate-500 text-sm py-4">No hay contactos. Agregue uno para este establecimiento.</p>
        ) : (
          <ul className="space-y-2">
            {contactos.map(c => (
              <li key={c.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <p className="font-bold text-slate-900">{c.nombre}</p>
                  <p className="text-xs text-slate-600">{c.cargo}{c.sector ? ` • ${c.sector}` : ''}</p>
                  <p className="text-xs text-slate-500">{c.email} | {c.telefono}{c.interno ? ` (Int: ${c.interno})` : ''}</p>
                  {c.esPrincipal && <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-bold">Principal</span>}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => openEditContacto(c)} className="text-blue-600 hover:underline text-xs font-bold uppercase">Editar</button>
                  <button type="button" onClick={() => handleDeleteContacto(c.id)} className="text-red-600 hover:underline text-xs font-bold uppercase">Eliminar</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-black text-slate-600 uppercase">Sistemas / Equipos en este establecimiento</h3>
          <Link to={`/equipos/nuevo?establecimiento=${id}`}>
            <Button variant="outline" size="sm">+ Agregar sistema</Button>
          </Link>
        </div>
        {sistemas.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-sm">
            No hay sistemas registrados. <Link to={`/equipos/nuevo?establecimiento=${id}`} className="text-blue-600 hover:underline">Agregar sistema</Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {sistemas.map(s => (
              <li key={s.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="font-bold text-slate-900">{s.nombre}</span>
                <Link to={`/equipos/${s.id}`}><Button variant="outline" size="sm">Ver</Button></Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Modal contacto */}
      {showContactoModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <h3 className="text-lg font-black text-slate-900 uppercase mb-4">
              {editingContacto ? 'Editar contacto' : 'Nuevo contacto'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Nombre *</label>
                <Input value={contactoForm.nombre} onChange={e => setContactoForm({ ...contactoForm, nombre: e.target.value })} required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Cargo</label>
                <Input value={contactoForm.cargo} onChange={e => setContactoForm({ ...contactoForm, cargo: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Sector</label>
                <Input value={contactoForm.sector} onChange={e => setContactoForm({ ...contactoForm, sector: e.target.value })} placeholder="Laboratorio, Compras..." />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Teléfono *</label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Input value={contactoForm.telefono} onChange={e => setContactoForm({ ...contactoForm, telefono: e.target.value })} placeholder="Teléfono" required />
                  </div>
                  <div>
                    <Input value={contactoForm.interno} onChange={e => setContactoForm({ ...contactoForm, interno: e.target.value })} placeholder="Int." />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Email *</label>
                <Input type="email" value={contactoForm.email} onChange={e => setContactoForm({ ...contactoForm, email: e.target.value })} required />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={contactoForm.esPrincipal} onChange={e => setContactoForm({ ...contactoForm, esPrincipal: e.target.checked })} className="w-4 h-4" />
                <span className="text-xs font-bold text-slate-600 uppercase">Contacto principal</span>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" onClick={() => { setShowContactoModal(false); setEditingContacto(null); setContactoForm(emptyContactoForm); }}>Cancelar</Button>
              <Button onClick={handleSaveContacto}>{editingContacto ? 'Guardar' : 'Agregar'}</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
