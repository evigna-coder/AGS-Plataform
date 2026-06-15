import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useImportacionForm, type ImportacionPrefill } from '../../hooks/useImportacionForm';
import { computeCosteoImportacion } from '../../utils/costeoImportacion';
import { ImportacionGastosEditor } from './ImportacionGastosEditor';
import { ImportacionCosteoPanel } from './ImportacionCosteoPanel';

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

  const costeo = useMemo(() => computeCosteoImportacion({
    items: h.items, articulosById: h.articulosById, gastos: h.gastos,
    monedaBase: h.monedaOC,
    fleteDeclarado: h.form.fleteDeclarado ? Number(h.form.fleteDeclarado) : 0,
    seguroDeclarado: h.form.seguroDeclarado ? Number(h.form.seguroDeclarado) : 0,
    tipoCambio: h.form.tipoCambio ? Number(h.form.tipoCambio) : null,
    paseEurUsd: h.form.paseEurUsd ? Number(h.form.paseEurUsd) : null,
  }), [h.items, h.articulosById, h.gastos, h.monedaOC, h.form.fleteDeclarado, h.form.seguroDeclarado, h.form.tipoCambio, h.form.paseEurUsd]);

  const handleSave = async () => {
    const id = await h.save(costeo.costoTotalARS, costeo.factorEmbarque);
    if (id) { onSaved?.(); onClose(); }
  };

  const selectAll = (e: React.FocusEvent<HTMLInputElement>) => e.target.select();
  // El pase EUR→USD se necesita si el embarque o algún gasto está en euros.
  const necesitaPase = h.monedaOC === 'EUR' || h.gastos.some(g => g.moneda === 'EUR');

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

  const title = h.imp ? `Importación ${h.imp.numero}` : 'Nueva importación';
  const seleccionarOC = !impId && !prefill;

  const footer = (
    <>
      {h.imp && (
        <Button variant="ghost" size="sm" className="mr-auto"
          onClick={() => { onClose(); navigate(`/stock/importaciones/${h.imp!.id}`); }}>
          Detalle completo
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
      <Button size="sm" onClick={handleSave} disabled={h.saving || !h.ordenCompraId}>
        {h.saving ? 'Guardando...' : 'Guardar'}
      </Button>
    </>
  );

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl" title={title}
      subtitle={h.ordenCompraNumero ? `OC ${h.ordenCompraNumero} · ${h.proveedorNombre}` : 'Comercio exterior'} footer={footer}>
      {h.loading ? (
        <div className="text-center py-10 text-xs text-slate-400">Cargando...</div>
      ) : (
        <div className="space-y-4">
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
              <label className={lbl}>Agente de carga</label>
              <div className="flex gap-1">
                <select className={ctrl} value={h.form.agenteCarga} onChange={e => h.set('agenteCarga', e.target.value)}>
                  <option value="">—</option>
                  {h.form.agenteCarga && !h.agentes.some(a => a.nombre === h.form.agenteCarga) && (
                    <option value={h.form.agenteCarga}>{h.form.agenteCarga}</option>
                  )}
                  {h.agentes.map(a => <option key={a.id} value={a.nombre}>{a.nombre}</option>)}
                </select>
                <button type="button" title="Nuevo agente"
                  onClick={() => { const n = window.prompt('Nuevo agente de carga (DHL, FedEx, ...)'); if (n) void h.crearAgente(n); }}
                  className="shrink-0 px-2 text-xs border border-slate-300 rounded-md text-teal-600 hover:bg-teal-50">+</button>
              </div>
            </div>
            <Input inputSize="sm" label="N° de guía" value={h.form.numeroGuia} onFocus={selectAll} onChange={e => h.set('numeroGuia', e.target.value)} />
            <Input inputSize="sm" label="Despacho N°" value={h.form.despachoNumero} onFocus={selectAll} onChange={e => h.set('despachoNumero', e.target.value)} />
          </div>

          {/* Valor en aduana — flete/seguro DECLARADOS (guía), distintos de los pagos locales */}
          <div className="border-t border-slate-200 pt-3">
            <p className="text-[10px] font-mono uppercase tracking-wide text-slate-500 mb-1.5">Valor en aduana (declarado)</p>
            <div className="grid grid-cols-4 gap-3 items-end">
              <div>
                <label className={lbl}>FOB (USD)</label>
                <div className="text-xs font-mono text-slate-600 px-2 py-1.5 bg-slate-50 rounded-md">{costeo.fobTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
              </div>
              <Input inputSize="sm" label={`Flete declarado (${h.monedaOC})`} type="number" value={h.form.fleteDeclarado} onFocus={selectAll} onChange={e => h.set('fleteDeclarado', e.target.value)} placeholder="0.00" />
              <Input inputSize="sm" label={`Seguro declarado (${h.monedaOC})`} type="number" value={h.form.seguroDeclarado} onFocus={selectAll} onChange={e => h.set('seguroDeclarado', e.target.value)} placeholder="0.00" />
              <div>
                <label className={lbl}>CIF (USD)</label>
                <div className="text-xs font-mono font-semibold text-teal-700 px-2 py-1.5 bg-teal-50 rounded-md">{costeo.cifTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
              </div>
            </div>
          </div>

          {/* VEP — flujo de fondos. Monto mostrado en ARS y USD vía TC mayorista. */}
          <div className="border-t border-slate-200 pt-3">
            <p className="text-[10px] font-mono uppercase tracking-wide text-slate-500 mb-1.5">VEP</p>
            <div className="grid grid-cols-4 gap-3 items-start">
              <Input inputSize="sm" label="N° VEP" value={h.form.vepNumero} onFocus={selectAll} onChange={e => h.set('vepNumero', e.target.value)} />
              <div>
                <Input inputSize="sm" label="Monto VEP" type="number" value={h.form.vepMonto} onFocus={selectAll} onChange={e => h.set('vepMonto', e.target.value)} />
                {vepEquiv && <p className="text-[10px] text-slate-400 mt-0.5">≈ {vepEquiv}</p>}
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

          {/* Giro al exterior — pago al proveedor (manual; ~30 días post VEP) */}
          <div className="border-t border-slate-200 pt-3">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-mono uppercase tracking-wide text-slate-500">Giro al exterior</p>
              <button type="button" onClick={giroPostVep} disabled={!h.form.vepFechaPago}
                className="text-[10px] text-teal-600 hover:underline disabled:text-slate-300">30 días post VEP</button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Input inputSize="sm" label={`Monto giro`} type="number" value={h.form.giroMonto} onFocus={selectAll} onChange={e => h.set('giroMonto', e.target.value)} />
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
  );
};
