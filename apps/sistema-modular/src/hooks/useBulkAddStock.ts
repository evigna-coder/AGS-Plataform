import { useState, useEffect, useMemo } from 'react';
import { articulosService, unidadesService, posicionesStockService, minikitsService, ingenierosService, proveedoresService, movimientosService } from '../services/firebaseService';
import type { Articulo, CondicionUnidad, TipoUbicacionStock, TipoOrigenDestino, Proveedor, UnidadStock } from '@ags/shared';

export interface BulkRow {
  key: string;
  nroSerie: string;
  nroLote: string;
  cantidad: number;
  observaciones: string;
}

let _rowSeq = 0;
const newRow = (): BulkRow => ({ key: `r${++_rowSeq}`, nroSerie: '', nroLote: '', cantidad: 1, observaciones: '' });

export function useBulkAddStock(
  open: boolean,
  presetArticulo: Articulo | null | undefined,
  onClose: () => void,
  onCreated: () => void,
  creadoPor: string = 'Admin',
) {
  const [saving, setSaving] = useState(false);
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [articuloId, setArticuloId] = useState('');
  const [articulo, setArticulo] = useState<Articulo | null>(null);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [proveedorId, setProveedorId] = useState('');

  // Campos comunes a todas las filas
  const [condicion, setCondicion] = useState<CondicionUnidad>('nuevo');
  const [ubicacionTipo, setUbicacionTipo] = useState<TipoUbicacionStock>('posicion');
  const [ubicacionRefId, setUbicacionRefId] = useState('');
  const [ubicacionRefNombre, setUbicacionRefNombre] = useState('');
  const [costoUnitario, setCostoUnitario] = useState('');
  const [monedaCosto, setMonedaCosto] = useState<'ARS' | 'USD'>('USD');
  const [refOptions, setRefOptions] = useState<{ id: string; label: string }[]>([]);

  const [rows, setRows] = useState<BulkRow[]>([newRow()]);
  const [error, setError] = useState('');

  const requiereSerie = !!articulo?.requiereNumeroSerie;
  const requiereLote = !!articulo?.requiereNumeroLote;

  // Cargar catálogo de artículos (solo si no viene preseteado)
  useEffect(() => {
    if (!open || presetArticulo) return;
    articulosService.getAll({ activoOnly: true }).then(setArticulos);
  }, [open, presetArticulo]);

  // Cargar proveedores (origen del ingreso)
  useEffect(() => {
    if (!open) return;
    proveedoresService.getAll().then(setProveedores);
  }, [open]);

  // Reset al abrir / aplicar preset
  useEffect(() => {
    if (!open) return;
    setArticuloId(presetArticulo?.id ?? '');
    setArticulo(presetArticulo ?? null);
    setRows([newRow()]);
    setError('');
    setCondicion('nuevo');
    setCostoUnitario('');
    setProveedorId('');
    setUbicacionTipo('posicion');
    setUbicacionRefId('');
    setUbicacionRefNombre('');
  }, [open, presetArticulo]);

  // Resolver artículo seleccionado desde el selector
  useEffect(() => {
    if (presetArticulo) return;
    if (!articuloId) { setArticulo(null); return; }
    setArticulo(articulos.find(a => a.id === articuloId) ?? null);
  }, [articuloId, articulos, presetArticulo]);

  // Cargar opciones de ubicación según tipo
  useEffect(() => {
    const loadRefs = async () => {
      if (ubicacionTipo === 'posicion') {
        const items = await posicionesStockService.getAll();
        setRefOptions(items.map(i => ({ id: i.id, label: `${i.codigo} - ${i.nombre}` })));
      } else if (ubicacionTipo === 'minikit') {
        const items = await minikitsService.getAll();
        setRefOptions(items.map(i => ({ id: i.id, label: `${i.codigo} - ${i.nombre}` })));
      } else if (ubicacionTipo === 'ingeniero') {
        const items = await ingenierosService.getAll();
        setRefOptions(items.map(i => ({ id: i.id, label: i.nombre })));
      } else { setRefOptions([]); }
    };
    if (open) loadRefs();
  }, [ubicacionTipo, open]);

  const setRow = (key: string, patch: Partial<BulkRow>) =>
    setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));
  const addRow = () => setRows(prev => [...prev, newRow()]);
  const addRows = (n: number) => setRows(prev => [...prev, ...Array.from({ length: n }, newRow)]);
  const removeRow = (key: string) => setRows(prev => (prev.length > 1 ? prev.filter(r => r.key !== key) : prev));

  // Total de unidades físicas que se van a crear
  const totalUnidades = useMemo(() => {
    if (requiereSerie) return rows.length;
    return rows.reduce((acc, r) => acc + (Number(r.cantidad) || 0), 0);
  }, [rows, requiereSerie]);

  const validate = (): string => {
    if (!articulo) return 'Seleccioná un artículo.';
    const refLabel = refOptions.find(o => o.id === ubicacionRefId)?.label ?? ubicacionRefNombre.trim();
    if (!refLabel) return 'Indicá la ubicación de las unidades.';
    if (requiereSerie) {
      const series = rows.map(r => r.nroSerie.trim());
      if (series.some(s => !s)) return 'Cada unidad necesita su nº de serie.';
      const dup = series.find((s, i) => series.indexOf(s) !== i);
      if (dup) return `Nº de serie repetido en la carga: "${dup}".`;
    }
    if (!requiereSerie) {
      if (rows.some(r => (Number(r.cantidad) || 0) < 1)) return 'La cantidad debe ser al menos 1.';
      if (requiereLote && rows.some(r => !r.nroLote.trim())) return 'Cada fila necesita su nº de lote.';
    }
    return '';
  };

  const handleSave = async () => {
    const v = validate();
    if (v) { setError(v); return; }
    if (!articulo) return;
    setError('');
    setSaving(true);
    try {
      // Chequeo de series ya existentes para este artículo
      if (requiereSerie) {
        const existing = await unidadesService.getByArticulo(articulo.id);
        const taken = new Set(existing.map(u => (u.nroSerie ?? '').trim()).filter(Boolean));
        const clash = rows.map(r => r.nroSerie.trim()).find(s => taken.has(s));
        if (clash) { setError(`Ya existe una unidad con nº de serie "${clash}".`); setSaving(false); return; }
      }
      const refLabel = refOptions.find(o => o.id === ubicacionRefId)?.label ?? ubicacionRefNombre.trim();
      const costo = costoUnitario ? Number(costoUnitario) : null;
      const base = {
        articuloId: articulo.id, articuloCodigo: articulo.codigo, articuloDescripcion: articulo.descripcion,
        condicion, estado: 'disponible' as const,
        ubicacion: { tipo: ubicacionTipo, referenciaId: ubicacionRefId, referenciaNombre: refLabel },
        costoUnitario: costo, monedaCosto: costo != null ? monedaCosto : null,
        activo: true,
      };
      const items: Omit<UnidadStock, 'id' | 'createdAt' | 'updatedAt'>[] = rows.map(r => ({
        ...base,
        nroSerie: requiereSerie ? r.nroSerie.trim() : null,
        nroLote: requiereLote || (!requiereSerie && r.nroLote.trim()) ? r.nroLote.trim() || null : null,
        cantidad: requiereSerie ? 1 : (Number(r.cantidad) || 1),
        observaciones: r.observaciones.trim() || null,
      }));
      const ids = await unidadesService.createMany(items);

      // Registrar el movimiento de ingreso por cada unidad creada (audit trail del stock).
      // Best-effort: si falla el ledger, las unidades ya existen (que es lo importante).
      try {
        const prov = proveedores.find(p => p.id === proveedorId);
        const destinoTipo = (['posicion', 'minikit', 'ingeniero', 'proveedor', 'cliente'].includes(ubicacionTipo)
          ? ubicacionTipo : 'posicion') as TipoOrigenDestino;
        await Promise.all(ids.map((unidadId, i) => movimientosService.create({
          tipo: 'ingreso',
          unidadId,
          articuloId: articulo.id,
          articuloCodigo: articulo.codigo,
          articuloDescripcion: articulo.descripcion,
          cantidad: items[i].cantidad ?? 1,
          origenTipo: 'proveedor',
          origenId: prov?.id ?? '',
          origenNombre: prov?.nombre ?? 'Ingreso manual',
          destinoTipo,
          destinoId: ubicacionRefId,
          destinoNombre: refLabel,
          remitoId: null,
          otNumber: null,
          motivo: 'Ingreso de stock',
          creadoPor,
        })));
      } catch (movErr) {
        console.warn('[useBulkAddStock] unidades creadas pero falló el registro de movimientos:', movErr);
      }

      onCreated();
      onClose();
    } catch (e) {
      console.error('Error en carga de stock:', e);
      setError('Error al cargar las unidades.');
    } finally {
      setSaving(false);
    }
  };

  return {
    saving, articulos, articuloId, setArticuloId, articulo,
    proveedores, proveedorId, setProveedorId,
    condicion, setCondicion, ubicacionTipo, setUbicacionTipo,
    ubicacionRefId, setUbicacionRefId, ubicacionRefNombre, setUbicacionRefNombre,
    costoUnitario, setCostoUnitario, monedaCosto, setMonedaCosto, refOptions,
    rows, setRow, addRow, addRows, removeRow,
    requiereSerie, requiereLote, totalUnidades, error, handleSave,
  };
}
