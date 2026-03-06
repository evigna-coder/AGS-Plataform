import { useState, useEffect } from 'react';
import type { Lead, LeadEstado, UsuarioAGS, Posta } from '@ags/shared';
import { LEAD_ESTADO_LABELS } from '@ags/shared';
import { leadsService, usuariosService } from '../../services/firebaseService';
import { useAuth } from '../../contexts/AuthContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface DerivarLeadModalProps {
  lead: Lead;
  onClose: () => void;
  onDerived: () => void;
}

const DERIVAR_ESTADOS: LeadEstado[] = ['en_revision', 'derivado', 'en_proceso'];

export const DerivarLeadModal = ({ lead, onClose, onDerived }: DerivarLeadModalProps) => {
  const { usuario } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioAGS[]>([]);
  const [destinatarioId, setDestinatarioId] = useState('');
  const [nuevoEstado, setNuevoEstado] = useState<LeadEstado>('derivado');
  const [comentario, setComentario] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { usuariosService.getAll().then(u => setUsuarios(u.filter(x => x.status === 'activo'))); }, []);

  const destinatario = usuarios.find(u => u.id === destinatarioId);

  const handleSubmit = async () => {
    if (!destinatarioId || !usuario || !destinatario) return;
    setSaving(true);
    try {
      const posta: Posta = {
        id: crypto.randomUUID(),
        fecha: new Date().toISOString(),
        deUsuarioId: usuario.id,
        deUsuarioNombre: usuario.displayName,
        aUsuarioId: destinatarioId,
        aUsuarioNombre: destinatario.displayName,
        comentario: comentario.trim() || undefined,
        estadoAnterior: lead.estado,
        estadoNuevo: nuevoEstado,
      };
      await leadsService.derivar(lead.id, posta, destinatarioId);
      onDerived();
    } catch {
      alert('Error al derivar el lead');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title="Derivar lead" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-[11px] font-medium text-slate-400 mb-1 block">Lead</label>
          <p className="text-xs text-slate-700 font-medium">{lead.razonSocial}</p>
          <p className="text-[10px] text-slate-500">{lead.contacto}</p>
        </div>

        <div>
          <label className="text-[11px] font-medium text-slate-400 mb-1 block">Derivar a *</label>
          <select value={destinatarioId} onChange={e => setDestinatarioId(e.target.value)}
            className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">Seleccionar usuario...</option>
            {usuarios.map(u => <option key={u.id} value={u.id}>{u.displayName} ({u.role})</option>)}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-medium text-slate-400 mb-1 block">Nuevo estado</label>
          <select value={nuevoEstado} onChange={e => setNuevoEstado(e.target.value as LeadEstado)}
            className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {DERIVAR_ESTADOS.map(e => <option key={e} value={e}>{LEAD_ESTADO_LABELS[e]}</option>)}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-medium text-slate-400 mb-1 block">Comentario (opcional)</label>
          <textarea value={comentario} onChange={e => setComentario(e.target.value)} rows={3}
            className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            placeholder="Instrucciones o contexto..." />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSubmit} disabled={!destinatarioId || saving}>
            {saving ? 'Derivando...' : 'Derivar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
