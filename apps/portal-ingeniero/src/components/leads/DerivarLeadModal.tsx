import { useState, useEffect, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { leadsService, usuariosService, ingenierosService } from '../../services/firebaseService';
import type { Ticket, Posta, TicketEstado, TicketArea, MotivoLlamado } from '@ags/shared';
import { TICKET_ESTADO_LABELS, TICKET_ESTADO_ORDER, TICKET_AREA_LABELS, MOTIVO_LLAMADO_LABELS, getUserTicketAreas } from '@ags/shared';

interface Props {
  lead: Ticket;
  onClose: () => void;
  onSuccess: () => void;
}

export default function DerivarTicketModal({ lead, onClose, onSuccess }: Props) {
  const { usuario } = useAuth();
  const [usuarios, setUsuarios] = useState<{ id: string; displayName: string; role: string | null; roles?: string[] }[]>([]);
  const [ingenieros, setIngenieros] = useState<{ id: string; nombre: string }[]>([]);
  const [destinatarioId, setDestinatarioId] = useState('');
  const [nuevoEstado, setNuevoEstado] = useState<TicketEstado>(lead.estado);
  const [areaDestino, setAreaDestino] = useState<TicketArea | ''>(lead.areaActual || '');
  const [accionRequerida, setAccionRequerida] = useState('');
  const [comentario, setComentario] = useState('');
  const [motivoLlamado, setMotivoLlamado] = useState<MotivoLlamado>(lead.motivoLlamado);
  const [motivoOtros, setMotivoOtros] = useState(lead.motivoOtros || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    usuariosService.getIngenieros().then(setUsuarios);
    ingenierosService.getAll().then(setIngenieros);
  }, []);

  // Reset destinatario when area changes
  useEffect(() => { setDestinatarioId(''); }, [areaDestino]);

  const personList = useMemo(() => {
    if (!areaDestino) return usuarios.map(u => ({ id: u.id, label: u.displayName }));
    return usuarios.filter(u => {
      if ((u as any).role === 'admin') return true;
      const areas = getUserTicketAreas(u as any);
      return areas.includes(areaDestino as TicketArea);
    }).map(u => ({ id: u.id, label: u.displayName }));
  }, [usuarios, areaDestino]);

  const getDestinatarioNombre = () => {
    if (!destinatarioId) return '';
    return personList.find(p => p.id === destinatarioId)?.label ?? '';
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
      await leadsService.derivar(lead.id, posta, destinatarioId, destNombre || null, areaDestino || null, accionRequerida.trim() || null, {
        motivoLlamado,
        motivoOtros: motivoLlamado === 'otros' ? motivoOtros.trim() || null : null,
      });
      onSuccess();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={true} title="Derivar Ticket" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="text-[11px] font-medium text-slate-500 mb-0.5 block">Área destino</label>
          <select
            value={areaDestino}
            onChange={e => setAreaDestino(e.target.value as TicketArea | '')}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">Sin área específica</option>
            {Object.entries(TICKET_AREA_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-medium text-slate-500 mb-0.5 block">Motivo</label>
          <select
            value={motivoLlamado}
            onChange={e => setMotivoLlamado(e.target.value as MotivoLlamado)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            {Object.entries(MOTIVO_LLAMADO_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        {motivoLlamado === 'otros' && (
          <div>
            <label className="text-[11px] font-medium text-slate-500 mb-0.5 block">Especificar motivo</label>
            <input
              type="text"
              value={motivoOtros}
              onChange={e => setMotivoOtros(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Describir motivo..."
            />
          </div>
        )}
        <div>
          <label className="text-[11px] font-medium text-slate-500 mb-0.5 block">
            Derivar a (usuario)
          </label>
          <select
            value={destinatarioId}
            onChange={e => setDestinatarioId(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">Sin asignar usuario</option>
            {personList.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-medium text-slate-500 mb-0.5 block">Nuevo estado</label>
          <select
            value={nuevoEstado}
            onChange={e => setNuevoEstado(e.target.value as TicketEstado)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            {TICKET_ESTADO_ORDER.filter(e => e !== 'finalizado' && e !== 'no_concretado').map(e => (
              <option key={e} value={e}>{TICKET_ESTADO_LABELS[e]}</option>
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
