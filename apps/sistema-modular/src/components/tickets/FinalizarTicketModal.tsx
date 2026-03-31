import { useState } from 'react';
import type { Lead, LeadEstado, Posta } from '@ags/shared';
import { leadsService } from '../../services/firebaseService';
import { useAuth } from '../../contexts/AuthContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface FinalizarLeadModalProps {
  lead: Lead;
  onClose: () => void;
  onFinalized: () => void;
}

const MOTIVOS_FINALIZACION = [
  { value: 'finalizado', label: 'Consulta resuelta / Presupuesto generado' },
  { value: 'no_concretado', label: 'No concretado / Sin interés' },
] as const;

export const FinalizarLeadModal = ({ lead, onClose, onFinalized }: FinalizarLeadModalProps) => {
  const { usuario } = useAuth();
  const [estadoFinal, setEstadoFinal] = useState<'finalizado' | 'no_concretado'>('finalizado');
  const [comentario, setComentario] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!usuario) return;
    setSaving(true);
    try {
      const posta: Posta = {
        id: crypto.randomUUID(),
        fecha: new Date().toISOString(),
        deUsuarioId: usuario.id,
        deUsuarioNombre: usuario.displayName,
        aUsuarioId: usuario.id,
        aUsuarioNombre: usuario.displayName,
        comentario: comentario.trim() || undefined,
        estadoAnterior: lead.estado,
        estadoNuevo: estadoFinal as LeadEstado,
      };
      await leadsService.finalizar(lead.id, posta);
      onFinalized();
    } catch {
      alert('Error al finalizar el lead');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title="Finalizar lead" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-[11px] font-medium text-slate-400 mb-1 block">Lead</label>
          <p className="text-xs text-slate-700 font-medium">{lead.razonSocial}</p>
        </div>

        <div>
          <label className="text-[11px] font-medium text-slate-400 mb-1 block">Motivo de cierre</label>
          <select value={estadoFinal} onChange={e => setEstadoFinal(e.target.value as 'finalizado' | 'no_concretado')}
            className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500">
            {MOTIVOS_FINALIZACION.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-medium text-slate-400 mb-1 block">Comentario (opcional)</label>
          <textarea value={comentario} onChange={e => setComentario(e.target.value)} rows={3}
            className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            placeholder="Notas sobre el cierre..." />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Finalizando...' : estadoFinal === 'no_concretado' ? 'Marcar como no concretado' : 'Finalizar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
