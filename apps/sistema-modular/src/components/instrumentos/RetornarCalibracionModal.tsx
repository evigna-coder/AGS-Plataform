import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { PdfPickerRow } from './PdfPickerRow';
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
  const [archivo, setArchivo] = useState<File | null>(null);
  const [trazabilidad, setTrazabilidad] = useState<File | null>(null);
  const [emisor, setEmisor] = useState('');
  const [fechaEmision, setFechaEmision] = useState('');
  const [vencimiento, setVencimiento] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setArchivo(null);
    setTrazabilidad(null);
    setEmisor('');
    setFechaEmision('');
    setVencimiento('');
    setError(null);
  }, [open]);

  const canSubmit = !!archivo && !!trazabilidad && !!vencimiento;

  const handleSubmit = async () => {
    if (!canSubmit || !archivo || !trazabilidad) return;
    setSubmitting(true);
    setError(null);
    try {
      await retornarDeCalibracion(instrumento.id, {
        nuevoCert: archivo,
        nuevoEmisor: emisor.trim() || null,
        nuevoFechaEmision: fechaEmision || null,
        nuevoVencimiento: vencimiento,
        nuevaTrazabilidad: trazabilidad,
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

        <PdfPickerRow label="Nuevo certificado (PDF) *" file={archivo} onPick={setArchivo} />

        <PdfPickerRow label="Trazabilidad (PDF) *" file={trazabilidad} onPick={setTrazabilidad} />

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
