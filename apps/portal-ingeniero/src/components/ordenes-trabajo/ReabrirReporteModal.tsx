import { useState } from 'react';
import { TEXTO_AVISO_REAPERTURA_TECNICA } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { misOTService, type MisOTDoc } from '../../services/misOTService';

interface Props {
  open: boolean;
  ot: MisOTDoc;
  onClose: () => void;
  /** Reabierto: el caller refresca (el reporte vuelve a ser editable). */
  onReabierto: () => void;
}

type Step = 'confirm' | 'working' | 'done' | 'error';

/**
 * Reabrir el reporte técnico desde el portal (2026-09-10): el ingeniero está en
 * el cliente a las 19 hs y no puede depender de un administrativo. Reabre en
 * nivel TÉCNICO (vuelve a En Curso, reporte editable en la app de campo).
 * La firma del cliente se borra: hay que avisarle y se vuelve a firmar.
 */
export default function ReabrirReporteModal({ open, ot, onClose, onReabierto }: Props) {
  const [step, setStep] = useState<Step>('confirm');
  const [motivo, setMotivo] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [entendido, setEntendido] = useState(false);

  const handleClose = () => {
    if (step === 'working') return;
    onClose();
    setStep('confirm'); setMotivo(''); setErrorMsg(''); setEntendido(false);
  };

  const handleConfirm = async () => {
    setStep('working');
    try {
      await misOTService.reabrirReporte(ot, motivo);
      setStep('done');
      onReabierto();
    } catch (err) {
      console.error('[ReabrirReporte] failed:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Error inesperado');
      setStep('error');
    }
  };

  const puede = motivo.trim().length > 0 && entendido;

  return (
    <Modal open={open} onClose={handleClose} title={`Reabrir reporte OT ${ot.otNumber}`}
      footer={
        step === 'confirm' ? (
          <>
            <Button variant="secondary" onClick={handleClose}>Cancelar</Button>
            <Button onClick={handleConfirm} disabled={!puede}>Reabrir reporte</Button>
          </>
        ) : step === 'done' || step === 'error' ? (
          <Button onClick={handleClose}>Cerrar</Button>
        ) : undefined
      }>
      {step === 'confirm' && (
        <div className="space-y-3 text-sm text-slate-700">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5 text-xs text-amber-900 space-y-1">
            <p className="font-semibold">Antes de reabrir</p>
            <p>{TEXTO_AVISO_REAPERTURA_TECNICA}</p>
            <p>El PDF ya generado se resguarda. El reporte vuelve a En Curso y se edita desde la app de campo; al finalizarlo de nuevo se regenera el PDF.</p>
            {ot.cierreAdmin?.stockDeducido && <p>El stock ya descontado por administración se mantiene; si hay que corregirlo, se hace desde el re-cierre.</p>}
          </div>
          <div>
            <label className="font-mono text-[10px] uppercase tracking-wider text-slate-500 block mb-1">Motivo *</label>
            <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3}
              placeholder="Qué hay que corregir"
              className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <label className="flex items-start gap-2 cursor-pointer text-xs">
            <input type="checkbox" className="mt-0.5 accent-teal-600" checked={entendido} onChange={e => setEntendido(e.target.checked)} />
            <span>Entendido: le aviso al cliente y el reporte se vuelve a firmar.</span>
          </label>
        </div>
      )}
      {step === 'working' && (
        <div className="py-6 text-center space-y-2">
          <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-600">Reabriendo…</p>
        </div>
      )}
      {step === 'done' && (
        <div className="py-4 text-center space-y-2">
          <p className="text-sm font-semibold text-teal-800">Reporte reabierto</p>
          <p className="text-xs text-slate-500">Abrilo con "Reporte" para corregirlo. Te quedó un ticket recordando avisar al cliente y volver a firmar.</p>
        </div>
      )}
      {step === 'error' && (
        <div className="py-3 space-y-2">
          <p className="text-sm font-semibold text-red-700">No se pudo reabrir el reporte.</p>
          <p className="text-xs text-slate-500 break-words">{errorMsg}</p>
        </div>
      )}
    </Modal>
  );
}
