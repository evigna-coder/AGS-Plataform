import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  articulosService, unidadesService, posicionesStockService, minikitsService, ingenierosService,
} from '../services/firebaseService';
import { movimientosAplicarService, type PuntoMovimiento } from '../services/movimientosAplicar';
import type { Articulo, UnidadStock, PosicionStock, Minikit, Ingeniero, TipoOrigenDestino } from '@ags/shared';

/**
 * Movimiento en LOTE: varios artículos en un mismo movimiento (mismo tipo/destino), generando
 * un asiento por artículo. Cubre transferencia / egreso / consumo. El ORIGEN es POR LÍNEA:
 * elegís el artículo y aparecen los depósitos que tienen stock de ESE artículo (cada línea
 * puede salir de un depósito distinto). Ingreso multi-artículo → "Ingresar stock"; ajuste → por unidad.
 */
export type TipoLote = 'transferencia' | 'egreso' | 'consumo';

export const TIPO_LOTE_OPTIONS: { value: TipoLote; label: string }[] = [
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'egreso', label: 'Egreso' },
  { value: 'consumo', label: 'Consumo' },
];

/** Cómo se resuelve el destino según el tipo. */
export const DESTINO_LOTE: Record<TipoLote, { mode: 'ubicacion' | 'texto'; label: string; tipo: TipoOrigenDestino }> = {
  transferencia: { mode: 'ubicacion', label: 'Destino',        tipo: 'posicion' },
  egreso:        { mode: 'texto',     label: 'Cliente',        tipo: 'cliente' },
  consumo:       { mode: 'texto',     label: 'Número de OT',   tipo: 'consumo_ot' },
};

export interface LocOption { key: string; tipo: TipoOrigenDestino; id: string; nombre: string; count?: number; }

export interface LineaLote {
  id: string;
  articuloId: string;
  articuloCodigo: string;
  articuloDescripcion: string;
  /** Origen de ESTA línea (depósito con stock del artículo). */
  origenTipo: TipoOrigenDestino;
  origenId: string;
  origenNombre: string;
  cantidad: number;
  /** Unidades específicas (obligatorio si el artículo requiere serie; sino FIFO). */
  unidadIds: string[];
  requiereSerie: boolean;
  detalleUnidades: string;
}

const locKey = (tipo: string, id: string) => `${tipo}:${id}`;

