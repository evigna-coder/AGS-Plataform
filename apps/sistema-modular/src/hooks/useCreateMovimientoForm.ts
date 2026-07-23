import { useState, useEffect, useMemo } from 'react';
import {
  movimientosService, articulosService, unidadesService,
  posicionesStockService, minikitsService, ingenierosService, proveedoresService,
} from '../services/firebaseService';
import { movimientosAplicarService, type PuntoMovimiento } from '../services/movimientosAplicar';
import type {
  Articulo, UnidadStock, PosicionStock, Minikit, Ingeniero, Proveedor,
  TipoMovimiento, TipoOrigenDestino, MovimientoStock,
} from '@ags/shared';

export const TIPO_MOV_OPTIONS: { value: TipoMovimiento; label: string }[] = [
  { value: 'ingreso', label: 'Ingreso' },
  { value: 'egreso', label: 'Egreso' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'consumo', label: 'Consumo' },
  { value: 'devolucion', label: 'Devolucion' },
  { value: 'ajuste', label: 'Ajuste' },
];

/**
 * Mapeo `tipo de movimiento` → cómo se renderiza el origen y el destino.
 *   - `ubicacion_con_stock`: SearchableSelect con ubicaciones internas (posición/minikit/ingeniero)
 *     filtradas a las que tienen stock real del artículo. Habilita selector de unidades.
 *   - `proveedor`: SearchableSelect del catálogo de proveedores.
 *   - `ubicacion_interna`: SearchableSelect del catálogo completo (sin filtrar por stock).
 *   - `texto_libre`: input texto (cliente, OT, ajuste).
 */
type SlotMode = 'ubicacion_con_stock' | 'proveedor' | 'ubicacion_interna' | 'texto_libre';

export const SLOT_BY_TIPO: Record<TipoMovimiento, { origen: SlotMode; destino: SlotMode; origenLibreLabel?: string; destinoLibreLabel?: string }> = {
  ingreso:       { origen: 'proveedor',           destino: 'ubicacion_interna' },
  egreso:        { origen: 'ubicacion_con_stock', destino: 'texto_libre',          destinoLibreLabel: 'Cliente' },
  transferencia: { origen: 'ubicacion_con_stock', destino: 'ubicacion_interna' },
  consumo:       { origen: 'ubicacion_con_stock', destino: 'texto_libre',          destinoLibreLabel: 'Número de OT' },
  devolucion:    { origen: 'texto_libre',         destino: 'ubicacion_interna',     origenLibreLabel: 'Número de OT' },
  ajuste:        { origen: 'ubicacion_con_stock', destino: 'texto_libre',          destinoLibreLabel: 'Motivo del ajuste' },
};

/**
 * Mapeo SlotMode → tipo de origen/destino almacenado en Firestore (TipoOrigenDestino).
 * Para ubicaciones se infiere de la ubicación elegida; para los demás se hardcodea.
 */
const FALLBACK_TIPO_ORIGENDESTINO: Record<TipoMovimiento, { origen: TipoOrigenDestino; destino: TipoOrigenDestino }> = {
  ingreso:       { origen: 'proveedor',  destino: 'posicion' },
  egreso:        { origen: 'posicion',   destino: 'cliente' },
  transferencia: { origen: 'posicion',   destino: 'posicion' },
  consumo:       { origen: 'posicion',   destino: 'consumo_ot' },
  devolucion:    { origen: 'consumo_ot', destino: 'posicion' },
  ajuste:        { origen: 'posicion',   destino: 'ajuste' },
};

export interface UbicacionLocationOption {
  /** Key única "tipo:id" para el SearchableSelect. */
  key: string;
  tipo: TipoOrigenDestino;
  id: string;
  nombre: string;
  /** Cantidad de unidades del artículo en esta ubicación (solo cuando aplica). */
  count: number;
  /** Marcado en gris cuando es histórico (artículo ya no tiene stock acá). */
  historica?: boolean;
}

export interface InitOpts {
  /** Pre-fija y bloquea el tipo de movimiento. */
  lockTipo?: TipoMovimiento;
  /** Pre-fija y bloquea el artículo. */
  lockArticulo?: { id: string; codigo: string; descripcion: string };
  /** Pre-fija y bloquea el destino. */
  lockDestino?: { tipo: TipoOrigenDestino; id: string; nombre: string };
  /** Preselecciona el origen (no lo bloquea) — ej: "Mover" desde una ubicación concreta. */
  initOrigen?: { tipo: TipoOrigenDestino; id: string; nombre: string };
}

