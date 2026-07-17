import { useState, useEffect, useMemo } from 'react';
import {
  articulosService, unidadesService, movimientosService,
  posicionesStockService, minikitsService, ingenierosService, proveedoresService,
  ordenesCompraService, requerimientosService,
} from '../services/firebaseService';
import { reservasService } from '../services/stockService';
import type {
  Articulo, CondicionUnidad, Proveedor, PosicionStock, Minikit, Ingeniero,
  TipoOrigenDestino, UnidadStock, MovimientoStock,
} from '@ags/shared';

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
  cantidad: number;
  condicion: CondicionUnidad;
  ubicacion: { tipo: TipoOrigenDestino; id: string; nombre: string } | null;
  series: string[];
  serieInput: string;
  lote: string;
}

export interface IntakeItem {
  key: string;
  articulo: Articulo;
  cantidad: number;
  condicion: CondicionUnidad;
  ubicacion: { tipo: TipoOrigenDestino; id: string; nombre: string };
  series: string[];
  lote: string;
}

let _seq = 0;

export function useStockIntake(
  open: boolean,
  onClose: () => void,
  onCreated: () => void,
  creadoPor: string = 'Admin',
  /** Recepción desde una OC: precarga proveedor y N° de OC (UAT 2026-07-16). */
  preset?: { proveedorId?: string; ocNumero?: string },
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
    Promise.all([
      proveedoresService.getAll(), articulosService.getAll({ activoOnly: true }),
      posicionesStockService.getAll(), minikitsService.getAll(), ingenierosService.getAll(),
    ]).then(([prov, arts, pos, mk, ing]) => {
      setProveedores(prov); setArticulos(arts); setPosiciones(pos); setMinikits(mk); setIngenieros(ing);
    });
  }, [open]);

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

  const startArticulo = async (articulo: Articulo) => {
    setError('');
    setDraft({
      articulo, step: 'cantidad', cantidad: 1, condicion: 'nuevo',
      ubicacion: null, series: [], serieInput: '', lote: '',
    });
    const [unidades, movs] = await Promise.all([
      unidadesService.getByArticulo(articulo.id),
      movimientosService.getAll({ articuloId: articulo.id }).catch(() => [] as MovimientoStock[]),
    ]);
    setDraftUbic(buildUbicOptions(unidades, movs));
  };

  const patchDraft = (p: Partial<Draft>) => setDraft(prev => (prev ? { ...prev, ...p } : prev));
  const cancelDraft = () => { setDraft(null); setDraftUbic([]); };

  const commitDraft = (d: Draft) => {
    const item: IntakeItem = {
      key: `i${++_seq}`,
      articulo: d.articulo, cantidad: d.cantidad, condicion: d.condicion,
      ubicacion: d.ubicacion!, series: d.series, lote: d.lote,
    };
    setItems(prev => [...prev, item]);
    setDraft(null); setDraftUbic([]);
  };

  // Avanza al siguiente paso del wizard (Enter en inputs de texto/num; selección en ubicación)
  const advance = (payload?: { ubic?: UbicOption }) => {
    if (!draft) return;
    const d = draft;
    const reqSerie = !!d.articulo.requiereNumeroSerie;
    const reqLote = !!d.articulo.requiereNumeroLote;

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
      if (d.series.includes(s)) { setError(`Serie repetida: ${s}`); return; }
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

  const removeItem = (key: string) => setItems(prev => prev.filter(i => i.key !== key));

  const totalUnidades = useMemo(() => items.reduce((acc, it) => acc + (it.articulo.requiereNumeroSerie ? it.series.length : it.cantidad), 0), [items]);

  const confirmFinalize = async () => {
    if (items.length === 0) { setError('Agregá al menos un artículo'); return; }
    setSaving(true); setError('');
    try {
      const prov = proveedores.find(p => p.id === proveedorId);
      const oc = ocNumero.trim() || null;
      const desp = despachoNumero.trim() || null;

      const units: Omit<UnidadStock, 'id' | 'createdAt' | 'updatedAt'>[] = [];
      for (const it of items) {
        const base = {
          articuloId: it.articulo.id, articuloCodigo: it.articulo.codigo, articuloDescripcion: it.articulo.descripcion,
          condicion: it.condicion, estado: 'disponible' as const,
          ubicacion: { tipo: it.ubicacion.tipo as any, referenciaId: it.ubicacion.id, referenciaNombre: it.ubicacion.nombre },
          costoUnitario: null, monedaCosto: null,
          ordenCompraNumero: oc, despachoImportacionNumero: desp,
          observaciones: null, activo: true,
        };
        if (it.articulo.requiereNumeroSerie) {
          for (const s of it.series) units.push({ ...base, nroSerie: s, nroLote: it.lote.trim() || null, cantidad: 1 });
        } else if (it.articulo.requiereNumeroLote) {
          units.push({ ...base, nroSerie: null, nroLote: it.lote.trim() || null, cantidad: it.cantidad });
        } else {
          units.push({ ...base, nroSerie: null, nroLote: null, cantidad: it.cantidad });
        }
      }
      const ids = await unidadesService.createMany(units);

      try {
        await Promise.all(ids.map((unidadId, i) => movimientosService.create({
          tipo: 'ingreso', unidadId,
          articuloId: units[i].articuloId, articuloCodigo: units[i].articuloCodigo, articuloDescripcion: units[i].articuloDescripcion,
          cantidad: units[i].cantidad ?? 1,
          origenTipo: 'proveedor', origenId: prov?.id ?? '', origenNombre: prov?.nombre ?? 'Ingreso manual',
          destinoTipo: units[i].ubicacion.tipo as TipoOrigenDestino, destinoId: units[i].ubicacion.referenciaId, destinoNombre: units[i].ubicacion.referenciaNombre,
          remitoId: null, otNumber: null,
          ordenCompraNumero: oc, despachoImportacionNumero: desp,
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
            const recibidoPorArticulo = new Map<string, number>();
            for (const it of items) {
              const qty = it.articulo.requiereNumeroSerie ? it.series.length : it.cantidad;
              recibidoPorArticulo.set(it.articulo.id, (recibidoPorArticulo.get(it.articulo.id) ?? 0) + qty);
            }
            let touched = false;
            const newItems = (ocDoc.items ?? []).map((oi: any) => {
              if (!oi.articuloId) return oi;
              const restante = recibidoPorArticulo.get(oi.articuloId) ?? 0;
              if (restante <= 0) return oi;
              const pendiente = Math.max((oi.cantidad ?? 0) - (oi.cantidadRecibida ?? 0), 0);
              const aplicar = Math.min(restante, pendiente);
              if (aplicar <= 0) return oi;
              recibidoPorArticulo.set(oi.articuloId, restante - aplicar);
              touched = true;
              return { ...oi, cantidadRecibida: (oi.cantidadRecibida ?? 0) + aplicar };
            });
            if (touched) {
              const completa = newItems.every((oi: any) => (oi.cantidadRecibida ?? 0) >= (oi.cantidad ?? 0));
              await ordenesCompraService.update(ocDoc.id, {
                items: newItems,
                ...(completa ? { estado: 'recibida' as const } : {}),
              });
              console.log(`[useStockIntake] OC ${ocDoc.numero} reconciliada${completa ? ' → recibida' : ' (parcial)'}`);

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
    items, removeItem, totalUnidades,
    draft, draftUbic, startArticulo, patchDraft, cancelDraft, advance,
    finalizing, setFinalizing, ocNumero, setOcNumero, despachoNumero, setDespachoNumero,
    saving, error, confirmFinalize,
  };
}