export function useMovimientoLoteForm(open: boolean, onClose: () => void, onCreated: () => void, creadoPor: string) {
  const [saving, setSaving] = useState(false);
  const [tipo, setTipo] = useState<TipoLote>('transferencia');
  const [destinoKey, setDestinoKey] = useState('');
  const [destinoLibre, setDestinoLibre] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [lineas, setLineas] = useState<LineaLote[]>([]);

  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [posiciones, setPosiciones] = useState<PosicionStock[]>([]);
  const [minikits, setMinikits] = useState<Minikit[]>([]);
  const [ingenieros, setIngenieros] = useState<Ingeniero[]>([]);

  // Draft de la línea en edición
  const [draftArticuloId, setDraftArticuloId] = useState('');
  const [draftOrigenKey, setDraftOrigenKey] = useState('');
  const [draftCantidad, setDraftCantidad] = useState(1);
  const [draftUnidadIds, setDraftUnidadIds] = useState<string[]>([]);
  // TODAS las unidades disponibles del artículo del draft (se agrupan por depósito).
  const [draftArticuloUnidades, setDraftArticuloUnidades] = useState<UnidadStock[]>([]);

  const resetDraft = () => {
    setDraftArticuloId(''); setDraftOrigenKey(''); setDraftCantidad(1);
    setDraftUnidadIds([]); setDraftArticuloUnidades([]);
  };

  const reset = useCallback(() => {
    setTipo('transferencia'); setDestinoKey(''); setDestinoLibre('');
    setObservaciones(''); setLineas([]);
    setDraftArticuloId(''); setDraftOrigenKey(''); setDraftCantidad(1);
    setDraftUnidadIds([]); setDraftArticuloUnidades([]);
  }, []);

  useEffect(() => {
    if (!open) return;
    reset();
    // Artículos EN VIVO (subscribe): un cambio de catálogo con el modal abierto
    // (ej. "requiere n° de serie") se toma en el draft sin cerrar nada — el flag
    // del draft se deriva de esta lista (draftArticulo useMemo).
    const unsub = articulosService.subscribe(
      undefined,
      setArticulos,
      (err: Error) => console.error('[useMovimientoLoteForm] articulos subscribe error:', err),
    );
    Promise.all([
      posicionesStockService.getAll(),
      minikitsService.getAll(), ingenierosService.getAll(),
    ]).then(([p, mk, ing]) => { setPosiciones(p); setMinikits(mk); setIngenieros(ing); });
    return () => unsub();
  }, [open, reset]);

  // Cambiar el tipo cambia el destino → limpiar líneas y draft.
  useEffect(() => { setLineas([]); resetDraft(); }, [tipo]);

  // Catálogo completo de ubicaciones — solo para el DESTINO de transferencia.
  const locationOptions: LocOption[] = useMemo(() => [
    ...posiciones.map(p => ({ key: locKey('posicion', p.id), tipo: 'posicion' as TipoOrigenDestino, id: p.id, nombre: `${p.codigo} — ${p.nombre}` })),
    ...minikits.map(m => ({ key: locKey('minikit', m.id), tipo: 'minikit' as TipoOrigenDestino, id: m.id, nombre: `${m.codigo} — ${m.nombre}` })),
    ...ingenieros.map(i => ({ key: locKey('ingeniero', i.id), tipo: 'ingeniero' as TipoOrigenDestino, id: i.id, nombre: i.nombre })),
  ], [posiciones, minikits, ingenieros]);

  const draftArticulo = useMemo(() => articulos.find(a => a.id === draftArticuloId) ?? null, [articulos, draftArticuloId]);
  const draftRequiereSerie = !!draftArticulo?.requiereNumeroSerie;

  // Al elegir artículo → traer TODAS sus unidades disponibles (para agrupar por depósito).
  useEffect(() => {
    setDraftOrigenKey(''); setDraftUnidadIds([]); setDraftCantidad(1);
    if (!draftArticuloId) { setDraftArticuloUnidades([]); return; }
    let alive = true;
    unidadesService.getByArticulo(draftArticuloId).then(us => {
      if (!alive) return;
      setDraftArticuloUnidades(us.filter(u => u.activo && u.estado === 'disponible'));
    });
    return () => { alive = false; };
  }, [draftArticuloId]);

  // Depósitos que TIENEN stock del artículo elegido (agrupado por ubicación, con conteo).
  const draftOrigenOptions: LocOption[] = useMemo(() => {
    const grouped = new Map<string, LocOption>();
    for (const u of draftArticuloUnidades) {
      const t = u.ubicacion?.tipo; const id = u.ubicacion?.referenciaId ?? '';
      if (!t) continue;
      const key = locKey(t, id);
      const prev = grouped.get(key) ?? { key, tipo: t as TipoOrigenDestino, id, nombre: u.ubicacion?.referenciaNombre || t, count: 0 };
      prev.count = (prev.count ?? 0) + (u.cantidad ?? 1);
      grouped.set(key, prev);
    }
    return [...grouped.values()].sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
  }, [draftArticuloUnidades]);

  // Unidades del artículo EN el depósito de origen elegido (para selección serializada).
  const draftUnidades = useMemo(() => {
    if (!draftOrigenKey) return [];
    const [t, id] = draftOrigenKey.split(':');
    return draftArticuloUnidades.filter(u => u.ubicacion?.tipo === t && (u.ubicacion?.referenciaId ?? '') === (id ?? ''));
  }, [draftArticuloUnidades, draftOrigenKey]);

  const draftStock = useMemo(() => draftUnidades.reduce((acc, u) => acc + (u.cantidad ?? 1), 0), [draftUnidades]);
  const draftSeleccionSum = useMemo(
    () => draftUnidades.filter(u => draftUnidadIds.includes(u.id)).reduce((acc, u) => acc + (u.cantidad ?? 1), 0),
    [draftUnidades, draftUnidadIds],
  );
  const cantidadEfectiva = draftRequiereSerie ? draftSeleccionSum : draftCantidad;

  const addLinea = () => {
    if (!draftArticulo) return 'Elegí un artículo';
    if (!draftOrigenKey) return 'Elegí el depósito de origen';
    const [oTipo, oId] = draftOrigenKey.split(':');
    if (lineas.some(l => l.articuloId === draftArticulo.id && l.origenId === (oId ?? '') && l.origenTipo === oTipo)) {
      return 'Ya agregaste ese artículo desde ese depósito';
    }
    if (draftRequiereSerie) {
      if (draftUnidadIds.length === 0) return 'Artículo con n° de serie: seleccioná las unidades';
    } else {
      if (cantidadEfectiva <= 0) return 'La cantidad debe ser mayor a 0';
      if (cantidadEfectiva > draftStock) return `Stock insuficiente en el depósito (${draftStock} disponible)`;
    }
    const origenOpt = draftOrigenOptions.find(o => o.key === draftOrigenKey);
    const detalle = draftUnidadIds.length > 0
      ? draftUnidades.filter(u => draftUnidadIds.includes(u.id)).map(u => u.nroSerie || u.nroLote || '·').join(', ')
      : 'FIFO';
    setLineas(prev => [...prev, {
      id: crypto.randomUUID(),
      articuloId: draftArticulo.id, articuloCodigo: draftArticulo.codigo, articuloDescripcion: draftArticulo.descripcion,
      origenTipo: oTipo as TipoOrigenDestino, origenId: oId ?? '', origenNombre: origenOpt?.nombre ?? '',
      cantidad: cantidadEfectiva, unidadIds: [...draftUnidadIds], requiereSerie: draftRequiereSerie, detalleUnidades: detalle,
    }]);
    resetDraft();
    return null;
  };

  const removeLinea = (id: string) => setLineas(prev => prev.filter(l => l.id !== id));

  const toggleDraftUnidad = (id: string) => setDraftUnidadIds(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const destinoCfg = DESTINO_LOTE[tipo];
  const totalUnidades = useMemo(() => lineas.reduce((acc, l) => acc + l.cantidad, 0), [lineas]);

  const handleClose = () => { onClose(); reset(); };

  const handleSave = async () => {
    if (lineas.length === 0) { alert('Agregá al menos un artículo'); return; }

    let destino: PuntoMovimiento;
    let otNumber: string | null = null;
    if (destinoCfg.mode === 'ubicacion') {
      const d = locationOptions.find(o => o.key === destinoKey);
      if (!d) { alert('Seleccioná el destino'); return; }
      if (lineas.some(l => l.origenTipo === d.tipo && l.origenId === d.id)) {
        alert('Hay una línea cuyo origen es el mismo que el destino'); return;
      }
      destino = { tipo: d.tipo, id: d.id, nombre: d.nombre };
    } else {
      const txt = destinoLibre.trim();
      if (!txt) { alert(`Completá ${destinoCfg.label.toLowerCase()}`); return; }
      destino = { tipo: destinoCfg.tipo, id: '', nombre: txt };
      if (tipo === 'consumo') otNumber = txt;
    }

    // Guard: si el catálogo cambió DURANTE la carga y una línea agregada por FIFO
    // (sin unidades elegidas) ahora corresponde a un artículo serializado, pedir
    // recargar ESA línea con las unidades específicas (regla de trazabilidad).
    const desactualizadas = lineas.filter(l => {
      const fresh = articulos.find(a => a.id === l.articuloId);
      return !!fresh?.requiereNumeroSerie && l.unidadIds.length === 0;
    });
    if (desactualizadas.length > 0) {
      alert(`El catálogo cambió durante la carga: ${desactualizadas.map(l => l.articuloCodigo).join(', ')} ahora requiere n° de serie. Quitá esa línea y volvé a agregarla seleccionando las unidades — el resto se conserva.`);
      return;
    }

    const motivo = observaciones.trim() || null;
    setSaving(true);
    try {
      for (const linea of lineas) {
        // Re-leer las unidades frescas del artículo en SU origen (evita datos rancios).
        const enOrigen = (await unidadesService.getByArticulo(linea.articuloId)).filter(u =>
          u.activo && u.estado === 'disponible' &&
          u.ubicacion?.tipo === linea.origenTipo && (u.ubicacion?.referenciaId ?? '') === linea.origenId);
        const candidatas = linea.unidadIds.length > 0
          ? enOrigen.filter(u => linea.unidadIds.includes(u.id))
          : [...enOrigen].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')); // FIFO
        const disponible = candidatas.reduce((acc, u) => acc + (u.cantidad ?? 1), 0);
        if (disponible < linea.cantidad) {
          throw new Error(`${linea.articuloCodigo}: stock insuficiente en ${linea.origenNombre} (${disponible} de ${linea.cantidad}).`);
        }
        let restante = linea.cantidad;
        for (const u of candidatas) {
          if (restante <= 0) break;
          const aMover = Math.min(u.cantidad ?? 1, restante);
          if (tipo === 'transferencia') {
            restante -= await movimientosAplicarService.transferirUnidad({ unidad: u, aMover, destino, motivo, creadoPor });
          } else {
            restante -= await movimientosAplicarService.deducirUnidad({
              unidad: u, aDeducir: aMover, tipoMov: tipo,
              estadoFinal: tipo === 'consumo' ? 'consumido' : 'entregado',
              destino, otNumber, motivo, creadoPor,
            });
          }
        }
      }
      handleClose();
      onCreated();
    } catch (err) {
      console.error('[useMovimientoLoteForm]', err);
      alert(err instanceof Error ? `Error al registrar el movimiento: ${err.message}` : 'Error al registrar el movimiento');
    } finally { setSaving(false); }
  };

  return {
    saving, tipo, setTipo, destinoKey, setDestinoKey,
    destinoLibre, setDestinoLibre, observaciones, setObservaciones,
    lineas, addLinea, removeLinea, totalUnidades,
    articulos, locationOptions, destinoCfg,
    draftArticuloId, setDraftArticuloId, draftOrigenKey, setDraftOrigenKey,
    draftCantidad, setDraftCantidad, draftOrigenOptions,
    draftUnidades, draftUnidadIds, toggleDraftUnidad, draftRequiereSerie, draftStock, cantidadEfectiva,
    handleClose, handleSave,
  };
}
