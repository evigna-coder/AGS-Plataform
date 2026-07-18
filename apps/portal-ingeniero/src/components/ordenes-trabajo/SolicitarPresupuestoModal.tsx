import { useState } from 'react';
import type { Sistema } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { misOTService, type MisOTDoc } from '../../services/misOTService';

interface Props {
  open: boolean;
  onClose: () => void;
  ot: MisOTDoc;
  sistema: Sistema | null;
}

type Step = 'confirm' | 'working' | 'done' | 'error';

/**
 * Flujo "Solicitar presupuesto" desde una OT:
 * confirma → genera número atómico + presupuesto borrador + ticket a ventas →
 * muestra el número PRE-XXXX.RR bien visible.
 */
export default function SolicitarPresupuestoModal({ open, onClose, ot, sistema }: Props) {
  const [step, setStep] = useState<Step>('confirm');
  const [numero, setNumero] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const reset = () => { setStep('confirm'); setNumero(''); setErrorMsg(''); };
  const handleClose = () => { if (step !== 'working') { onClose(); reset(); } };

  async function handleConfirm() {
    setStep('working');
    try {
      const res = await misOTService.solicitarPresupuesto(ot, sistema);
      setNumero(res.numero);
      setStep('done');
    } catch (err) {
      console.error('[SolicitarPresupuesto] failed:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Error inesperado');
      setStep('error');
    }
  }

  const equipoLabel = [sistema?.nombre || ot.sistema, sistema?.agsVisibleId].filter(Boolean).join(' · ');

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Solicitar presupuesto"
      footer={
        step === 'confirm' ? (
          <>
            <Button variant="secondary" onClick={handleClose}>Cancelar</Button>
            <Button onClick={handleConfirm}>Generar presupuesto</Button>
          </>
        ) : step === 'done' || step === 'error' ? (
          <Button onClick={handleClose}>Cerrar</Button>
        ) : undefined
      }
    >
      {step === 'confirm' && (
        <div className="space-y-3 text-sm text-slate-700">
          <p>
            Se va a crear un presupuesto <strong>en borrador</strong> vinculado a la
            OT <span className="font-mono font-semibold">{ot.otNumber}</span> y un ticket
            al encargado de presupuestos para completarlo y enviarlo.
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 space-y-1 text-xs">
            <p><span className="font-mono text-[10px] uppercase tracking-wider text-slate-500 mr-2">Cliente</span>{ot.razonSocial || '—'}</p>
            <p><span className="font-mono text-[10px] uppercase tracking-wider text-slate-500 mr-2">Equipo</span>{equipoLabel || '—'}</p>
            <p><span className="font-mono text-[10px] uppercase tracking-wider text-slate-500 mr-2">Servicio</span>{ot.tipoServicio || '—'}</p>
          </div>
        </div>
      )}

      {step === 'working' && (
        <div className="py-6 text-center space-y-2">
          <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-600">Generando presupuesto…</p>
        </div>
      )}

      {step === 'done' && (
        <div className="py-4 text-center space-y-3">
          <p className="text-sm text-slate-600">Se generó el presupuesto</p>
          <p className="font-mono text-3xl font-bold text-teal-800 tracking-tight">{numero}</p>
          <p className="text-xs text-slate-500">
            Quedó en borrador, vinculado a la OT {ot.otNumber}. Se creó un ticket
            al encargado de presupuestos para completarlo y enviarlo al cliente.
          </p>
        </div>
      )}

      {step === 'error' && (
        <div className="py-3 space-y-2">
          <p className="text-sm font-semibold text-red-700">No se pudo generar el presupuesto.</p>
          <p className="text-xs text-slate-500 break-words">{errorMsg}</p>
          <p className="text-xs text-slate-500">Verificá la conexión y volvé a intentar.</p>
        </div>
      )}
    </Modal>
  );
}
