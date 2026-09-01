import { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { derivarEstadoImportacion, ESTADO_IMPORTACION_LABELS, ESTADO_IMPORTACION_COLORS } from '@ags/shared';
import { useImportacionForm, type ImportacionPrefill } from '../../hooks/useImportacionForm';
import { computeCosteoImportacion } from '../../utils/costeoImportacion';
import { ImportacionGastosEditor } from './ImportacionGastosEditor';
import { ImportacionCosteoPanel } from './ImportacionCosteoPanel';
import { ImportacionIngresarStockModal } from './ImportacionIngresarStockModal';
import { ImportacionDocumentosSection } from './ImportacionDocumentosSection';
import { resumenRecepcion } from '../../utils/importacionRecepcion';
import { useConfirm } from '../ui/ConfirmDialog';
import { importacionesService, unidadesService } from '../../services/firebaseService';

interface Props {
  open: boolean;
  impId: string | null;
  onClose: () => void;
  onSaved?: () => void;
  prefill?: ImportacionPrefill;
}

const INCOTERMS = ['FOB', 'CIF', 'EXW', 'FCA', 'DAP', 'CFR', 'DDP'];
const lbl = 'block text-[10px] font-mono uppercase tracking-wide text-slate-500 mb-0.5';
const ctrl = 'w-full text-xs border border-slate-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500';

export const ImportacionModal: React.FC<Props> = ({ open, impId, onClose, onSaved, prefill }) => {
  const navigate = useNavigate();
  const h = useImportacionForm(impId, open, prefill);
  const confirm = useConfirm();
  const [confirmandoCosteo, setConfirmandoCosteo] = useState(false);

  const costeo = useMemo(() => computeCosteoImportacion({
    items: h.items, articulosById: h.articulosById, gastos: h.gastos,
    monedaBase: h.monedaOC,
    fleteDeclarado: h.form.fleteDeclarado ? Number(h.form.fleteDeclarado) : 0,
    seguroDeclarado: h.form.seguroDeclarado ? Number(h.form.seguroDeclarado) : 0,
    monedaFlete: h.form.monedaFleteDeclarado || null,
    monedaSeguro: h.form.monedaSeguroDeclarado || null,
    tipoCambio: h.form.tipoCambio ? Number(h.form.tipoCambio) : null,
    paseEurUsd: h.form.paseEurUsd ? Number(h.form.paseEurUsd) : null,
    esCourier: h.form.esCourier,
  }), [h.items, h.articulosById, h.gastos, h.monedaOC, h.form.fleteDeclarado, h.form.seguroDeclarado,
    h.form.monedaFleteDeclarado, h.form.monedaSeguroDeclarado, h.form.tipoCambio, h.form.paseEurUsd, h.form.esCourier]);

  const handleSave = async () => {
    const id = await h.save(costeo.costoTotalARS, costeo.factorEmbarque);
    if (id) { onSaved?.(); onClose(); }
  };

  const selectAll = (e: React.FocusEvent<HTMLInputElement>) => e.target.select();
  // El pase EUR→USD se necesita si el embarque o algún gasto está en euros.
  const necesitaPase = h.monedaOC === 'EUR' || h.gastos.some(g => g.moneda === 'EUR');

  // Estado automático en vivo (se actualiza al tipear guía/despacho/recepción).
  const estadoLive = derivarEstadoImportacion({
    fechaEmbarque: h.form.fechaEmbarque || null,
    numeroGuia: h.form.numeroGuia || null,
    despachoNumero: h.form.despachoNumero || null,
    fechaRecepcion: h.form.fechaRecepcion || null,
    stockIngresado: h.imp?.stockIngresado ?? null,
  }, h.imp?.estado ?? 'preparacion');

  const [showIngresar, setShowIngresar] = useState(false);
  // Mostramos "Ingresar a stock" siempre que la importación esté guardada, tenga ítems
  // y la recepción no esté terminada (stockIngresado se prende recién al completar o al
  // cerrar incompleta — I3 admite N recepciones parciales). La disciplina de estados
  // (despachado/recibido) y el cierre incompleto viven en la página detalle.
  const puedeIngresar = !!h.imp && !h.imp.stockIngresado && (h.imp.items?.length ?? 0) > 0;
  const recepcion = h.imp ? resumenRecepcion(h.imp) : null;
  const recepcionParcial = puedeIngresar && !!recepcion?.huboRecepcion && !recepcion.completo;

  // Alta de agente de carga inline (window.prompt no existe en el renderer de Electron).
  const [nuevoAgente, setNuevoAgente] = useState<string | null>(null);
  const confirmarAgente = async () => {
    const n = (nuevoAgente ?? '').trim();
    if (n) await h.crearAgente(n);
    setNuevoAgente(null);
  };

  const tc = h.form.tipoCambio ? Number(h.form.tipoCambio) : null;
  const fmtN = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });
  // Equivalente del VEP en la otra moneda (ARS↔USD) usando el TC mayorista.
  const vepMontoN = h.form.vepMonto ? Number(h.form.vepMonto) : 0;
  const vepEquiv = tc && vepMontoN
    ? (h.form.vepMoneda === 'ARS' ? `USD ${fmtN(vepMontoN / tc)}` : `ARS ${fmtN(vepMontoN * tc)}`)
    : null;
  // "30 días post VEP" para la fecha estimada de giro.
  const giroPostVep = () => {
    if (!h.form.vepFechaPago) return;
    const d = new Date(h.form.vepFechaPago); d.setDate(d.getDate() + 30);
    h.set('giroFechaEstimada', d.toISOString().slice(0, 10));
  };

  // --- VEP y giro automáticos ---
  // VEP = total de tributos aduaneros (gravámenes). En ARS = ×TC; en USD = directo.
  const vepSugerido = h.form.vepMoneda === 'ARS'
    ? (tc ? costeo.totalGravamenes * tc : null)
    : costeo.totalGravamenes;
  // Giro = valor de factura de la OC (Σ precio×cant, en moneda del proveedor) × (1 − %anticipo).
  const valorFactura = useMemo(
    () => h.items.reduce((s, it) => s + (it.precioUnitario || 0) * (it.cantidadPedida || 0), 0),
    [h.items],
  );
  const anticipoPct = h.form.anticipoPct ? Number(h.form.anticipoPct) : 0;
  const giroSugerido = valorFactura * (1 - anticipoPct / 100);
  const aplicarVep = () => { if (vepSugerido != null) h.set('vepMonto', vepSugerido.toFixed(2)); };
  const aplicarGiro = () => { if (giroSugerido > 0) { h.set('giroMonto', giroSugerido.toFixed(2)); h.set('giroMoneda', h.monedaOC); } };

  /**
   * El VEP es un ESTIMADO mientras no tenga número de VEP ni esté pagado: ahí
   * todavía es "lo que va a haber que pagar", y debe seguir al costeo.
   * Con número cargado o pagado pasa a ser una cifra REAL de AFIP y no se pisa.
   */
  const vepEsEstimado = !h.form.vepNumero.trim() && !h.form.vepPagado;
  /** El VEP real quedó viejo respecto de los tributos recalculados. */
  const vepDesactualizado = !vepEsEstimado && vepSugerido != null && vepSugerido > 0
    && vepMontoN > 0 && Math.abs(vepMontoN - vepSugerido) > 0.5;

  // El VEP estimado SIGUE al costeo (2026-09-01): antes se autocompletaba una
  // sola vez y, al recalcular los tributos —cambio de gastos, de tipo de cambio
  // o del régimen courier—, el monto guardado quedaba viejo sin ningún aviso.
  // La comparación previa al set evita el ciclo con la dependencia del form.
  useEffect(() => {
    if (h.loading || !vepEsEstimado) return;
    if (vepSugerido == null || vepSugerido <= 0) return;
    const nuevo = vepSugerido.toFixed(2);
    if (h.form.vepMonto !== nuevo) h.set('vepMonto', nuevo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [h.loading, vepEsEstimado, vepSugerido, h.form.vepMonto]);

  // El giro se autocompleta una sola vez si está vacío; se recalcula con ↻.
  const autoFilledRef = useRef(false);
  useEffect(() => { autoFilledRef.current = false; }, [impId, open]);
  useEffect(() => {
    if (h.loading || autoFilledRef.current) return;
    if (costeo.totalGravamenes <= 0 && valorFactura <= 0) return;
    autoFilledRef.current = true;
    if (!h.form.giroMonto && giroSugerido > 0) { h.set('giroMonto', giroSugerido.toFixed(2)); h.set('giroMoneda', h.monedaOC); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [h.loading, costeo.totalGravamenes, valorFactura]);

  const title = h.imp ? `Importación · OC ${h.ordenCompraNumero}` : 'Nueva importación';
  const seleccionarOC = !impId && !prefill;

  /**
   * Borrar / cancelar la importacion (2026-08-20). No existia ninguna de las dos:
   * una importacion cargada por error quedaba para siempre en el listado.
   *
   * Se ELIMINA solo si no ingreso nada a stock. Con unidades ya creadas, borrar
   * el embarque las dejaria huerfanas —sin de donde salieron ni con que factor de
   * costeo— y eso no se reconstruye. Ese caso se CANCELA, que deja el rastro.
   */
  const yaIngresoStock = !!h.imp?.stockIngresado
    || (h.imp?.items ?? []).some(it => (it.cantidadRecibida ?? 0) > 0);

  /**
   * Confirmar el costeo DEFINITIVO (2026-08-21).
   *
   * El stock entra apenas llega la mercadería, con las facturas todavía sin
   * llegar: ese costo es estimado. Cuando estan las facturas reales se recalcula
   * con los gastos ya cargados y el valor definitivo se estampa en las unidades.
   *
   * Alcanza a TODAS las unidades del embarque, incluidas las que ya salieron:
   * el costo real de esa mercadería no depende de dónde esté hoy. El estimado
   * no se pisa — queda como registro de con qué número se trabajó.
   */
  const handleConfirmarCosteo = async () => {
    if (!h.imp?.numero) return;
    // articuloId -> costo por unidad base, del costeo recalculado.
    const costoPorArticulo = new Map<string, number>();
    for (const linea of costeo.lineas) {
      const item = (h.imp.items ?? []).find(i => i.id === linea.itemId);
      if (!item?.articuloId || !item.cantidadPedida) continue;
      costoPorArticulo.set(item.articuloId, linea.costoComputable / item.cantidadPedida);
    }
    if (costoPorArticulo.size === 0) {
      alert('El costeo no arrojó ningún artículo con costo. Revisá que los ítems tengan artículo de catálogo y cantidad.');
      return;
    }
    const ok = await confirm({
      title: 'Confirmar costeo definitivo',
      message: `Se va a estampar el costo REAL en las unidades ingresadas por ${h.imp.numero}, calculado con los gastos cargados hoy (factor ${costeo.factorEmbarque.toFixed(3)}).\n\nAlcanza también a las unidades que ya salieron por remito o se entregaron. El costo estimado se conserva.\n\n¿Confirmar?`,
      confirmLabel: 'Confirmar costeo',
    });
    if (!ok) return;
    setConfirmandoCosteo(true);
    try {
      const r = await unidadesService.confirmarCosteoImportacion({
        importacionNumero: h.imp.numero,
        factorEmbarque: costeo.factorEmbarque,
        costoPorArticulo,
      });
      alert(`Costeo confirmado.\n\nUnidades actualizadas: ${r.actualizadas}` +
        (r.sinCosto > 0 ? `\nSin costo en el costeo (no se tocaron): ${r.sinCosto}` : ''));
    } catch (e) {
      console.error('[ImportacionModal] confirmar costeo:', e);
      alert('Error al confirmar el costeo.');
    } finally {
      setConfirmandoCosteo(false);
    }
  };

  /**
   * Re-estimar el costeo (2026-08-25): recalcula el ESTIMADO con los gastos
   * cargados hoy y lo re-estampa en las unidades del embarque. Para cuando a
   * alguien se le olvidó un gasto al ingresar y el definitivo va a tardar un
   * mes o más. No confirma nada: sigue siendo estimado.
   */
  const handleReestimarCosteo = async () => {
    if (!h.imp?.numero) return;
    const costoPorArticulo = new Map<string, number>();
    for (const linea of costeo.lineas) {
      const item = (h.imp.items ?? []).find(i => i.id === linea.itemId);
      if (!item?.articuloId || !item.cantidadPedida) continue;
      costoPorArticulo.set(item.articuloId, linea.costoComputable / item.cantidadPedida);
    }
    if (costoPorArticulo.size === 0) {
      alert('El costeo no arrojó ningún artículo con costo. Revisá que los ítems tengan artículo de catálogo y cantidad.');
      return;
    }
    const ok = await confirm({
      title: 'Actualizar costeo estimado',
      message: `Se recalcula el costo ESTIMADO de las unidades ingresadas por ${h.imp.numero} con los gastos cargados hoy (factor ${costeo.factorEmbarque.toFixed(3)}) y se pisa el estimado anterior.

Sigue siendo estimado — no confirma el costeo definitivo. Las unidades con costeo ya confirmado no se tocan.

¿Actualizar?`,
      confirmLabel: 'Actualizar estimado',
    });
    if (!ok) return;
    setConfirmandoCosteo(true);
    try {
      const r = await unidadesService.reestimarCosteoImportacion({
        importacionNumero: h.imp.numero,
        factorEmbarque: costeo.factorEmbarque,
        costoPorArticulo,
      });
      alert(`Estimado actualizado.

Unidades actualizadas: ${r.actualizadas}` +
        (r.confirmadas > 0 ? `
Con costeo confirmado (no se tocaron): ${r.confirmadas}` : '') +
        (r.sinCosto > 0 ? `
Sin costo en el costeo (no se tocaron): ${r.sinCosto}` : ''));
    } catch (e) {
      console.error('[ImportacionModal] re-estimar costeo:', e);
      alert('Error al actualizar el estimado.');
    } finally {
      setConfirmandoCosteo(false);
    }
  };

  const handleEliminar = async () => {
    if (!h.imp) return;
    const ok = await confirm({
      title: 'Eliminar importacion',
      message: `Se borra la importacion de la OC ${h.ordenCompraNumero} con todos sus datos de embarque, aduana y gastos.

No ingreso ninguna unidad a stock, asi que no queda nada colgado. La accion no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    await importacionesService.delete(h.imp.id);
    onSaved?.();
    onClose();
  };

  const handleCancelarImportacion = async () => {
    if (!h.imp) return;
    const ok = await confirm({
      title: 'Cancelar importacion',
      message: `La importacion queda en estado Cancelada. Se conserva el historial y las unidades que ya ingresaron a stock.

No se van a poder ingresar mas unidades por este embarque.`,
      confirmLabel: 'Cancelar importacion',
      danger: true,
    });
    if (!ok) return;
    await importacionesService.update(h.imp.id, { estado: 'cancelado' });
    onSaved?.();
    onClose();
  };

  const footer = (
    <>
      {h.imp && (
        <Button variant="ghost" size="sm" className="mr-auto"
          onClick={() => { onClose(); navigate(`/stock/importaciones/${h.imp!.id}`); }}>
          Detalle completo
        </Button>
      )}
      {h.imp && h.imp.estado !== 'cancelado' && (
        yaIngresoStock
          ? <Button variant="ghost" size="sm" className="text-amber-600 hover:text-amber-800"
              onClick={() => void handleCancelarImportacion()}>Cancelar importacion</Button>
          : <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-800"
              onClick={() => void handleEliminar()}>Eliminar</Button>
      )}
      {puedeIngresar && (
        <Button variant="secondary" size="sm" onClick={() => setShowIngresar(true)}>
          {recepcionParcial && recepcion
            ? `Ingresar faltante (${recepcion.recibido}/${recepcion.pedido})`
            : 'Ingresar a stock'}
        </Button>
      )}
      {h.imp?.stockIngresado && (
        <Button variant="ghost" size="sm" onClick={() => void handleReestimarCosteo()} disabled={confirmandoCosteo}
          title="Recalcular el costo ESTIMADO con los gastos cargados hoy y re-estamparlo en las unidades (no confirma el definitivo)">
          Actualizar estimado
        </Button>
      )}
      {h.imp?.stockIngresado && (
        <Button variant="secondary" size="sm" onClick={() => void handleConfirmarCosteo()} disabled={confirmandoCosteo}
          title="Estampar el costo real en las unidades de este embarque, con los gastos cargados hoy">
          {confirmandoCosteo ? 'Confirmando...' : 'Confirmar costeo definitivo'}
        </Button>
      )}
      {h.imp?.stockIngresado && (
        <span className="text-[11px] text-teal-600 font-medium self-center mr-1">
          ✓ Ingresada a stock{h.imp.recepcionCerradaIncompleta ? ' (incompleta)' : ''}
        </span>
      )}
      <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
      <Button size="sm" onClick={handleSave} disabled={h.saving || !h.ordenCompraId}>
        {h.saving ? 'Guardando...' : 'Guardar'}
      </Button>
    </>
  );

  return (
    <>
    <Modal open={open} onClose={onClose} maxWidth="2xl" title={title}
      subtitle={h.proveedorNombre || 'Comercio exterior'} footer={footer}>
      {h.loading ? (
        <div className="text-center py-10 text-xs text-slate-400">Cargando...</div>
      ) : (
        <div className="space-y-4">
          {/* Estado automático (derivado de los datos cargados) */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wide text-slate-400">Estado</span>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${ESTADO_IMPORTACION_COLORS[estadoLive]}`}>
              {ESTADO_IMPORTACION_LABELS[estadoLive]}
            </span>
            <span className="text-[10px] text-slate-400">· automático según embarque / despacho / recepción</span>
          </div>

          {/* OC + proveedor */}
          {seleccionarOC ? (
            <div>
              <label className={lbl}>Orden de compra (importación) *</label>
              <select className={ctrl} value={h.ordenCompraId} onChange={e => h.selectOC(e.target.value)}>
                <option value="">Seleccionar OC...</option>
                {h.ocOptions.map(oc => <option key={oc.id} value={oc.id}>{oc.numero} — {oc.proveedorNombre}</option>)}
              </select>
            </div>
          ) : null}

          {/* Datos de la operación */}
          <div className="grid grid-cols-3 gap-3">
            <Input inputSize="sm" label="Fecha de carga" type="date" value={h.form.fechaEmbarque} onChange={e => h.set('fechaEmbarque', e.target.value)} />
            <Input inputSize="sm" label="Fecha de arribo" type="date" value={h.form.fechaEstimadaArribo} onChange={e => h.set('fechaEstimadaArribo', e.target.value)} />
            <Input inputSize="sm" label="Arribo real (confirmado)" type="date" value={h.form.fechaArriboReal} onChange={e => h.set('fechaArriboReal', e.target.value)} />
            <div>
              <label className={lbl}>Tipo de cambio (ARS/USD)</label>
              <div className="flex gap-1">
                <input type="number" className={ctrl} value={h.form.tipoCambio} onFocus={selectAll} onChange={e => h.set('tipoCambio', e.target.value)} placeholder="0.00" />
                <button type="button" title="Traer mayorista comprador BNA" onClick={() => void h.fetchTC()}
                  className="shrink-0 px-2 text-xs border border-slate-300 rounded-md text-teal-600 hover:bg-teal-50">↻</button>
              </div>
              {h.tcInfo ? (
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Mayorista BNA: ${h.tcInfo.compra}{h.tcInfo.fecha ? ` · ${new Date(h.tcInfo.fecha).toLocaleDateString('es-AR')}` : ''}
                </p>
              ) : h.tcError ? (
                <p className="text-[10px] text-amber-600 mt-0.5">No se pudo traer el mayorista — cargalo manual o tocá ↻</p>
              ) : null}
            </div>
            {necesitaPase && (
              <div>
                <label className={lbl}>Pase EUR→USD (USD/EUR)</label>
                <div className="flex gap-1">
                  <input type="number" step="0.0001" className={ctrl} value={h.form.paseEurUsd} onFocus={selectAll} onChange={e => h.set('paseEurUsd', e.target.value)} placeholder="1.0800" />
                  <button type="button" title="Sugerir pase (cross oficial)" onClick={() => void h.fetchPase()}
                    className="shrink-0 px-2 text-xs border border-slate-300 rounded-md text-teal-600 hover:bg-teal-50">↻</button>
                </div>
                {h.paseSugerido ? (
                  <p className="text-[10px] text-slate-400 mt-0.5">Sugerido: {h.paseSugerido.toFixed(4)} · el real lo da el banco</p>
                ) : (
                  <p className="text-[10px] text-amber-600 mt-0.5">Cargá el pase para costear en USD</p>
                )}
              </div>
            )}
            <div>
              <label className={lbl}>Incoterm</label>
              <select className={ctrl} value={h.form.incoterm} onChange={e => h.set('incoterm', e.target.value)}>
                <option value="">—</option>
                {INCOTERMS.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Despachante</label>
              {/* Proveedores con categoría "Despachante de aduanas"
                  (2026-08-07) — antes era una lista fija en el código. El valor
                  ya cargado se conserva aunque el proveedor no esté migrado. */}
              <select className={ctrl} value={h.form.despachante} onChange={e => h.set('despachante', e.target.value)}>
                <option value="">—</option>
                {h.form.despachante && !h.despachantes.some(d => d.nombre === h.form.despachante) && (
                  <option value={h.form.despachante}>{h.form.despachante}</option>
                )}
                {h.despachantes.map(d => <option key={d.id} value={d.nombre}>{d.nombre}</option>)}
              </select>
            </div>
            {/* Courier (2026-08-06): cambia el costeo — sin percepciones. */}
            <div>
              <label className={lbl}>Régimen</label>
              <label className="flex items-center gap-1.5 cursor-pointer h-[30px]"
                title="Courier (puerta a puerta): paga derechos de la posición arancelaria e IVA. NO paga IVA adicional, percepción de ganancias ni ingresos brutos.">
                <input type="checkbox" checked={h.form.esCourier}
                  onChange={e => h.set('esCourier', e.target.checked)}
                  className="w-3.5 h-3.5 accent-teal-600" />
                <span className="text-xs text-slate-700">Es courier</span>
              </label>
            </div>
            <div>
              <label className={lbl}>Agente de carga</label>
              {nuevoAgente === null ? (
                <div className="flex gap-1">
                  <select className={ctrl} value={h.form.agenteCarga} onChange={e => h.set('agenteCarga', e.target.value)}>
                    <option value="">—</option>
                    {h.form.agenteCarga && !h.agentes.some(a => a.nombre === h.form.agenteCarga) && (
                      <option value={h.form.agenteCarga}>{h.form.agenteCarga}</option>
                    )}
                    {h.agentes.map(a => <option key={a.id} value={a.nombre}>{a.nombre}</option>)}
                  </select>
                  <button type="button" title="Nuevo agente" onClick={() => setNuevoAgente('')}
                    className="shrink-0 px-2 text-xs border border-slate-300 rounded-md text-teal-600 hover:bg-teal-50">+</button>
                </div>
              ) : (
                <div className="flex gap-1">
                  <input autoFocus className={ctrl} value={nuevoAgente} placeholder="DHL, FedEx, ..."
                    onChange={e => setNuevoAgente(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void confirmarAgente(); } if (e.key === 'Escape') setNuevoAgente(null); }} />
                  <button type="button" title="Guardar agente" onClick={() => void confirmarAgente()}
                    className="shrink-0 px-2 text-xs border border-slate-300 rounded-md text-teal-600 hover:bg-teal-50">✓</button>
                  <button type="button" title="Cancelar" onClick={() => setNuevoAgente(null)}
                    className="shrink-0 px-2 text-xs border border-slate-300 rounded-md text-slate-400 hover:bg-slate-50">✕</button>
                </div>
              )}
            </div>
            <Input inputSize="sm" label="N° de guía" value={h.form.numeroGuia} onFocus={selectAll} onChange={e => h.set('numeroGuia', e.target.value)} />
            <Input inputSize="sm" label="Despacho N°" value={h.form.despachoNumero} onFocus={selectAll} onChange={e => h.set('despachoNumero', e.target.value)} />
            <Input inputSize="sm" label="Fecha de despacho" type="date" value={h.form.fechaDespacho} onChange={e => h.set('fechaDespacho', e.target.value)} />
            <Input inputSize="sm" label="Fecha de recepción" type="date" value={h.form.fechaRecepcion} onChange={e => h.set('fechaRecepcion', e.target.value)} />
          </div>

          {/* Valor en aduana — flete/seguro DECLARADOS (guía), distintos de los pagos locales */}
          <div className="border-t border-slate-200 pt-3">
            <p className="text-[10px] font-mono uppercase tracking-wide text-slate-500 mb-1.5">Valor en aduana (declarado)</p>
            <div className="grid grid-cols-4 gap-3 items-end">
              <div>
                <label className={lbl}>FOB (USD)</label>
                <div className="text-xs font-mono text-slate-600 px-2 py-1.5 bg-slate-50 rounded-md">{costeo.fobTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
              </div>
              {/* Flete y seguro con su PROPIA moneda (2026-09-01): en los
                  despachos por courier el flete viene en dólares y la
                  mercadería en euros. Vacío = la moneda del embarque. */}
              <div>
                <label className={lbl}>Flete declarado</label>
                <div className="flex gap-1">
                  <input type="number" className={ctrl} value={h.form.fleteDeclarado} onFocus={selectAll}
                    onChange={e => h.set('fleteDeclarado', e.target.value)} placeholder="0.00" />
                  <select className={`${ctrl} w-24`} value={h.form.monedaFleteDeclarado}
                    onChange={e => h.set('monedaFleteDeclarado', e.target.value as 'ARS' | 'USD' | 'EUR' | '')}>
                    <option value="">{h.monedaOC}</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="ARS">ARS</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={lbl}>Seguro declarado</label>
                <div className="flex gap-1">
                  <input type="number" className={ctrl} value={h.form.seguroDeclarado} onFocus={selectAll}
                    onChange={e => h.set('seguroDeclarado', e.target.value)} placeholder="0.00" />
                  <select className={`${ctrl} w-24`} value={h.form.monedaSeguroDeclarado}
                    onChange={e => h.set('monedaSeguroDeclarado', e.target.value as 'ARS' | 'USD' | 'EUR' | '')}>
                    <option value="">{h.monedaOC}</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="ARS">ARS</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={lbl}>CIF (USD)</label>
                <div className="text-xs font-mono font-semibold text-teal-700 px-2 py-1.5 bg-teal-50 rounded-md">{costeo.cifTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
              </div>
            </div>
          </div>

          {/* VEP — flujo de fondos. Monto mostrado en ARS y USD vía TC mayorista. */}
          <div className="border-t border-slate-200 pt-3">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-mono uppercase tracking-wide text-slate-500">VEP</p>
              {/* Confirmación explícita: saca el VEP de los pendientes del flujo de fondos. */}
              <label className="flex items-center gap-1.5 text-[10px] text-slate-600 cursor-pointer select-none">
                <input type="checkbox" checked={h.form.vepPagado}
                  onChange={e => h.set('vepPagado', e.target.checked)}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                VEP pagado{h.imp?.vepFechaPagado ? ` (el ${h.imp.vepFechaPagado.slice(0, 10).split('-').reverse().join('/')})` : ''}
              </label>
            </div>
            <div className="grid grid-cols-4 gap-3 items-start">
              <Input inputSize="sm" label="N° VEP" value={h.form.vepNumero} onFocus={selectAll} onChange={e => h.set('vepNumero', e.target.value)} />
              <div>
                <div className="flex items-end justify-between">
                  <label className={lbl}>Monto VEP (tributos)</label>
                  {vepSugerido != null && vepSugerido > 0 && (
                    <button type="button" onClick={aplicarVep} title="Usar el total de tributos aduaneros"
                      className="text-[10px] text-teal-600 hover:underline mb-0.5">↻ tributos</button>
                  )}
                </div>
                <input type="number" className={ctrl} value={h.form.vepMonto} onFocus={selectAll} onChange={e => h.set('vepMonto', e.target.value)} placeholder="0.00" />
                {vepDesactualizado ? (
                  <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-1 mt-0.5">
                    Los tributos recalculados dan <span className="font-mono font-semibold">{h.form.vepMoneda} {fmtN(vepSugerido!)}</span>.
                    El monto cargado no se toca porque el VEP ya está emitido; si corresponde, aplicalo con «↻ tributos».
                  </p>
                ) : vepSugerido != null && vepSugerido > 0
                  ? <p className="text-[10px] text-slate-400 mt-0.5">
                      Tributos: {h.form.vepMoneda} {fmtN(vepSugerido)}{vepEquiv ? ` · ≈ ${vepEquiv}` : ''}
                      {vepEsEstimado && <span className="text-teal-600"> · se actualiza solo hasta cargar el N° de VEP</span>}
                    </p>
                  : vepEquiv && <p className="text-[10px] text-slate-400 mt-0.5">≈ {vepEquiv}</p>}
              </div>
              <div>
                <label className={lbl}>Moneda VEP</label>
                <select className={ctrl} value={h.form.vepMoneda} onChange={e => h.set('vepMoneda', e.target.value as 'ARS' | 'USD' | 'EUR')}>
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <Input inputSize="sm" label="Fecha pago VEP" type="date" value={h.form.vepFechaPago} onChange={e => h.set('vepFechaPago', e.target.value)} />
            </div>
          </div>

          {/* Giro al exterior — pago al proveedor. Monto = valor factura OC × (1 − %anticipo). */}
          <div className="border-t border-slate-200 pt-3">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-mono uppercase tracking-wide text-slate-500">Giro al exterior</p>
              <div className="flex items-center gap-3">
                {/* Recibir la mercadería NO cierra el giro: se marca acá al pagarlo. */}
                <label className="flex items-center gap-1.5 text-[10px] text-slate-600 cursor-pointer select-none">
                  <input type="checkbox" checked={h.form.giroPagado}
                    onChange={e => h.set('giroPagado', e.target.checked)}
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                  Giro pagado{h.imp?.giroFechaPagado ? ` (el ${h.imp.giroFechaPagado.slice(0, 10).split('-').reverse().join('/')})` : ''}
                </label>
                <button type="button" onClick={giroPostVep} disabled={!h.form.vepFechaPago}
                  className="text-[10px] text-teal-600 hover:underline disabled:text-slate-300">30 días post VEP</button>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className={lbl}>% anticipo</label>
                <input type="number" className={ctrl} value={h.form.anticipoPct} onFocus={selectAll} onChange={e => h.set('anticipoPct', e.target.value)} placeholder="0" />
                <p className="text-[10px] text-slate-400 mt-0.5">{anticipoPct > 0 ? `Saldo ${100 - anticipoPct}% diferido` : '100% diferido'}</p>
              </div>
              <div>
                <div className="flex items-end justify-between">
                  <label className={lbl}>Monto giro</label>
                  {giroSugerido > 0 && (
                    <button type="button" onClick={aplicarGiro} title="Usar el saldo de la factura"
                      className="text-[10px] text-teal-600 hover:underline mb-0.5">↻ saldo</button>
                  )}
                </div>
                <input type="number" className={ctrl} value={h.form.giroMonto} onFocus={selectAll} onChange={e => h.set('giroMonto', e.target.value)} placeholder="0.00" />
                {valorFactura > 0 && (
                  <p className="text-[10px] text-slate-400 mt-0.5">Factura {h.monedaOC} {fmtN(valorFactura)} → saldo {fmtN(giroSugerido)}</p>
                )}
              </div>
              <div>
                <label className={lbl}>Moneda</label>
                <select className={ctrl} value={h.form.giroMoneda} onChange={e => h.set('giroMoneda', e.target.value as 'ARS' | 'USD' | 'EUR')}>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="ARS">ARS</option>
                </select>
              </div>
              <Input inputSize="sm" label="Fecha estimada de giro" type="date" value={h.form.giroFechaEstimada} onChange={e => h.set('giroFechaEstimada', e.target.value)} />
            </div>
          </div>

          {/* Gastos */}
          <div className="border-t border-slate-200 pt-3">
            <ImportacionGastosEditor gastos={h.gastos} onAdd={h.addGasto} onUpdate={h.updateGasto} onRemove={h.removeGasto} />
          </div>

          {/* Documentos — adjuntar invoice, packing, BL, despacho, etc. (requiere importación guardada) */}
          {h.imp && (
            <div className="border-t border-slate-200 pt-3">
              <ImportacionDocumentosSection imp={h.imp} onUpdate={h.reload} />
            </div>
          )}

          {/* Artículos + costeo */}
          <div className="border-t border-slate-200 pt-3">
            <p className="text-[10px] font-mono uppercase tracking-wide text-slate-500 mb-1.5">Artículos y costeo</p>
            <ImportacionCosteoPanel costeo={costeo} />
          </div>

          {/* Notas */}
          <div>
            <label className={lbl}>Notas</label>
            <textarea className={ctrl} rows={2} value={h.form.notas} onChange={e => h.set('notas', e.target.value)} />
          </div>
        </div>
      )}
    </Modal>
    {showIngresar && h.imp && (
      <ImportacionIngresarStockModal
        imp={h.imp}
        onClose={() => setShowIngresar(false)}
        onSuccess={() => { setShowIngresar(false); h.reload(); }}
      />
    )}
    </>
  );
};
