import { useEffect, useMemo, useState } from 'react';
import type { Cliente, Pendiente, PendienteTipo, Sistema } from '@ags/shared';
import { PENDIENTE_TIPO_LABELS } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';
import { clientesService, sistemasService } from '../../services/firebaseService';
import { pendientesService } from '../../services/pendientesService';

const lbl = 'block text-[10px] font-mono font-medium text-slate-500 mb-1 uppercase tracking-wide';
const inputClass = 'w-full border border-[#E5E5E5] rounded-md px-3 py-1.5 text-xs';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: (id: string) => void;

  /** Si se pasa, es modo edición */
  pendiente?: Pendiente | null;

  /** Pre-selecciones para modo creación */
  initialClienteId?: string;
  initialClienteNombre?: string;
  initialEquipoId?: string;
  initialEquipoNombre?: string;

  /** Origen ticket (cuando se crea desde flujo de finalizar ticket) */
  origenTicketId?: string;
  origenTicketRazonSocial?: string;
}

interface FormState {
  clienteId: string;
  clienteNombre: string;
  equipoId: string;
  equipoNombre: string;
  equipoAgsId: string;
  tipo: PendienteTipo;
  descripcion: string;
}

const emptyForm: FormState = {
  clienteId: '',
  clienteNombre: '',
  equipoId: '',
  equipoNombre: '',
  equipoAgsId: '',
  tipo: 'ambos',
  descripcion: '',
};

