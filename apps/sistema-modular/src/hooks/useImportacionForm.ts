import { useState, useEffect, useCallback } from 'react';
import { importacionesService, ordenesCompraService, articulosService, agentesCargaService } from '../services/firebaseService';
import type { AgenteCarga } from '../services/agentesCargaService';
import { cotizacionesService, type CotizacionDolar } from '../services/cotizacionesService';
import { deepCleanForFirestore } from '../services/firebase';
import { CONCEPTOS_GASTO_IMPORTACION, derivarEstadoImportacion } from '@ags/shared';
import type { Importacion, OrdenCompra, ItemImportacion, GastoImportacion, Articulo, ItemOC } from '@ags/shared';

type Moneda = 'ARS' | 'USD' | 'EUR';

export interface ImportacionPrefill {
  ordenCompraId: string;
  ordenCompraNumero: string;
  proveedorId?: string | null;
  proveedorNombre?: string | null;
  moneda?: Moneda | null;
  incoterm?: string | null;
  items?: ItemOC[];
}

const uuid = () => crypto.randomUUID();

/** Convierte ItemOC[] → ItemImportacion[] (todo el embarque por defecto). */
const itemsFromOC = (items: ItemOC[], ocMoneda: Moneda): ItemImportacion[] =>
  items.map(io => ({
    id: uuid(), itemOCId: io.id, articuloId: io.articuloId ?? null, articuloCodigo: io.articuloCodigo ?? null,
    descripcion: io.descripcion, cantidadPedida: io.cantidad, cantidadRecibida: null,
    unidadMedida: io.unidadMedida, precioUnitario: io.precioUnitario ?? null,
    moneda: (io.moneda ?? ocMoneda) as Moneda, requerimientoId: io.requerimientoId ?? null,
  }));

/** Gastos precargados: todos en la moneda de la importación (USD por defecto). */
const gastosPrecargados = (ocMoneda: Moneda): GastoImportacion[] =>
  CONCEPTOS_GASTO_IMPORTACION.map(c => ({
    id: uuid(), concepto: c.key, descripcion: c.label, monto: 0,
    moneda: ocMoneda, fecha: null, comprobante: null,
  }));

