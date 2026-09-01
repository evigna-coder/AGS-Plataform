import { useState, useEffect, useMemo, useRef } from 'react';
import {
  articulosService, unidadesService, movimientosService,
  posicionesStockService, minikitsService, ingenierosService, proveedoresService,
  ordenesCompraService, requerimientosService,
} from '../services/firebaseService';
import { reservasService } from '../services/stockService';
import { sweepStockMinimoRequerimientos } from '../utils/stockMinimoRequerimientos';
import type {
  Articulo, CondicionUnidad, Proveedor, PosicionStock, Minikit, Ingeniero,
  TipoOrigenDestino, UnidadStock, MovimientoStock, PresentacionUsada, Patron,
} from '@ags/shared';
import { cantidadEnUnidadBase, unidadesPatronDesdeCompra, normalizarSerie } from '@ags/shared';
import { patronesService } from '../services/patronesService';

export interface UbicOption {
  key: string;
  tipo: TipoOrigenDestino;
  id: string;
  nombre: string;
  count: number;       // unidades del artículo en esta ubicación hoy
  historica?: boolean; // estuvo acá antes pero hoy no tiene stock
}

export type IntakeStep = 'cantidad' | 'condicion' | 'ubicacion' | 'serie' | 'lote';

interface Draft {
  articulo: Articulo;
  step: IntakeStep;
  /** Cantidad TAL COMO SE RECIBE: si hay presentación, son envases, no unidades base. */
  cantidad: number;
  /**
   * Envase recibido (Fase 2 presentaciones, 2026-08-13). Recibir "1 × 5183-2067"
   * de un envase ×10 tiene que dar de alta 10 unidades del artículo base, no 1.
   * null = se recibe por la unidad base.
   */
  presentacion: PresentacionUsada | null;
  condicion: CondicionUnidad;
  ubicacion: { tipo: TipoOrigenDestino; id: string; nombre: string } | null;
  series: string[];
  serieInput: string;
  /**
   * Series YA existentes de este artículo, normalizadas (2026-09-01). El paso de
   * serie solo miraba la carga en curso, así que se podía ingresar una unidad
   * con el nº de serie de otra que ya estaba en el sistema. Se carga junto con
   * las unidades del artículo, en `startArticulo`.
   */
  seriesEnUso: Set<string>;
  lote: string;
  /**
   * Patrón asociado al artículo (2026-08-18). Si viene, este renglón NO da de
   * alta stock: da de alta un LOTE del patrón. Se resuelve al elegir el
   * artículo para poder avisarlo en la UI antes de cargar nada.
   */
  patron: Patron | null;
  /** Vencimiento del lote — solo aplica al renglón que entra como patrón. */
  vencimiento: string;
}

export interface IntakeItem {
  key: string;
  articulo: Articulo;
  /** Cantidad en la unidad en que se recibe (envases si hay presentación). */
  cantidad: number;
  presentacion: PresentacionUsada | null;
  condicion: CondicionUnidad;
  ubicacion: { tipo: TipoOrigenDestino; id: string; nombre: string };
  series: string[];
  lote: string;
  patron: Patron | null;
  vencimiento: string;
}

/** Unidades BASE que da de alta un renglón — la conversión vive en shared. */
export function unidadesBaseDeItem(it: Pick<IntakeItem, 'cantidad' | 'presentacion'>): number {
  return cantidadEnUnidadBase(it.cantidad, it.presentacion);
}

let _seq = 0;