export const CreatePendienteModal: React.FC<Props> = ({
  open,
  onClose,
  onSaved,
  pendiente,
  initialClienteId,
  initialClienteNombre,
  initialEquipoId,
  initialEquipoNombre,
  origenTicketId,
  origenTicketRazonSocial,
}) => {
  const isEdit = !!pendiente;
  const [form, setForm] = useState<FormState>(emptyForm);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load clientes y sistemas al abrir
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingRefs(true);
    Promise.all([clientesService.getAll(true), sistemasService.getAll()])
      .then(([cs, ss]) => {
        if (cancelled) return;
        setClientes(cs);
        setSistemas(ss);
      })
      .catch(err => {
        console.error('Error cargando referencias:', err);
        if (!cancelled) setError('Error cargando clientes/equipos');
      })
      .finally(() => {
        if (!cancelled) setLoadingRefs(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Reset/seed form when opening
  useEffect(() => {
    if (!open) return;
    setError(null);
    if (pendiente) {
      setForm({
        clienteId: pendiente.clienteId,
        clienteNombre: pendiente.clienteNombre,
        equipoId: pendiente.equipoId ?? '',
        equipoNombre: pendiente.equipoNombre ?? '',
        equipoAgsId: pendiente.equipoAgsId ?? '',
        tipo: pendiente.tipo,
        descripcion: pendiente.descripcion,
      });
    } else {
      setForm({
        ...emptyForm,
        clienteId: initialClienteId ?? '',
        clienteNombre: initialClienteNombre ?? '',
        equipoId: initialEquipoId ?? '',
        equipoNombre: initialEquipoNombre ?? '',
      });
    }
  }, [open, pendiente, initialClienteId, initialClienteNombre, initialEquipoId, initialEquipoNombre]);

  // Filtrar sistemas por cliente seleccionado
  const sistemasFiltrados = useMemo(() => {
    if (!form.clienteId) return [];
    return sistemas.filter(s => s.clienteId === form.clienteId && s.activo !== false);
  }, [sistemas, form.clienteId]);

  const handleClienteChange = (id: string) => {
    const cliente = clientes.find(c => c.id === id);
    setForm(prev => ({
      ...prev,
      clienteId: id,
      clienteNombre: cliente?.razonSocial ?? '',
      // Si cambia cliente, limpiar equipo
      equipoId: '',
      equipoNombre: '',
      equipoAgsId: '',
    }));
  };

  const handleEquipoChange = (id: string) => {
    const sistema = sistemas.find(s => s.id === id);
    setForm(prev => ({
      ...prev,
      equipoId: id,
      equipoNombre: sistema?.nombre ?? '',
      equipoAgsId: sistema?.agsVisibleId ?? '',
    }));
  };

  const canSubmit =
    !!form.clienteId &&
    !!form.tipo &&
    form.descripcion.trim().length >= 3 &&
    !saving &&
    !loadingRefs;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      if (isEdit && pendiente) {
        await pendientesService.update(pendiente.id, {
          clienteId: form.clienteId,
          clienteNombre: form.clienteNombre,
          equipoId: form.equipoId || null,
          equipoNombre: form.equipoNombre || null,
          equipoAgsId: form.equipoAgsId || null,
          tipo: form.tipo,
          descripcion: form.descripcion.trim(),
        });
        onSaved?.(pendiente.id);
      } else {
        const id = await pendientesService.create({
          clienteId: form.clienteId,
          clienteNombre: form.clienteNombre,
          equipoId: form.equipoId || null,
          equipoNombre: form.equipoNombre || null,
          equipoAgsId: form.equipoAgsId || null,
          tipo: form.tipo,
          descripcion: form.descripcion.trim(),
          estado: 'pendiente',
          origenTicketId: origenTicketId ?? null,
          origenTicketRazonSocial: origenTicketRazonSocial ?? null,
        });
        onSaved?.(id);
      }
      onClose();
    } catch (err) {
      console.error('Error guardando pendiente:', err);
      setError('No se pudo guardar. Intente nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar Pendiente' : 'Nueva Pendiente'}
      subtitle={
        origenTicketRazonSocial
          ? `Origen: Ticket de ${origenTicketRazonSocial}`
          : 'Recordatorio que aparecerá al crear presupuestos u órdenes de trabajo'
      }
      maxWidth="lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Cliente *</label>
            <SearchableSelect
              value={form.clienteId}
              onChange={handleClienteChange}
              options={clientes.map(c => ({ value: c.id, label: c.razonSocial }))}
              placeholder={loadingRefs ? 'Cargando...' : 'Seleccionar cliente...'}
            />
          </div>
          <div>
            <label className={lbl}>Equipo (opcional)</label>
            <SearchableSelect
              value={form.equipoId}
              onChange={handleEquipoChange}
              options={[
                { value: '', label: 'Sin equipo específico' },
                ...sistemasFiltrados.map(s => ({
                  value: s.id,
                  label: s.agsVisibleId ? `${s.nombre} (${s.agsVisibleId})` : s.nombre,
                })),
              ]}
              placeholder={form.clienteId ? 'Sin equipo específico' : 'Elija cliente primero'}
            />
          </div>
        </div>

        <div>
          <label className={lbl}>Tipo *</label>
          <div className="flex items-center gap-2">
            {(Object.keys(PENDIENTE_TIPO_LABELS) as PendienteTipo[]).map(t => (
              <label
                key={t}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs cursor-pointer transition-colors ${
                  form.tipo === t
                    ? 'bg-teal-50 border-teal-400 text-teal-700 font-medium'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="pendiente-tipo"
                  value={t}
                  checked={form.tipo === t}
                  onChange={() => setForm(prev => ({ ...prev, tipo: t }))}
                  className="sr-only"
                />
                {PENDIENTE_TIPO_LABELS[t]}
              </label>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            Define cuándo aparecerá el recordatorio: al crear un presupuesto, al agendar una
            visita, o en ambos casos.
          </p>
        </div>

        <div>
          <label className={lbl}>Descripción *</label>
          <textarea
            value={form.descripcion}
            onChange={e => setForm(prev => ({ ...prev, descripcion: e.target.value }))}
            rows={4}
            className={`${inputClass} resize-none`}
            placeholder="Ej: En próximo mantenimiento cotizar filtros de split del GC 7890"
            maxLength={500}
          />
          <p className="text-[10px] text-slate-400 mt-1 text-right">
            {form.descripcion.length}/500
          </p>
        </div>

        {error && (
          <div className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear pendiente'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
