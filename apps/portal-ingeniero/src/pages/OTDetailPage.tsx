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

      {/* Botonera sticky — mobile: targets ≥44px con primario a ancho completo;
          desktop: botones compactos alineados a la derecha */}
      <div
        className="shrink-0 sticky bottom-0 z-10 bg-white/95 backdrop-blur border-t border-slate-200 shadow-[0_-8px_20px_rgba(30,41,59,0.08)] px-4 py-3 md:py-2"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        <div className="flex gap-2.5 max-w-5xl mx-auto w-full md:justify-end">
          {!form.readOnly && (
            <button
              onClick={() => form.save()}
              disabled={form.saving}
              className="min-h-[48px] md:min-h-[38px] px-4 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 disabled:opacity-50"
            >
              {form.saving ? 'Guardando…' : 'Guardar'}
            </button>
          )}
          <a
            href={reporteHref}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[48px] md:min-h-[38px] px-4 rounded-xl border-[1.5px] border-teal-700 bg-white text-sm font-semibold text-teal-700 inline-flex items-center justify-center"
          >
            {form.readOnly && ot?.pdfUrl ? 'Ver PDF' : 'Reporte'}
          </a>
          <button
            onClick={() => setSolicitarOpen(true)}
            disabled={!ot}
            className="flex-1 md:flex-none min-h-[48px] md:min-h-[38px] px-4 md:px-6 rounded-xl bg-teal-700 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            Solicitar presupuesto
          </button>
        </div>
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
