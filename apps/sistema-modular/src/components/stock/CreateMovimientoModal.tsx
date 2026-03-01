import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';
import {
  movimientosService, articulosService, unidadesService,
  posicionesStockService, minikitsService, ingenierosService, proveedoresService,
} from '../../services/firebaseService';
import type {
  Articulo, UnidadStock, PosicionStock, Minikit, Ingeniero, Proveedor,
  TipoMovimiento, TipoOrigenDestino,
} from '@ags/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const TIPO_MOV_OPTIONS: { value: TipoMovimiento; label: string }[] = [
  { value: 'ingreso', label: 'Ingreso' },
  { value: 'egreso', label: 'Egreso' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'consumo', label: 'Consumo' },
  { value: 'devolucion', label: 'Devolucion' },
  { value: 'ajuste', label: 'Ajuste' },
];

const ORIGEN_DESTINO_OPTIONS: { value: TipoOrigenDestino; label: string }[] = [
  { value: 'posicion', label: 'Posicion' },
  { value: 'minikit', label: 'Minikit' },
  { value: 'ingeniero', label: 'Ingeniero' },
  { value: 'proveedor', label: 'Proveedor' },
  { value: 'cliente', label: 'Cliente' },
  { value: 'consumo_ot', label: 'Consumo OT' },
  { value: 'baja', label: 'Baja' },
  { value: 'ajuste', label: 'Ajuste' },
];

type EntityLookup = { id: string; nombre: string }[];

const emptyForm = {
  tipo: 'ingreso' as TipoMovimiento,
  articuloId: '', unidadId: '', cantidad: 1,
  origenTipo: 'proveedor' as TipoOrigenDestino, origenId: '', origenNombre: '',
  destinoTipo: 'posicion' as TipoOrigenDestino, destinoId: '', destinoNombre: '',
  motivo: '', creadoPor: '',
};

