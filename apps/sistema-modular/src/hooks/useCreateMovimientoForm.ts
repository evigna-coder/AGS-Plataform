import { useState, useEffect } from 'react';
import {
  movimientosService, articulosService, unidadesService,
  posicionesStockService, minikitsService, ingenierosService, proveedoresService,
} from '../services/firebaseService';
import type {
  Articulo, UnidadStock, PosicionStock, Minikit, Ingeniero, Proveedor,
  TipoMovimiento, TipoOrigenDestino,
} from '@ags/shared';

export const TIPO_MOV_OPTIONS: { value: TipoMovimiento; label: string }[] = [
  { value: 'ingreso', label: 'Ingreso' },
  { value: 'egreso', label: 'Egreso' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'consumo', label: 'Consumo' },
  { value: 'devolucion', label: 'Devolucion' },
  { value: 'ajuste', label: 'Ajuste' },
];

export const ORIGEN_DESTINO_OPTIONS: { value: TipoOrigenDestino; label: string }[] = [
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

export function useCreateMovimientoForm(open: boolean, onClose: () => void, onCreated: () => void) {
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
    } else { setUnidades([]); }
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
        tipo: form.tipo, unidadId: form.unidadId || '',
        articuloId: form.articuloId, articuloCodigo: articulo.codigo,
        articuloDescripcion: articulo.descripcion, cantidad: form.cantidad,
        origenTipo: form.origenTipo, origenId: form.origenId,
        origenNombre: form.origenNombre || ORIGEN_DESTINO_OPTIONS.find(o => o.value === form.origenTipo)?.label || '',
        destinoTipo: form.destinoTipo, destinoId: form.destinoId,
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

  return {
    saving, form, set, articulos, unidades, handleClose, handleSave,
    getEntitiesForType, needsEntitySelect, handleEntitySelect,
  };
}
