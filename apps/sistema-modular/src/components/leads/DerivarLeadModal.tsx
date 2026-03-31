import { useState, useEffect } from 'react';
import type { Lead, LeadEstado, LeadArea, LeadPrioridad, UsuarioAGS, Posta, Ingeniero } from '@ags/shared';
import { TICKET_ESTADO_LABELS, TICKET_AREA_LABELS, TICKET_ESTADO_ORDER, TICKET_PRIORIDAD_LABELS } from '@ags/shared';
import { leadsService, usuariosService, ingenierosService } from '../../services/firebaseService';
import { useAuth } from '../../contexts/AuthContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface DerivarLeadModalProps {
  lead: Lead;
  onClose: () => void;
  onDerived: () => void;
}

export const DerivarLeadModal = ({ lead, onClose, onDerived }: DerivarLeadModalProps) => {
  const { usuario } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioAGS[]>([]);
  const [ingenieros, setIngenieros] = useState<Ingeniero[]>([]);
  const [destinatarioId, setDestinatarioId] = useState('');
  const [nuevoEstado, setNuevoEstado] = useState<LeadEstado>(lead.estado);
  const [areaDestino, setAreaDestino] = useState<LeadArea | ''>(lead.areaActual || '');
  const [accionRequerida, setAccionRequerida] = useState('');
  const [comentario, setComentario] = useState('');
  const [prioridad, setPrioridad] = useState<LeadPrioridad | ''>(lead.prioridad || '');
  const [proximoContacto, setProximoContacto] = useState(lead.proximoContacto || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    usuariosService.getAll().then(u => setUsuarios(u.filter(x => x.status === 'activo')));
    ingenierosService.getAll().then(setIngenieros);
  }, []);

  // Reset destinatario when area changes
  useEffect(() => { setDestinatarioId(''); }, [areaDestino]);

  const personList = usuarios.map(u => ({ id: u.id, label: `${u.displayName} (${u.role})` }));

  const getDestinatarioNombre = () => {
    if (!destinatarioId) return '';
    return personList.find(p => p.id === destinatarioId)?.label ?? '';
  };

  const handleSubmit = async () => {
    if (!usuario) return;
    const destNombre = getDestinatarioNombre();
    setSaving(true);
    try {
      const posta: Posta = {
        id: crypto.randomUUID(),
        fecha: new Date().toISOString(),
        deUsuarioId: usuario.id,
        deUsuarioNombre: usuario.displayName,
        aUsuarioId: destinatarioId || '',
        aUsuarioNombre: destNombre,
        aArea: areaDestino || undefined,
        comentario: comentario.trim() || undefined,
        estadoAnterior: lead.estado,
        estadoNuevo: nuevoEstado,
        accionRequerida: accionRequerida.trim() || undefined,
      };
      await leadsService.derivar(lead.id, posta, destinatarioId, destNombre || null, areaDestino || null, accionRequerida.trim() || null, {
        prioridad: prioridad || null,
        proximoContacto: proximoContacto || null,
      });
      onDerived();
    } catch {
      alert('Error al derivar el lead');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title="Derivar Ticket" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-[11px] font-medium text-slate-400 mb-1 block">Lead</label>
          <p className="text-xs text-slate-700 font-medium">{lead.razonSocial}</p>
          <p className="text-[10px] text-slate-500">{lead.contacto}</p>
        </div>

        <div>
          <label className="text-[11px] font-medium text-slate-400 mb-1 block">Área destino *</label>
          <select value={areaDestino} onChange={e => setAreaDestino(e.target.value as LeadArea | '')}
            className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500">
            <option value="">Sin área específica</option>
            {Object.entries(TICKET_AREA_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-medium text-slate-400 mb-1 block">
            Derivar a (usuario)
          </label>
          <select value={destinatarioId} onChange={e => setDestinatarioId(e.target.value)}
            className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500">
            <option value="">Sin asignar usuario específico</option>
            {personList.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-medium text-slate-400 mb-1 block">Nuevo estado</label>
          <select value={nuevoEstado} onChange={e => setNuevoEstado(e.target.value as LeadEstado)}
            className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500">
            {TICKET_ESTADO_ORDER.filter(e => e !== 'finalizado' && e !== 'no_concretado').map(e => (
              <option key={e} value={e}>{TICKET_ESTADO_LABELS[e]}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-medium text-slate-400 mb-1 block">Prioridad</label>
            <select value={prioridad} onChange={e => setPrioridad(e.target.value as LeadPrioridad | '')}
              className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="">Sin definir</option>
              {Object.entries(TICKET_PRIORIDAD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-400 mb-1 block">Próximo contacto</label>
            <input type="date" value={proximoContacto} onChange={e => setProximoContacto(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
        </div>

        <div>
          <label className="text-[11px] font-medium text-slate-400 mb-1 block">Acción requerida (opcional)</label>
          <input type="text" value={accionRequerida} onChange={e => setAccionRequerida(e.target.value)}
            className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
            placeholder="Ej: Averiguar N° de parte, Enviar cotización..." />
        </div>

        <div>
          <label className="text-[11px] font-medium text-slate-400 mb-1 block">Comentario (opcional)</label>
          <textarea value={comentario} onChange={e => setComentario(e.target.value)} rows={3}
            className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            placeholder="Instrucciones o contexto..." />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Derivando...' : 'Derivar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
