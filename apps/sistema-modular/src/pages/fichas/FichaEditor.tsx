import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fichasService, clientesService, establecimientosService, sistemasService, modulosService } from '../../services/firebaseService';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import type { FichaPropiedad, ViaIngreso, AccesorioFicha, Cliente, Establecimiento, Sistema, ModuloSistema } from '@ags/shared';
import { VIA_INGRESO_LABELS } from '@ags/shared';
import { FichaAccesoriosSection } from '../../components/fichas/FichaAccesoriosSection';

export function FichaEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [saving, setSaving] = useState(false);

  // Entity options
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [modulos, setModulos] = useState<ModuloSistema[]>([]);

  // Form state
  const [clienteId, setClienteId] = useState('');
  const [establecimientoId, setEstablecimientoId] = useState('');
  const [sistemaId, setSistemaId] = useState('');
  const [moduloId, setModuloId] = useState('');
  const [descripcionLibre, setDescripcionLibre] = useState('');
  const [codigoArticulo, setCodigoArticulo] = useState('');
  const [serie, setSerie] = useState('');
  const [condicionFisica, setCondicionFisica] = useState('');
  const [viaIngreso, setViaIngreso] = useState<ViaIngreso>('ingeniero');
  const [traidoPor, setTraidoPor] = useState('');
  const [fechaIngreso, setFechaIngreso] = useState(new Date().toISOString().split('T')[0]);
  const [otReferencia, setOtReferencia] = useState('');
  const [descripcionProblema, setDescripcionProblema] = useState('');
  const [sintomasReportados, setSintomasReportados] = useState('');
  const [accesorios, setAccesorios] = useState<AccesorioFicha[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    clientesService.getAll().then(setClientes);
  }, []);

  // Load existing ficha for edit
  useEffect(() => {
    if (!id) return;
    fichasService.getById(id).then(f => {
      if (!f) return navigate('/fichas');
      setClienteId(f.clienteId);
      setEstablecimientoId(f.establecimientoId || '');
      setSistemaId(f.sistemaId || '');
      setModuloId(f.moduloId || '');
      setDescripcionLibre(f.descripcionLibre || '');
      setCodigoArticulo(f.codigoArticulo || '');
      setSerie(f.serie || '');
      setCondicionFisica(f.condicionFisica || '');
      setViaIngreso(f.viaIngreso);
      setTraidoPor(f.traidoPor);
      setFechaIngreso(f.fechaIngreso?.split('T')[0] || '');
      setOtReferencia(f.otReferencia || '');
      setDescripcionProblema(f.descripcionProblema);
      setSintomasReportados(f.sintomasReportados || '');
      setAccesorios(f.accesorios || []);
    });
  }, [id, navigate]);

  // Chain: cliente -> establecimientos
  useEffect(() => {
    if (!clienteId) { setEstablecimientos([]); return; }
    establecimientosService.getByCliente(clienteId).then(setEstablecimientos);
  }, [clienteId]);

  // Chain: establecimiento -> sistemas
  useEffect(() => {
    if (!establecimientoId) { setSistemas([]); return; }
    sistemasService.getAll({ establecimientoId }).then(setSistemas);
  }, [establecimientoId]);

  // Chain: sistema -> modulos
  useEffect(() => {
    if (!sistemaId) { setModulos([]); return; }
    modulosService.getBySistema(sistemaId).then(setModulos);
  }, [sistemaId]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!clienteId) e.clienteId = 'Requerido';
    if (!traidoPor.trim()) e.traidoPor = 'Requerido';
    if (!fechaIngreso) e.fechaIngreso = 'Requerido';
    if (!descripcionProblema.trim()) e.descripcionProblema = 'Requerido';
    if (!sistemaId && !descripcionLibre.trim()) e.descripcionLibre = 'Indicar sistema o descripcion';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const selectedCliente = clientes.find(c => c.id === clienteId);
  const selectedEstab = establecimientos.find(e => e.id === establecimientoId);
  const selectedSistema = sistemas.find(s => s.id === sistemaId);
  const selectedModulo = modulos.find(m => m.id === moduloId);

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const data: Omit<FichaPropiedad, 'id' | 'numero' | 'createdAt' | 'updatedAt'> = {
        sistemaId: sistemaId || null,
        sistemaNombre: selectedSistema?.nombre || null,
        moduloId: moduloId || null,
        moduloNombre: selectedModulo?.nombre || null,
        descripcionLibre: descripcionLibre.trim() || null,
        codigoArticulo: codigoArticulo.trim() || null,
        serie: serie.trim() || null,
        accesorios,
        condicionFisica: condicionFisica.trim() || null,
        clienteId,
        clienteNombre: selectedCliente?.razonSocial || '',
        establecimientoId: establecimientoId || null,
        establecimientoNombre: selectedEstab?.nombre || null,
        viaIngreso,
        traidoPor: traidoPor.trim(),
        fechaIngreso: new Date(fechaIngreso).toISOString(),
        otReferencia: otReferencia.trim() || null,
        descripcionProblema: descripcionProblema.trim(),
        sintomasReportados: sintomasReportados.trim() || null,
        estado: 'recibido',
        historial: [{
          id: crypto.randomUUID(),
          fecha: new Date().toISOString(),
          estadoAnterior: 'recibido',
          estadoNuevo: 'recibido',
          nota: 'Ficha creada',
          creadoPor: 'admin',
        }],
        derivaciones: [],
        repuestosPendientes: [],
        remitoDevolucionId: null,
        fechaEntrega: null,
        loanerId: null,
        loanerCodigo: null,
        otIds: otReferencia.trim() ? [otReferencia.trim()] : [],
      };
      const fichaId = await (isEdit ? fichasService.update(id!, data).then(() => id!) : fichasService.create(data));
      navigate(`/fichas/${fichaId}`);
    } catch (err) {
      console.error('Error guardando ficha:', err);
      alert('Error al guardar la ficha');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="-m-6 h-[calc(100%+3rem)] flex flex-col">
      <div className="shrink-0 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 tracking-tight">
            {isEdit ? 'Editar ficha' : 'Nueva ficha propiedad del cliente'}
          </h1>
          <p className="text-xs text-slate-500">Registrar ingreso de modulo/equipo del cliente</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigate('/fichas')}>Cancelar</Button>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50 px-6 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Cliente y origen */}
          <Card title="Cliente y origen">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cliente *</label>
                <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={clienteId} onChange={e => { setClienteId(e.target.value); setEstablecimientoId(''); setSistemaId(''); setModuloId(''); }}>
                  <option value="">Seleccionar cliente</option>
                  {clientes.filter(c => c.activo).map(c => <option key={c.id} value={c.id}>{c.razonSocial}</option>)}
                </select>
                {errors.clienteId && <p className="text-xs text-red-500 mt-1">{errors.clienteId}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Establecimiento</label>
                <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={establecimientoId} onChange={e => { setEstablecimientoId(e.target.value); setSistemaId(''); setModuloId(''); }} disabled={!clienteId}>
                  <option value="">Seleccionar establecimiento</option>
                  {establecimientos.filter(e => e.activo).map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Via de ingreso *</label>
                <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={viaIngreso} onChange={e => setViaIngreso(e.target.value as ViaIngreso)}>
                  {(Object.keys(VIA_INGRESO_LABELS) as ViaIngreso[]).map(v => (
                    <option key={v} value={v}>{VIA_INGRESO_LABELS[v]}</option>
                  ))}
                </select>
              </div>
              <Input label="Traido por *" value={traidoPor} onChange={e => setTraidoPor(e.target.value)} error={errors.traidoPor} placeholder="Nombre del ingeniero o transporte" />
              <Input label="Fecha de ingreso *" type="date" value={fechaIngreso} onChange={e => setFechaIngreso(e.target.value)} error={errors.fechaIngreso} />
              <Input label="OT de referencia" value={otReferencia} onChange={e => setOtReferencia(e.target.value)} placeholder="Ej: 25660" />
            </div>
          </Card>

          {/* Identificacion del modulo */}
          <Card title="Identificacion del modulo/equipo">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sistema/Equipo</label>
                <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={sistemaId} onChange={e => { setSistemaId(e.target.value); setModuloId(''); }} disabled={!establecimientoId}>
                  <option value="">Seleccionar sistema</option>
                  {sistemas.filter(s => s.activo).map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Modulo</label>
                <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={moduloId} onChange={e => setModuloId(e.target.value)} disabled={!sistemaId}>
                  <option value="">Seleccionar modulo</option>
                  {modulos.map(m => <option key={m.id} value={m.id}>{m.nombre}{m.serie ? ` (S/N: ${m.serie})` : ''}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <Input label="Descripcion libre (si no esta en el sistema)" value={descripcionLibre} onChange={e => setDescripcionLibre(e.target.value)} error={errors.descripcionLibre} placeholder="Ej: Bomba cuaternaria G1311A" />
              </div>
              <Input label="Codigo de articulo / Part number" value={codigoArticulo} onChange={e => setCodigoArticulo(e.target.value)} placeholder="Ej: G1311A" />
              <Input label="Numero de serie" value={serie} onChange={e => setSerie(e.target.value)} placeholder="S/N" />
              <div className="md:col-span-2">
                <Input label="Condicion fisica al ingreso" value={condicionFisica} onChange={e => setCondicionFisica(e.target.value)} placeholder="Estado general del equipo/modulo" />
              </div>
            </div>
          </Card>

          {/* Accesorios */}
          <Card title="Accesorios incluidos">
            <FichaAccesoriosSection accesorios={accesorios} onChange={setAccesorios} />
          </Card>

          {/* Problema */}
          <Card title="Problema / Falla">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripcion del problema *</label>
                <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-[80px]" value={descripcionProblema} onChange={e => setDescripcionProblema(e.target.value)} placeholder="Describir la falla o problema reportado" />
                {errors.descripcionProblema && <p className="text-xs text-red-500 mt-1">{errors.descripcionProblema}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sintomas reportados por el cliente</label>
                <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-[60px]" value={sintomasReportados} onChange={e => setSintomasReportados(e.target.value)} placeholder="Que observa el cliente" />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
