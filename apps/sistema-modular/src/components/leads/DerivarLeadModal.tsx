import { useState, useEffect, useMemo } from 'react';
import type { Lead, LeadArea, TicketArea, TicketPrioridad, UsuarioAGS, Posta, Ingeniero, MotivoLlamado } from '@ags/shared';
import { TICKET_AREA_LABELS, TICKET_PRIORIDAD_LABELS, TICKET_PRIORIDAD_DIAS, MOTIVO_LLAMADO_LABELS, getUserTicketAreas } from '@ags/shared';
import { leadsService, usuariosService, ingenierosService } from '../../services/firebaseService';
import { useAuth } from '../../contexts/AuthContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface DerivarLeadModalProps {
  lead: Lead;
  onClose: () => void;
  onDerived: () => void;
}

const selectClass = 'w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500';
const labelClass = 'text-[11px] font-medium text-slate-400 mb-1 block';

export const DerivarLeadModal = ({ lead, onClose, onDerived }: DerivarLeadModalProps) => {
  const { usuario } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioAGS[]>([]);
  const [_ingenieros, setIngenieros] = useState<Ingeniero[]>([]);
  const [destinatarioId, setDestinatarioId] = useState('');
  const [areaDestino, setAreaDestino] = useState<LeadArea | ''>(lead.areaActual || '');
  const [comentario, setComentario] = useState('');
  const [prioridad, setPrioridad] = useState<TicketPrioridad | 'custom'>((lead.prioridad as TicketPrioridad) || 'normal');
  const [fechaContactoCustom, setFechaContactoCustom] = useState('');
  const [motivoLlamado, setMotivoLlamado] = useState<MotivoLlamado>(lead.motivoLlamado);
  const [motivoOtros, setMotivoOtros] = useState(lead.motivoOtros || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    usuariosService.getAll().then(u => setUsuarios(u.filter(x => x.status === 'activo')));
    ingenierosService.getAll().then(setIngenieros);
  }, []);

  // Reset destinatario when area changes
  useEffect(() => { setDestinatarioId(''); }, [areaDestino]);

  const personList = useMemo(() => {
    if (!areaDestino) return usuarios.map(u => ({ id: u.id, label: u.displayName }));
    return usuarios
      .filter(u => {
        if (u.role === 'admin') return true;
        const areas = getUserTicketAreas(u);
        return areas.includes(areaDestino as TicketArea);
      })
      .map(u => ({ id: u.id, label: u.displayName }));
  }, [usuarios, areaDestino]);

  const getDestinatarioNombre = () => {
    if (!destinatarioId) return '';
    return personList.find(p => p.id === destinatarioId)?.label ?? '';
  };

  const handleSubmit = async () => {
    if (!usuario) return;
    const destNombre = getDestinatarioNombre();
    setSaving(true);
    try {
      // Al derivar, el estado pasa a "en_seguimiento" (mostrado como "En proceso")
      const nuevoEstado = 'en_seguimiento' as const;
      const posta: Posta = {
        id: crypto.randomUUID(),
        fecha: new Date().toISOString(),
        deUsuarioId: usuario.id,
        deUsuarioNombre: usuario.displayName,
        aUsuarioId: destinatarioId || '',
        aUsuarioNombre: destNombre,
        estadoAnterior: lead.estado,
        estadoNuevo: nuevoEstado,
        ...(areaDestino ? { aArea: areaDestino } : {}),
        ...(comentario.trim() ? { comentario: comentario.trim() } : {}),
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
      onDerived();
    } catch (err: any) {
      console.error('Error derivando ticket:', err);
      alert(`Error al derivar: ${err?.message || 'Error desconocido'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title="Derivar Ticket" onClose={onClose}>
      <div className="space-y-2">
        {/* Ticket info */}
        <div className="bg-slate-50 rounded-lg px-3 py-2">
          <p className="text-xs text-slate-700 font-medium">{lead.razonSocial}</p>
          <p className="text-[10px] text-slate-500">{lead.contacto}</p>
        </div>

        {/* Motivo + Área */}
        <div className="grid grid-cols-2 gap-2">
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
            <select value={areaDestino} onChange={e => setAreaDestino(e.target.value as LeadArea | '')} className={selectClass}>
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
            <input type="text" value={motivoOtros} onChange={e => setMotivoOtros(e.target.value)} className={selectClass}
              placeholder="Describir motivo..." />
          </div>
        )}

        {/* Asignar a + Próximo contacto */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelClass}>Derivar a</label>
            <select value={destinatarioId} onChange={e => setDestinatarioId(e.target.value)} className={selectClass}>
              <option value="">Sin asignar</option>
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
                className="mt-1 w-full text-[11px] border border-slate-200 rounded-lg px-2 py-1 text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500"
                title="Elegir fecha" />
            )}
          </div>
        </div>

        <div>
          <label className={labelClass}>Observación</label>
          <textarea value={comentario} onChange={e => setComentario(e.target.value)} rows={2}
            className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            placeholder="Qué hay que hacer con este ticket..." />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Derivando...' : 'Derivar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
