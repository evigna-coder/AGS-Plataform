import { useState } from 'react';
import type { Factura } from '@ags/shared';
import { facturasService } from '../../services/facturasService';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface AprobarFacturaModalProps {
  factura: Factura;
  actor: string;
  onClose: () => void;
  onApproved?: () => void;
}

/**
 * Aprobación con comentario opcional (pedido 2026-08-03): "está ok,
 * corresponde a tal cosa". El comentario queda en el historial de la factura
 * marcado como aprobación, y el creador recibe un ticket de aviso.
 */
export const AprobarFacturaModal = ({ factura, actor, onClose, onApproved }: AprobarFacturaModalProps) => {
  const [comentario, setComentario] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAprobar = async () => {
    setSaving(true);
    try {
      await facturasService.aprobar(factura.id, actor, comentario);
      onApproved?.();
      onClose();
    } catch (err) {
      console.error('Error al aprobar la factura:', err);
      alert('Error al aprobar la factura');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title="Aprobar factura" subtitle={`${factura.numero ?? 'Factura'} · ${factura.proveedorNombre}`} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide font-mono block mb-1">
            Comentario de aprobación (opcional)
          </label>
          <textarea
            value={comentario}
            onChange={e => setComentario(e.target.value)}
            rows={3}
            autoFocus
            placeholder='Ej: "Está OK, corresponde al service del HPLC de mayo."'
            className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
          />
          {factura.createdByName && (
            <p className="text-[10px] text-slate-400 mt-1">
              Se le avisará por ticket a {factura.createdByName} (cargó la factura).
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button size="sm" onClick={handleAprobar} disabled={saving}>
            {saving ? 'Aprobando...' : 'Aprobar factura'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
