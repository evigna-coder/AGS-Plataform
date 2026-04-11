import { useEffect, useState } from 'react';
import type { Pendiente } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { pendientesService } from '../../services/pendientesService';

const lbl = 'block text-[10px] font-mono font-medium text-slate-500 mb-1 uppercase tracking-wide';
const inputClass = 'w-full border border-[#E5E5E5] rounded-md px-3 py-1.5 text-xs';

interface Props {
  open: boolean;
  onClose: () => void;
  onDescartada?: () => void;
  pendiente: Pendiente | null;
}

export const DescartarPendienteModal: React.FC<Props> = ({
  open,
  onClose,
  onDescartada,
  pendiente,
}) => {
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setMotivo('');
      setError(null);
    }
  }, [open]);

  if (!pendiente) return null;

  const handleConfirm = async () => {
    setSaving(true);
    setError(null);
    try {
      await pendientesService.descartar(pendiente.id, motivo.trim() || null);
      onDescartada?.();
      onClose();
    } catch (err) {
      console.error('Error descartando pendiente:', err);
      setError('No se pudo descartar. Intente nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Descartar pendiente"
      subtitle="La pendiente se marcará como descartada y ya no aparecerá en presupuestos u OTs"
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Resumen de la pendiente */}
        <div className="bg-slate-50 border border-slate-200 rounded-md px-3 py-2 space-y-1">
          <p className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wide">
            Pendiente
          </p>
          <p className="text-xs text-slate-700 font-medium">{pendiente.clienteNombre}</p>
          {pendiente.equipoNombre && (
            <p className="text-[11px] text-slate-500">{pendiente.equipoNombre}</p>
          )}
          <p className="text-[11px] text-slate-600 italic">{pendiente.descripcion}</p>
        </div>

        <div>
          <label className={lbl}>Motivo (opcional)</label>
          <textarea
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            rows={3}
            className={`${inputClass} resize-none`}
            placeholder="Ej: Ya se resolvió en otra visita, el cliente no lo requiere, etc."
            maxLength={300}
          />
        </div>

        {error && (
          <div className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={saving} variant="danger">
            {saving ? 'Descartando...' : 'Descartar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
