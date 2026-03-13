import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { leadsService } from '../../services/firebaseService';
import type { Lead, Posta, LeadEstado } from '@ags/shared';

interface Props {
  lead: Lead;
  onClose: () => void;
  onSuccess: () => void;
}

const RESULTADOS: { value: LeadEstado; label: string }[] = [
  { value: 'finalizado', label: 'Finalizado (resuelto)' },
  { value: 'perdido', label: 'Perdido' },
];

export default function FinalizarLeadModal({ lead, onClose, onSuccess }: Props) {
  const { usuario } = useAuth();
  const [resultado, setResultado] = useState<LeadEstado>('finalizado');
  const [comentario, setComentario] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const posta: Posta = {
        id: crypto.randomUUID(),
        fecha: new Date().toISOString(),
        deUsuarioId: usuario?.id ?? '',
        deUsuarioNombre: usuario?.displayName ?? '',
        aUsuarioId: usuario?.id ?? '',
        aUsuarioNombre: usuario?.displayName ?? '',
        comentario: comentario.trim() || undefined,
        estadoAnterior: lead.estado,
        estadoNuevo: resultado,
      };
      await leadsService.finalizar(lead.id, posta);
      onSuccess();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={true} title="Finalizar Lead" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="text-[11px] font-medium text-slate-500 mb-0.5 block">Resultado *</label>
          <select
            value={resultado}
            onChange={e => setResultado(e.target.value as LeadEstado)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {RESULTADOS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-medium text-slate-500 mb-0.5 block">Comentario</label>
          <textarea
            value={comentario}
            onChange={e => setComentario(e.target.value)}
            rows={3}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            placeholder="Notas de cierre..."
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" variant={resultado === 'perdido' ? 'danger' : 'primary'} onClick={handleSubmit} disabled={saving}>
            {saving ? 'Finalizando...' : resultado === 'perdido' ? 'Marcar perdido' : 'Finalizar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
