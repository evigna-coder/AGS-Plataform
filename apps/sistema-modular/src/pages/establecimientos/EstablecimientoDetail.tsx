import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { establecimientosService, clientesService, sistemasService, condicionesPagoService, contactosEstablecimientoService } from '../../services/firebaseService';
import type { Establecimiento, Cliente, Sistema, ContactoEstablecimiento, CondicionPago } from '@ags/shared';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EstablecimientoInfoSidebar } from '../../components/establecimientos/EstablecimientoInfoSidebar';
import { ContactosSection, emptyContactoForm, type ContactoFormData } from '../../components/establecimientos/ContactosSection';

const ChevronRight = () => (
  <svg className="w-4 h-4 text-slate-300 shrink-0 ml-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

const SistemaRow = ({ s }: { s: Sistema }) => (
  <Link key={s.id} to={`/equipos/${s.id}`} className="flex justify-between items-center px-3 py-2 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors">
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <p className="text-xs font-medium text-slate-900 truncate">{s.nombre}</p>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${s.activo ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
          {s.activo ? 'Activo' : 'Inactivo'}
        </span>
      </div>
      {s.codigoInternoCliente && <p className="text-[11px] text-slate-400 truncate">{s.codigoInternoCliente}</p>}
    </div>
    <ChevronRight />
  </Link>
);

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
    nombre: '', direccion: '', localidad: '', provincia: '',
    pais: '', codigoPostal: '', lat: null as number | null, lng: null as number | null,
    placeId: '', tipo: '' as Establecimiento['tipo'] | '',
    condicionPagoId: '' as string | null, tipoServicio: '' as any,
    infoPagos: '', pagaEnTiempo: false, sueleDemorarse: false, activo: true,
  });
  const [showContactoModal, setShowContactoModal] = useState(false);
  const [editingContacto, setEditingContacto] = useState<ContactoEstablecimiento | null>(null);
  const [contactoForm, setContactoForm] = useState<ContactoFormData>(emptyContactoForm);
  useEffect(() => { if (id) load(); }, [id]);

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
          nombre: estData.nombre, direccion: estData.direccion,
          localidad: estData.localidad, provincia: estData.provincia,
          pais: estData.pais || '', codigoPostal: estData.codigoPostal || '',
          lat: estData.lat || null, lng: estData.lng || null,
          placeId: estData.placeId || '', tipo: estData.tipo || '',
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
        nombre: formData.nombre.trim(), direccion: formData.direccion.trim(),
        localidad: formData.localidad.trim(), provincia: formData.provincia.trim(),
        pais: formData.pais?.trim() || null, codigoPostal: formData.codigoPostal?.trim() || null,
        lat: formData.lat || null, lng: formData.lng || null,
        placeId: formData.placeId?.trim() || null, tipo: formData.tipo || null,
        condicionPagoId: formData.condicionPagoId || null,
        tipoServicio: formData.tipoServicio || null,
        infoPagos: formData.infoPagos?.trim() || null,
        pagaEnTiempo: formData.pagaEnTiempo, sueleDemorarse: formData.sueleDemorarse,
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

  const closeContactoModal = () => { setShowContactoModal(false); setEditingContacto(null); setContactoForm(emptyContactoForm); };

  const handleSaveContacto = async () => {
    if (!id) return;
    if (!contactoForm.nombre.trim() || !contactoForm.telefono.trim() || !contactoForm.email.trim()) { alert('Complete Nombre, Telefono y Email'); return; }
    try {
      if (editingContacto) { await contactosEstablecimientoService.update(id, editingContacto.id, contactoForm); alert('Contacto actualizado'); }
      else { await contactosEstablecimientoService.create(id, contactoForm); alert('Contacto agregado'); }
      closeContactoModal();
      setContactos(await contactosEstablecimientoService.getByEstablecimiento(id));
    } catch (e) { console.error(e); alert('Error al guardar contacto'); }
  };

  const handleDeleteContacto = async (contactoId: string) => {
    if (!id || !confirm('Eliminar este contacto?')) return;
    try { await contactosEstablecimientoService.delete(id, contactoId); setContactos(prev => prev.filter(c => c.id !== contactoId)); }
    catch (e) { console.error(e); alert('Error al eliminar'); }
  };

  const openEditContacto = (c: ContactoEstablecimiento) => {
    setEditingContacto(c);
    setContactoForm({ nombre: c.nombre, cargo: c.cargo, sector: c.sector || '', telefono: c.telefono, interno: c.interno || '', email: c.email, esPrincipal: c.esPrincipal ?? false });
    setShowContactoModal(true);
  };

  if (loading) return <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando...</p></div>;
  if (!est) return null;

  const tipoLabel = est.tipo ? String(est.tipo).charAt(0).toUpperCase() + String(est.tipo).slice(1) : '';

  return (
    <div className="-m-6 h-[calc(100%+3rem)] flex flex-col bg-slate-50">
      {/* Compact header */}
      <div className="shrink-0 bg-white border-b border-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.06)] z-10 px-5 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/establecimientos')} className="text-slate-400 hover:text-slate-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <div>
              <h2 className="text-base font-semibold text-slate-900 tracking-tight">{est.nombre}</h2>
              <p className="text-xs text-slate-400">
                {est.localidad}, {est.provincia}{tipoLabel ? ` · ${tipoLabel}` : ''}{' · '}
                <span className={est.activo ? 'text-green-600' : 'text-slate-400'}>{est.activo ? 'Activo' : 'Inactivo'}</span>
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {!editing ? (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Editar</Button>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => { setEditing(false); load(); }}>Cancelar</Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 2-column body */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="flex gap-5">
          <EstablecimientoInfoSidebar
            est={est}
            cliente={cliente}
            condicionesPago={condicionesPago}
            editing={editing}
            formData={formData}
            setFormData={setFormData}
          />
          <div className="flex-1 min-w-0 space-y-4">
            {/* Contactos */}
            <ContactosSection
              contactos={contactos}
              showModal={showContactoModal}
              editingContacto={editingContacto}
              contactoForm={contactoForm}
              onOpenNew={() => { setEditingContacto(null); setContactoForm(emptyContactoForm); setShowContactoModal(true); }}
              onOpenEdit={openEditContacto}
              onDelete={handleDeleteContacto}
              onSave={handleSaveContacto}
              onClose={closeContactoModal}
              setContactoForm={setContactoForm}
            />

            {/* Sistemas / Equipos */}
            <Card compact>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase">Sistemas / Equipos</h3>
                <Link to={`/equipos/nuevo?establecimiento=${id}`}>
                  <Button variant="outline" size="sm">+ Agregar</Button>
                </Link>
              </div>
              {sistemas.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-slate-400 text-xs mb-2">Sin sistemas registrados</p>
                  <Link to={`/equipos/nuevo?establecimiento=${id}`}>
                    <Button variant="outline" size="sm">+ Agregar</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {sistemas.map(s => <SistemaRow key={s.id} s={s} />)}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
