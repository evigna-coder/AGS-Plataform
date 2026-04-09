import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { establecimientosService, clientesService, sistemasService, condicionesPagoService, contactosEstablecimientoService } from '../../services/firebaseService';
import type { Establecimiento, Cliente, Sistema, ContactoEstablecimiento, CondicionPago } from '@ags/shared';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EstablecimientoInfoSidebar } from '../../components/establecimientos/EstablecimientoInfoSidebar';
import { ContactosSection, emptyContactoForm, type ContactoFormData } from '../../components/establecimientos/ContactosSection';
import { CreateEquipoModal } from '../../components/equipos/CreateEquipoModal';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { sectoresCatalogService, type SectorCatalog } from '../../services/catalogService';
import { MoveSistemaModal } from '../../components/equipos/MoveSistemaModal';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import { useConfirm } from '../../components/ui/ConfirmDialog';

const ChevronRight = () => (
  <svg className="w-4 h-4 text-slate-300 shrink-0 ml-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

const SistemaRow = ({ s, selected, onToggle }: { s: Sistema; selected?: boolean; onToggle?: (s: Sistema) => void }) => {
  const { pathname } = useLocation();
  return (
  <div className="flex items-center gap-1.5">
    {onToggle && (
      <input
        type="checkbox"
        checked={!!selected}
        onChange={() => onToggle(s)}
        className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 shrink-0"
      />
    )}
    <Link key={s.id} to={`/equipos/${s.id}`} state={{ from: pathname }} className="flex-1 flex justify-between items-center px-3 py-2 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-slate-900 truncate">{s.nombre}</p>
          {s.sector && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-600">{s.sector}</span>}
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${s.activo ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
            {s.activo ? 'Activo' : 'Inactivo'}
          </span>
        </div>
        {s.codigoInternoCliente && <p className="text-[11px] text-slate-400 truncate">{s.codigoInternoCliente}</p>}
      </div>
      <ChevronRight />
    </Link>
  </div>
  );
};

export const EstablecimientoDetail = () => {
  const confirm = useConfirm();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const goBack = useNavigateBack();
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
  const [sectores, setSectores] = useState<string[]>([]);
  const [sectorCatalog, setSectorCatalog] = useState<SectorCatalog[]>([]);
  const [showCreateEquipo, setShowCreateEquipo] = useState(false);
  const [selectedSistemaIds, setSelectedSistemaIds] = useState<Set<string>>(new Set());
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showContactoModal, setShowContactoModal] = useState(false);
  const [editingContacto, setEditingContacto] = useState<ContactoEstablecimiento | null>(null);
  const [contactoForm, setContactoForm] = useState<ContactoFormData>(emptyContactoForm);
  // Real-time subscription for the establecimiento document
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    const unsub = establecimientosService.subscribeById(id, (estData) => {
      if (estData) {
        setEst(estData);
        if (!editing) {
          setSectores(estData.sectores || []);
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
        }
      } else {
        alert('Establecimiento no encontrado');
        navigate('/establecimientos');
      }
      setLoading(false);
    }, (err) => {
      console.error(err);
      alert('Error al cargar');
      setLoading(false);
    });
    return () => unsub();
  }, [id]);

  // One-shot reference loads (contactos, condiciones, sectores catalog, cliente, sistemas)
  useEffect(() => {
    if (!id) return;
    const loadRefs = async () => {
      try {
        const [contactosData, condicionesData, sectoresCat] = await Promise.all([
          contactosEstablecimientoService.getByEstablecimiento(id),
          condicionesPagoService.getAll(),
          sectoresCatalogService.getAll(),
        ]);
        setContactos(contactosData);
        setCondicionesPago(condicionesData);
        setSectorCatalog(sectoresCat);
      } catch (error) {
        console.error('Error cargando referencias:', error);
      }
    };
    loadRefs();
  }, [id]);

  // Load cliente and sistemas once est is available
  useEffect(() => {
    if (!id || !est) return;
    const loadRelated = async () => {
      try {
        const clienteData = est.clienteCuit ? await clientesService.getById(est.clienteCuit) : null;
        setCliente(clienteData || null);
        let sistemasData = await sistemasService.getAll({ establecimientoId: id });
        if (sistemasData.length === 0 && est.clienteCuit) {
          const allClienteSistemas = await sistemasService.getAll({ clienteCuit: est.clienteCuit });
          sistemasData = allClienteSistemas.filter(s => !s.establecimientoId);
        }
        setSistemas(sistemasData);
      } catch (error) {
        console.error('Error cargando cliente/sistemas:', error);
      }
    };
    loadRelated();
  }, [id, est?.clienteCuit]);

  const load = async (_silent = false) => {
    // Kept for onRefresh callbacks (reloads contactos and sistemas)
    if (!id) return;
    try {
      const [contactosData, sistemasData] = await Promise.all([
        contactosEstablecimientoService.getByEstablecimiento(id),
        sistemasService.getAll({ establecimientoId: id }),
      ]);
      setContactos(contactosData);
      if (sistemasData.length > 0) setSistemas(sistemasData);
    } catch (error) {
      console.error('Error recargando referencias:', error);
    }
  };

  const [saveMsg, setSaveMsg] = useState('');

  const handleAddSector = async (nombre: string) => {
    const trimmed = nombre.trim();
    if (!trimmed || !id) return;
    if (sectores.includes(trimmed)) return;
    const updated = [...sectores, trimmed];
    setSectores(updated);
    await establecimientosService.update(id, { sectores: updated });
    setEst(prev => prev ? { ...prev, sectores: updated } : prev);
    // Si es nuevo (no existe en catálogo), agregarlo al catálogo global
    if (!sectorCatalog.find(s => s.nombre.toLowerCase() === trimmed.toLowerCase())) {
      const newId = await sectoresCatalogService.create(trimmed);
      setSectorCatalog(prev => [...prev, { id: newId, nombre: trimmed }].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    }
  };

  const handleRemoveSector = async (nombre: string) => {
    if (!id) return;
    const updated = sectores.filter(s => s !== nombre);
    setSectores(updated);
    await establecimientosService.update(id, { sectores: updated });
    setEst(prev => prev ? { ...prev, sectores: updated } : prev);
  };

  const handleSave = async () => {
    if (!id) return;
    try {
      setSaving(true);
      const updated = {
        nombre: (formData.nombre || '').trim(), direccion: (formData.direccion || '').trim(),
        localidad: (formData.localidad || '').trim(), provincia: (formData.provincia || '').trim(),
        pais: formData.pais?.trim() || null, codigoPostal: formData.codigoPostal?.trim() || null,
        lat: formData.lat || null, lng: formData.lng || null,
        placeId: formData.placeId?.trim() || null, tipo: formData.tipo || null,
        condicionPagoId: formData.condicionPagoId || null,
        tipoServicio: formData.tipoServicio || null,
        infoPagos: formData.infoPagos?.trim() || null,
        pagaEnTiempo: formData.pagaEnTiempo, sueleDemorarse: formData.sueleDemorarse,
        activo: formData.activo,
        sectores,
      };
      await establecimientosService.update(id, updated);
      // Subscription will auto-update the est state
      setEditing(false);
      setSaveMsg('Guardado');
      setTimeout(() => setSaveMsg(''), 2000);
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
    if (!contactoForm.nombre.trim() || !contactoForm.email.trim()) { alert('Complete Nombre y Email'); return; }
    try {
      if (editingContacto) { await contactosEstablecimientoService.update(id, editingContacto.id, contactoForm); }
      else { await contactosEstablecimientoService.create(id, contactoForm); }
      closeContactoModal();
      setContactos(await contactosEstablecimientoService.getByEstablecimiento(id));
    } catch (e) { console.error(e); alert('Error al guardar contacto'); }
  };

  const handleDeleteContacto = async (contactoId: string) => {
    if (!id || !await confirm('Eliminar este contacto?')) return;
    try { await contactosEstablecimientoService.delete(id, contactoId); setContactos(prev => prev.filter(c => c.id !== contactoId)); }
    catch (e) { console.error(e); alert('Error al eliminar'); }
  };

  const openEditContacto = (c: ContactoEstablecimiento) => {
    setEditingContacto(c);
    setContactoForm({ nombre: c.nombre, cargo: c.cargo, sector: c.sector || '', telefono: c.telefono || '', interno: c.interno || '', email: c.email, esPrincipal: c.esPrincipal ?? false });
    setShowContactoModal(true);
  };

  if (loading) return <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando...</p></div>;
  if (!est) return null;

  const tipoLabel = est.tipo ? String(est.tipo).charAt(0).toUpperCase() + String(est.tipo).slice(1) : '';

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Compact header */}
      <div className="shrink-0 bg-white border-b border-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.06)] z-10 px-5 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => goBack()} className="text-slate-400 hover:text-slate-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 tracking-tight">{est.nombre}</h2>
              <p className="text-xs text-slate-400">
                {est.localidad}, {est.provincia}{tipoLabel ? ` · ${tipoLabel}` : ''}{' · '}
                <span className={est.activo ? 'text-green-600' : 'text-slate-400'}>{est.activo ? 'Activo' : 'Inactivo'}</span>
              </p>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            {saveMsg && <span className="text-xs text-green-600 font-medium">{saveMsg}</span>}
            {!editing ? (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Editar</Button>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancelar</Button>
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
              establecimientoSectores={sectores}
              onOpenNew={() => { setEditingContacto(null); setContactoForm(emptyContactoForm); setShowContactoModal(true); }}
              onOpenEdit={openEditContacto}
              onDelete={handleDeleteContacto}
              onSave={handleSaveContacto}
              onClose={closeContactoModal}
              setContactoForm={setContactoForm}
            />

            {/* Sectores */}
            <Card compact>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase">Sectores</h3>
              </div>
              {sectores.length === 0 ? (
                <p className="text-slate-400 text-xs">Sin sectores definidos</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {sectores.map(s => (
                    <span key={s} className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-full">
                      {s}
                      <button onClick={() => handleRemoveSector(s)} className="text-slate-400 hover:text-red-500 ml-0.5">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {(() => {
                const allNames = new Set(sectorCatalog.map(s => s.nombre));
                sectores.forEach(s => allNames.add(s));
                const available = [...allNames].filter(n => !sectores.includes(n)).sort();
                return (
                  <div className="mt-2">
                    <SearchableSelect
                      value=""
                      onChange={(val) => { if (val) handleAddSector(val); }}
                      options={available.map(n => ({ value: n, label: n }))}
                      placeholder="Agregar sector..."
                      emptyMessage="Escribí un nombre para crear un sector nuevo"
                      creatable
                      createLabel="Crear sector"
                    />
                  </div>
                );
              })()}
            </Card>

            {/* Sistemas / Equipos */}
            <Card compact>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase">Sistemas / Equipos</h3>
                <div className="flex gap-2">
                  {selectedSistemaIds.size > 0 && (
                    <Button variant="outline" size="sm" className="text-amber-600 border-amber-300 hover:bg-amber-50" onClick={() => setShowMoveModal(true)}>
                      Mover {selectedSistemaIds.size > 1 ? `(${selectedSistemaIds.size})` : ''}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setShowCreateEquipo(true)}>+ Agregar</Button>
                </div>
              </div>
              {sistemas.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-slate-400 text-xs mb-2">Sin sistemas registrados</p>
                  <Button variant="outline" size="sm" onClick={() => setShowCreateEquipo(true)}>+ Agregar</Button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {sistemas.map(s => (
                    <SistemaRow
                      key={s.id}
                      s={s}
                      selected={selectedSistemaIds.has(s.id)}
                      onToggle={(sys) => {
                        setSelectedSistemaIds(prev => {
                          const next = new Set(prev);
                          if (next.has(sys.id)) next.delete(sys.id); else next.add(sys.id);
                          return next;
                        });
                      }}
                    />
                  ))}
                </div>
              )}
            </Card>
            <CreateEquipoModal
              open={showCreateEquipo}
              onClose={() => setShowCreateEquipo(false)}
              onCreated={() => load(true)}
              defaultEstablecimientoId={id}
              defaultClienteId={est.clienteCuit}
            />
            {showMoveModal && selectedSistemaIds.size > 0 && (
              <MoveSistemaModal
                sistemas={sistemas.filter(s => selectedSistemaIds.has(s.id))}
                clienteCuit={est.clienteCuit}
                onClose={() => setShowMoveModal(false)}
                onMoved={() => { setShowMoveModal(false); setSelectedSistemaIds(new Set()); load(true); }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
