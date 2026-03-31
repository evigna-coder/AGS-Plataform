import { useState } from 'react';
import type { Lead, Posta } from '@ags/shared';
import { leadsService } from '../../services/firebaseService';
import { useAuth } from '../../contexts/AuthContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface LeadQuickNoteModalProps {
  lead: Lead;
  onClose: () => void;
  onAdded: () => void;
}

export default function LeadQuickNoteModal({ lead, onClose, onAdded }: LeadQuickNoteModalProps) {
  const { usuario } = useAuth();
  const [texto, setTexto] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!usuario || !texto.trim()) return;
    setSaving(true);
    try {
      const posta: Posta = {
        id: crypto.randomUUID(),
        fecha: new Date().toISOString(),
        deUsuarioId: usuario.id,
        deUsuarioNombre: usuario.displayName,
        aUsuarioId: lead.asignadoA || usuario.id,
        aUsuarioNombre: lead.asignadoNombre || usuario.displayName,
        comentario: texto.trim(),
        estadoAnterior: lead.estado,
        estadoNuevo: lead.estado,
      };
      await leadsService.agregarComentario(lead.id, posta);
      onAdded();
    } catch {
      alert('Error al agregar nota');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title="Nota rápida" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-slate-500">{lead.razonSocial} — {lead.contacto}</p>
        <textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          rows={3}
          autoFocus
          placeholder="Escribí una nota o actualización..."
          className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
        />
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving || !texto.trim()}>
            {saving ? 'Guardando...' : 'Agregar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