interface FormState {
  tipo: TipoMovimiento;
  articuloId: string;
  cantidad: number;
  origenKey: string;
  origenUnidadIds: string[];
  origenLibre: string;
  destinoKey: string;
  destinoLibre: string;
  observaciones: string;
  /** Series (una por línea) para ingreso/devolución de artículos con `requiereNumeroSerie`. */
  seriesText: string;
  /** Lote para ingreso/devolución de artículos con `requiereNumeroLote`. */
  lote: string;
}

const buildEmptyForm = (init: InitOpts): FormState => ({
  tipo: init.lockTipo ?? 'transferencia',
  articuloId: init.lockArticulo?.id ?? '',
  cantidad: 1,
  origenKey: '',
  origenUnidadIds: [],
  origenLibre: '',
  destinoKey: init.lockDestino ? `${init.lockDestino.tipo}:${init.lockDestino.id}` : '',
  destinoLibre: '',
  observaciones: '',
  seriesText: '',
  lote: '',
});

export function useCreateMovimientoForm(open: boolean, onClose: () => void, onCreated: () => void, init: InitOpts = {}, creadoPor: string = 'Admin') {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(() => buildEmptyForm(init));

  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [unidades, setUnidades] = useState<UnidadStock[]>([]);
  const [posiciones, setPosiciones] = useState<PosicionStock[]>([]);
  const [minikits, setMinikits] = useState<Minikit[]>([]);
  const [ingenieros, setIngenieros] = useState<Ingeniero[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [movimientosArticulo, setMovimientosArticulo] = useState<MovimientoStock[]>([]);

  // Cargar catálogos cuando se abre
  useEffect(() => {
    if (!open) return;
    Promise.all([
      articulosService.getAll(), posicionesStockService.getAll(),
      minikitsService.getAll(), ingenierosService.getAll(), proveedoresService.getAll(),
    ]).then(([a, p, mk, ing, prov]) => {
      setArticulos(a); setPosiciones(p); setMinikits(mk); setIngenieros(ing); setProveedores(prov);
    });
  }, [open]);

  // Reset form cuando se abre (respetando locks)
  useEffect(() => {
    if (!open) return;
    setForm(buildEmptyForm(init));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Cargar unidades + movimientos del artículo
  useEffect(() => {
    if (!form.articuloId) {
      setUnidades([]);
      setMovimientosArticulo([]);
      return;
    }
    unidadesService.getByArticulo(form.articuloId).then(setUnidades);
    movimientosService.getAll({ articuloId: form.articuloId }).then(setMovimientosArticulo).catch(() => setMovimientosArticulo([]));
  }, [form.articuloId]);

  // Auto-set tipo cuando NO hay lock (mantiene comportamiento previo de defaults)
  useEffect(() => {
    if (init.lockTipo) return;
    setForm(prev => ({
      ...prev,
      origenKey: '',
      origenUnidadIds: [],
      origenLibre: '',
      destinoKey: init.lockDestino ? `${init.lockDestino.tipo}:${init.lockDestino.id}` : '',
      destinoLibre: '',
      seriesText: '',
      lote: '',
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.tipo]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const slot = SLOT_BY_TIPO[form.tipo];

  // ── Origen options ──
  const origenOptions: UbicacionLocationOption[] = useMemo(() => {
    if (slot.origen === 'ubicacion_con_stock') {
      const grouped: Record<string, UbicacionLocationOption> = {};
      for (const u of unidades) {
        if (!u.activo || u.estado !== 'disponible') continue;
        const t = u.ubicacion?.tipo;
        const id = u.ubicacion?.referenciaId ?? '';
        const nom = u.ubicacion?.referenciaNombre ?? '';
        if (!t) continue;
        const key = `${t}:${id}`;
        grouped[key] ??= { key, tipo: t as TipoOrigenDestino, id, nombre: nom || `${t}`, count: 0 };
        grouped[key].count += u.cantidad ?? 1;
      }
      return Object.values(grouped).sort((a, b) => b.count - a.count);
    }
    if (slot.origen === 'proveedor') {
      return proveedores.map(p => ({ key: `proveedor:${p.id}`, tipo: 'proveedor', id: p.id, nombre: p.nombre, count: 0 }));
    }
    return [];
  }, [slot.origen, unidades, proveedores]);

  // Preselección del origen (corre cuando las opciones ya cargaron, así sobrevive
  // al reset de tipo del mount):
  //  1) `initOrigen` explícito → esa ubicación (ej: "Mover" desde un renglón).
  //  2) si el artículo tiene stock en UNA sola ubicación → esa, automáticamente.
  useEffect(() => {
    if (slot.origen !== 'ubicacion_con_stock' || form.origenKey) return;
    if (init.initOrigen) {
      const key = `${init.initOrigen.tipo}:${init.initOrigen.id}`;
      if (origenOptions.some(o => o.key === key)) {
        setForm(prev => (prev.origenKey ? prev : { ...prev, origenKey: key }));
        return;
      }
    }
    if (origenOptions.length === 1) {
      const only = origenOptions[0];
      setForm(prev => (prev.origenKey ? prev : { ...prev, origenKey: only.key }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origenOptions, slot.origen, form.origenKey]);

  // ── Destino options + sugerencias históricas en gris ──
  const destinoOptions: UbicacionLocationOption[] = useMemo(() => {
    if (slot.destino !== 'ubicacion_interna') return [];

    const mkOpts = (): UbicacionLocationOption[] => [
      ...posiciones.map(p => ({ key: `posicion:${p.id}`, tipo: 'posicion' as TipoOrigenDestino, id: p.id, nombre: `${p.codigo} — ${p.nombre}`, count: 0 })),
      ...minikits.map(m => ({ key: `minikit:${m.id}`, tipo: 'minikit' as TipoOrigenDestino, id: m.id, nombre: `${m.codigo} — ${m.nombre}`, count: 0 })),
      ...ingenieros.map(i => ({ key: `ingeniero:${i.id}`, tipo: 'ingeniero' as TipoOrigenDestino, id: i.id, nombre: i.nombre, count: 0 })),
    ];

    const opts = mkOpts();

    // Sugerencias en gris: si el artículo NO tiene stock en ningún lado, marcar como históricas
    // las últimas 5 ubicaciones donde estuvo (según movimientosArticulo).
    const totalStock = unidades.filter(u => u.activo && u.estado === 'disponible').length;
    if (totalStock === 0 && movimientosArticulo.length > 0) {
      const seen = new Set<string>();
      const historicas: string[] = [];
      // Ordenar por createdAt desc para que las más recientes tengan prioridad
      const sortedMovs = [...movimientosArticulo].sort((a, b) =>
        (b.createdAt || '').localeCompare(a.createdAt || '')
      );
      for (const m of sortedMovs) {
        if (!m.destinoTipo || !m.destinoId) continue;
        const k = `${m.destinoTipo}:${m.destinoId}`;
        if (seen.has(k)) continue;
        if (m.destinoTipo === 'consumo_ot' || m.destinoTipo === 'cliente' || m.destinoTipo === 'ajuste' || m.destinoTipo === 'baja') continue;
        seen.add(k);
        historicas.push(k);
        if (historicas.length >= 5) break;
      }
      const histSet = new Set(historicas);
      for (const o of opts) {
        if (histSet.has(o.key)) o.historica = true;
      }
    }

    return opts;
  }, [slot.destino, posiciones, minikits, ingenieros, unidades, movimientosArticulo]);

  // ── Unidades disponibles dentro del origen elegido ──
  const unidadesEnOrigen: UnidadStock[] = useMemo(() => {
    if (slot.origen !== 'ubicacion_con_stock' || !form.origenKey) return [];
    const [tipo, id] = form.origenKey.split(':');
    return unidades.filter(u =>
      u.activo && u.estado === 'disponible' &&
      u.ubicacion?.tipo === tipo &&
      (u.ubicacion?.referenciaId ?? '') === (id ?? '')
    );
  }, [unidades, form.origenKey, slot.origen]);

  const handleClose = () => { onClose(); setForm(buildEmptyForm(init)); };

  const findOption = (opts: UbicacionLocationOption[], key: string): UbicacionLocationOption | undefined =>
    opts.find(o => o.key === key);

  // ── Derivados para validación / UI ──
  const articuloSel = useMemo(() => articulos.find(a => a.id === form.articuloId) ?? null, [articulos, form.articuloId]);
  const requiereSerie = !!articuloSel?.requiereNumeroSerie;
  const requiereLote = !!articuloSel?.requiereNumeroLote;

  const unidadesSeleccionadas: UnidadStock[] = useMemo(
    () => form.origenUnidadIds
      .map(id => unidadesEnOrigen.find(u => u.id === id))
      .filter((u): u is UnidadStock => !!u),
    [form.origenUnidadIds, unidadesEnOrigen],
  );

  const sumCantidad = (list: UnidadStock[]) => list.reduce((acc, u) => acc + (u.cantidad ?? 1), 0);

  const handleSave = async () => {
    if (!form.articuloId) { alert('Seleccione un articulo'); return; }
    if (form.tipo === 'ajuste') {
      if (!form.cantidad || form.cantidad === 0) { alert('El ajuste no puede ser cero (usá + para sumar y − para restar)'); return; }
    } else if (!form.cantidad || form.cantidad <= 0) { alert('La cantidad debe ser mayor a 0'); return; }

    const articulo = articulos.find(a => a.id === form.articuloId);
    if (!articulo) { alert('Articulo no encontrado'); return; }

    // Resolver origen
    let origenTipo: TipoOrigenDestino;
    let origenId = '';
    let origenNombre = '';
    if (slot.origen === 'ubicacion_con_stock' || slot.origen === 'proveedor') {
      if (!form.origenKey) { alert('Seleccione el origen'); return; }
      const opt = findOption(origenOptions, form.origenKey);
      if (!opt) { alert('Origen inválido'); return; }
      origenTipo = opt.tipo; origenId = opt.id; origenNombre = opt.nombre;
    } else {
      origenTipo = FALLBACK_TIPO_ORIGENDESTINO[form.tipo].origen;
      origenNombre = form.origenLibre.trim();
      if (slot.origen === 'texto_libre' && !origenNombre) { alert('Complete el origen'); return; }
    }

    // Resolver destino
    let destinoTipo: TipoOrigenDestino;
    let destinoId = '';
    let destinoNombre = '';
    if (init.lockDestino) {
      destinoTipo = init.lockDestino.tipo; destinoId = init.lockDestino.id; destinoNombre = init.lockDestino.nombre;
    } else if (slot.destino === 'ubicacion_interna') {
      if (!form.destinoKey) { alert('Seleccione el destino'); return; }
      const opt = findOption(destinoOptions, form.destinoKey);
      if (!opt) { alert('Destino inválido'); return; }
      destinoTipo = opt.tipo; destinoId = opt.id; destinoNombre = opt.nombre;
    } else {
      destinoTipo = FALLBACK_TIPO_ORIGENDESTINO[form.tipo].destino;
      destinoNombre = form.destinoLibre.trim();
      if (slot.destino === 'texto_libre' && !destinoNombre) { alert('Complete el destino'); return; }
    }

    const origen: PuntoMovimiento = { tipo: origenTipo, id: origenId, nombre: origenNombre };
    const destino: PuntoMovimiento = { tipo: destinoTipo, id: destinoId, nombre: destinoNombre };
    const otNumber =
      origenTipo === 'consumo_ot' ? origenNombre :
      destinoTipo === 'consumo_ot' ? destinoNombre : null;
    const motivo = form.observaciones.trim() || null;

    // ── Validaciones por tipo: nada de asientos que no muevan existencias ──

    // Ingreso / devolución: se CREAN unidades → exigir serie/lote según el artículo.
    let series: string[] = [];
    if (form.tipo === 'ingreso' || form.tipo === 'devolucion') {
      if (requiereSerie) {
        series = form.seriesText.split(/[\n,;]/).map(s => s.trim()).filter(Boolean);
        if (series.length !== form.cantidad) {
          alert(`Artículo con n° de serie: ingresá exactamente ${form.cantidad} serie${form.cantidad !== 1 ? 's' : ''} (una por línea). Cargaste ${series.length}.`);
          return;
        }
        if (new Set(series).size !== series.length) { alert('Hay números de serie repetidos en la carga'); return; }
        const existentes = new Set(unidades.filter(u => u.activo && u.nroSerie).map(u => u.nroSerie as string));
        const dup = series.find(s => existentes.has(s));
        if (dup) { alert(`El n° de serie "${dup}" ya existe para este artículo`); return; }
      }
      if (requiereLote && !form.lote.trim()) { alert('Artículo con n° de lote: ingresá el lote'); return; }
    }

    // Egreso / consumo / transferencia: se descuentan o mueven unidades reales.
    // Candidatas = las seleccionadas, o FIFO de la ubicación de origen si no se seleccionó ninguna.
    let candidatas: UnidadStock[] = [];
    if (form.tipo === 'egreso' || form.tipo === 'consumo' || form.tipo === 'transferencia') {
      if (requiereSerie && unidadesSeleccionadas.length === 0) {
        alert('Artículo con n° de serie: seleccioná las unidades específicas (trazabilidad). No se registran movimientos sin unidad identificada.');
        return;
      }
      candidatas = unidadesSeleccionadas.length > 0
        ? unidadesSeleccionadas
        : [...unidadesEnOrigen].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')); // FIFO
      const disponible = sumCantidad(candidatas);
      if (disponible < form.cantidad) {
        alert(`Stock insuficiente: en ${unidadesSeleccionadas.length > 0 ? 'las unidades seleccionadas' : 'el origen'} hay ${disponible} y estás registrando ${form.cantidad}. El movimiento no se registra sin efecto real sobre las existencias.`);
        return;
      }
      if (form.tipo === 'transferencia' && origenTipo === destinoTipo && origenId === destinoId) {
        alert('El destino es la misma ubicación que el origen');
        return;
      }
    }

    if (form.tipo === 'ajuste' && unidadesSeleccionadas.length !== 1) {
      alert('Ajuste: seleccioná exactamente UNA unidad de la lista del origen para ajustar su cantidad.');
      return;
    }

    setSaving(true);
    try {
      switch (form.tipo) {
        case 'ingreso':
        case 'devolucion':
          // Crea las unidades (mismo shape que el alta por intake) + movimiento, en un batch atómico.
          await movimientosAplicarService.ingresarUnidades({
            articulo, cantidad: form.cantidad, series, lote: form.lote.trim() || null,
            tipoMov: form.tipo, origen, destino, otNumber, motivo, creadoPor,
          });
          break;

        case 'egreso':
        case 'consumo': {
          // Descuenta de verdad (patrón deducirUnidadDisponible): estado terminal o decremento de lote.
          let restante = form.cantidad;
          for (const u of candidatas) {
            if (restante <= 0) break;
            const aDeducir = Math.min(u.cantidad ?? 1, restante);
            restante -= await movimientosAplicarService.deducirUnidad({
              unidad: u, aDeducir,
              tipoMov: form.tipo,
              estadoFinal: form.tipo === 'consumo' ? 'consumido' : 'entregado',
              destino, otNumber, motivo, creadoPor,
            });
          }
          break;
        }

        case 'transferencia': {
          // Mueve la ubicación real (split de lote si se transfiere una porción).
          let restante = form.cantidad;
          for (const u of candidatas) {
            if (restante <= 0) break;
            const aMover = Math.min(u.cantidad ?? 1, restante);
            restante -= await movimientosAplicarService.transferirUnidad({
              unidad: u, aMover, destino, motivo, creadoPor,
            });
          }
          break;
        }

        case 'ajuste':
          await movimientosAplicarService.ajustarUnidad({
            unidad: unidadesSeleccionadas[0],
            delta: form.cantidad,
            motivo: destinoNombre, // slot destino texto_libre = "Motivo del ajuste" (obligatorio)
            creadoPor,
          });
          break;
      }
      handleClose();
      onCreated();
    } catch (err) {
      console.error('[CreateMovimientoModal]', err);
      alert(err instanceof Error ? `Error al registrar el movimiento: ${err.message}` : 'Error al registrar el movimiento');
    } finally { setSaving(false); }
  };

  return {
    saving, form, set, articulos, unidades,
    slot, origenOptions, destinoOptions, unidadesEnOrigen,
    requiereSerie, requiereLote, unidadesSeleccionadas,
    handleClose, handleSave,
    locks: { tipo: init.lockTipo, articulo: init.lockArticulo, destino: init.lockDestino },
  };
}
