import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';
import { GCPortsGrid } from '../GCPortsGrid';
import { sistemasService, clientesService, establecimientosService, categoriasEquipoService } from '../../services/firebaseService';
import { sectoresCatalogService, type SectorCatalog } from '../../services/catalogService';
import type { Cliente, Establecimiento, CategoriaEquipo, ConfiguracionGC } from '@ags/shared';
import { esGaseoso } from '@ags/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  defaultClienteId?: string;
  defaultEstablecimientoId?: string;
}

export const CreateEquipoModal: React.FC<Props> = ({ open, onClose, onCreated, defaultClienteId, defaultEstablecimientoId }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [saving, setSaving] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [categorias, setCategorias] = useState<CategoriaEquipo[]>([]);
  const [estFiltrados, setEstFiltrados] = useState<Establecimiento[]>([]);

  const [form, setForm] = useState({
    clienteId: '', establecimientoId: '', categoriaId: '',
    nombre: '', nombreManual: '', software: '', codigoInternoCliente: '', sector: '',
  });
  const [gcConfig, setGcConfig] = useState<ConfiguracionGC>({});

  const [sectorCatalog, setSectorCatalog] = useState<SectorCatalog[]>([]);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      clientesService.getAll(true), establecimientosService.getAll(), categoriasEquipoService.getAll(), sectoresCatalogService.getAll(),
    ]).then(([c, e, cat, sc]) => {
      setClientes(c); setEstablecimientos(e); setCategorias(cat); setSectorCatalog(sc);
      // Pre-populate from defaults if provided
      if (defaultClienteId || defaultEstablecimientoId) {
        setForm(prev => ({
          ...prev,
          clienteId: defaultClienteId || prev.clienteId,
          establecimientoId: defaultEstablecimientoId || prev.establecimientoId,
        }));
      }
    });
  }, [open, defaultClienteId, defaultEstablecimientoId]);

  useEffect(() => {
    if (form.clienteId) {
      setEstFiltrados(establecimientos.filter(e => e.clienteCuit === form.clienteId));
    } else {
      setEstFiltrados([]);
    }
  }, [form.clienteId, establecimientos]);

  const set = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const clienteOptions = useMemo(() => clientes.map(c => ({ value: c.id, label: c.razonSocial })), [clientes]);
  const estOptions = useMemo(() => estFiltrados.map(e => ({ value: e.id, label: `${e.nombre} — ${e.localidad}` })), [estFiltrados]);
  const catOptions = useMemo(() => categorias.map(c => ({ value: c.id, label: c.nombre })), [categorias]);

  const selectedCategoria = categorias.find(c => c.id === form.categoriaId);
  const hasModelos = selectedCategoria && Array.isArray(selectedCategoria.modelos) && selectedCategoria.modelos.length > 0;
  const nombreEfectivo = hasModelos
    ? (form.nombre === '__otro__' ? form.nombreManual : form.nombre)
    : form.nombre;
  const showGC = esGaseoso(nombreEfectivo) || esGaseoso(selectedCategoria?.nombre ?? '');

  const selectedEst = establecimientos.find(e => e.id === form.establecimientoId);
  const estSectores = selectedEst?.sectores || [];

  const handleClose = () => {
    onClose();
    setForm({ clienteId: '', establecimientoId: '', categoriaId: '', nombre: '', nombreManual: '', software: '', codigoInternoCliente: '', sector: '' });
    setGcConfig({});
  };

  const handleSave = async () => {
    if (!form.establecimientoId) { alert('Seleccione un establecimiento'); return; }
    if (!form.categoriaId) { alert('Seleccione una categoria'); return; }
    const finalNombre = form.nombre === '__otro__' ? form.nombreManual.trim() : form.nombre;
    if (!finalNombre) { alert('El nombre es obligatorio'); return; }

    setSaving(true);
    try {
      const isGC = esGaseoso(finalNombre) || esGaseoso(selectedCategoria?.nombre ?? '');
      const sistemaId = await sistemasService.create({
        establecimientoId: form.establecimientoId,
        clienteId: form.clienteId || null,
        categoriaId: form.categoriaId,
        nombre: finalNombre,
        software: form.software.trim() || null,
        codigoInternoCliente: form.codigoInternoCliente.trim() || `PROV-${Date.now().toString(36).toUpperCase()}`,
        sector: form.sector.trim() || null,
        configuracionGC: isGC ? {
          puertoInyeccionFront: gcConfig.puertoInyeccionFront || null,
          puertoInyeccionBack: gcConfig.puertoInyeccionBack || null,
          detectorFront: gcConfig.detectorFront || null,
          detectorBack: gcConfig.detectorBack || null,
        } : null,
        activo: true,
        ubicaciones: [],
        otIds: [],
      });
      handleClose();
      onCreated();
      navigate(`/equipos/${sistemaId}`, { state: { from: pathname } });
    } catch (err) { console.error('Error creando sistema:', err); alert('Error al crear el sistema'); }
    finally { setSaving(false); }
  };

  const lbl = "block text-[11px] font-medium text-slate-500 mb-1";

  return (
    <Modal open={open} onClose={handleClose} maxWidth="lg" title="Nuevo sistema / equipo"
      subtitle="Seleccione cliente, establecimiento y categoria"
      footer={<>
        <Button variant="outline" size="sm" onClick={handleClose}>Cancelar</Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Creando...' : 'Crear sistema'}
        </Button>
      </>}>
      <div className="space-y-4">
        <div>
          <label className={lbl}>Cliente *</label>
          <SearchableSelect value={form.clienteId}
            onChange={v => { set('clienteId', v); set('establecimientoId', ''); }}
            options={clienteOptions}
            placeholder="Seleccionar cliente..." />
        </div>

        {form.clienteId && (
          <div>
            <label className={lbl}>Establecimiento *</label>
            <SearchableSelect value={form.establecimientoId}
              onChange={v => { set('establecimientoId', v); set('sector', ''); }}
              options={estOptions}
              placeholder="Seleccionar establecimiento..." />
          </div>
        )}

        {form.establecimientoId && (() => {
          // Merge: sectores del establecimiento + catálogo global (sin duplicados)
          const allNames = new Set(estSectores);
          sectorCatalog.forEach(s => allNames.add(s.nombre));
          const sectorOptions = [
            { value: '', label: 'Sin sector' },
            ...[...allNames].sort().map(n => ({ value: n, label: n })),
          ];
          return (
            <div>
              <label className={lbl}>Sector</label>
              <SearchableSelect value={form.sector}
                onChange={v => set('sector', v)}
                options={sectorOptions}
                placeholder="Seleccionar sector..."
                creatable createLabel="Crear sector" />
            </div>
          );
        })()}

        <hr className="border-slate-100" />

        <div>
          <label className={lbl}>Categoria *</label>
          <SearchableSelect value={form.categoriaId}
            onChange={v => { set('categoriaId', v); set('nombre', ''); set('nombreManual', ''); }}
            options={catOptions}
            placeholder="Seleccionar categoria..." />
        </div>

        {form.categoriaId && (
          <>
            {hasModelos ? (
              <div>
                <label className={lbl}>Modelo / Nombre *</label>
                <SearchableSelect value={form.nombre}
                  onChange={v => set('nombre', v)}
                  options={[
                    ...(selectedCategoria?.modelos ?? []).map((m: any) => ({ value: typeof m === 'string' ? m : m.nombre, label: typeof m === 'string' ? m : m.nombre })),
                    { value: '__otro__', label: 'Otro (ingresar manualmente)' },
                  ]}
                  placeholder="Seleccionar modelo..." />
                {form.nombre === '__otro__' && (
                  <div className="mt-2">
                    <Input inputSize="sm" label="Nombre manual *" value={form.nombreManual}
                      onChange={e => set('nombreManual', e.target.value)} placeholder="Nombre del sistema..." />
                  </div>
                )}
              </div>
            ) : (
              <Input inputSize="sm" label="Nombre *" value={form.nombre}
                onChange={e => set('nombre', e.target.value)} placeholder="Nombre del sistema..." />
            )}
          </>
        )}

        {showGC && (
          <GCPortsGrid value={gcConfig} onChange={setGcConfig} />
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input inputSize="sm" label="Codigo interno cliente" value={form.codigoInternoCliente}
            onChange={e => set('codigoInternoCliente', e.target.value)} placeholder="Ej: HPLC-01 (auto si vacio)" />
          <Input inputSize="sm" label="Software" value={form.software}
            onChange={e => set('software', e.target.value)} placeholder="Ej: OpenLab CDS" />
        </div>
      </div>
    </Modal>
  );
};
