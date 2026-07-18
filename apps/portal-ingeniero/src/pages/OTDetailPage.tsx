import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useOTForm } from '../hooks/useOTForm';
import { useNavigateBack } from '../hooks/useNavigateBack';
import { useSistemaContext } from '../hooks/useSistemaContext';
import OTDetalleBand from '../components/ordenes-trabajo/OTDetalleBand';
import OTDetalleTab from '../components/ordenes-trabajo/OTDetalleTab';
import OTReporteTab from '../components/ordenes-trabajo/OTReporteTab';
import OTFirmasTab from '../components/ordenes-trabajo/OTFirmasTab';
import { PartesForm } from '../components/ordenes-trabajo/PartesForm';
import SolicitarPresupuestoModal from '../components/ordenes-trabajo/SolicitarPresupuestoModal';
import { Spinner } from '../components/ui/Spinner';
import { REPORTES_OT_URL } from '../utils/constants';
import type { MisOTDoc } from '../services/misOTService';

type Tab = 'detalle' | 'reporte' | 'partes' | 'firmas';

const TABS: { id: Tab; label: string }[] = [
  { id: 'detalle', label: 'Detalle' },
  { id: 'reporte', label: 'Reporte' },
  { id: 'partes', label: 'Partes' },
  { id: 'firmas', label: 'Firmas' },
];

export default function OTDetailPage() {
  const { otNumber } = useParams<{ otNumber: string }>();
  const goBack = useNavigateBack();
  const form = useOTForm(otNumber);
  const [tab, setTab] = useState<Tab>('detalle');
  const [solicitarOpen, setSolicitarOpen] = useState(false);
  const [accionesOpen, setAccionesOpen] = useState(false);
  const ot = form.ot as MisOTDoc & { problemaFallaInicial?: string; pdfUrl?: string | null } | null;
  const { sistema, modulos } = useSistemaContext(ot?.sistemaId);

  if (form.loading) {
    return <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>;
  }

  const reportesUrl = `${REPORTES_OT_URL}?reportId=${encodeURIComponent(otNumber || '')}`;
  const reporteHref = form.readOnly && ot?.pdfUrl ? ot.pdfUrl : reportesUrl;

  return (
    <div className="h-full flex flex-col">
      <OTDetalleBand ot={ot} otNumber={otNumber || ''} onBack={goBack} />

      {/* Tab bar — mobile: 4 tabs a ancho completo; desktop: alineados a la izquierda */}
      <div className="shrink-0 bg-white border-b border-slate-100">
        <div className="flex max-w-5xl mx-auto w-full md:px-4">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 md:flex-none md:px-6 py-2.5 md:py-2 text-xs font-medium transition-colors border-b-2 min-h-[44px] md:min-h-0 ${
                tab === t.id
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-w-5xl w-full mx-auto">
        {tab === 'detalle' && ot && <OTDetalleTab ot={ot} sistema={sistema} modulos={modulos} />}
        {tab === 'reporte' && <OTReporteTab form={form} />}
        {tab === 'partes' && (
          <PartesForm
            parts={form.articulos}
            readOnly={form.readOnly}
            onAdd={form.addPart}
            onUpdate={form.updatePart}
            onRemove={form.removePart}
          />
        )}
        {tab === 'firmas' && <OTFirmasTab form={form} ot={ot} />}
      </div>

      {/* Acciones — desktop: barra inferior compacta */}
      <div className="hidden md:block shrink-0 sticky bottom-0 z-10 bg-white/95 backdrop-blur border-t border-slate-200 shadow-[0_-8px_20px_rgba(30,41,59,0.08)] px-4 py-2">
        <div className="flex gap-2.5 max-w-5xl mx-auto w-full justify-end">
          {!form.readOnly && (
            <button
              onClick={() => form.save()}
              disabled={form.saving}
              className="min-h-[38px] px-4 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 disabled:opacity-50"
            >
              {form.saving ? 'Guardando…' : 'Guardar'}
            </button>
          )}
          <a
            href={reporteHref}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[38px] px-4 rounded-xl border-[1.5px] border-teal-700 bg-white text-sm font-semibold text-teal-700 inline-flex items-center justify-center"
          >
            {form.readOnly && ot?.pdfUrl ? 'Ver PDF' : 'Reporte'}
          </a>
          <button
            onClick={() => setSolicitarOpen(true)}
            disabled={!ot}
            className="min-h-[38px] px-6 rounded-xl bg-teal-700 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            Solicitar presupuesto
          </button>
        </div>
      </div>

      {/* Acciones — mobile: pestaña colapsada en el borde derecho, no roba alto */}
      <div className="md:hidden fixed right-0 bottom-28 z-30 flex items-center">
        {accionesOpen && (
          <div className="bg-white border border-slate-200 rounded-l-2xl shadow-xl p-2.5 space-y-2 w-52">
            <button
              onClick={() => { setSolicitarOpen(true); setAccionesOpen(false); }}
              disabled={!ot}
              className="w-full min-h-[44px] px-3 rounded-xl bg-teal-700 text-sm font-semibold text-white disabled:opacity-50"
            >
              Solicitar presupuesto
            </button>
            <a
              href={reporteHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setAccionesOpen(false)}
              className="w-full min-h-[44px] px-3 rounded-xl border-[1.5px] border-teal-700 bg-white text-sm font-semibold text-teal-700 inline-flex items-center justify-center"
            >
              {form.readOnly && ot?.pdfUrl ? 'Ver PDF' : 'Reporte'}
            </a>
            {!form.readOnly && (
              <button
                onClick={() => form.save()}
                disabled={form.saving}
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 disabled:opacity-50"
              >
                {form.saving ? 'Guardando…' : 'Guardar'}
              </button>
            )}
          </div>
        )}
        <button
          onClick={() => setAccionesOpen(v => !v)}
          aria-label={accionesOpen ? 'Ocultar acciones' : 'Mostrar acciones'}
          className="bg-teal-700 text-white rounded-l-xl py-5 px-1 shadow-lg border border-teal-800 border-r-0"
        >
          <svg className={`w-4 h-4 transition-transform ${accionesOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {ot && (
        <SolicitarPresupuestoModal
          open={solicitarOpen}
          onClose={() => setSolicitarOpen(false)}
          ot={ot}
          sistema={sistema}
        />
      )}
    </div>
  );
}
