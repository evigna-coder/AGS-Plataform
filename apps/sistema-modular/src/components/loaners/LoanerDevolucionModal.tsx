import { useRef, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface Props {
  open: boolean;
  onClose: () => void;
  clienteNombre: string;
  onConfirm: (data: {
    fechaRetornoReal: string;
    condicionRetorno: string;
    /** Ciclo de recalificación: genera OT interna + ticket y deja el loaner NO disponible. */
    requiereRecalificacion: boolean;
    /** Fotos del retorno (opcionales) — se suben con contexto 'devolucion'. */
    fotos: File[];
  }) => Promise<void>;
}

export function LoanerDevolucionModal({ open, onClose, clienteNombre, onConfirm }: Props) {
  const [condicion, setCondicion] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [requiereRecalificacion, setRequiereRecalificacion] = useState(true);
  const [fotos, setFotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleConfirm = async () => {
    if (!condicion.trim() || !fecha) return;
    setSaving(true);
    try {
      await onConfirm({
        fechaRetornoReal: new Date(fecha).toISOString(),
        condicionRetorno: condicion.trim(),
        requiereRecalificacion,
        fotos,
      });
      onClose();
      setCondicion('');
      setRequiereRecalificacion(true);
      setFotos([]);
      if (fileRef.current) fileRef.current.value = '';
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Registrar devolucion" subtitle={`Cliente: ${clienteNombre}`} footer={
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" size="sm" onClick={handleConfirm} disabled={!condicion.trim() || saving}>
          {saving ? 'Guardando...' : 'Confirmar devolucion'}
        </Button>
      </div>
    }>
      <div className="space-y-4">
        <Input label="Fecha de devolucion *" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Condicion al retorno *</label>
          <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-[60px]" value={condicion} onChange={e => setCondicion(e.target.value)} placeholder="Estado del equipo al ser devuelto" />
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={requiereRecalificacion}
              onChange={e => setRequiereRecalificacion(e.target.checked)}
              className="rounded border-slate-300" />
            Requiere recalificación (genera OT + ticket)
          </label>
          <p className="text-[11px] text-slate-400 mt-1 ml-6">
            {requiereRecalificacion
              ? 'El loaner queda "En recalificación" (no disponible) hasta el cierre técnico de la OT.'
              : 'El loaner vuelve directo a "En base" (disponible).'}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Fotos del retorno <span className="text-slate-400 font-normal">(opcional)</span></label>
          <input ref={fileRef} type="file" accept="image/*" multiple
            onChange={e => setFotos(Array.from(e.target.files ?? []))}
            className="block w-full text-xs text-slate-500 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-teal-50 file:text-teal-700 file:text-xs file:font-medium hover:file:bg-teal-100" />
          {fotos.length > 0 && (
            <p className="text-[11px] text-slate-400 mt-1">{fotos.length} foto(s) seleccionada(s)</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
