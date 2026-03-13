import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { leadsService, usuariosService } from '../../services/firebaseService';
import type { Lead, Posta, LeadEstado } from '@ags/shared';

interface Props {
  lead: Lead;
  onClose: () => void;
  onSuccess: () => void;
}

export default function DerivarLeadModal({ lead, onClose, onSuccess }: Props) {
  const { usuario } = useAuth();
  const [usuarios, setUsuarios] = useState<{ id: string; displayName: string }[]>([]);
  const [destinatarioId, setDestinatarioId] = useState('');
  const [comentario, setComentario] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    usuariosService.getIngenieros().then(setUsuarios);
  }, []);

  const handleSubmit = async () => {
    if (!destinatarioId) return;
    const destUser = usuarios.find(u => u.id === destinatarioId);
    setSaving(true);
    try {
      const posta: Posta = {
        id: crypto.randomUUID(),
        fecha: new Date().toISOString(),
        deUsuarioId: usuario?.id ?? '',
        deUsuarioNombre: usuario?.displayName ?? '',
        aUsuarioId: destinatarioId,
        aUsuarioNombre: destUser?.displayName ?? '',
        comentario: comentario.trim() || undefined,
        estadoAnterior: lead.estado,
        estadoNuevo: 'derivado' as LeadEstado,
      };
      await leadsService.derivar(lead.id, posta, destinatarioId);
      onSuccess();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={true} title="Derivar Lead" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="text-[11px] font-medium text-slate-500 mb-0.5 block">Derivar a *</label>
          <select
            value={destinatarioId}
            onChange={e => setDestinatarioId(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Seleccionar...</option>
            {usuarios.map(u => <option key={u.id} value={u.id}>{u.displayName}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-medium text-slate-500 mb-0.5 block">Comentario</label>
          <textarea
            value={comentario}
            onChange={e => setComentario(e.target.value)}
            rows={3}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            placeholder="Motivo de derivación..."
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving || !destinatarioId}>
            {saving ? 'Derivando...' : 'Derivar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
