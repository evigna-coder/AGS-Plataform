import { useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOTForm } from '../hooks/useOTForm';
import { OTStatusBadge } from '../components/ordenes-trabajo/OTStatusBadge';
import { PartesForm } from '../components/ordenes-trabajo/PartesForm';
import { SignaturePad, type SignaturePadHandle } from '../components/ordenes-trabajo/SignaturePad';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { generateOTPdf } from '../utils/pdfGenerator';
import type { WorkOrder } from '@ags/shared';

type Tab = 'info' | 'reporte' | 'partes' | 'firmas';

const TABS: { id: Tab; label: string }[] = [
  { id: 'info', label: 'Info' },
  { id: 'reporte', label: 'Reporte' },
  { id: 'partes', label: 'Partes' },
  { id: 'firmas', label: 'Firmas' },
];

const ta = 'w-full border border-slate-300 rounded-xl px-3 py-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none disabled:bg-slate-50 disabled:text-slate-500';
const inp = 'w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-500';
const lbl = 'block text-xs font-medium text-slate-500 mb-1';

export default function OTDetailPage() {
  const { otNumber } = useParams<{ otNumber: string }>();
  const navigate = useNavigate();
  const form = useOTForm(otNumber);
  const [tab, setTab] = useState<Tab>('info');
  const [finalizing, setFinalizing] = useState(false);
  const engineerPad = useRef<SignaturePadHandle>(null);
  const clientPad = useRef<SignaturePadHandle>(null);

  if (form.loading) {
    return <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>;
  }

  const ot = form.ot as WorkOrder & { problemaFallaInicial?: string; materialesParaServicio?: string };

  async function handleFinalize() {
    if (engineerPad.current?.isEmpty()) {
      alert('La firma del especialista es obligatoria para finalizar.');
      return;
    }
    setFinalizing(true);
    try {
      const sigEng = engineerPad.current?.getDataURL() ?? '';
      const sigCli = clientPad.current?.isEmpty() ? '' : (clientPad.current?.getDataURL() ?? '');
      await form.finalize(sigEng, sigCli);
      const updated = { ...ot, signatureEngineer: sigEng, signatureClient: sigCli, status: 'FINALIZADO' as const };
      await generateOTPdf(updated);
    } catch { alert('Error al finalizar la OT.'); }
    finally { setFinalizing(false); }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/ordenes-trabajo')} className="text-slate-400 hover:text-slate-600 p-1">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className="text-base font-semibold text-slate-900 font-mono shrink-0">OT-{otNumber}</span>
          <OTStatusBadge status={form.status} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {form.saving && <span className="text-[11px] text-slate-400">Guardando...</span>}
          {!form.readOnly && (
            <Button size="sm" onClick={() => form.save()}>Guardar</Button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="shrink-0 bg-white border-b border-slate-100 flex">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors border-b-2 ${
              tab === t.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">

        {tab === 'info' && (
          <>
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-2">Cliente / Equipo</p>
              <p className="text-sm font-semibold text-slate-800">{ot?.razonSocial || '—'}</p>
              {ot?.sistema && <p className="text-xs text-slate-500">{ot.sistema}</p>}
              {ot?.tipoServicio && <p className="text-xs text-slate-400">{ot.tipoServicio}</p>}
              <div className="flex gap-2 pt-1">
                {ot?.esFacturable && <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">Facturable</span>}
                {ot?.tieneContrato && <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">Contrato</span>}
                {ot?.esGarantia && <span className="text-[10px] bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded-full font-medium">Garantía</span>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Fecha inicio</label><input type="date" className={inp} value={form.fechaInicio} onChange={e => form.setFechaInicio(e.target.value)} disabled={form.readOnly} /></div>
              <div><label className={lbl}>Fecha fin</label><input type="date" className={inp} value={form.fechaFin} onChange={e => form.setFechaFin(e.target.value)} disabled={form.readOnly} /></div>
              <div><label className={lbl}>Horas trabajadas</label><input type="number" min={0} step={0.5} className={inp} value={form.horasTrabajadas} onChange={e => form.setHorasTrabajadas(e.target.value)} disabled={form.readOnly} /></div>
              <div><label className={lbl}>Tiempo viaje (hs)</label><input type="number" min={0} step={0.5} className={inp} value={form.tiempoViaje} onChange={e => form.setTiempoViaje(e.target.value)} disabled={form.readOnly} /></div>
            </div>
          </>
        )}

        {tab === 'reporte' && (
          <>
            <div><label className={lbl}>Problema / Falla inicial</label><textarea rows={3} className={ta} value={form.problemaFallaInicial} onChange={e => form.setProblemaFallaInicial(e.target.value)} disabled={form.readOnly} placeholder="Descripción del problema reportado por el cliente..." /></div>
            <div><label className={lbl}>Reporte técnico</label><textarea rows={5} className={ta} value={form.reporteTecnico} onChange={e => form.setReporteTecnico(e.target.value)} disabled={form.readOnly} placeholder="Descripción detallada del trabajo realizado..." /></div>
            <div><label className={lbl}>Materiales / Insumos utilizados</label><textarea rows={3} className={ta} value={form.materialesParaServicio} onChange={e => form.setMaterialesParaServicio(e.target.value)} disabled={form.readOnly} placeholder="Materiales utilizados durante el servicio..." /></div>
            <div><label className={lbl}>Acciones a tomar</label><textarea rows={3} className={ta} value={form.accionesTomar} onChange={e => form.setAccionesTomar(e.target.value)} disabled={form.readOnly} placeholder="Próximas acciones o recomendaciones..." /></div>
          </>
        )}

        {tab === 'partes' && (
          <PartesForm
            parts={form.articulos}
            readOnly={form.readOnly}
            onAdd={form.addPart}
            onUpdate={form.updatePart}
            onRemove={form.removePart}
          />
        )}

        {tab === 'firmas' && (
          <>
            {form.readOnly ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                <p className="text-xs font-medium text-emerald-800">Esta OT ya fue finalizada.</p>
                <p className="text-[11px] text-emerald-600 mt-0.5">Las firmas y datos están guardados.</p>
              </div>
            ) : null}
            <div>
              <label className={lbl}>Firma del Especialista *</label>
              {ot?.signatureEngineer && form.readOnly
                ? <img src={ot.signatureEngineer} alt="Firma especialista" className="h-28 border border-slate-200 rounded-xl" />
                : <SignaturePad ref={engineerPad} disabled={form.readOnly} />
              }
              {!form.readOnly && <button type="button" className="text-[11px] text-slate-400 mt-1" onClick={() => engineerPad.current?.clear()}>Limpiar firma</button>}
              <input className={`${inp} mt-2`} value={form.aclaracionEspecialista} onChange={e => form.setAclaracionEspecialista(e.target.value)} disabled={form.readOnly} placeholder="Aclaración / nombre legible" />
            </div>
            <div>
              <label className={lbl}>Firma del Cliente</label>
              {ot?.signatureClient && form.readOnly
                ? <img src={ot.signatureClient} alt="Firma cliente" className="h-28 border border-slate-200 rounded-xl" />
                : <SignaturePad ref={clientPad} disabled={form.readOnly} />
              }
              {!form.readOnly && <button type="button" className="text-[11px] text-slate-400 mt-1" onClick={() => clientPad.current?.clear()}>Limpiar firma</button>}
              <input className={`${inp} mt-2`} value={form.aclaracionCliente} onChange={e => form.setAclaracionCliente(e.target.value)} disabled={form.readOnly} placeholder="Aclaración / nombre legible" />
            </div>
            {!form.readOnly && (
              <Button size="lg" className="w-full mt-2" onClick={handleFinalize} disabled={finalizing || form.saving}>
                {finalizing ? 'Finalizando...' : 'Finalizar y generar PDF'}
              </Button>
            )}
            {form.readOnly && (
              <Button size="lg" variant="secondary" className="w-full mt-2" onClick={() => generateOTPdf(ot!)}>
                Descargar PDF
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
