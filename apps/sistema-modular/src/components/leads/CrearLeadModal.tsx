import { useMemo } from 'react';
import { MOTIVO_LLAMADO_LABELS, TICKET_AREA_LABELS, TICKET_PRIORIDAD_LABELS, TICKET_PRIORIDAD_DIAS, getUserTicketAreas } from '@ags/shared';
import type { MotivoLlamado, TicketArea, TicketPrioridad } from '@ags/shared';
import { useCrearLeadForm, type LeadPrefill } from '../../hooks/useCrearLeadForm';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';
import { LeadClienteField } from './LeadClienteField';
import { LeadAdjuntosField } from './LeadAdjuntosField';

interface CrearLeadModalProps {
  onClose: () => void;
  onCreated?: (leadId?: string) => void;
  prefill?: LeadPrefill;
}

const selectClass = 'w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500';
const labelClass = 'text-[11px] font-medium text-slate-400 mb-1 block';

export const CrearLeadModal = ({ onClose, onCreated, prefill }: CrearLeadModalProps) => {
  const h = useCrearLeadForm(onClose, onCreated, prefill);

  const sistemaOptions = useMemo(() =>
    h.sistemasFiltrados.map(s => ({ value: s.id, label: `${s.nombre} (${s.codigoInternoCliente})` })),
    [h.sistemasFiltrados]
  );
  const moduloOptions = useMemo(() =>
    h.modulos.map(m => ({ value: m.id, label: m.nombre })),
    [h.modulos]
  );

  return (
    <Modal open title="Nuevo Ticket" subtitle="Registrar nueva consulta o pedido" onClose={onClose}>
      <div className="space-y-2">
        {/* Bloque 1: Cliente + Contacto */}
        <LeadClienteField
          clienteId={h.clienteId} razonSocial={h.razonSocial} setRazonSocial={h.setRazonSocial}
          setClienteSearch={h.setClienteSearch}
          showDropdown={h.showClienteDropdown} setShowDropdown={h.setShowClienteDropdown}
          filteredClientes={h.filteredClientes}
          onSelect={h.handleSelectCliente} onClear={h.handleClearCliente}
          error={h.errors.razonSocial} />
        {h.contactosCliente.length > 0 ? (
          <div>
            <label className={labelClass}>Contacto *</label>
            <SearchableSelect
              value={h.contacto}
              onChange={v => {
                const ct = h.contactosCliente.find(c => c.nombre === v);
                if (ct) { h.handleSelectContacto(ct); }
                else { h.setContacto(v); }
              }}
              options={h.contactosCliente.map(c => ({ value: c.nombre, label: `${c.nombre}${c.cargo ? ` — ${c.cargo}` : ''}` }))}
              placeholder="Buscar o escribir contacto..."
              creatable
              createLabel="Nuevo contacto"
            />
            {h.errors.contacto && <p className="text-xs text-red-600 mt-0.5">{h.errors.contacto}</p>}
          </div>
        ) : (
          <Input inputSize="sm" label="Contacto *" value={h.contacto}
            onChange={e => h.setContacto(e.target.value)} error={h.errors.contacto} placeholder="Persona de contacto" />
        )}
        <div className="grid grid-cols-2 gap-2">
          <Input inputSize="sm" label="Email" type="email" value={h.email}
            onChange={e => h.setEmail(e.target.value)} placeholder="correo@ejemplo.com" />
          <Input inputSize="sm" label="Teléfono" value={h.telefono}
            onChange={e => h.setTelefono(e.target.value)} placeholder="011 1234 5678" />
        </div>

        {/* Bloque 2: Motivo + Área */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelClass}>Motivo *</label>
            <select value={h.motivoLlamado} onChange={e => h.setMotivoLlamado(e.target.value as MotivoLlamado)} className={selectClass}>
              {Object.entries(MOTIVO_LLAMADO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Área destino</label>
            <select value={h.areaActual} onChange={e => h.setAreaActual(e.target.value as TicketArea | '')} className={selectClass}>
              <option value="">Sin área específica</option>
              {Object.entries(TICKET_AREA_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
        </div>
        {h.motivoLlamado === 'otros' && (
          <Input inputSize="sm" label="Especificar motivo *" value={h.motivoOtros}
            onChange={e => h.setMotivoOtros(e.target.value)} placeholder="Describir el motivo..." />
        )}

        {/* Bloque 3: Asignado + Próximo contacto */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelClass}>Asignar a</label>
            <select value={h.asignadoA} onChange={e => h.setAsignadoA(e.target.value)} className={selectClass}>
              <option value="">Sin asignar</option>
              {h.usuarios
                .filter(u => {
                  if (!h.areaActual) return true;
                  if (u.role === 'admin') return true;
                  const areas = getUserTicketAreas(u);
                  return areas.includes(h.areaActual as TicketArea);
                })
                .map(u => <option key={u.id} value={u.id}>{u.displayName}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Próximo contacto</label>
            <select
              value={h.prioridad}
              onChange={e => {
                const v = e.target.value;
                if (v === 'custom') {
                  h.setPrioridad('custom' as TicketPrioridad);
                } else {
                  h.setPrioridad(v as TicketPrioridad);
                  h.setFechaContactoCustom('');
                }
              }}
              className={selectClass}
            >
              {Object.entries(TICKET_PRIORIDAD_DIAS).map(([k, dias]) => (
                <option key={k} value={k}>{dias <= 4 ? `${(dias as number) * 24} hs` : `${dias} días`} — {TICKET_PRIORIDAD_LABELS[k as TicketPrioridad]}</option>
              ))}
              <option value="custom">Elegir fecha específica...</option>
            </select>
            {(h.prioridad as string) === 'custom' && (
              <input type="date" value={h.fechaContactoCustom}
                onChange={e => h.setFechaContactoCustom(e.target.value)}
                className="mt-1 w-full text-[11px] border border-slate-200 rounded-lg px-2 py-1 text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500"
                title="Elegir fecha" />
            )}
          </div>
        </div>

        {/* Bloque 4: Sistema/Equipo (si hay cliente) */}
        {h.clienteId && h.sistemasFiltrados.length > 0 && (
          <div>
            <label className={labelClass}>Sistema/Equipo (opcional)</label>
            <SearchableSelect value={h.sistemaId} onChange={h.handleSistemaChange}
              options={sistemaOptions} placeholder="Buscar sistema..." />
          </div>
        )}
        {h.sistemaId && h.modulos.length > 0 && (
          <div>
            <label className={labelClass}>Módulo (opcional)</label>
            <SearchableSelect value={h.moduloId} onChange={h.setModuloId}
              options={moduloOptions} placeholder="Buscar módulo..." />
          </div>
        )}

        {/* Bloque 5: Descripción */}
        <div>
          <label className={labelClass}>Descripción</label>
          <textarea value={h.descripcion} onChange={e => h.setDescripcion(e.target.value)} rows={2}
            className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            placeholder="Detalle de la consulta o solicitud..." />
        </div>

        {/* Bloque 6: Adjuntos */}
        <LeadAdjuntosField
          pendingFiles={h.pendingFiles} fileRef={h.fileRef}
          onFileChange={h.handleFileChange} onRemove={h.removeFile} />

        {/* Bloque 7: Override fecha de creación (oculto por default) */}
        <div className="pt-1 border-t border-slate-100">
          <label className="flex items-center gap-2 text-[11px] text-slate-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={h.overrideFechaCreacion}
              onChange={e => h.setOverrideFechaCreacion(e.target.checked)}
              className="rounded border-slate-300"
            />
            Modificar fecha de creación
          </label>
          {h.overrideFechaCreacion && (
            <div className="mt-1.5">
              <input
                type="date"
                value={h.fechaCreacionCustom}
                onChange={e => h.setFechaCreacionCustom(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className="text-xs border border-slate-300 rounded-lg px-2 py-1 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">
                El ticket quedará registrado con esta fecha en lugar del momento actual.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={h.handleSubmit} disabled={h.saving}>
            {h.saving ? 'Creando...' : 'Crear Ticket'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
