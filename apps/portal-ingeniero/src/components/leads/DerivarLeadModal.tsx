import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { leadsService, usuariosService } from '../../services/firebaseService';
import type { Lead, Posta, LeadEstado, LeadArea } from '@ags/shared';
import { LEAD_ESTADO_LABELS, LEAD_ESTADO_ORDER, LEAD_AREA_LABELS, LEAD_AREA_GROUPS } from '@ags/shared';

interface Props {
  lead: Lead;
  onClose: () => void;
  onSuccess: () => void;
}

export default function DerivarLeadModal({ lead, onClose, onSuccess }: Props) {
  const { usuario } = useAuth();
  const [usuarios, setUsuarios] = useState<{ id: string; displayName: string }[]>([]);
  const [destinatarioId, setDestinatarioId] = useState('');
  const [nuevoEstado, setNuevoEstado] = useState<LeadEstado>(lead.estado);
  const [areaDestino, setAreaDestino] = useState<LeadArea | ''>(lead.areaActual || '');
  const [accionRequerida, setAccionRequerida] = useState('');
  const [comentario, setComentario] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    usuariosService.getIngenieros().then(setUsuarios);
  }, []);

  const handleSubmit = async () => {
    const destUser = usuarios.find(u => u.id === destinatarioId);
    setSaving(true);
    try {
      const posta: Posta = {
        id: crypto.randomUUID(),
        fecha: new Date().toISOString(),
        deUsuarioId: usuario?.id ?? '',
        deUsuarioNombre: usuario?.displayName ?? '',
        aUsuarioId: destinatarioId || '',
        aUsuarioNombre: destUser?.displayName ?? '',
        aArea: areaDestino || undefined,
        comentario: comentario.trim() || undefined,
        estadoAnterior: lead.estado,
        estadoNuevo: nuevoEstado,
        accionRequerida: accionRequerida.trim() || undefined,
      };
      await leadsService.derivar(lead.id, posta, destinatarioId, areaDestino || null, accionRequerida.trim() || null);
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
          <label className="text-[11px] font-medium text-slate-500 mb-0.5 block">Área destino</label>
          <select
            value={areaDestino}
            onChange={e => setAreaDestino(e.target.value as LeadArea | '')}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Sin área específica</option>
            {LEAD_AREA_GROUPS.map(g => (
              <optgroup key={g.label} label={g.label}>
                {g.areas.map(a => <option key={a} value={a}>{LEAD_AREA_LABELS[a]}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-medium text-slate-500 mb-0.5 block">Derivar a (usuario)</label>
          <select
            value={destinatarioId}
            onChange={e => setDestinatarioId(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Sin asignar usuario</option>
            {usuarios.map(u => <option key={u.id} value={u.id}>{u.displayName}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-medium text-slate-500 mb-0.5 block">Nuevo estado</label>
          <select
            value={nuevoEstado}
            onChange={e => setNuevoEstado(e.target.value as LeadEstado)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {LEAD_ESTADO_ORDER.filter(e => e !== 'finalizado' && e !== 'no_concretado').map(e => (
              <option key={e} value={e}>{LEAD_ESTADO_LABELS[e]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-medium text-slate-500 mb-0.5 block">Acción requerida</label>
          <input
            type="text"
            value={accionRequerida}
            onChange={e => setAccionRequerida(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Ej: Averiguar N° de parte..."
          />
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
          <Button size="sm" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Derivando...' : 'Derivar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
