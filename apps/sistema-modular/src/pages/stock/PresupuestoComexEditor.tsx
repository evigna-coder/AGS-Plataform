import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { LoadingState } from '../../components/ui/LoadingState';
import { PosicionComexCard } from '../../components/comex/PosicionComexCard';
import { GastosComexEditor } from '../../components/comex/GastosComexEditor';
import { ResumenComex } from '../../components/comex/ResumenComex';
import { CampoNumero } from '../../components/comex/CampoNumero';
import { abrirPresupuestoComexPDF } from '../../components/comex/abrirPresupuestoComexPDF';
import { usePresupuestoComexForm } from '../../hooks/usePresupuestoComexForm';
import { notify } from '../../utils/notify';

const inputCls = 'w-full text-xs border border-slate-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500';
const lbl = 'block text-[10px] font-mono uppercase tracking-wide text-slate-500 mb-0.5';

/**
 * Presupuestador de comex (2026-10-01): estimación de costo de importación sin
 * artículos, en reemplazo de la planilla. Posiciones con CIF y alícuotas,
 * gastos, resumen en vivo y PDF para pasar.
 */
export function PresupuestoComexEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const h = usePresupuestoComexForm(id === 'nuevo' ? undefined : id);
  const [generando, setGenerando] = useState(false);

  const guardar = async () => {
    const nuevo = !h.form.id;
    const savedId = await h.guardar();
    if (savedId && nuevo) navigate(`/stock/importaciones/comex/${savedId}`, { replace: true });
  };

  const pdf = async () => {
    setGenerando(true);
    try { await abrirPresupuestoComexPDF(h.form); }
    catch (err) { console.error('[PresupuestoComexEditor] pdf', err); notify.error('No se pudo generar el PDF'); }
    finally { setGenerando(false); }
  };

  if (h.loading) return <LoadingState message="Cargando presupuesto…" />;
  const resPorId = new Map(h.resultado.posiciones.map(r => [r.id, r]));

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title={h.form.numero ? `Presupuesto comex ${h.form.numero}` : 'Nuevo presupuesto comex'}
        subtitle="Estimación de costo de importación — no genera importación ni toca stock"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/stock/importaciones/comex')}>Volver</Button>
            <Button variant="outline" size="sm" onClick={() => void pdf()} disabled={generando || h.resultado.valorCif <= 0}
              estado={generando ? 'guardando' : 'idle'} textoOcupado="Generando…">PDF</Button>
            <Button size="sm" onClick={() => void guardar()} disabled={h.saving} estado={h.saving ? 'guardando' : 'idle'}>
              {h.sucio || !h.form.id ? 'Guardar' : 'Guardado'}
            </Button>
          </div>
        }
      />
      <div className="flex-1 min-h-0 overflow-auto px-5 py-4">
        <div className="grid grid-cols-[1fr_340px] gap-5 items-start max-w-[1200px]">
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3 grid grid-cols-[1fr_1fr_140px_120px] gap-3 items-end">
              <label><span className={lbl}>Título</span>
                <input className={inputCls} value={h.form.titulo} placeholder="Cromatógrafo 7890B + SCD"
                  onChange={e => h.set('titulo', e.target.value)} /></label>
              <label><span className={lbl}>Cliente / referencia</span>
                <input className={inputCls} value={h.form.cliente ?? ''} placeholder="Opcional"
                  onChange={e => h.set('cliente', e.target.value)} /></label>
              <label><span className={lbl}>Fecha</span>
                <input type="date" className={inputCls} value={h.form.fecha} onChange={e => h.set('fecha', e.target.value)} /></label>
              <CampoNumero label="TC ARS/USD" value={h.form.tipoCambio ?? 0} onChange={v => h.set('tipoCambio', v || null)} />
            </div>

            {h.form.posiciones.map((p, i) => (
              <PosicionComexCard key={p.id} indice={i} posicion={p} resultado={resPorId.get(p.id)}
                onChange={patch => h.setPosicion(p.id, patch)}
                onQuitar={h.form.posiciones.length > 1 ? () => h.quitarPosicion(p.id) : undefined} />
            ))}
            <button type="button" onClick={h.agregarPosicion}
              className="w-full rounded-xl border border-dashed border-slate-300 py-2 text-xs text-slate-500 hover:border-teal-400 hover:text-teal-700">
              + Otra posición arancelaria (ej.: detector declarado aparte)
            </button>

            <GastosComexEditor gastos={h.form.gastos} onChange={g => h.set('gastos', g)}
              gastosBancarios={h.form.gastosBancarios} onGastosBancarios={v => h.set('gastosBancarios', v)}
              costoFinancieroPct={h.form.costoFinancieroPct} onCostoFinancieroPct={v => h.set('costoFinancieroPct', v)} />

            <label className="block rounded-xl border border-slate-200 bg-white p-3">
              <span className={lbl}>Notas (salen en el PDF)</span>
              <textarea className={inputCls} rows={2} value={h.form.notas ?? ''} placeholder="Supuestos, condición de compra, validez…"
                onChange={e => h.set('notas', e.target.value)} />
            </label>
          </div>
          <div className="sticky top-0">
            <ResumenComex r={h.resultado} tipoCambio={h.form.tipoCambio} />
          </div>
        </div>
      </div>
    </div>
  );
}
