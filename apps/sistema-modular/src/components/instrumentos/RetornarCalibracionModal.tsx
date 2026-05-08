import { useState, useRef, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useInstrumentos } from '../../hooks/useInstrumentos';
import { formatFechaAR } from '../../utils/formatFecha';
import type { InstrumentoPatron } from '@ags/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  instrumento: InstrumentoPatron;
  onRetornado: () => void;
}

export function RetornarCalibracionModal({ open, onClose, instrumento, onRetornado }: Props) {
  const { retornarDeCalibracion } = useInstrumentos();
  const fileRef = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [emisor, setEmisor] = useState('');
  const [fechaEmision, setFechaEmision] = useState('');
  const [vencimiento, setVencimiento] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setArchivo(null);
    setEmisor('');
    setFechaEmision('');
    setVencimiento('');
    setError(null);
  }, [open]);

  const canSubmit = !!archivo && !!vencimiento;

  const handleSubmit = async () => {
    if (!canSubmit || !archivo) return;
    setSubmitting(true);
    setError(null);
    try {
      await retornarDeCalibracion(instrumento.id, {
        nuevoCert: archivo,
        nuevoEmisor: emisor.trim() || null,
        nuevoFechaEmision: fechaEmision || null,
        nuevoVencimiento: vencimiento,
      });
      onRetornado();
      onClose();
    } catch (err) {
      console.error('Error retornando de calibración:', err);
      setError(err instanceof Error ? err.message : 'No se pudo retornar el instrumento');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Retornar de calibración"
      subtitle={instrumento.nombre}
      maxWidth="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>Cancelar</Button>
          <Button size="sm" onClick={() => void handleSubmit()} disabled={!canSubmit || submitting}>
            {submitting ? 'Guardando…' : 'Retornar y actualizar certificado'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{error}</div>
        )}

        {instrumento.calibracionProveedorNombre && (
          <div className="text-xs text-slate-500 border-l-2 border-amber-300 pl-2.5">
            Enviado a <strong className="text-slate-700">{instrumento.calibracionProveedorNombre}</strong>
            {instrumento.calibracionFechaEnvio && ` el ${formatFechaAR(instrumento.calibracionFechaEnvio)}`}
            {instrumento.calibracionRemitoNumero && ` · Remito ${instrumento.calibracionRemitoNumero}`}
          </div>
        )}

        <div>
          <label className="block text-[11px] font-mono uppercase tracking-wide text-slate-500 mb-1.5">
            Nuevo certificado (PDF) *
          </label>
          {archivo ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-teal-700 font-medium truncate max-w-xs">{archivo.name}</span>
              <button onClick={() => fileRef.current?.click()}
                className="text-slate-500 hover:text-slate-700 underline">
                Cambiar
              </button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              Seleccionar PDF…
            </Button>
          )}
          <input ref={fileRef} type="file" accept=".pdf" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) setArchivo(f); e.target.value = ''; }} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input inputSize="sm" label="Emisor" value={emisor}
            onChange={e => setEmisor(e.target.value)} placeholder="Ej: Lab. ABC" />
          <Input inputSize="sm" label="Fecha de emisión" type="date" value={fechaEmision}
            onChange={e => setFechaEmision(e.target.value)} />
          <Input inputSize="sm" label="Vencimiento *" type="date" value={vencimiento}
            onChange={e => setVencimiento(e.target.value)} />
        </div>

        <p className="text-[11px] text-slate-500 leading-relaxed">
          El certificado actual del instrumento se moverá al historial (queda accesible para auditorías). El nuevo certificado pasa a ser el vigente y el instrumento vuelve al estado <strong>Operativo</strong>.
        </p>
      </div>
    </Modal>
  );
}
