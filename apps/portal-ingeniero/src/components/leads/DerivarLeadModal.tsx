import { useState, useEffect, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { leadsService, usuariosService, ingenierosService } from '../../services/firebaseService';
import type { Ticket, Posta, TicketArea, TicketPrioridad, MotivoLlamado } from '@ags/shared';
import { TICKET_AREA_LABELS, TICKET_PRIORIDAD_LABELS, TICKET_PRIORIDAD_DIAS, MOTIVO_LLAMADO_LABELS, getUserTicketAreas } from '@ags/shared';

interface Props {
  lead: Ticket;
  onClose: () => void;
  onSuccess: () => void;
}

const selectClass = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500';
const labelClass = 'text-[11px] font-medium text-slate-500 mb-0.5 block';

export default function DerivarTicketModal({ lead, onClose, onSuccess }: Props) {
  const { usuario } = useAuth();
  const [usuarios, setUsuarios] = useState<{ id: string; displayName: string; role: string | null; roles?: string[] }[]>([]);
  const [_ingenieros, setIngenieros] = useState<{ id: string; nombre: string }[]>([]);
  const [destinatarioId, setDestinatarioId] = useState('');
  const [areaDestino, setAreaDestino] = useState<TicketArea | ''>(lead.areaActual || '');
  const [comentario, setComentario] = useState('');
  const [prioridad, setPrioridad] = useState<TicketPrioridad | 'custom'>(((lead as any).prioridad as TicketPrioridad) || 'normal');
  const [fechaContactoCustom, setFechaContactoCustom] = useState('');
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
      // Al derivar, el estado pasa a "en_seguimiento" (mostrado como "En proceso")
      const nuevoEstado = 'en_seguimiento' as const;
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
      };
      await leadsService.derivar(lead.id, posta, destinatarioId, destNombre || null, areaDestino || null, null, {
        prioridad: prioridad === 'custom' ? 'normal' : prioridad,
        proximoContacto: fechaContactoCustom || (() => {
          const d = new Date();
          const dias = prioridad === 'custom' ? 7 : (TICKET_PRIORIDAD_DIAS[prioridad as TicketPrioridad] ?? 7);
          d.setDate(d.getDate() + dias);
          return d.toISOString().split('T')[0];
        })(),
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
      <div className="space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className={labelClass}>Motivo</label>
            <select value={motivoLlamado} onChange={e => setMotivoLlamado(e.target.value as MotivoLlamado)} className={selectClass}>
              {Object.entries(MOTIVO_LLAMADO_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Área destino</label>
            <select value={areaDestino} onChange={e => setAreaDestino(e.target.value as TicketArea | '')} className={selectClass}>
              <option value="">Sin área específica</option>
              {Object.entries(TICKET_AREA_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
        </div>
        {motivoLlamado === 'otros' && (
          <div>
            <label className={labelClass}>Especificar motivo</label>
            <input
              type="text"
              value={motivoOtros}
              onChange={e => setMotivoOtros(e.target.value)}
              className={selectClass}
              placeholder="Describir motivo..."
            />
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className={labelClass}>Derivar a</label>
            <select value={destinatarioId} onChange={e => setDestinatarioId(e.target.value)} className={selectClass}>
              <option value="">Sin asignar usuario</option>
              {personList.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Próximo contacto</label>
            <select
              value={prioridad}
              onChange={e => {
                const v = e.target.value;
                if (v === 'custom') {
                  setPrioridad('custom');
                } else {
                  setPrioridad(v as TicketPrioridad);
                  setFechaContactoCustom('');
                }
              }}
              className={selectClass}
            >
              {Object.entries(TICKET_PRIORIDAD_DIAS).map(([k, dias]) => (
                <option key={k} value={k}>{dias <= 4 ? `${(dias as number) * 24} hs` : `${dias} días`} — {TICKET_PRIORIDAD_LABELS[k as TicketPrioridad]}</option>
              ))}
              <option value="custom">Elegir fecha específica...</option>
            </select>
            {prioridad === 'custom' && (
              <input type="date" value={fechaContactoCustom} onChange={e => setFechaContactoCustom(e.target.value)}
                className="mt-1 w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500"
                title="Elegir fecha" />
            )}
          </div>
        </div>
        <div>
          <label className={labelClass}>Observación</label>
          <textarea
            value={comentario}
            onChange={e => setComentario(e.target.value)}
            rows={2}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            placeholder="Qué hay que hacer con este ticket..."
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Derivando...' : 'Derivar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
