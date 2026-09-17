import { useState, useEffect, useCallback, useRef } from 'react';
import { importacionesService, ordenesCompraService, articulosService } from '../services/firebaseService';
import { proveedoresService } from '../services/personalService';
import { proveedorEsCategoria } from '@ags/shared';
import type { Proveedor } from '@ags/shared';
import { cotizacionesService, type CotizacionDolar } from '../services/cotizacionesService';
import { deepCleanForFirestore } from '../services/firebase';
import { onCacheInvalidated } from '../services/serviceCache';
import { CONCEPTOS_GASTO_IMPORTACION, derivarEstadoImportacion } from '@ags/shared';
import type { Importacion, OrdenCompra, ItemImportacion, GastoImportacion, Articulo, ItemOC } from '@ags/shared';

import { notify } from '../utils/notify';
type Moneda = 'ARS' | 'USD' | 'EUR';

export interface ImportacionPrefill {
  ordenCompraId: string;
  ordenCompraNumero: string;
  proveedorId?: string | null;
  proveedorNombre?: string | null;
  moneda?: Moneda | null;
  incoterm?: string | null;
  /** Flete y seguro acordados en la OC — prefill de los declarados (2026-08-24). */
  flete?: number | null;
  seguro?: number | null;
  items?: ItemOC[];
}

const uuid = () => crypto.randomUUID();

/** Hoy en formato date-input (YYYY-MM-DD, hora local). */
const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Convierte ItemOC[] → ItemImportacion[] (todo el embarque por defecto). */
const itemsFromOC = (items: ItemOC[], ocMoneda: Moneda): ItemImportacion[] =>
  items.map(io => ({
    id: uuid(), itemOCId: io.id, articuloId: io.articuloId ?? null, articuloCodigo: io.articuloCodigo ?? null,
    descripcion: io.descripcion, cantidadPedida: io.cantidad, cantidadRecibida: null,
    unidadMedida: io.unidadMedida, precioUnitario: io.precioUnitario ?? null,
    moneda: (io.moneda ?? ocMoneda) as Moneda, requerimientoId: io.requerimientoId ?? null,
    requerimientoIds: io.requerimientoIds ?? null,
    // Envase de la OC (2026-09-16): cantidades y precio van en este envase.
    presentacion: io.presentacion ?? null,
  }));

/** Gastos precargados: todos en la moneda de la importación (USD por defecto). */
const gastosPrecargados = (ocMoneda: Moneda): GastoImportacion[] =>
  CONCEPTOS_GASTO_IMPORTACION.map(c => ({
    id: uuid(), concepto: c.key, descripcion: c.label, monto: 0,
    moneda: ocMoneda, fecha: null, comprobante: null,
  }));

