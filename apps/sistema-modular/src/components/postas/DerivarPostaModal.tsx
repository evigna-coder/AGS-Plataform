import { useState, useEffect } from 'react';
import type { PostaWorkflow, PostaHandoff, UsuarioAGS } from '@ags/shared';
import { postasService, usuariosService } from '../../services/firebaseService';
import { useAuth } from '../../contexts/AuthContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface DerivarPostaModalProps {
  posta: PostaWorkflow;
  onClose: () => void;
  onDerived: () => void;
}

export const DerivarPostaModal = ({ posta, onClose, onDerived }: DerivarPostaModalProps) => {
  const { usuario } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioAGS[]>([]);
  const [destinatarioId, setDestinatarioId] = useState('');
  const [accionRequerida, setAccionRequerida] = useState('');
  const [comentario, setComentario] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { usuariosService.getAll().then(u => setUsuarios(u.filter(x => x.status === 'activo'))); }, []);

  const destinatario = usuarios.find(u => u.id === destinatarioId);

  const handleSubmit = async () => {
    if (!destinatarioId || !accionRequerida.trim() || !usuario || !destinatario) return;
    setSaving(true);
    try {
      const handoff: PostaHandoff = {
        fecha: new Date().toISOString(),
        deUsuarioId: usuario.id,
        deUsuarioNombre: usuario.displayName,
        aUsuarioId: destinatarioId,
        aUsuarioNombre: destinatario.displayName,
        accion: 'Derivar',
        comentario: comentario.trim() || null,
      };
      await postasService.addHandoff(posta.id, handoff);
      await postasService.update(posta.id, {
        responsableId: destinatarioId,
        responsableNombre: destinatario.displayName,
        accionRequerida: accionRequerida.trim(),
        estado: 'pendiente',
        comentario: comentario.trim() || null,
      });
      onDerived();
    } catch {
      alert('Error al derivar la posta');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title="Derivar posta" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-[11px] font-medium text-slate-400 mb-1 block">Posta actual</label>
          <p className="text-xs text-slate-700">{posta.entidadNumero} — {posta.accionRequerida}</p>
        </div>

        <div>
          <label className="text-[11px] font-medium text-slate-400 mb-1 block">Derivar a *</label>
          <select
            value={destinatarioId}
            onChange={e => setDestinatarioId(e.target.value)}
            className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Seleccionar usuario...</option>
            {usuarios.map(u => <option key={u.id} value={u.id}>{u.displayName} ({u.role})</option>)}
          </select>
        </div>

        <Input
          label="Accion requerida *"
          inputSize="sm"
          value={accionRequerida}
          onChange={e => setAccionRequerida(e.target.value)}
          placeholder="Que debe hacer el destinatario..."
        />

        <div>
          <label className="text-[11px] font-medium text-slate-400 mb-1 block">Comentario (opcional)</label>
          <textarea
            value={comentario}
            onChange={e => setComentario(e.target.value)}
            rows={3}
            className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            placeholder="Informacion adicional..."
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSubmit} disabled={!destinatarioId || !accionRequerida.trim() || saving}>
            {saving ? 'Derivando...' : 'Derivar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
