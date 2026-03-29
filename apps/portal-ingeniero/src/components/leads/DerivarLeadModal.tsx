import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { leadsService, usuariosService, ingenierosService } from '../../services/firebaseService';
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
  const [ingenieros, setIngenieros] = useState<{ id: string; nombre: string }[]>([]);
  const [destinatarioId, setDestinatarioId] = useState('');
  const [nuevoEstado, setNuevoEstado] = useState<LeadEstado>(lead.estado);
  const [areaDestino, setAreaDestino] = useState<LeadArea | ''>(lead.areaActual || '');
  const [accionRequerida, setAccionRequerida] = useState('');
  const [comentario, setComentario] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    usuariosService.getIngenieros().then(setUsuarios);
    ingenierosService.getAll().then(setIngenieros);
  }, []);

  // Reset destinatario when area changes
  useEffect(() => { setDestinatarioId(''); }, [areaDestino]);

  const isIngeniero = areaDestino === 'ingeniero_soporte';
  const personList = isIngeniero
    ? ingenieros.map(i => ({ id: i.id, label: i.nombre }))
    : usuarios.map(u => ({ id: u.id, label: u.displayName }));

  const getDestinatarioNombre = () => {
    if (!destinatarioId) return '';
    if (isIngeniero) return ingenieros.find(i => i.id === destinatarioId)?.nombre ?? '';
    return usuarios.find(u => u.id === destinatarioId)?.displayName ?? '';
  };

  const handleSubmit = async () => {
    const destNombre = getDestinatarioNombre();
    setSaving(true);
    try {
      const posta: Posta = {
        id: crypto.randomUUID(),
        fecha: new Date().toISOString(),
        deUsuarioId: usuario?.id ?? '',
        deUsuarioNombre: usuario?.displayName ?? '',
        aUsuarioId: destinatarioId || '',
        aUsuarioNombre: destNombre,
        ...(areaDestino ? { aArea: areaDestino } : {}),
        ...(comentario.trim() ? { comentario: comentario.trim() } : {}),
        estadoAnterior: lead.estado,
        estadoNuevo: nuevoEstado,
        ...(accionRequerida.trim() ? { accionRequerida: accionRequerida.trim() } : {}),
      };
      await leadsService.derivar(lead.id, posta, destinatarioId, destNombre || null, areaDestino || null, accionRequerida.trim() || null);
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
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
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
          <label className="text-[11px] font-medium text-slate-500 mb-0.5 block">
            Derivar a ({isIngeniero ? 'ingeniero' : 'usuario'})
          </label>
          <select
            value={destinatarioId}
            onChange={e => setDestinatarioId(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">Sin asignar {isIngeniero ? 'ingeniero' : 'usuario'}</option>
            {personList.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-medium text-slate-500 mb-0.5 block">Nuevo estado</label>
          <select
            value={nuevoEstado}
            onChange={e => setNuevoEstado(e.target.value as LeadEstado)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
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
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
            placeholder="Ej: Averiguar N° de parte..."
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-slate-500 mb-0.5 block">Comentario</label>
          <textarea
            value={comentario}
            onChange={e => setComentario(e.target.value)}
            rows={3}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
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
