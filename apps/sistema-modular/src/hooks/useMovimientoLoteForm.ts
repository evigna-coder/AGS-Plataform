import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  articulosService, unidadesService, posicionesStockService, minikitsService, ingenierosService,
} from '../services/firebaseService';
import { movimientosAplicarService, type PuntoMovimiento } from '../services/movimientosAplicar';
import type { Articulo, UnidadStock, PosicionStock, Minikit, Ingeniero, TipoOrigenDestino } from '@ags/shared';

/**
 * Movimiento en LOTE: varios artículos en un mismo movimiento (mismo tipo/origen/destino),
 * generando un asiento por artículo. Cubre los tipos que MUEVEN o SACAN stock existente —
 * transferencia / egreso / consumo — donde el origen es una ubicación compartida. El ingreso
 * (multi-artículo) ya lo hace "Ingresar stock"; el ajuste es por unidad puntual (no en lote).
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

export interface LocOption { key: string; tipo: TipoOrigenDestino; id: string; nombre: string; }

export interface LineaLote {
  id: string;
  articuloId: string;
  articuloCodigo: string;
  articuloDescripcion: string;
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
  const [origenKey, setOrigenKey] = useState('');
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
  const [draftCantidad, setDraftCantidad] = useState(1);
  const [draftUnidadIds, setDraftUnidadIds] = useState<string[]>([]);
  const [draftUnidades, setDraftUnidades] = useState<UnidadStock[]>([]);

  const reset = useCallback(() => {
    setTipo('transferencia'); setOrigenKey(''); setDestinoKey(''); setDestinoLibre('');
    setObservaciones(''); setLineas([]);
    setDraftArticuloId(''); setDraftCantidad(1); setDraftUnidadIds([]); setDraftUnidades([]);
  }, []);

  useEffect(() => {
    if (!open) return;
    reset();
    Promise.all([
      articulosService.getAll(), posicionesStockService.getAll(),
      minikitsService.getAll(), ingenierosService.getAll(),
    ]).then(([a, p, mk, ing]) => { setArticulos(a); setPosiciones(p); setMinikits(mk); setIngenieros(ing); });
  }, [open, reset]);

  // Cambiar tipo u origen invalida las líneas (sus unidades cuelgan del origen elegido).
  useEffect(() => { setLineas([]); setDraftArticuloId(''); setDraftUnidadIds([]); setDraftUnidades([]); }, [tipo, origenKey]);

  const locationOptions: LocOption[] = useMemo(() => [
    ...posiciones.map(p => ({ key: locKey('posicion', p.id), tipo: 'posicion' as TipoOrigenDestino, id: p.id, nombre: `${p.codigo} — ${p.nombre}` })),
    ...minikits.map(m => ({ key: locKey('minikit', m.id), tipo: 'minikit' as TipoOrigenDestino, id: m.id, nombre: `${m.codigo} — ${m.nombre}` })),
    ...ingenieros.map(i => ({ key: locKey('ingeniero', i.id), tipo: 'ingeniero' as TipoOrigenDestino, id: i.id, nombre: i.nombre })),
  ], [posiciones, minikits, ingenieros]);

  const origen = useMemo(() => locationOptions.find(o => o.key === origenKey) ?? null, [locationOptions, origenKey]);
  const draftArticulo = useMemo(() => articulos.find(a => a.id === draftArticuloId) ?? null, [articulos, draftArticuloId]);
  const draftRequiereSerie = !!draftArticulo?.requiereNumeroSerie;

  // Unidades del artículo del draft, disponibles EN el origen elegido.
  useEffect(() => {
    setDraftUnidadIds([]);
    if (!draftArticuloId || !origen) { setDraftUnidades([]); return; }
    let alive = true;
    unidadesService.getByArticulo(draftArticuloId).then(us => {
      if (!alive) return;
      setDraftUnidades(us.filter(u =>
        u.activo && u.estado === 'disponible' &&
        u.ubicacion?.tipo === origen.tipo && (u.ubicacion?.referenciaId ?? '') === origen.id));
    });
    return () => { alive = false; };
  }, [draftArticuloId, origen]);

  const draftStock = useMemo(() => draftUnidades.reduce((acc, u) => acc + (u.cantidad ?? 1), 0), [draftUnidades]);
  const draftSeleccionSum = useMemo(
    () => draftUnidades.filter(u => draftUnidadIds.includes(u.id)).reduce((acc, u) => acc + (u.cantidad ?? 1), 0),
    [draftUnidades, draftUnidadIds],
  );
  const cantidadEfectiva = draftRequiereSerie ? draftSeleccionSum : draftCantidad;

  const yaEnLineas = useMemo(() => new Set(lineas.map(l => l.articuloId)), [lineas]);

  const addLinea = () => {
    if (!draftArticulo) return 'Elegí un artículo';
    if (yaEnLineas.has(draftArticulo.id)) return 'Ese artículo ya está en la lista';
    if (draftRequiereSerie) {
      if (draftUnidadIds.length === 0) return 'Artículo con n° de serie: seleccioná las unidades';
    } else {
      if (cantidadEfectiva <= 0) return 'La cantidad debe ser mayor a 0';
      if (cantidadEfectiva > draftStock) return `Stock insuficiente en el origen (${draftStock} disponible)`;
    }
    const detalle = draftUnidadIds.length > 0
      ? draftUnidades.filter(u => draftUnidadIds.includes(u.id)).map(u => u.nroSerie || u.nroLote || '·').join(', ')
      : 'FIFO';
    setLineas(prev => [...prev, {
      id: crypto.randomUUID(),
      articuloId: draftArticulo.id, articuloCodigo: draftArticulo.codigo, articuloDescripcion: draftArticulo.descripcion,
      cantidad: cantidadEfectiva, unidadIds: [...draftUnidadIds], requiereSerie: draftRequiereSerie, detalleUnidades: detalle,
    }]);
    setDraftArticuloId(''); setDraftCantidad(1); setDraftUnidadIds([]); setDraftUnidades([]);
    return null;
  };

  const removeLinea = (id: string) => setLineas(prev => prev.filter(l => l.id !== id));

  const toggleDraftUnidad = (id: string) => setDraftUnidadIds(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const destinoCfg = DESTINO_LOTE[tipo];
  const totalUnidades = useMemo(() => lineas.reduce((acc, l) => acc + l.cantidad, 0), [lineas]);

  const handleClose = () => { onClose(); reset(); };

  const handleSave = async () => {
    if (!origen) { alert('Seleccioná el origen'); return; }
    let destino: PuntoMovimiento;
    let otNumber: string | null = null;
    if (destinoCfg.mode === 'ubicacion') {
      const d = locationOptions.find(o => o.key === destinoKey);
      if (!d) { alert('Seleccioná el destino'); return; }
      if (d.tipo === origen.tipo && d.id === origen.id) { alert('El destino es la misma ubicación que el origen'); return; }
      destino = { tipo: d.tipo, id: d.id, nombre: d.nombre };
    } else {
      const txt = destinoLibre.trim();
      if (!txt) { alert(`Completá ${destinoCfg.label.toLowerCase()}`); return; }
      destino = { tipo: destinoCfg.tipo, id: '', nombre: txt };
      if (tipo === 'consumo') otNumber = txt;
    }
    if (lineas.length === 0) { alert('Agregá al menos un artículo'); return; }

    const motivo = observaciones.trim() || null;
    setSaving(true);
    try {
      for (const linea of lineas) {
        // Re-leer las unidades frescas del artículo en el origen (evita datos rancios).
        const enOrigen = (await unidadesService.getByArticulo(linea.articuloId)).filter(u =>
          u.activo && u.estado === 'disponible' &&
          u.ubicacion?.tipo === origen.tipo && (u.ubicacion?.referenciaId ?? '') === origen.id);
        const candidatas = linea.unidadIds.length > 0
          ? enOrigen.filter(u => linea.unidadIds.includes(u.id))
          : [...enOrigen].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')); // FIFO
        const disponible = candidatas.reduce((acc, u) => acc + (u.cantidad ?? 1), 0);
        if (disponible < linea.cantidad) {
          throw new Error(`${linea.articuloCodigo}: stock insuficiente en el origen (${disponible} de ${linea.cantidad}).`);
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
    saving, tipo, setTipo, origenKey, setOrigenKey, destinoKey, setDestinoKey,
    destinoLibre, setDestinoLibre, observaciones, setObservaciones,
    lineas, addLinea, removeLinea, totalUnidades,
    articulos, locationOptions, origen, destinoCfg,
    draftArticuloId, setDraftArticuloId, draftCantidad, setDraftCantidad,
    draftUnidades, draftUnidadIds, toggleDraftUnidad, draftRequiereSerie, draftStock, cantidadEfectiva,
    yaEnLineas, handleClose, handleSave,
  };
}