export function useStockIntake(
  open: boolean,
  onClose: () => void,
  onCreated: () => void,
  creadoPor: string = 'Admin',
  /**
   * Recepción desde una OC: precarga proveedor, N° de OC y los renglones que
   * todavía no entraron (2026-08-18). Sin `pendientes` el operador tenía que
   * buscar a mano cada artículo que el sistema ya sabía que estaba pendiente.
   */
  preset?: {
    proveedorId?: string;
    ocNumero?: string;
    pendientes?: { articuloId: string; cantidad: number }[];
  },
) {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [proveedorId, setProveedorId] = useState('');
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [posiciones, setPosiciones] = useState<PosicionStock[]>([]);
  const [minikits, setMinikits] = useState<Minikit[]>([]);
  const [ingenieros, setIngenieros] = useState<Ingeniero[]>([]);

  const [items, setItems] = useState<IntakeItem[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  // Ubicaciones del artículo en curso (con sugerencias)
  const [draftUbic, setDraftUbic] = useState<UbicOption[]>([]);

  const [finalizing, setFinalizing] = useState(false);
  const [ocNumero, setOcNumero] = useState('');
  const [despachoNumero, setDespachoNumero] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    // Artículos EN VIVO (subscribe, no getAll): si se edita el catálogo con el modal
    // abierto — ej. marcar "requiere n° de serie" a mitad de una carga larga — la
    // lista se actualiza sola, incluso desde otra pestaña. Antes había que cancelar
    // todo el ingreso y arrancar de cero (UAT 2026-07-27).
    const unsub = articulosService.subscribe(
      { activoOnly: true },
      setArticulos,
      (err: Error) => console.error('[useStockIntake] articulos subscribe error:', err),
    );
    Promise.all([
      proveedoresService.getAll(), posicionesStockService.getAll(), minikitsService.getAll(), ingenierosService.getAll(),
    ]).then(([prov, pos, mk, ing]) => {
      setProveedores(prov); setPosiciones(pos); setMinikits(mk); setIngenieros(ing);
    });
    return () => unsub();
  }, [open]);

  // El wizard y los renglones cargados guardan una COPIA del artículo (con sus flags
  // de serie/lote de ese momento). Cuando llega una versión nueva del catálogo, se
  // refresca esa copia por id: el paso de serie/lote se evalúa al avanzar, así que un
  // cambio de "requiere n° de serie" a mitad del wizard se toma sin recargar nada.
  useEffect(() => {
    if (articulos.length === 0) return;
    const byId = new Map(articulos.map(a => [a.id, a]));
    setDraft(prev => {
      if (!prev) return prev;
      const fresh = byId.get(prev.articulo.id);
      return fresh ? { ...prev, articulo: fresh } : prev;
    });
    setItems(prev => {
      let changed = false;
      const next = prev.map(it => {
        const fresh = byId.get(it.articulo.id);
        if (fresh && fresh !== it.articulo) { changed = true; return { ...it, articulo: fresh }; }
        return it;
      });
      return changed ? next : prev;
    });
  }, [articulos]);

  useEffect(() => {
    if (open) return;
    // reset al cerrar
    setProveedorId(''); setItems([]); setDraft(null); setDraftUbic([]);
    setFinalizing(false); setOcNumero(''); setDespachoNumero(''); setError('');
  }, [open]);

  // Preset de recepción desde OC: aplicar al abrir.
  useEffect(() => {
    if (!open || !preset) return;
    if (preset.proveedorId) setProveedorId(preset.proveedorId);
    if (preset.ocNumero) setOcNumero(preset.ocNumero);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Opciones de ubicación para el artículo en curso (reusa lógica de useCreateMovimientoForm) ──
  const buildUbicOptions = (unidades: UnidadStock[], movs: MovimientoStock[]): UbicOption[] => {
    const opts: UbicOption[] = [
      ...posiciones.map(p => ({ key: `posicion:${p.id}`, tipo: 'posicion' as TipoOrigenDestino, id: p.id, nombre: `${p.codigo} — ${p.nombre}`, count: 0 })),
      ...minikits.map(m => ({ key: `minikit:${m.id}`, tipo: 'minikit' as TipoOrigenDestino, id: m.id, nombre: `${m.codigo} — ${m.nombre}`, count: 0 })),
      ...ingenieros.map(i => ({ key: `ingeniero:${i.id}`, tipo: 'ingeniero' as TipoOrigenDestino, id: i.id, nombre: i.nombre, count: 0 })),
    ];
    const byKey = new Map(opts.map(o => [o.key, o]));
    // contar stock actual disponible
    let totalStock = 0;
    for (const u of unidades) {
      if (!u.activo || u.estado !== 'disponible') continue;
      totalStock += u.cantidad ?? 1;
      const k = `${u.ubicacion?.tipo}:${u.ubicacion?.referenciaId ?? ''}`;
      const o = byKey.get(k);
      if (o) o.count += u.cantidad ?? 1;
    }
    // si no hay stock en ningún lado, marcar últimas 5 ubicaciones históricas
    if (totalStock === 0 && movs.length > 0) {
      const sorted = [...movs].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      const seen = new Set<string>();
      let n = 0;
      for (const m of sorted) {
        if (!m.destinoTipo || !m.destinoId) continue;
        if (['consumo_ot', 'cliente', 'ajuste', 'baja'].includes(m.destinoTipo)) continue;
        const k = `${m.destinoTipo}:${m.destinoId}`;
        if (seen.has(k)) continue;
        seen.add(k);
        const o = byKey.get(k);
        if (o) { o.historica = true; n++; }
        if (n >= 5) break;
      }
    }
    // ordenar: con stock primero (desc), después históricas, después el resto alfabético
    return opts.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      if (!!b.historica !== !!a.historica) return (b.historica ? 1 : 0) - (a.historica ? 1 : 0);
      return a.nombre.localeCompare(b.nombre);
    });
  };

  const startArticulo = async (articulo: Articulo, cantidadInicial = 1) => {
    setError('');
    setDraft({
      articulo, step: 'cantidad', cantidad: cantidadInicial, presentacion: null, condicion: 'nuevo',
      ubicacion: null, series: [], serieInput: '', seriesEnUso: new Set(), lote: '',
      patron: null, vencimiento: '',
    });
    const [unidades, movs, patron] = await Promise.all([
      unidadesService.getByArticulo(articulo.id),
      movimientosService.getAll({ articuloId: articulo.id }).catch(() => [] as MovimientoStock[]),
      patronesService.getByArticuloId(articulo.id).catch(() => null),
    ]);
    // Las series ya usadas salen de las MISMAS unidades que alimentan las
    // ubicaciones sugeridas — sin consulta extra. Alcanza a las unidades ACTIVAS
    // del artículo (`getByArticulo` filtra las de baja): una pieza dada de baja
    // salió del inventario y su serie puede volver a usarse. Mismo criterio que
    // useBulkAddStock.
    const seriesEnUso = new Set(
      unidades.map(u => normalizarSerie(u.nroSerie)).filter(Boolean),
    );
    // Sin patrón el flujo es el de siempre. Con patrón, el lote es obligatorio
    // aunque el artículo no lo exija: un lote de patrón sin número no se puede
    // rastrear ni vincular a su certificado.
    setDraft(prev => (prev ? { ...prev, seriesEnUso, ...(patron ? { patron } : {}) } : prev));
    setDraftUbic(buildUbicOptions(unidades, movs));
  };

  const patchDraft = (p: Partial<Draft>) => setDraft(prev => (prev ? { ...prev, ...p } : prev));
  const cancelDraft = () => { setDraft(null); setDraftUbic([]); };

  const commitDraft = (d: Draft) => {
    const item: IntakeItem = {
      key: `i${++_seq}`,
      articulo: d.articulo, cantidad: d.cantidad, presentacion: d.presentacion, condicion: d.condicion,
      ubicacion: d.ubicacion!, series: d.series, lote: d.lote,
      patron: d.patron, vencimiento: d.vencimiento,
    };
    setItems(prev => [...prev, item]);
    setDraft(null); setDraftUbic([]);
  };

  // Avanza al siguiente paso del wizard (Enter en inputs de texto/num; selección en ubicación)
  const advance = (payload?: { ubic?: UbicOption }) => {
    if (!draft) return;
    const d = draft;
    const reqSerie = !!d.articulo.requiereNumeroSerie;
    // Un renglón que entra como patrón SIEMPRE pasa por el paso de lote, aunque
    // el artículo no lo exija (2026-08-18): un lote de patrón sin número no se
    // puede rastrear ni colgarle el certificado.
    const reqLote = !!d.articulo.requiereNumeroLote || !!d.patron;

    if (d.step === 'cantidad') {
      if (!d.cantidad || d.cantidad < 1) { setError('La cantidad debe ser al menos 1'); return; }
      setError(''); patchDraft({ step: 'condicion' }); return;
    }
    if (d.step === 'condicion') { patchDraft({ step: 'ubicacion' }); return; }
    if (d.step === 'ubicacion') {
      const u = payload?.ubic;
      if (!u) { setError('Elegí una ubicación'); return; }
      const ubic = { tipo: u.tipo, id: u.id, nombre: u.nombre };
      if (reqSerie) { patchDraft({ ubicacion: ubic, step: 'serie', series: [], serieInput: '' }); }
      else if (reqLote) { patchDraft({ ubicacion: ubic, step: 'lote' }); }
      else { commitDraft({ ...d, ubicacion: ubic }); }
      setError(''); return;
    }
    if (d.step === 'serie') {
      const s = d.serieInput.trim();
      if (!s) { setError('Ingresá el nº de serie'); return; }
      const sNorm = normalizarSerie(s);
      if (d.series.some(x => normalizarSerie(x) === sNorm)) { setError(`Serie repetida: ${s}`); return; }
      if (d.seriesEnUso.has(sNorm)) {
        setError(`Ya existe una unidad de ${d.articulo.codigo} con el nº de serie ${s}.`);
        return;
      }
      const series = [...d.series, s];
      setError('');
      if (series.length >= d.cantidad) {
        if (reqLote) patchDraft({ series, serieInput: '', step: 'lote' });
        else commitDraft({ ...d, series });
      } else {
        patchDraft({ series, serieInput: '' });
      }
      return;
    }
    if (d.step === 'lote') {
      if (!d.lote.trim()) { setError('Ingresá el nº de lote'); return; }
      setError('');
      commitDraft({ ...d });
      return;
    }
  };

  /**
   * Precarga de los renglones de la OC (2026-08-18).
   *
   * Abrir el ingreso desde una orden y tener que buscar cada artículo a mano
   * es rehacer el trabajo de cargar la orden: el sistema ya sabe qué se pidió
   * y cuánto falta. Entran todos, editables y con la ✕ para sacar el que no
   * llegó.
   *
   * La ubicación se propone con la que más stock tiene de ese artículo hoy —
   * que es donde casi siempre va — y si el artículo nunca tuvo stock queda
   * vacía y la fila pide que la completes. Serie y lote no se adivinan.
   */
  const precargaHecha = useRef(false);
  useEffect(() => { if (!open) precargaHecha.current = false; }, [open]);
  useEffect(() => {
    const pend = preset?.pendientes ?? [];
    // Espera a los catálogos de ubicación: `articulos` llega por subscribe (rápido)
    // y las posiciones por un Promise.all aparte. Sin esta guarda la precarga
    // corría antes y `buildUbicOptions` devolvía una lista VACÍA — la fila
    // quedaba sin desplegable y era imposible elegir destino (2026-08-18).
    if (!open || precargaHecha.current || pend.length === 0
      || articulos.length === 0 || posiciones.length === 0) return;
    precargaHecha.current = true;
    (async () => {
      const byId = new Map(articulos.map(a => [a.id, a]));
      const nuevos: IntakeItem[] = [];
      const conSerie: string[] = [];
      const opciones: Record<string, UbicOption[]> = {};
      for (const p of pend) {
        const articulo = byId.get(p.articuloId);
        if (!articulo || p.cantidad <= 0) continue;
        // Los que piden N° de serie NO se precargan: hay que tipear una serie
        // por unidad y eso vive en el wizard. Precargarlos dejaría una fila
        // imposible de completar desde la tabla.
        if (articulo.requiereNumeroSerie) { conSerie.push(articulo.codigo); continue; }
        const [unidades, movs] = await Promise.all([
          unidadesService.getByArticulo(articulo.id).catch(() => [] as UnidadStock[]),
          movimientosService.getAll({ articuloId: articulo.id }).catch(() => [] as MovimientoStock[]),
        ]);
        const opts = buildUbicOptions(unidades, movs);
        opciones[articulo.id] = opts;
        const sugerida = opts.find(o => !o.historica) ?? opts[0] ?? null;
        nuevos.push({
          key: `i${++_seq}`,
          articulo,
          cantidad: p.cantidad,
          presentacion: null,
          condicion: 'nuevo',
          ubicacion: sugerida
            ? { tipo: sugerida.tipo, id: sugerida.id, nombre: sugerida.nombre }
            : { tipo: 'posicion' as TipoOrigenDestino, id: '', nombre: '' },
          series: [],
          lote: '',
          patron: null,
          vencimiento: '',
        });
      }
      // Resolver el patrón de cada uno: define si el renglón va a stock o a lote.
      await Promise.all(nuevos.map(async (n) => {
        n.patron = await patronesService.getByArticuloId(n.articulo.id).catch(() => null);
      }));
      setUbicOptionsPorArticulo(opciones);
      setItems(prev => (prev.length > 0 ? prev : nuevos));
      if (conSerie.length > 0) {
        setError(`${conSerie.join(', ')} lleva${conSerie.length === 1 ? '' : 'n'} N° de serie: agregalo${conSerie.length === 1 ? '' : 's'} desde el buscador.`);
      }
    })();
  }, [open, articulos, posiciones, minikits, ingenieros, preset?.pendientes]);

  const [ubicOptionsPorArticulo, setUbicOptionsPorArticulo] = useState<Record<string, UbicOption[]>>({});

  /**
   * Todas las ubicaciones internas, sin contar stock. Respaldo del desplegable
   * por fila: un artículo sin historial no genera opciones propias, y sin esto
   * la celda quedaba muerta.
   */
  const ubicOptionsBase = useMemo(() => buildUbicOptions([], []), [posiciones, minikits, ingenieros]);

  /** Edición inline de un renglón ya cargado (cantidad, ubicación, lote…). */
  const updateItem = (key: string, patch: Partial<IntakeItem>) =>
    setItems(prev => prev.map(i => (i.key === key ? { ...i, ...patch } : i)));

  const removeItem = (key: string) => setItems(prev => prev.filter(i => i.key !== key));

  // Total en unidades BASE: es lo que realmente entra al stock (2026-08-13).
  const totalUnidades = useMemo(
    () => items.reduce((acc, it) => acc + (it.articulo.requiereNumeroSerie ? it.series.length : unidadesBaseDeItem(it)), 0),
    [items],
  );

  const confirmFinalize = async () => {
    if (items.length === 0) { setError('Agregá al menos un artículo'); return; }
    // Guard: si el catálogo cambió DURANTE la carga (el artículo ahora exige serie/lote
    // y el renglón se cargó sin), pedir recargar SOLO ese renglón. Sin este chequeo,
    // un item con requiereNumeroSerie y series vacías crearía 0 unidades en silencio.
    const desactualizados = items.filter(it =>
      (it.articulo.requiereNumeroSerie && it.series.length === 0) ||
      ((it.articulo.requiereNumeroLote || !!it.patron) && !it.lote.trim()));
    if (desactualizados.length > 0) {
      // Los precargados desde la OC se completan en la misma fila; los que
      // vinieron del wizard hay que rehacerlos porque el catálogo cambió.
      const soloLote = desactualizados.every(i => !i.articulo.requiereNumeroSerie);
      setError(soloLote
        ? `Completá el N° de lote de: ${desactualizados.map(i => i.articulo.codigo).join(', ')}`
        : `El catálogo cambió durante la carga: ${desactualizados.map(i => i.articulo.codigo).join(', ')} `
          + 'ahora exige N° de serie. Quitá ese renglón (✕) y volvé a agregarlo — el resto de la carga se conserva.');
      return;
    }
    // Los renglones precargados desde una OC pueden llegar sin ubicación
    // (artículo que nunca tuvo stock): sin destino no se puede dar de alta.
    const sinUbicacion = items.filter(it => !it.ubicacion?.id);
    if (sinUbicacion.length > 0) {
      setError(`Elegí la ubicación de: ${sinUbicacion.map(i => i.articulo.codigo).join(', ')}`);
      return;
    }
    setSaving(true); setError('');
    try {
      const prov = proveedores.find(p => p.id === proveedorId);
      const oc = ocNumero.trim() || null;
      const desp = despachoNumero.trim() || null;

      const units: Omit<UnidadStock, 'id' | 'createdAt' | 'updatedAt'>[] = [];
      // Presentación por unidad creada, en paralelo a `units` — se denormaliza
      // en el movimiento para poder auditar la conversión.
      const unitPresentacion: (PresentacionUsada | null)[] = [];

      // Renglones que entran como PATRÓN (2026-08-18): no generan unidades de
      // stock. El artículo se recibe —la OC se concilia igual, más abajo— pero
      // la existencia pasa a vivir como lote del patrón. Una sola existencia:
      // contarlo de los dos lados sería contarlo dos veces.
      const itemsPatron = items.filter(it => it.patron);
      const itemsStock = items.filter(it => !it.patron);

      for (const it of itemsStock) {
        const base = {
          articuloId: it.articulo.id, articuloCodigo: it.articulo.codigo, articuloDescripcion: it.articulo.descripcion,
          condicion: it.condicion, estado: 'disponible' as const,
          ubicacion: { tipo: it.ubicacion.tipo as any, referenciaId: it.ubicacion.id, referenciaNombre: it.ubicacion.nombre },
          costoUnitario: null, monedaCosto: null,
          ordenCompraNumero: oc, despachoImportacionNumero: desp,
          observaciones: null, activo: true,
        };
        // Al pool SIEMPRE entran unidades BASE (2026-08-13): recibir 1 envase
        // de 10 da de alta 10. Con N° de serie no aplica conversión — cada
        // serie es una unidad física, y un envase serializado no tiene sentido.
        const cantidadBase = unidadesBaseDeItem(it);
        if (it.articulo.requiereNumeroSerie) {
          for (const s of it.series) {
            units.push({ ...base, nroSerie: s, nroLote: it.lote.trim() || null, cantidad: 1 });
            unitPresentacion.push(it.presentacion);
          }
        } else if (it.articulo.requiereNumeroLote) {
          units.push({ ...base, nroSerie: null, nroLote: it.lote.trim() || null, cantidad: cantidadBase });
          unitPresentacion.push(it.presentacion);
        } else {
          units.push({ ...base, nroSerie: null, nroLote: null, cantidad: cantidadBase });
          unitPresentacion.push(it.presentacion);
        }
      }
      // Alta de los lotes de patrón. Va ANTES del stock a propósito: si el
      // patrón falla queremos enterarnos sin haber creado ya las unidades.
      for (const it of itemsPatron) {
        const cantidadPatron = unidadesPatronDesdeCompra(it.patron!, unidadesBaseDeItem(it));
        await patronesService.registrarLoteDesdeIngreso(it.patron!.id, {
          lote: it.lote.trim(),
          cantidad: cantidadPatron,
          fechaVencimiento: it.vencimiento.trim() || null,
          notas: oc ? `Ingreso por OC ${oc}` : 'Ingreso manual',
        });

        // Asiento del ingreso (2026-08-18). La primera versión de esto solo
        // creaba el lote: la compra entraba sin ningún rastro en
        // `movimientosStock`, así que no había forma de contestar "de dónde
        // salió este lote" ni de ver la compra en el listado de movimientos.
        // Pasó con la OC SIN001 — 10 unidades de metanol sin un solo asiento.
        // `unidadId` va vacío a propósito: un lote de patrón no es una unidad
        // de stock, y apuntar a una inexistente sería peor que no apuntar.
        await movimientosService.create({
          tipo: 'ingreso',
          unidadId: '',
          articuloId: it.articulo.id,
          articuloCodigo: it.articulo.codigo,
          articuloDescripcion: it.articulo.descripcion,
          cantidad: cantidadPatron,
          origenTipo: 'proveedor', origenId: prov?.id ?? '', origenNombre: prov?.nombre ?? 'Ingreso manual',
          destinoTipo: 'ajuste', destinoId: it.patron!.id,
          destinoNombre: `Patrón ${it.patron!.codigoArticulo} — lote ${it.lote.trim()}`,
          remitoId: null, otNumber: null,
          ordenCompraNumero: oc, despachoImportacionNumero: desp,
          nroSerie: null, nroLote: it.lote.trim(),
          presentacion: it.presentacion ?? null,
          motivo: `Ingreso como patrón — lote ${it.lote.trim()}`,
          creadoPor,
        }).catch(err => console.warn('[useStockIntake] asiento del ingreso a patrón falló:', err));
      }

      const ids = units.length > 0 ? await unidadesService.createMany(units) : [];

      try {
        await Promise.all(ids.map((unidadId, i) => movimientosService.create({
          tipo: 'ingreso', unidadId,
          articuloId: units[i].articuloId, articuloCodigo: units[i].articuloCodigo, articuloDescripcion: units[i].articuloDescripcion,
          cantidad: units[i].cantidad ?? 1,
          origenTipo: 'proveedor', origenId: prov?.id ?? '', origenNombre: prov?.nombre ?? 'Ingreso manual',
          destinoTipo: units[i].ubicacion.tipo as TipoOrigenDestino, destinoId: units[i].ubicacion.referenciaId, destinoNombre: units[i].ubicacion.referenciaNombre,
          remitoId: null, otNumber: null,
          ordenCompraNumero: oc, despachoImportacionNumero: desp,
          nroSerie: units[i].nroSerie ?? null, nroLote: units[i].nroLote ?? null,
          // Rastro de la conversión: "1 × 5183-2067 ×10 = 10" (2026-08-13).
          presentacion: unitPresentacion[i] ?? null,
          motivo: 'Ingreso de stock', creadoPor,
        })));
      } catch (movErr) {
        console.warn('[useStockIntake] unidades creadas, falló registro de movimientos:', movErr);
      }

      // ── Reconciliar la OC referenciada (UAT 2026-07-16): sumar cantidadRecibida
      // a los items que matcheen por artículo y pasarla a 'recibida' si quedó
      // completa. Antes cambiar el estado de la OC era solo cosmético — el alta
      // de stock y la OC no se hablaban. Best-effort: si falla, el ingreso vale.
      if (oc) {
        try {
          const ocs = await ordenesCompraService.getAll().catch(() => [] as any[]);
          const ocDoc = ocs.find((o: any) => (o.numero || '').trim().toLowerCase() === oc.toLowerCase());
          if (ocDoc && ocDoc.estado !== 'cancelada') {
            // La conciliación se hace en UNIDADES BASE de los dos lados
            // (2026-08-13): el ítem de la OC puede estar expresado en envases
            // ("1 × 5183-2067 ×10") y el ingreso en otro envase o suelto. Sin
            // esto, recibir 10 sueltos contra un ítem de 1 envase marcaba la OC
            // como sobre-recibida, y recibir 1 envase contra 10 sueltos la
            // dejaba eternamente incompleta.
            const recibidoPorArticulo = new Map<string, number>();
            for (const it of items) {
              const qty = it.articulo.requiereNumeroSerie ? it.series.length : unidadesBaseDeItem(it);
              recibidoPorArticulo.set(it.articulo.id, (recibidoPorArticulo.get(it.articulo.id) ?? 0) + qty);
            }
            let touched = false;
            const newItems = (ocDoc.items ?? []).map((oi: any) => {
              if (!oi.articuloId) return oi;
              const restanteBase = recibidoPorArticulo.get(oi.articuloId) ?? 0;
              if (restanteBase <= 0) return oi;
              const factor = oi.presentacion?.factor > 0 ? oi.presentacion.factor : 1;
              // Pendiente del ítem, convertido a base para comparar.
              const pendienteBase = Math.max(((oi.cantidad ?? 0) - (oi.cantidadRecibida ?? 0)) * factor, 0);
              const aplicarBase = Math.min(restanteBase, pendienteBase);
              if (aplicarBase <= 0) return oi;
              recibidoPorArticulo.set(oi.articuloId, restanteBase - aplicarBase);
              touched = true;
              // `cantidadRecibida` se guarda en la MISMA unidad que `cantidad`
              // del ítem (envases), para que la OC se lea coherente.
              return { ...oi, cantidadRecibida: (oi.cantidadRecibida ?? 0) + aplicarBase / factor };
            });
            if (touched) {
              const completa = newItems.every((oi: any) => (oi.cantidadRecibida ?? 0) >= (oi.cantidad ?? 0));
              const fechaRecepcion = new Date().toISOString();
              await ordenesCompraService.update(ocDoc.id, {
                items: newItems,
                // fechaRecepcion faltaba en este camino (el visor de entregas y
                // la calificación la necesitan) — se estampa al completar (2026-08-12).
                ...(completa ? { estado: 'recibida' as const, fechaRecepcion } : {}),
              });
              console.log(`[useStockIntake] OC ${ocDoc.numero} reconciliada${completa ? ' → recibida' : ' (parcial)'}`);

              // Calificación pendiente del proveedor (best-effort, idempotente
              // por origenKey — una por OC completa, 2026-08-12).
              if (completa) {
                const { calificacionesService } = await import('../services/calificacionesService');
                await calificacionesService.crearPendienteDesdeOC({
                  ...ocDoc, items: newItems, fechaRecepcion,
                }).catch((e: unknown) => console.warn('[useStockIntake] calificación pendiente falló:', e));
              }

              // Cerrar los requerimientos cuyos items de OC quedaron completos.
              await Promise.all(newItems
                .filter((oi: any) => oi.requerimientoId && (oi.cantidadRecibida ?? 0) >= (oi.cantidad ?? 0))
                .map((oi: any) => requerimientosService.update(oi.requerimientoId, { estado: 'comprado' })
                  .catch((e: unknown) => console.warn(`[useStockIntake] no se pudo cerrar req ${oi.requerimientoId}:`, e))));
            }
          }
        } catch (ocErr) {
          console.warn('[useStockIntake] ingreso OK, falló la reconciliación de la OC:', ocErr);
        }
      }

      // ── Auto-reserva post-ingreso (UAT 2026-07-16): si hay presupuestos aceptados
      // esperando este artículo (requerimientos vinculados a ppto), reservar lo que
      // les falta con el stock recién ingresado. El cálculo de pendiente adentro
      // evita sobre-reservar. Best-effort.
      try {
        const articuloIds = [...new Set(items.map(it => it.articulo.id))];
        for (const articuloId of articuloIds) {
          const reqsArticulo = await requerimientosService.getByArticulo(articuloId).catch(() => []);
          const pptoIds = [...new Set(
            reqsArticulo
              .filter(r => r.presupuestoId && r.estado !== 'cancelado')
              .map(r => r.presupuestoId as string),
          )];
          for (const pptoId of pptoIds) {
            await reservasService.reservarPendientesParaPresupuesto({
              presupuestoId: pptoId,
              articuloId,
              solicitadoPorNombre: creadoPor,
            }).catch(e => console.warn(`[useStockIntake] auto-reserva ppto ${pptoId} falló:`, e));
          }
        }
      } catch (resErr) {
        console.warn('[useStockIntake] ingreso OK, falló la auto-reserva post-ingreso:', resErr);
      }

      // Re-contrastar requerimientos por mínimo con el stock recién ingresado
      // (cancela los automáticos cuya falta quedó cubierta). Best-effort.
      void sweepStockMinimoRequerimientos({ force: true }).catch(err =>
        console.warn('[useStockIntake] re-contraste de requerimientos falló:', err));

      onCreated();
      onClose();
    } catch (e) {
      console.error('[useStockIntake] error al guardar ingreso:', e);
      setError('Error al guardar el ingreso de stock.');
    } finally {
      setSaving(false);
    }
  };

  return {
    proveedores, proveedorId, setProveedorId, articulos,
    items, removeItem, updateItem, ubicOptionsPorArticulo, ubicOptionsBase, totalUnidades,
    draft, draftUbic, startArticulo, patchDraft, cancelDraft, advance,
    finalizing, setFinalizing, ocNumero, setOcNumero, despachoNumero, setDespachoNumero,
    saving, error, confirmFinalize,
  };
}
