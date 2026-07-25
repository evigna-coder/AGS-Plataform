import { useState, useEffect } from 'react';
import type { WorkOrder } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { certificacionesService } from '../../services/certificacionesService';
import { useAuth } from '../../contexts/AuthContext';

const lbl = 'text-[10px] font-mono uppercase tracking-wide text-slate-500 mb-0.5 block';
const inp = 'w-full border rounded-lg px-2.5 py-1 text-xs bg-white border-slate-300';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  clienteId?: string | null;
  clienteNombre?: string | null;
  /** OTs retenidas por 'certificacion' de este cliente. */
  ots: WorkOrder[];
}

/**
 * Registra la certificación del cliente y libera las OTs seleccionadas para
 * facturación (clientes `requisitoFacturacion === 'certificacion'`, ej. YPF/Y-tec).
 */
export const RegistrarCertificacionModal: React.FC<Props> = ({ open, onClose, onCreated, clienteId, clienteNombre, ots }) => {
  const { firebaseUser, usuario } = useAuth();
  const [numero, setNumero] = useState('');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [archivo, setArchivo] = useState<File | null>(null);
  const [observaciones, setObservaciones] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNumero(''); setArchivo(null); setObservaciones(''); setError(null);
    setFecha(new Date().toISOString().slice(0, 10));
    setSelected(new Set(ots.map(o => o.otNumber)));
  }, [open, ots]);

  const toggle = (otNumber: string) => setSelected(prev => {
    const n = new Set(prev);
    if (n.has(otNumber)) n.delete(otNumber); else n.add(otNumber);
    return n;
  });

  const canSubmit = selected.size > 0 && fecha.length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await certificacionesService.create({
        numero: numero.trim() || null,
        clienteId: clienteId ?? null,
        clienteNombre: clienteNombre ?? null,
        fecha,
        otNumbers: [...selected],
        archivo,
        observaciones: observaciones.trim() || null,
      }, { uid: firebaseUser?.uid || '', name: usuario?.displayName });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar la certificación');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar certificación"
      subtitle={clienteNombre ?? undefined}
      maxWidth="lg"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? 'Registrando...' : `Registrar y liberar (${selected.size})`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className={lbl}>N° de certificación</span>
            <input value={numero} onChange={e => setNumero(e.target.value)} placeholder="Opcional" className={inp} />
          </div>
          <div>
            <span className={lbl}>Fecha</span>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inp} />
          </div>
        </div>

        <div>
          <span className={lbl}>Archivo de la certificación</span>
          <input type="file" accept="image/*,application/pdf" onChange={e => setArchivo(e.target.files?.[0] ?? null)}
            className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-1 file:text-teal-700" />
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-2">Servicios cubiertos ({selected.size}/{ots.length})</p>
          <div className="space-y-1">
            {ots.map(ot => (
              <label key={ot.otNumber} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input type="checkbox" checked={selected.has(ot.otNumber)} onChange={() => toggle(ot.otNumber)} className="w-3.5 h-3.5" />
                <span className="font-mono">{ot.otNumber}</span>
                <span className="text-slate-400 truncate">{ot.sistema || ''}{ot.tipoServicio ? ` · ${ot.tipoServicio}` : ''}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <span className={lbl}>Observaciones</span>
          <input value={observaciones} onChange={e => setObservaciones(e.target.value)} className={inp} />
        </div>

        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
      </div>
    </Modal>
  );
};
