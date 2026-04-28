import { useEffect, useState } from 'react';
import type { Lead, TicketEstado, Posta, Sistema } from '@ags/shared';
import { leadsService, sistemasService } from '../../services/firebaseService';
import { pendientesService } from '../../services/pendientesService';
import { useAuth } from '../../contexts/AuthContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { PendientesDraftList, type PendienteDraft } from '../pendientes/PendientesDraftList';

interface FinalizarLeadModalProps {
  lead: Lead;
  onClose: () => void;
  onFinalized: () => void;
}

type MotivoCierre = { value: 'finalizado' | 'no_concretado'; label: string };

const MOTIVOS_VENTAS: readonly MotivoCierre[] = [
  { value: 'finalizado', label: 'Consulta resuelta / Presupuesto generado' },
  { value: 'no_concretado', label: 'No concretado / Sin interés' },
];

const MOTIVOS_NO_VENTAS: readonly MotivoCierre[] = [
  { value: 'finalizado', label: 'Consulta resuelta' },
];

function getMotivosParaMotivoLlamado(motivoLlamado: Lead['motivoLlamado']): readonly MotivoCierre[] {
  const esVentas = motivoLlamado === 'ventas_insumos' || motivoLlamado === 'ventas_equipos';
  return esVentas ? MOTIVOS_VENTAS : MOTIVOS_NO_VENTAS;
}

export const FinalizarLeadModal = ({ lead, onClose, onFinalized }: FinalizarLeadModalProps) => {
  const { usuario } = useAuth();
  const motivosDisponibles = getMotivosParaMotivoLlamado(lead.motivoLlamado);
  const [estadoFinal, setEstadoFinal] = useState<'finalizado' | 'no_concretado'>('finalizado');
  const [comentario, setComentario] = useState('');
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<PendienteDraft[]>([]);
  const [equipos, setEquipos] = useState<Sistema[]>([]);

  // Load equipos del cliente (si existe clienteId) para el selector de cada pendiente
  useEffect(() => {
    if (!lead.clienteId) return;
    sistemasService
      .getAll()
      .then(all => {
        const del = all.filter(s => s.clienteId === lead.clienteId && s.activo !== false);
        setEquipos(del);
      })
      .catch(() => {});
  }, [lead.clienteId]);

  const handleSubmit = async () => {
    if (!usuario) return;
    setSaving(true);
    try {
      const posta: Posta = {
        id: crypto.randomUUID(),
        fecha: new Date().toISOString(),
        deUsuarioId: usuario.id,
        deUsuarioNombre: usuario.displayName,
        aUsuarioId: usuario.id,
        aUsuarioNombre: usuario.displayName,
        estadoAnterior: lead.estado,
        estadoNuevo: estadoFinal as TicketEstado,
        ...(comentario.trim() ? { comentario: comentario.trim() } : {}),
      };
      await leadsService.finalizar(lead.id, posta);

      // Persist pendientes drafts (only if cliente exists)
      if (lead.clienteId && drafts.length > 0) {
        await Promise.all(
          drafts.map(d =>
            pendientesService.create({
              clienteId: lead.clienteId!,
              clienteNombre: lead.razonSocial,
              equipoId: d.equipoId,
              equipoNombre: d.equipoNombre,
              equipoAgsId: d.equipoAgsId,
              tipo: d.tipo,
              descripcion: d.descripcion,
              estado: 'pendiente',
              origenTicketId: lead.id,
              origenTicketRazonSocial: lead.razonSocial,
            }),
          ),
        );
      }

      onFinalized();
    } catch (err) {
      console.error('Error al finalizar ticket:', err);
      alert('Error al finalizar el ticket');
    } finally {
      setSaving(false);
    }
  };

  const canCreatePendientes = !!lead.clienteId;

  return (
    <Modal open title="Finalizar Ticket" onClose={onClose} maxWidth="lg">
      <div className="space-y-4">
        <div>
          <label className="text-[11px] font-medium text-slate-400 mb-1 block">Ticket</label>
          <p className="text-xs text-slate-700 font-medium">{lead.razonSocial}</p>
        </div>

        <div>
          <label className="text-[11px] font-medium text-slate-400 mb-1 block">Motivo de cierre</label>
          {motivosDisponibles.length === 1 ? (
            <div className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-600">
              {motivosDisponibles[0].label}
            </div>
          ) : (
            <select
              value={estadoFinal}
              onChange={e => setEstadoFinal(e.target.value as 'finalizado' | 'no_concretado')}
              className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {motivosDisponibles.map(m => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="text-[11px] font-medium text-slate-400 mb-1 block">
            Comentario (opcional)
          </label>
          <textarea
            value={comentario}
            onChange={e => setComentario(e.target.value)}
            rows={3}
            className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            placeholder="Notas sobre el cierre..."
          />
        </div>

        {/* Pendientes sección */}
        {canCreatePendientes && (
          <div className="border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-medium text-slate-500">
                Pendientes para el sistema
              </label>
              {drafts.length > 0 && (
                <span className="text-[10px] font-medium text-teal-600">
                  {drafts.length} pendiente{drafts.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mb-2">
              Recordatorios que aparecerán al crear próximos presupuestos u órdenes para este
              cliente
            </p>
            <PendientesDraftList
              drafts={drafts}
              onChange={setDrafts}
              equipos={equipos.map(e => ({
                id: e.id,
                nombre: e.nombre,
                agsVisibleId: e.agsVisibleId ?? null,
              }))}
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button size="sm" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving}>
            {saving
              ? 'Finalizando...'
              : estadoFinal === 'no_concretado'
                ? 'Marcar como no concretado'
                : 'Finalizar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
