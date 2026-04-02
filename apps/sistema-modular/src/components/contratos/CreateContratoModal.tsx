import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';
import { useCreateContratoForm } from '../../hooks/useCreateContratoForm';
import { TIPO_LIMITE_CONTRATO_LABELS } from '@ags/shared';
import type { TipoLimiteContrato } from '@ags/shared';

const lbl = "block text-[10px] font-mono font-medium text-slate-500 mb-1 uppercase tracking-wide";
const inputClass = "w-full border border-[#E5E5E5] rounded-md px-3 py-1.5 text-xs";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export const CreateContratoModal: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const h = useCreateContratoForm(open, onClose, onCreated);

  return (
    <Modal open={open} onClose={h.handleClose} title="Nuevo contrato" subtitle="Defina los terminos del contrato de servicio" maxWidth="xl">
      <div className="space-y-4">
        <p className="text-[9px] font-mono font-semibold text-teal-700/70 uppercase tracking-widest">Datos del contrato</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Cliente *</label>
            <SearchableSelect value={h.form.clienteId} onChange={v => h.setForm(prev => ({ ...prev, clienteId: v, sistemaIds: [], presupuestoId: '' }))}
              options={h.clientes.map(c => ({ value: c.id, label: c.razonSocial }))} placeholder="Seleccionar cliente..." />
          </div>
          <div>
            <label className={lbl}>Presupuesto (contrato)</label>
            <SearchableSelect value={h.form.presupuestoId} onChange={v => h.setForm(prev => ({ ...prev, presupuestoId: v }))}
              options={[{ value: '', label: 'Sin presupuesto' }, ...h.presupuestos.map(p => ({ value: p.id, label: p.numero }))]}
              placeholder="Seleccionar..." />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={lbl}>Fecha inicio *</label>
            <input type="date" value={h.form.fechaInicio} onChange={e => h.setForm(prev => ({ ...prev, fechaInicio: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className={lbl}>Fecha fin *</label>
            <input type="date" value={h.form.fechaFin} onChange={e => h.setForm(prev => ({ ...prev, fechaFin: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className={lbl}>Tipo de limite</label>
            <select value={h.form.tipoLimite} onChange={e => h.setForm(prev => ({ ...prev, tipoLimite: e.target.value as TipoLimiteContrato }))} className={inputClass}>
              {Object.entries(TIPO_LIMITE_CONTRATO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        {h.form.tipoLimite !== 'ilimitado' && (
          <div className="w-32">
            <label className={lbl}>{h.form.tipoLimite === 'visitas' ? 'Max visitas' : 'Max horas'}</label>
            <input type="number" min="1" value={h.form.maxVisitas} onChange={e => h.setForm(prev => ({ ...prev, maxVisitas: e.target.value }))} className={inputClass} />
          </div>
        )}

        {/* Servicios incluidos */}
        <div>
          <label className={lbl}>Servicios incluidos *</label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {h.tiposServicio.map(ts => {
              const selected = h.form.serviciosIncluidos.some(s => s.tipoServicioId === ts.id);
              return (
                <button key={ts.id} type="button" onClick={() => h.toggleServicio(ts)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${selected ? 'bg-teal-100 text-teal-700 border-teal-300' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                  {ts.nombre}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sistemas cubiertos */}
        {h.form.clienteId && h.sistemasFiltrados.length > 0 && (
          <div>
            <label className={lbl}>Sistemas cubiertos</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {h.sistemasFiltrados.map(s => {
                const selected = h.form.sistemaIds.includes(s.id);
                return (
                  <button key={s.id} type="button" onClick={() => h.toggleSistema(s.id)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${selected ? 'bg-teal-100 text-teal-700 border-teal-300' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                    {s.nombre}{s.codigoInternoCliente ? ` (${s.codigoInternoCliente})` : ''}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <label className={lbl}>Notas</label>
          <textarea value={h.form.notas} onChange={e => h.setForm(prev => ({ ...prev, notas: e.target.value }))} rows={2} className={inputClass} placeholder="Observaciones del contrato..." />
        </div>
      </div>

      <div className="flex items-center justify-end px-5 py-3 border-t border-[#E5E5E5] bg-[#F0F0F0] rounded-b-xl -mx-5 -mb-4 mt-3 gap-2">
        <Button variant="secondary" size="sm" onClick={h.handleClose}>Cancelar</Button>
        <Button variant="primary" size="sm" onClick={h.handleSave} disabled={h.saving || !h.form.clienteId}>
          {h.saving ? 'Creando...' : 'Crear contrato'}
        </Button>
      </div>
    </Modal>
  );
};