export const CreateMovimientoModal: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [unidades, setUnidades] = useState<UnidadStock[]>([]);
  const [posiciones, setPosiciones] = useState<PosicionStock[]>([]);
  const [minikits, setMinikits] = useState<Minikit[]>([]);
  const [ingenieros, setIngenieros] = useState<Ingeniero[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      articulosService.getAll(), posicionesStockService.getAll(),
      minikitsService.getAll(), ingenierosService.getAll(), proveedoresService.getAll(),
    ]).then(([a, p, mk, ing, prov]) => {
      setArticulos(a); setPosiciones(p); setMinikits(mk); setIngenieros(ing); setProveedores(prov);
    });
  }, [open]);

  useEffect(() => {
    if (form.articuloId) {
      unidadesService.getByArticulo(form.articuloId).then(setUnidades);
    } else {
      setUnidades([]);
    }
  }, [form.articuloId]);

  // Auto-set defaults when tipo changes
  useEffect(() => {
    const defaults: Record<TipoMovimiento, { origenTipo: TipoOrigenDestino; destinoTipo: TipoOrigenDestino }> = {
      ingreso: { origenTipo: 'proveedor', destinoTipo: 'posicion' },
      egreso: { origenTipo: 'posicion', destinoTipo: 'cliente' },
      transferencia: { origenTipo: 'posicion', destinoTipo: 'posicion' },
      consumo: { origenTipo: 'posicion', destinoTipo: 'consumo_ot' },
      devolucion: { origenTipo: 'consumo_ot', destinoTipo: 'posicion' },
      ajuste: { origenTipo: 'ajuste', destinoTipo: 'posicion' },
    };
    const d = defaults[form.tipo];
    setForm(prev => ({
      ...prev, origenTipo: d.origenTipo, destinoTipo: d.destinoTipo,
      origenId: '', origenNombre: '', destinoId: '', destinoNombre: '',
    }));
  }, [form.tipo]);

  const set = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const getEntitiesForType = (tipo: TipoOrigenDestino): EntityLookup => {
    switch (tipo) {
      case 'posicion': return posiciones.map(p => ({ id: p.id, nombre: `${p.codigo} - ${p.nombre}` }));
      case 'minikit': return minikits.map(m => ({ id: m.id, nombre: m.codigo }));
      case 'ingeniero': return ingenieros.map(i => ({ id: i.id, nombre: i.nombre }));
      case 'proveedor': return proveedores.map(p => ({ id: p.id, nombre: p.nombre }));
      default: return [];
    }
  };

  const needsEntitySelect = (tipo: TipoOrigenDestino) =>
    ['posicion', 'minikit', 'ingeniero', 'proveedor'].includes(tipo);

  const handleEntitySelect = (prefix: 'origen' | 'destino', entityId: string, tipo: TipoOrigenDestino) => {
    const entities = getEntitiesForType(tipo);
    const entity = entities.find(e => e.id === entityId);
    setForm(prev => ({
      ...prev,
      [`${prefix}Id`]: entityId,
      [`${prefix}Nombre`]: entity?.nombre ?? '',
    }));
  };

  const handleClose = () => { onClose(); setForm(emptyForm); setUnidades([]); };

  const handleSave = async () => {
    if (!form.articuloId) { alert('Seleccione un articulo'); return; }
    if (!form.cantidad || form.cantidad <= 0) { alert('La cantidad debe ser mayor a 0'); return; }
    if (!form.creadoPor.trim()) { alert('Ingrese quien registra el movimiento'); return; }

    const articulo = articulos.find(a => a.id === form.articuloId);
    if (!articulo) { alert('Articulo no encontrado'); return; }

    setSaving(true);
    try {
      await movimientosService.create({
        tipo: form.tipo,
        unidadId: form.unidadId || '',
        articuloId: form.articuloId,
        articuloCodigo: articulo.codigo,
        articuloDescripcion: articulo.descripcion,
        cantidad: form.cantidad,
        origenTipo: form.origenTipo,
        origenId: form.origenId,
        origenNombre: form.origenNombre || ORIGEN_DESTINO_OPTIONS.find(o => o.value === form.origenTipo)?.label || '',
        destinoTipo: form.destinoTipo,
        destinoId: form.destinoId,
        destinoNombre: form.destinoNombre || ORIGEN_DESTINO_OPTIONS.find(o => o.value === form.destinoTipo)?.label || '',
        remitoId: null,
        otNumber: form.origenTipo === 'consumo_ot' ? form.origenNombre : form.destinoTipo === 'consumo_ot' ? form.destinoNombre : null,
        motivo: form.motivo.trim() || null,
        creadoPor: form.creadoPor.trim(),
      });
      handleClose();
      onCreated();
    } catch { alert('Error al registrar el movimiento'); }
    finally { setSaving(false); }
  };

  const lbl = "block text-[11px] font-medium text-slate-500 mb-1";
  const selectCls = "w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500";

  const renderLocationField = (prefix: 'origen' | 'destino', tipo: TipoOrigenDestino) => {
    if (needsEntitySelect(tipo)) {
      const entities = getEntitiesForType(tipo);
      return (
        <div>
          <label className={lbl}>{prefix === 'origen' ? 'Origen' : 'Destino'}</label>
          <SearchableSelect
            value={form[`${prefix}Id` as 'origenId' | 'destinoId']}
            onChange={v => handleEntitySelect(prefix, v, tipo)}
            options={entities.map(e => ({ value: e.id, label: e.nombre }))}
            placeholder={`Seleccionar ${ORIGEN_DESTINO_OPTIONS.find(o => o.value === tipo)?.label ?? ''}...`}
          />
        </div>
      );
    }
    if (tipo === 'consumo_ot') {
      return (
        <Input inputSize="sm" label={prefix === 'origen' ? 'OT Origen' : 'OT Destino'}
          value={form[`${prefix}Nombre` as 'origenNombre' | 'destinoNombre']}
          onChange={e => set(`${prefix}Nombre`, e.target.value)}
          placeholder="Numero de OT..." />
      );
    }
    if (tipo === 'cliente') {
      return (
        <Input inputSize="sm" label="Cliente"
          value={form[`${prefix}Nombre` as 'origenNombre' | 'destinoNombre']}
          onChange={e => set(`${prefix}Nombre`, e.target.value)}
          placeholder="Nombre del cliente..." />
      );
    }
    return null;
  };

  return (
    <Modal open={open} onClose={handleClose} title="Registrar movimiento"
      subtitle="Registre un ingreso, egreso, transferencia o ajuste de stock"
      footer={<>
        <Button variant="outline" size="sm" onClick={handleClose}>Cancelar</Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : 'Registrar'}
        </Button>
      </>}>
      <div className="space-y-4">
        {/* Tipo y articulo */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Tipo de movimiento *</label>
            <select value={form.tipo} onChange={e => set('tipo', e.target.value)} className={selectCls}>
              {TIPO_MOV_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <Input inputSize="sm" label="Cantidad *" type="number" value={String(form.cantidad)}
            onChange={e => set('cantidad', Number(e.target.value) || 0)} />
        </div>

        <div>
          <label className={lbl}>Articulo *</label>
          <SearchableSelect value={form.articuloId} onChange={v => { set('articuloId', v); set('unidadId', ''); }}
            options={articulos.map(a => ({ value: a.id, label: `${a.codigo} — ${a.descripcion}` }))}
            placeholder="Buscar articulo..." />
        </div>

        {form.articuloId && unidades.length > 0 && (
          <div>
            <label className={lbl}>Unidad (S/N o lote)</label>
            <SearchableSelect value={form.unidadId} onChange={v => set('unidadId', v)}
              options={[
                { value: '', label: 'Sin unidad especifica' },
                ...unidades.map(u => ({
                  value: u.id,
                  label: `${u.nroSerie || u.nroLote || 'S/N'} — ${u.estado} (${u.ubicacion.referenciaNombre})`,
                })),
              ]}
              placeholder="Seleccionar unidad..." />
          </div>
        )}

        <hr className="border-slate-100" />

        {/* Origen */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Tipo origen</label>
            <select value={form.origenTipo} onChange={e => { set('origenTipo', e.target.value); set('origenId', ''); set('origenNombre', ''); }} className={selectCls}>
              {ORIGEN_DESTINO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {renderLocationField('origen', form.origenTipo)}
        </div>

        {/* Destino */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Tipo destino</label>
            <select value={form.destinoTipo} onChange={e => { set('destinoTipo', e.target.value); set('destinoId', ''); set('destinoNombre', ''); }} className={selectCls}>
              {ORIGEN_DESTINO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {renderLocationField('destino', form.destinoTipo)}
        </div>

        <hr className="border-slate-100" />

        <div className="grid grid-cols-2 gap-3">
          <Input inputSize="sm" label="Creado por *" value={form.creadoPor}
            onChange={e => set('creadoPor', e.target.value)} placeholder="Nombre del operador..." />
          <Input inputSize="sm" label="Motivo" value={form.motivo}
            onChange={e => set('motivo', e.target.value)} placeholder="Motivo del movimiento..." />
        </div>
      </div>
    </Modal>
  );
};
