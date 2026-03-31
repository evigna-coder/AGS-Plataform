import { MOTIVO_LLAMADO_LABELS, TICKET_AREA_LABELS, TICKET_PRIORIDAD_LABELS } from '@ags/shared';
import type { MotivoLlamado, TicketArea, TicketPrioridad } from '@ags/shared';
import { useCrearLeadForm } from '../../hooks/useCrearLeadForm';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';
import { LeadClienteField } from './LeadClienteField';
import { LeadAdjuntosField } from './LeadAdjuntosField';

interface CrearLeadModalProps {
  onClose: () => void;
  onCreated?: (leadId?: string) => void;
}

const selectClass = 'w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500';
const labelClass = 'text-[11px] font-medium text-slate-400 mb-1 block';

export const CrearLeadModal = ({ onClose, onCreated }: CrearLeadModalProps) => {
  const h = useCrearLeadForm(onClose, onCreated);

  return (
    <Modal open title="Nuevo Ticket" subtitle="Registrar nueva consulta o pedido" onClose={onClose}>
      <div className="space-y-3">
        {/* Motivo */}
        <div>
          <label className={labelClass}>Motivo *</label>
          <select value={h.motivoLlamado} onChange={e => h.setMotivoLlamado(e.target.value as MotivoLlamado)} className={selectClass}>
            {Object.entries(MOTIVO_LLAMADO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        {h.motivoLlamado === 'otros' && (
          <div>
            <label className={labelClass}>Especificar motivo *</label>
            <input type="text" value={h.motivoOtros} onChange={e => h.setMotivoOtros(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Describir el motivo..." />
          </div>
        )}

        {/* Prioridad + Próximo contacto */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Prioridad</label>
            <select value={h.prioridad} onChange={e => h.setPrioridad(e.target.value as TicketPrioridad)} className={selectClass}>
              {Object.entries(TICKET_PRIORIDAD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Próximo contacto (días)</label>
            <input type="number" min="1" value={h.diasProximoContacto}
              onChange={e => h.setDiasProximoContacto(e.target.value)} className={selectClass} placeholder="Ej: 10" />
            {h.diasProximoContacto && parseInt(h.diasProximoContacto) > 0 && (
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {(() => { const d = new Date(); d.setDate(d.getDate() + parseInt(h.diasProximoContacto)); return d.toLocaleDateString('es-AR'); })()}
              </span>
            )}
          </div>
        </div>

        {/* Cliente */}
        <LeadClienteField
          clienteId={h.clienteId} razonSocial={h.razonSocial} setRazonSocial={h.setRazonSocial}
          setClienteSearch={h.setClienteSearch}
          showDropdown={h.showClienteDropdown} setShowDropdown={h.setShowClienteDropdown}
          filteredClientes={h.filteredClientes}
          onSelect={h.handleSelectCliente} onClear={h.handleClearCliente}
          error={h.errors.razonSocial} />

        {/* Contacto + Email + Teléfono */}
        <div>
          <Input inputSize="sm" label="Contacto *" value={h.contacto}
            onChange={e => h.setContacto(e.target.value)} error={h.errors.contacto} placeholder="Persona de contacto" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input inputSize="sm" label="Email" type="email" value={h.email}
            onChange={e => h.setEmail(e.target.value)} placeholder="correo@ejemplo.com" />
          <Input inputSize="sm" label="Teléfono" value={h.telefono}
            onChange={e => h.setTelefono(e.target.value)} placeholder="011 1234 5678" />
        </div>

        {/* Sistema/Equipo */}
        {h.clienteId && h.sistemasFiltrados.length > 0 && (
          <div>
            <label className={labelClass}>Sistema/Equipo (opcional)</label>
            <SearchableSelect value={h.sistemaId} onChange={h.handleSistemaChange}
              options={h.sistemasFiltrados.map(s => ({ value: s.id, label: `${s.nombre} (${s.codigoInternoCliente})` }))}
              placeholder="Buscar sistema..." />
          </div>
        )}
        {h.sistemaId && h.modulos.length > 0 && (
          <div>
            <label className={labelClass}>Módulo (opcional)</label>
            <SearchableSelect value={h.moduloId} onChange={h.setModuloId}
              options={h.modulos.map(m => ({ value: m.id, label: m.nombre }))}
              placeholder="Buscar módulo..." />
          </div>
        )}

        {/* Área destino */}
        <div>
          <label className={labelClass}>Área destino (opcional)</label>
          <select value={h.areaActual} onChange={e => h.setAreaActual(e.target.value as TicketArea | '')} className={selectClass}>
            <option value="">Sin área específica</option>
            {Object.entries(TICKET_AREA_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>

        {/* Asignar a */}
        <div>
          <label className={labelClass}>Asignar a (opcional)</label>
          <select value={h.asignadoA} onChange={e => h.setAsignadoA(e.target.value)} className={selectClass}>
            <option value="">Sin asignar</option>
            {h.usuarios.map(u => <option key={u.id} value={u.id}>{u.displayName} ({u.role})</option>)}
          </select>
        </div>

        {/* Descripción */}
        <div>
          <label className={labelClass}>Descripción</label>
          <textarea value={h.descripcion} onChange={e => h.setDescripcion(e.target.value)} rows={2}
            className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            placeholder="Detalle de la consulta o solicitud..." />
        </div>

        {/* Acción pendiente */}
        <div>
          <label className={labelClass}>Acción pendiente (opcional)</label>
          <input type="text" value={h.accionPendiente} onChange={e => h.setAccionPendiente(e.target.value)}
            className={selectClass}
            placeholder="Ej: Averiguar N° de parte, Confirmar disponibilidad..." />
        </div>

        {/* Adjuntos */}
        <LeadAdjuntosField
          pendingFiles={h.pendingFiles} fileRef={h.fileRef}
          onFileChange={h.handleFileChange} onRemove={h.removeFile} />

        <div className="flex justify-end gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={h.handleSubmit} disabled={h.saving}>
            {h.saving ? 'Creando...' : 'Crear Lead'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