export function useImportacionForm(impId: string | null, open: boolean, prefill?: ImportacionPrefill) {
  const isEdit = !!impId;
  // El prefill llega como objeto NUEVO en cada render del padre (OrdenCompraModal
  // lo arma inline): si fuera dependencia de `load`, cada re-render de la OC
  // volvía a cargar el form y pisaba lo que el usuario estaba escribiendo
  // (2026-09-16). Se lee por ref y `load` solo depende del id.
  const prefillRef = useRef(prefill);
  prefillRef.current = prefill;
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imp, setImp] = useState<Importacion | null>(null);
  const [ocOptions, setOcOptions] = useState<OrdenCompra[]>([]);
  const [articulosById, setArticulosById] = useState<Map<string, Articulo>>(new Map());
  // Agentes de carga y despachantes salen del catálogo de PROVEEDORES filtrado
  // por categoría (2026-08-07): son proveedores como cualquier otro y así
  // entran al circuito de calificación. Antes vivían en la colección suelta
  // `agentesCarga` y los despachantes en una lista fija en el código.
  const [proveedoresCat, setProveedoresCat] = useState<Proveedor[]>([]);
  const agentes = proveedoresCat.filter(p => proveedorEsCategoria(p, 'agente_carga'));
  const despachantes = proveedoresCat.filter(p => proveedorEsCategoria(p, 'despachante'));
  const [tcInfo, setTcInfo] = useState<CotizacionDolar | null>(null);
  const [tcError, setTcError] = useState(false);
  const [paseSugerido, setPaseSugerido] = useState<number | null>(null);

  const [ordenCompraId, setOrdenCompraId] = useState('');
  const [ordenCompraNumero, setOrdenCompraNumero] = useState('');
  const [proveedorId, setProveedorId] = useState('');
  const [proveedorNombre, setProveedorNombre] = useState('');
  const [monedaOC, setMonedaOC] = useState<Moneda>('USD');
  const [form, setForm] = useState({
    fechaEmbarque: '', fechaEstimadaArribo: '', fechaArriboReal: '', incoterm: '', agenteCarga: '',
    numeroGuia: '', despachoNumero: '', fechaDespacho: '', fechaRecepcion: '', tipoCambio: '' as string, paseEurUsd: '' as string,
    fleteDeclarado: '' as string, seguroDeclarado: '' as string,
    // Moneda propia del flete/seguro de la guía (2026-09-01): vacío = la del embarque.
    monedaFleteDeclarado: '' as '' | Moneda, monedaSeguroDeclarado: '' as '' | Moneda,
    vepNumero: '', vepMonto: '' as string, vepMoneda: 'ARS' as Moneda, vepFechaPago: '', vepPagado: false,
    giroMonto: '' as string, giroMoneda: 'USD' as Moneda, giroFechaEstimada: '', giroPagado: false, anticipoPct: '' as string,
    esCourier: false, despachante: '',
    // Según despacho (2026-09-16), en USD.
    derechosDespacho: '' as string, estadisticaDespacho: '' as string, motivoAjusteDespacho: '',
    notas: '',
  });
  const [gastos, setGastos] = useState<GastoImportacion[]>([]);
  const [items, setItems] = useState<ItemImportacion[]>([]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(prev => ({ ...prev, [k]: v }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [arts, provs] = await Promise.all([
        articulosService.getAll().catch(() => [] as Articulo[]),
        proveedoresService.getAll(true).catch(() => [] as Proveedor[]),
      ]);
      setArticulosById(new Map(arts.map(a => [a.id, a])));
      setProveedoresCat(provs);

      if (impId) {
        const data = await importacionesService.getById(impId);
        if (data) {
          setImp(data);
          setOrdenCompraId(data.ordenCompraId); setOrdenCompraNumero(data.ordenCompraNumero);
          setProveedorId(data.proveedorId); setProveedorNombre(data.proveedorNombre);
          setMonedaOC((data.items?.[0]?.moneda ?? 'USD') as Moneda);
          setForm({
            fechaEmbarque: (data.fechaEmbarque ?? '').slice(0, 10),
            fechaEstimadaArribo: (data.fechaEstimadaArribo ?? '').slice(0, 10),
            fechaArriboReal: (data.fechaArriboReal ?? '').slice(0, 10),
            incoterm: data.incoterm ?? '', agenteCarga: data.agenteCarga ?? '',
            numeroGuia: data.numeroGuia ?? '', despachoNumero: data.despachoNumero ?? '',
            fechaDespacho: (data.fechaDespacho ?? '').slice(0, 10),
            fechaRecepcion: (data.fechaRecepcion ?? '').slice(0, 10),
            tipoCambio: data.tipoCambio != null ? String(data.tipoCambio) : '',
            paseEurUsd: data.paseEurUsd != null ? String(data.paseEurUsd) : '',
            fleteDeclarado: data.fleteDeclarado != null ? String(data.fleteDeclarado) : '',
            seguroDeclarado: data.seguroDeclarado != null ? String(data.seguroDeclarado) : '',
            monedaFleteDeclarado: (data.monedaFleteDeclarado ?? '') as '' | Moneda,
            monedaSeguroDeclarado: (data.monedaSeguroDeclarado ?? '') as '' | Moneda,
            vepNumero: data.vepNumero ?? '', vepMonto: data.vepMonto != null ? String(data.vepMonto) : '',
            vepMoneda: (data.vepMoneda ?? 'ARS') as Moneda, vepFechaPago: (data.vepFechaPago ?? '').slice(0, 10),
            vepPagado: data.vepPagado === true,
            giroMonto: data.giroMonto != null ? String(data.giroMonto) : '',
            giroMoneda: (data.giroMoneda ?? data.items?.[0]?.moneda ?? 'USD') as Moneda,
            giroFechaEstimada: (data.giroFechaEstimada ?? '').slice(0, 10),
            giroPagado: data.giroPagado === true,
            anticipoPct: data.anticipoPct != null ? String(data.anticipoPct) : '',
            esCourier: data.esCourier === true,
            despachante: data.despachante ?? '',
            derechosDespacho: data.derechosDespacho != null ? String(data.derechosDespacho) : '',
            estadisticaDespacho: data.estadisticaDespacho != null ? String(data.estadisticaDespacho) : '',
            motivoAjusteDespacho: data.motivoAjusteDespacho ?? '',
            notas: data.notas ?? '',
          });
          setGastos(data.gastos?.length ? data.gastos : gastosPrecargados('USD'));
          setItems(data.items ?? []);
        }
      } else {
        // Nueva: prefill desde OC (o vacío) + gastos precargados.
        setImp(null);
        const prefill = prefillRef.current;
        if (prefill) {
          const m = (prefill.moneda ?? 'USD') as Moneda;
          setOrdenCompraId(prefill.ordenCompraId); setOrdenCompraNumero(prefill.ordenCompraNumero);
          setProveedorId(prefill.proveedorId ?? ''); setProveedorNombre(prefill.proveedorNombre ?? '');
          setMonedaOC(m);
          setForm(prev => ({
            ...prev,
            incoterm: prefill.incoterm ?? '',
            giroMoneda: m,
            fleteDeclarado: prefill.flete != null ? String(prefill.flete) : prev.fleteDeclarado,
            seguroDeclarado: prefill.seguro != null ? String(prefill.seguro) : prev.seguroDeclarado,
          }));
          setItems(prefill.items?.length ? itemsFromOC(prefill.items, m) : []);
          setGastos(gastosPrecargados(m));
        } else {
          const ocs = await ordenesCompraService.getAll({ tipo: 'importacion' }).catch(() => [] as OrdenCompra[]);
          setOcOptions(ocs);
          setGastos(gastosPrecargados('USD'));
        }
      }
      // Tipo de cambio mayorista comprador (BNA / Com. A 3500) automático.
      // Autocompleta el TC solo si está vacío (no pisa lo guardado ni lo manual).
      const cot = await cotizacionesService.mayorista();
      if (cot) {
        setTcInfo(cot); setTcError(false);
        setForm(prev => prev.tipoCambio ? prev : { ...prev, tipoCambio: String(cot.compra) });
      } else {
        setTcError(true);
      }
      // Pase EUR/USD sugerido. Sólo autocompleta el campo si el embarque es en euros.
      const embarqueEsEur = impId
        ? false /* se resuelve en el effect de monedaOC más abajo si hace falta */
        : (prefillRef.current?.moneda === 'EUR');
      const pase = await cotizacionesService.paseEurUsd();
      if (pase) {
        setPaseSugerido(pase);
        if (embarqueEsEur) {
          setForm(prev => prev.paseEurUsd ? prev : { ...prev, paseEurUsd: pase.toFixed(4) });
        }
      }
    } finally {
      setLoading(false);
    }
  }, [impId]);

  /**
   * Refresca SOLO el documento guardado (y, a pedido, los ítems) sin tocar el
   * form ni los gastos (2026-09-16). Adjuntar un PDF desde el modal llamaba a
   * `load()` entero y re-inicializaba el form desde el servidor: todo lo
   * escrito y todavía no guardado (despacho, guía, VEP, giro…) desaparecía.
   * Los ítems sí se refrescan tras ingresar stock, porque ahí cambió lo
   * recibido en el servidor y un guardado posterior lo pisaría.
   */
  const refrescarImp = useCallback(async (opts?: { items?: boolean }) => {
    if (!impId) return;
    const data = await importacionesService.getById(impId).catch(() => null);
    if (!data) return;
    setImp(data);
    if (opts?.items) setItems(data.items ?? []);
  }, [impId]);

  const fetchTC = async () => {
    const cot = await cotizacionesService.mayorista();
    if (cot) { setTcInfo(cot); setTcError(false); setForm(prev => ({ ...prev, tipoCambio: String(cot.compra) })); }
    else setTcError(true);
  };

  const fetchPase = async () => {
    const pase = await cotizacionesService.paseEurUsd();
    if (pase) { setPaseSugerido(pase); setForm(prev => ({ ...prev, paseEurUsd: pase.toFixed(4) })); }
  };

  useEffect(() => { if (open) load(); }, [open, load]);

  // Catálogo de artículos vivo mientras el modal está abierto (2026-09-16): al
  // guardar un artículo (posición arancelaria, descripción) desde otra pestaña
  // se vuelven a leer los artículos, sin tocar el form. Antes esto pasaba por
  // accidente porque el modal se recargaba entero con cualquier re-render.
  useEffect(() => {
    if (!open) return;
    return onCacheInvalidated(prefix => {
      if (!prefix.startsWith('articulos')) return;
      articulosService.getAll()
        .then(arts => setArticulosById(new Map(arts.map(a => [a.id, a]))))
        .catch(err => console.warn('[useImportacionForm] refresco de artículos falló:', err));
    });
  }, [open]);

  const selectOC = (ocId: string) => {
    const oc = ocOptions.find(o => o.id === ocId);
    if (!oc) { setOrdenCompraId(''); setOrdenCompraNumero(''); return; }
    const m = (oc.moneda ?? 'USD') as Moneda;
    setOrdenCompraId(oc.id); setOrdenCompraNumero(oc.numero);
    setProveedorId(oc.proveedorId); setProveedorNombre(oc.proveedorNombre);
    setMonedaOC(m);
    setForm(prev => ({
      ...prev,
      incoterm: prev.incoterm || (oc.incoterm ?? ''),
      giroMoneda: m,
      // Flete y seguro acordados en la OC → declarados. Igual que el incoterm,
      // es un PREFILL: si el usuario ya escribió algo, no se pisa. Lo que la
      // guía diga después manda, y se corrige acá sin tocar la OC (2026-08-24).
      fleteDeclarado: prev.fleteDeclarado || (oc.flete != null ? String(oc.flete) : ''),
      seguroDeclarado: prev.seguroDeclarado || (oc.seguro != null ? String(oc.seguro) : ''),
      // Si el embarque es en euros y hay sugerencia de pase, precargarla (si está vacío).
      paseEurUsd: m === 'EUR' && !prev.paseEurUsd && paseSugerido ? paseSugerido.toFixed(4) : prev.paseEurUsd,
    }));
    setItems(itemsFromOC(oc.items ?? [], m));
    setGastos(prev => prev.some(g => g.monto > 0) ? prev : gastosPrecargados(m));
  };

  /**
   * Alta rápida de un proveedor con la categoría correspondiente y selección
   * inmediata. Si ya existe uno con ese nombre, solo le agrega la categoría.
   */
  const crearProveedorCategoria = async (nombre: string, categoria: 'agente_carga' | 'despachante') => {
    const n = nombre.trim();
    if (!n) return;
    try {
      const existente = proveedoresCat.find(p => p.nombre.trim().toLowerCase() === n.toLowerCase());
      if (existente) {
        if (!proveedorEsCategoria(existente, categoria)) {
          await proveedoresService.update(existente.id, {
            categorias: [...(existente.categorias ?? []), categoria],
          });
        }
      } else {
        await proveedoresService.create({
          nombre: n, tipo: 'nacional', categorias: [categoria], activo: true,
        } as Omit<Proveedor, 'id' | 'createdAt' | 'updatedAt'>);
      }
      setProveedoresCat(await proveedoresService.getAll(true));
      setForm(prev => ({ ...prev, [categoria === 'agente_carga' ? 'agenteCarga' : 'despachante']: n }));
    } catch (err) { console.error(`Error creando proveedor (${categoria}):`, err); }
  };
  const crearAgente = (nombre: string) => crearProveedorCategoria(nombre, 'agente_carga');

  /**
   * Vuelve a tomar los valores de la OC (2026-09-16, caso JAS045: un artículo
   * sin precio al crear la impo, cargado en la OC después). Los ítems ya
   * existentes se emparejan por `itemOCId` y actualizan precio, moneda,
   * cantidad pedida, descripción y código; conservan lo recibido. Los ítems
   * nuevos de la OC se agregan; los que ya no están en la OC se conservan.
   * Solo toca el form: hay que Guardar para que impacte.
   */
  const actualizarDesdeOC = useCallback(async (): Promise<{ actualizados: number; agregados: number } | null> => {
    if (!ordenCompraId) { notify.warning('La importación no tiene orden de compra vinculada'); return null; }
    const oc = await ordenesCompraService.getById(ordenCompraId).catch(() => null);
    if (!oc) { notify.error('No se pudo leer la orden de compra'); return null; }
    const m = (oc.moneda ?? monedaOC) as Moneda;
    const nuevos = itemsFromOC(oc.items ?? [], m);
    // Se calcula sobre el estado actual (no dentro del updater): los contadores
    // se devuelven al caller y un updater corre después, fuera de este turno.
    let actualizados = 0, agregados = 0;
    {
      const prev = items;
      const porOC = new Map(prev.map(it => [it.itemOCId, it]));
      const out = prev.map(it => {
        const n = nuevos.find(x => x.itemOCId === it.itemOCId);
        if (!n) return it;
        const cambia = n.precioUnitario !== (it.precioUnitario ?? null) || n.moneda !== it.moneda
          || n.cantidadPedida !== it.cantidadPedida || n.descripcion !== it.descripcion || (n.articuloCodigo ?? null) !== (it.articuloCodigo ?? null)
          || (n.presentacion?.codigoParte ?? null) !== (it.presentacion?.codigoParte ?? null) || (n.presentacion?.factor ?? null) !== (it.presentacion?.factor ?? null);
        if (!cambia) return it;
        actualizados++;
        return { ...it, precioUnitario: n.precioUnitario, moneda: n.moneda, cantidadPedida: n.cantidadPedida,
          descripcion: n.descripcion, articuloId: n.articuloId, articuloCodigo: n.articuloCodigo,
          requerimientoId: n.requerimientoId, requerimientoIds: n.requerimientoIds, presentacion: n.presentacion ?? null };
      });
      for (const n of nuevos) if (!porOC.has(n.itemOCId)) { out.push(n); agregados++; }
      setItems(out);
    }
    setMonedaOC(m);
    return { actualizados, agregados };
  }, [ordenCompraId, monedaOC, items]);

  const addGasto = () => setGastos(prev => [...prev, { id: uuid(), concepto: '', descripcion: '', monto: 0, moneda: monedaOC, fecha: null, comprobante: null }]);
  const updateGasto = (id: string, patch: Partial<GastoImportacion>) =>
    setGastos(prev => prev.map(g => g.id === id ? { ...g, ...patch } : g));
  const removeGasto = (id: string) => setGastos(prev => prev.filter(g => g.id !== id));

  const save = useCallback(async (costoTotalARS: number | null, factorEmbarque?: number | null): Promise<string | null> => {
    if (!ordenCompraId) { notify.warning('Seleccioná una orden de compra'); return null; }
    setSaving(true);
    try {
      // Estado automático derivado de los datos cargados (embarque+guía → embarcada;
      // despacho → oficializada; recepción → recibida). Forward-only.
      const estado = derivarEstadoImportacion(
        {
          fechaEmbarque: form.fechaEmbarque || null,
          numeroGuia: form.numeroGuia || null,
          despachoNumero: form.despachoNumero || null,
          fechaRecepcion: form.fechaRecepcion || null,
          stockIngresado: imp?.stockIngresado ?? null,
        },
        imp?.estado ?? 'preparacion',
      );
      const payload = deepCleanForFirestore({
        ordenCompraId, ordenCompraNumero,
        proveedorId: proveedorId || null, proveedorNombre: proveedorNombre || null,
        estado,
        fechaEmbarque: form.fechaEmbarque || null,
        fechaEstimadaArribo: form.fechaEstimadaArribo || null,
        fechaArriboReal: form.fechaArriboReal || null,
        fechaDespacho: form.fechaDespacho || null,
        fechaRecepcion: form.fechaRecepcion || null,
        incoterm: form.incoterm || null, agenteCarga: form.agenteCarga || null,
        numeroGuia: form.numeroGuia || null, despachoNumero: form.despachoNumero || null,
        tipoCambio: form.tipoCambio ? Number(form.tipoCambio) : null,
        paseEurUsd: form.paseEurUsd ? Number(form.paseEurUsd) : null,
        fleteDeclarado: form.fleteDeclarado ? Number(form.fleteDeclarado) : null,
        seguroDeclarado: form.seguroDeclarado ? Number(form.seguroDeclarado) : null,
        monedaFleteDeclarado: form.monedaFleteDeclarado || null,
        monedaSeguroDeclarado: form.monedaSeguroDeclarado || null,
        factorEmbarque: factorEmbarque ?? null,
        vepNumero: form.vepNumero || null, vepMonto: form.vepMonto ? Number(form.vepMonto) : null,
        vepMoneda: form.vepMoneda, vepFechaPago: form.vepFechaPago || null,
        vepPagado: form.vepPagado,
        // Fecha efectiva: se estampa al CONFIRMAR (hoy) y se conserva la original
        // en ediciones posteriores; desmarcar la borra.
        vepFechaPagado: form.vepPagado ? ((imp?.vepFechaPagado ?? '').slice(0, 10) || hoyISO()) : null,
        giroMonto: form.giroMonto ? Number(form.giroMonto) : null,
        giroMoneda: form.giroMoneda, giroFechaEstimada: form.giroFechaEstimada || null,
        giroPagado: form.giroPagado,
        giroFechaPagado: form.giroPagado ? ((imp?.giroFechaPagado ?? '').slice(0, 10) || hoyISO()) : null,
        anticipoPct: form.anticipoPct ? Number(form.anticipoPct) : null,
        esCourier: form.esCourier,
        despachante: form.despachante || null,
        derechosDespacho: form.derechosDespacho ? Number(form.derechosDespacho) : null,
        estadisticaDespacho: form.estadisticaDespacho ? Number(form.estadisticaDespacho) : null,
        motivoAjusteDespacho: form.motivoAjusteDespacho.trim() || null,
        notas: form.notas || null,
        gastos, items: items.length ? items : null,
        costoTotalARS,
      });
      if (isEdit && impId) {
        await importacionesService.update(impId, payload as Partial<Importacion>);
        return impId;
      }
      // La OC ya NO se fuerza a 'embarcada' acá (2026-08-25): el servicio la
      // sincroniza con el estado real de la impo — en preparación queda enviada.
      const id = await importacionesService.create({ estado: 'preparacion', documentos: [], ...payload } as any);
      return id;
    } catch (err) {
      console.error('Error guardando importación:', err);
      notify.error('Error al guardar la importación');
      return null;
    } finally {
      setSaving(false);
    }
  }, [ordenCompraId, ordenCompraNumero, proveedorId, proveedorNombre, form, gastos, items, isEdit, impId, imp]);

  return {
    loading, saving, imp, ocOptions, articulosById,
    agentes, despachantes, crearAgente, crearProveedorCategoria,
    tcInfo, tcError, fetchTC,
    paseSugerido, fetchPase,
    ordenCompraId, ordenCompraNumero, proveedorNombre, monedaOC,
    form, set, selectOC,
    gastos, addGasto, updateGasto, removeGasto, items,
    save, reload: load, refrescarImp, actualizarDesdeOC,
  };
}
