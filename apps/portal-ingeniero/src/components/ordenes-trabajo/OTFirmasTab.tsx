import { useRef, useState } from 'react';
import type { WorkOrder } from '@ags/shared';
import type { useOTForm } from '../../hooks/useOTForm';
import { SignaturePad, type SignaturePadHandle } from './SignaturePad';
import { Button } from '../ui/Button';
import { generateOTPdf } from '../../utils/pdfGenerator';

const inp = 'w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-slate-50 disabled:text-slate-500';
const lbl = 'block font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1';

/** Tab "Firmas": pads de firma + finalización (sin cambios funcionales del rediseño). */
export default function OTFirmasTab({ form, ot }: {
  form: ReturnType<typeof useOTForm>;
  ot: (WorkOrder & { pdfUrl?: string | null }) | null;
}) {
  const [finalizing, setFinalizing] = useState(false);
  const engineerPad = useRef<SignaturePadHandle>(null);
  const clientPad = useRef<SignaturePadHandle>(null);

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
      const updated = { ...ot!, signatureEngineer: sigEng, signatureClient: sigCli, status: 'FINALIZADO' as const };
      await generateOTPdf(updated);
    } catch { alert('Error al finalizar la OT.'); }
    finally { setFinalizing(false); }
  }

  return (
    <>
      {form.readOnly && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <p className="text-xs font-medium text-emerald-800">Esta OT ya fue finalizada.</p>
          <p className="text-[11px] text-emerald-600 mt-0.5">Las firmas y datos están guardados.</p>
        </div>
      )}
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
      {!form.readOnly ? (
        <Button size="lg" className="w-full mt-2" onClick={handleFinalize} disabled={finalizing || form.saving}>
          {finalizing ? 'Finalizando...' : 'Finalizar y generar PDF'}
        </Button>
      ) : (
        <Button size="lg" variant="secondary" className="w-full mt-2" onClick={() => generateOTPdf(ot!)}>
          Descargar PDF
        </Button>
      )}
    </>
  );
}
