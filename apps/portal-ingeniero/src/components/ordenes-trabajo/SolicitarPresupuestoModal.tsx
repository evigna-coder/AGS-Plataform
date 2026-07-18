import { useState } from 'react';
import type { Sistema } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { misOTService, type MisOTDoc, type ParteSolicitada } from '../../services/misOTService';

interface Props {
  open: boolean;
  onClose: () => void;
  ot: MisOTDoc;
  sistema: Sistema | null;
}

type Step = 'confirm' | 'working' | 'done' | 'error';

interface ParteRow { numeroParte: string; cantidad: string }

const ROW_VACIA: ParteRow = { numeroParte: '', cantidad: '1' };

/**
 * Flujo "Solicitar presupuesto" desde una OT:
 * el ingeniero declara número de parte + cantidad (van como items sin precio
 * al presupuesto) → confirma → número atómico + presupuesto borrador + ticket
 * a ventas → muestra el número PRE-XXXX.RR bien visible.
 */
export default function SolicitarPresupuestoModal({ open, onClose, ot, sistema }: Props) {
  const [step, setStep] = useState<Step>('confirm');
  const [numero, setNumero] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [partes, setPartes] = useState<ParteRow[]>([{ ...ROW_VACIA }]);

  const reset = () => { setStep('confirm'); setNumero(''); setErrorMsg(''); setPartes([{ ...ROW_VACIA }]); };
  const handleClose = () => { if (step !== 'working') { onClose(); reset(); } };

  const setParte = (idx: number, patch: Partial<ParteRow>) =>
    setPartes(prev => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));

  // Válido: toda fila con número de parte necesita cantidad ≥ 1; al menos una parte declarada.
  const partesLimpias: ParteSolicitada[] = partes
    .filter(p => p.numeroParte.trim())
    .map(p => ({ numeroParte: p.numeroParte.trim(), cantidad: parseInt(p.cantidad, 10) || 0 }));
  const partesValidas = partesLimpias.length > 0 && partesLimpias.every(p => p.cantidad >= 1);

  async function handleConfirm() {
    setStep('working');
    try {
      const res = await misOTService.solicitarPresupuesto(ot, sistema, partesLimpias);
      setNumero(res.numero);
      setStep('done');
    } catch (err) {
      console.error('[SolicitarPresupuesto] failed:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Error inesperado');
      setStep('error');
    }
  }

  const equipoLabel = [sistema?.nombre || ot.sistema, sistema?.agsVisibleId].filter(Boolean).join(' · ');
  const inputCls = 'border border-slate-300 rounded-lg px-2.5 py-2 text-sm bg-white text-slate-900 '
    + 'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500';

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Solicitar presupuesto"
      footer={
        step === 'confirm' ? (
          <>
            <Button variant="secondary" onClick={handleClose}>Cancelar</Button>
            <Button onClick={handleConfirm} disabled={!partesValidas}>Generar presupuesto</Button>
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
            al encargado de presupuestos para ponerle precios y enviarlo.
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 space-y-1 text-xs">
            <p><span className="font-mono text-[10px] uppercase tracking-wider text-slate-500 mr-2">Cliente</span>{ot.razonSocial || '—'}</p>
            <p><span className="font-mono text-[10px] uppercase tracking-wider text-slate-500 mr-2">Equipo</span>{equipoLabel || '—'}</p>
            <p><span className="font-mono text-[10px] uppercase tracking-wider text-slate-500 mr-2">Servicio</span>{ot.tipoServicio || '—'}</p>
          </div>

          <div className="space-y-1.5">
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Partes solicitadas</p>
            {partes.map((p, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <input
                  className={`${inputCls} flex-1 min-w-0 font-mono`}
                  placeholder="N° de parte (ej: G1312-60067)"
                  value={p.numeroParte}
                  onChange={e => setParte(idx, { numeroParte: e.target.value })}
                  autoFocus={idx === 0}
                />
                <input
                  className={`${inputCls} w-16 text-center`}
                  type="number"
                  min={1}
                  inputMode="numeric"
                  placeholder="Cant."
                  value={p.cantidad}
                  onChange={e => setParte(idx, { cantidad: e.target.value })}
                />
                {partes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setPartes(prev => prev.filter((_, i) => i !== idx))}
                    className="text-slate-400 hover:text-red-600 px-1 text-lg leading-none"
                    aria-label="Quitar parte"
                  >×</button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setPartes(prev => [...prev, { ...ROW_VACIA }])}
              className="text-teal-700 hover:text-teal-800 text-xs font-medium"
            >+ Agregar otra parte</button>
            <p className="text-[11px] text-slate-400">
              Van al presupuesto como items sin precio; ventas los completa.
            </p>
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
            al encargado de presupuestos para ponerle precios y enviarlo al cliente.
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
