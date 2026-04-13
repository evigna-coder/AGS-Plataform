import { useState, useEffect, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { VoiceTextarea } from '../ui/VoiceTextarea';
import { useAuth } from '../../contexts/AuthContext';
import { leadsService, usuariosService, ingenierosService, clientesService, sistemasService, pendientesService } from '../../services/firebaseService';
import type { Ticket, Posta, TicketArea, TicketPrioridad, MotivoLlamado, PendienteTipo } from '@ags/shared';
import { TICKET_AREA_LABELS, TICKET_PRIORIDAD_LABELS, TICKET_PRIORIDAD_DIAS, MOTIVO_LLAMADO_LABELS, PENDIENTE_TIPO_LABELS, getUserTicketAreas } from '@ags/shared';

interface Props {
  lead: Ticket;
  onClose: () => void;
  onSuccess: () => void;
}

const selectClass = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500';
const labelClass = 'text-[11px] font-medium text-slate-500 mb-0.5 block';

export default function DerivarTicketModal({ lead, onClose, onSuccess }: Props) {
  const { usuario, hasRole } = useAuth();
  const canDeriveSistema = hasRole('admin', 'admin_soporte', 'admin_ing_soporte');

  const [usuarios, setUsuarios] = useState<{ id: string; displayName: string; role: string | null; roles?: string[] }[]>([]);
  const [_ingenieros, setIngenieros] = useState<{ id: string; nombre: string }[]>([]);
  const [destinatarioId, setDestinatarioId] = useState('');
  const [areaDestino, setAreaDestino] = useState<TicketArea | ''>(lead.areaActual || '');
  const [comentario, setComentario] = useState(lead.descripcion || (lead as any).accionPendiente || '');
  const [prioridad, setPrioridad] = useState<TicketPrioridad | 'custom'>(((lead as any).prioridad as TicketPrioridad) || 'normal');
  const [fechaContactoCustom, setFechaContactoCustom] = useState('');
  const [motivoLlamado, setMotivoLlamado] = useState<MotivoLlamado>(lead.motivoLlamado);
  const [motivoOtros, setMotivoOtros] = useState(lead.motivoOtros || '');
  const [saving, setSaving] = useState(false);

  // Sistema flow
  const [pendienteTipo, setPendienteTipo] = useState<PendienteTipo>('ambos');
  const [equipos, setEquipos] = useState<{ id: string; nombre: string; agsVisibleId: string | null }[]>([]);
  const [equipoId, setEquipoId] = useState(lead.sistemaId || '');
  const [resolvedClienteId, setResolvedClienteId] = useState<string | null>(lead.clienteId || null);
  const [resolvingCliente, setResolvingCliente] = useState(false);

  const isSistema = areaDestino === 'sistema';

  useEffect(() => {
    usuariosService.getIngenieros().then(setUsuarios);
    ingenierosService.getAll().then(setIngenieros);
  }, []);

  // Auto-resolve clienteId from razonSocial when missing
  useEffect(() => {
    if (lead.clienteId) { setResolvedClienteId(lead.clienteId); return; }
    if (!isSistema || !lead.razonSocial) return;
    setResolvingCliente(true);
    clientesService.getAll().then(clientes => {
      const match = clientes.find(c => c.razonSocial.toLowerCase() === lead.razonSocial.toLowerCase());
      setResolvedClienteId(match?.id ?? null);
    }).catch(() => {}).finally(() => setResolvingCliente(false));
  }, [isSistema, lead.clienteId, lead.razonSocial]);

  // Load equipos
  useEffect(() => {
    if (!isSistema || !resolvedClienteId) { setEquipos([]); return; }
    sistemasService.getByCliente(resolvedClienteId).then(list =>
      setEquipos(list.map(s => ({ id: s.id, nombre: s.nombre, agsVisibleId: s.agsVisibleId ?? null })))
    ).catch(() => {});
  }, [isSistema, resolvedClienteId]);

  useEffect(() => { setDestinatarioId(''); }, [areaDestino]);

  const personList = useMemo(() => {
    if (!areaDestino || isSistema) return usuarios.map(u => ({ id: u.id, label: u.displayName }));
    return usuarios.filter(u => {
      if ((u as any).role === 'admin') return true;
      const areas = getUserTicketAreas(u as any);
      return areas.includes(areaDestino as TicketArea);
    }).map(u => ({ id: u.id, label: u.displayName }));
  }, [usuarios, areaDestino, isSistema]);

  const getDestinatarioNombre = () => personList.find(p => p.id === destinatarioId)?.label ?? '';

  // Area options: hide 'sistema' for non-admin users
  const areaOptions = useMemo(() => {
    return Object.entries(TICKET_AREA_LABELS).filter(([v]) => {
      if (v === 'sistema') return canDeriveSistema;
      return true;
    });
  }, [canDeriveSistema]);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      if (isSistema) {
        if (!comentario.trim()) { alert('Escribí la descripción de la pendiente'); setSaving(false); return; }
        if (!resolvedClienteId) { alert('No se encontró el cliente en el sistema.'); setSaving(false); return; }

        const equipo = equipos.find(e => e.id === equipoId);

        await pendientesService.create({
          clienteId: resolvedClienteId,
          clienteNombre: lead.razonSocial,
          equipoId: equipoId || null,
          equipoNombre: equipo?.nombre ?? null,
          equipoAgsId: equipo?.agsVisibleId ?? null,
          tipo: pendienteTipo,
          descripcion: comentario.trim(),
          estado: 'pendiente',
          origenTicketId: lead.id,
          origenTicketRazonSocial: lead.razonSocial,
        });

        const posta: Posta = {
          id: crypto.randomUUID(),
          fecha: new Date().toISOString(),
          deUsuarioId: usuario?.id ?? '',
          deUsuarioNombre: usuario?.displayName ?? '',
          aUsuarioId: '',
          aUsuarioNombre: 'Sistema',
          estadoAnterior: lead.estado,
          estadoNuevo: 'finalizado',
          aArea: 'sistema',
          comentario: `Derivado al sistema como pendiente: ${comentario.trim()}`,
        };
        await leadsService.finalizar(lead.id, posta);
        onSuccess();
        onClose();
      } else {
        const destNombre = getDestinatarioNombre();
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
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={true} title={isSistema ? 'Derivar al Sistema' : 'Derivar Ticket'} onClose={onClose}>
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
              {areaOptions.map(([v, l]) => (
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

        {/* ── SISTEMA mode ── */}
        {isSistema && (
          <>
            <div className="border-t border-purple-200 pt-2 mt-1">
              <p className="text-[10px] font-semibold text-purple-600 uppercase tracking-wide mb-2">
                Se creará una pendiente y el ticket se finalizará
              </p>
            </div>

            <div>
              <label className={labelClass}>Tipo de pendiente</label>
              <div className="flex items-center gap-1.5">
                {(Object.keys(PENDIENTE_TIPO_LABELS) as PendienteTipo[]).map(t => (
                  <button key={t} type="button" onClick={() => setPendienteTipo(t)}
                    className={`px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors ${
                      pendienteTipo === t ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-500 border-slate-200'
                    }`}>
                    {PENDIENTE_TIPO_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            {resolvedClienteId && equipos.length > 0 && (
              <div>
                <label className={labelClass}>Equipo (opcional)</label>
                <select value={equipoId} onChange={e => setEquipoId(e.target.value)} className={selectClass}>
                  <option value="">Sin equipo específico</option>
                  {equipos.map(e => (
                    <option key={e.id} value={e.id}>{e.nombre}{e.agsVisibleId ? ` (${e.agsVisibleId})` : ''}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className={labelClass}>Descripción de la pendiente *</label>
              <VoiceTextarea value={comentario} onChange={setComentario} rows={3}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                placeholder="Ej: Cotizar filtros de split en próximo mantenimiento..." />
            </div>

            {!resolvedClienteId && !resolvingCliente && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <p className="text-[11px] text-amber-700">
                  No se encontró el cliente "{lead.razonSocial}" en el sistema.
                </p>
              </div>
            )}
            {resolvingCliente && <p className="text-[10px] text-slate-400">Buscando cliente...</p>}
          </>
        )}

        {/* ── NORMAL mode ── */}
        {!isSistema && (
          <>
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
                <select value={prioridad} onChange={e => {
                  const v = e.target.value;
                  if (v === 'custom') { setPrioridad('custom'); } else { setPrioridad(v as TicketPrioridad); setFechaContactoCustom(''); }
                }} className={selectClass}>
                  {Object.entries(TICKET_PRIORIDAD_DIAS).map(([k, dias]) => (
                    <option key={k} value={k}>{dias <= 4 ? `${(dias as number) * 24} hs` : `${dias} días`} — {TICKET_PRIORIDAD_LABELS[k as TicketPrioridad]}</option>
                  ))}
                  <option value="custom">Elegir fecha específica...</option>
                </select>
                {prioridad === 'custom' && (
                  <input type="date" value={fechaContactoCustom} onChange={e => setFechaContactoCustom(e.target.value)}
                    className="mt-1 w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500" />
                )}
              </div>
            </div>
            <div>
              <label className={labelClass}>Observación</label>
              <VoiceTextarea value={comentario} onChange={setComentario} rows={2}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                placeholder="Qué hay que hacer con este ticket..." />
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving || (isSistema && (!comentario.trim() || !resolvedClienteId || resolvingCliente))}>
            {saving
              ? (isSistema ? 'Creando pendiente...' : 'Derivando...')
              : (isSistema ? 'Crear pendiente y finalizar' : 'Derivar')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