export function useImportacionForm(impId: string | null, open: boolean, prefill?: ImportacionPrefill) {
  const isEdit = !!impId;
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imp, setImp] = useState<Importacion | null>(null);
  const [ocOptions, setOcOptions] = useState<OrdenCompra[]>([]);
  const [articulosById, setArticulosById] = useState<Map<string, Articulo>>(new Map());
  const [agentes, setAgentes] = useState<AgenteCarga[]>([]);
  const [tcInfo, setTcInfo] = useState<CotizacionDolar | null>(null);
  const [tcError, setTcError] = useState(false);
  const [paseSugerido, setPaseSugerido] = useState<number | null>(null);

  const [ordenCompraId, setOrdenCompraId] = useState('');
  const [ordenCompraNumero, setOrdenCompraNumero] = useState('');
  const [proveedorId, setProveedorId] = useState('');
  const [proveedorNombre, setProveedorNombre] = useState('');
  const [monedaOC, setMonedaOC] = useState<Moneda>('USD');
  const [form, setForm] = useState({
    fechaEmbarque: '', fechaEstimadaArribo: '', incoterm: '', agenteCarga: '',
    numeroGuia: '', despachoNumero: '', fechaRecepcion: '', tipoCambio: '' as string, paseEurUsd: '' as string,
    fleteDeclarado: '' as string, seguroDeclarado: '' as string,
    vepNumero: '', vepMonto: '' as string, vepMoneda: 'ARS' as Moneda, vepFechaPago: '',
    giroMonto: '' as string, giroMoneda: 'USD' as Moneda, giroFechaEstimada: '', giroPagado: false, anticipoPct: '' as string,
    notas: '',
  });
  const [gastos, setGastos] = useState<GastoImportacion[]>([]);
  const [items, setItems] = useState<ItemImportacion[]>([]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(prev => ({ ...prev, [k]: v }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [arts, ags] = await Promise.all([
        articulosService.getAll().catch(() => [] as Articulo[]),
        agentesCargaService.getAll().catch(() => [] as AgenteCarga[]),
      ]);
      setArticulosById(new Map(arts.map(a => [a.id, a])));
      setAgentes(ags);

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
            incoterm: data.incoterm ?? '', agenteCarga: data.agenteCarga ?? '',
            numeroGuia: data.numeroGuia ?? '', despachoNumero: data.despachoNumero ?? '',
            fechaRecepcion: (data.fechaRecepcion ?? '').slice(0, 10),
            tipoCambio: data.tipoCambio != null ? String(data.tipoCambio) : '',
            paseEurUsd: data.paseEurUsd != null ? String(data.paseEurUsd) : '',
            fleteDeclarado: data.fleteDeclarado != null ? String(data.fleteDeclarado) : '',
            seguroDeclarado: data.seguroDeclarado != null ? String(data.seguroDeclarado) : '',
            vepNumero: data.vepNumero ?? '', vepMonto: data.vepMonto != null ? String(data.vepMonto) : '',
            vepMoneda: (data.vepMoneda ?? 'ARS') as Moneda, vepFechaPago: (data.vepFechaPago ?? '').slice(0, 10),
            giroMonto: data.giroMonto != null ? String(data.giroMonto) : '',
            giroMoneda: (data.giroMoneda ?? data.items?.[0]?.moneda ?? 'USD') as Moneda,
            giroFechaEstimada: (data.giroFechaEstimada ?? '').slice(0, 10),
            giroPagado: data.giroPagado === true,
            anticipoPct: data.anticipoPct != null ? String(data.anticipoPct) : '',
            notas: data.notas ?? '',
          });
          setGastos(data.gastos?.length ? data.gastos : gastosPrecargados('USD'));
          setItems(data.items ?? []);
        }
      } else {
        // Nueva: prefill desde OC (o vacío) + gastos precargados.
        setImp(null);
        if (prefill) {
          const m = (prefill.moneda ?? 'USD') as Moneda;
          setOrdenCompraId(prefill.ordenCompraId); setOrdenCompraNumero(prefill.ordenCompraNumero);
          setProveedorId(prefill.proveedorId ?? ''); setProveedorNombre(prefill.proveedorNombre ?? '');
          setMonedaOC(m);
          setForm(prev => ({ ...prev, incoterm: prefill.incoterm ?? '', giroMoneda: m }));
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
        : (prefill?.moneda === 'EUR');
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
  }, [impId, prefill]);

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
      // Si el embarque es en euros y hay sugerencia de pase, precargarla (si está vacío).
      paseEurUsd: m === 'EUR' && !prev.paseEurUsd && paseSugerido ? paseSugerido.toFixed(4) : prev.paseEurUsd,
    }));
    setItems(itemsFromOC(oc.items ?? [], m));
    setGastos(prev => prev.some(g => g.monto > 0) ? prev : gastosPrecargados(m));
  };

  const crearAgente = async (nombre: string) => {
    const n = nombre.trim();
    if (!n) return;
    try {
      await agentesCargaService.create(n);
      setAgentes(await agentesCargaService.getAll());
      setForm(prev => ({ ...prev, agenteCarga: n }));
    } catch (err) { console.error('Error creando agente de carga:', err); }
  };

  const addGasto = () => setGastos(prev => [...prev, { id: uuid(), concepto: '', descripcion: '', monto: 0, moneda: monedaOC, fecha: null, comprobante: null }]);
  const updateGasto = (id: string, patch: Partial<GastoImportacion>) =>
    setGastos(prev => prev.map(g => g.id === id ? { ...g, ...patch } : g));
  const removeGasto = (id: string) => setGastos(prev => prev.filter(g => g.id !== id));

  const save = useCallback(async (costoTotalARS: number | null, factorEmbarque?: number | null): Promise<string | null> => {
    if (!ordenCompraId) { alert('Seleccioná una orden de compra'); return null; }
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
        fechaRecepcion: form.fechaRecepcion || null,
        incoterm: form.incoterm || null, agenteCarga: form.agenteCarga || null,
        numeroGuia: form.numeroGuia || null, despachoNumero: form.despachoNumero || null,
        tipoCambio: form.tipoCambio ? Number(form.tipoCambio) : null,
        paseEurUsd: form.paseEurUsd ? Number(form.paseEurUsd) : null,
        fleteDeclarado: form.fleteDeclarado ? Number(form.fleteDeclarado) : null,
        seguroDeclarado: form.seguroDeclarado ? Number(form.seguroDeclarado) : null,
        factorEmbarque: factorEmbarque ?? null,
        vepNumero: form.vepNumero || null, vepMonto: form.vepMonto ? Number(form.vepMonto) : null,
        vepMoneda: form.vepMoneda, vepFechaPago: form.vepFechaPago || null,
        giroMonto: form.giroMonto ? Number(form.giroMonto) : null,
        giroMoneda: form.giroMoneda, giroFechaEstimada: form.giroFechaEstimada || null,
        giroPagado: form.giroPagado,
        anticipoPct: form.anticipoPct ? Number(form.anticipoPct) : null,
        notas: form.notas || null,
        gastos, items: items.length ? items : null,
        costoTotalARS,
      });
      if (isEdit && impId) {
        await importacionesService.update(impId, payload as Partial<Importacion>);
        return impId;
      }
      const id = await importacionesService.create({ estado: 'preparacion', documentos: [], ...payload } as any);
      // Crear la importación pasa la OC a 'embarcada' (salvo recibida/cancelada).
      try {
        const oc = await ordenesCompraService.getById(ordenCompraId);
        if (oc && oc.estado !== 'recibida' && oc.estado !== 'cancelada') {
          await ordenesCompraService.update(ordenCompraId, { estado: 'embarcada' });
        }
      } catch (err) { console.error('[useImportacionForm] no se pudo marcar OC embarcada:', err); }
      return id;
    } catch (err) {
      console.error('Error guardando importación:', err);
      alert('Error al guardar la importación');
      return null;
    } finally {
      setSaving(false);
    }
  }, [ordenCompraId, ordenCompraNumero, proveedorId, proveedorNombre, form, gastos, items, isEdit, impId, imp]);

  return {
    loading, saving, imp, ocOptions, articulosById, agentes, crearAgente,
    tcInfo, tcError, fetchTC,
    paseSugerido, fetchPase,
    ordenCompraId, ordenCompraNumero, proveedorNombre, monedaOC,
    form, set, selectOC,
    gastos, addGasto, updateGasto, removeGasto, items,
    save, reload: load,
  };
}
