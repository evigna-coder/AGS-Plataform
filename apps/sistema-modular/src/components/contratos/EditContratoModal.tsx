import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { contratosService, tiposServicioService, sistemasService } from '../../services/firebaseService';
import { TIPO_LIMITE_CONTRATO_LABELS } from '@ags/shared';
import type { Contrato, ServicioContrato, Sistema, TipoLimiteContrato, TipoServicio } from '@ags/shared';

const lbl = "block text-[10px] font-mono font-medium text-slate-500 mb-1 uppercase tracking-wide";
const inputClass = "w-full border border-[#E5E5E5] rounded-md px-3 py-1.5 text-xs";
const chip = (selected: boolean) =>
  `px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${selected ? 'bg-teal-100 text-teal-700 border-teal-300' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`;

interface Props {
  open: boolean;
  contrato: Contrato;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Edición de contrato (pedido 2026-07-31): agregar/quitar equipos y servicios,
 * ajustar vigencia, límite y notas. El cliente y el presupuesto de origen no se
 * cambian (para eso, contrato nuevo). Al guardar, contratosService.update hace
 * el diff de sistemaIds y sincroniza enContrato/contratoId de los equipos.
 */
export const EditContratoModal: React.FC<Props> = ({ open, contrato, onClose, onSaved }) => {
  const [saving, setSaving] = useState(false);
  const [tiposServicio, setTiposServicio] = useState<TipoServicio[]>([]);
  const [sistemasCliente, setSistemasCliente] = useState<Sistema[]>([]);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [tipoLimite, setTipoLimite] = useState<TipoLimiteContrato>('ilimitado');
  const [maxVisitas, setMaxVisitas] = useState('10');
  const [servicios, setServicios] = useState<ServicioContrato[]>([]);
  const [sistemaIds, setSistemaIds] = useState<string[]>([]);
  const [notas, setNotas] = useState('');

  useEffect(() => {
    if (!open) return;
    tiposServicioService.getAll().then(setTiposServicio).catch(() => setTiposServicio([]));
    sistemasService.getAll({ clienteId: contrato.clienteId })
      .then(setSistemasCliente).catch(() => setSistemasCliente([]));
    setFechaInicio(contrato.fechaInicio || '');
    setFechaFin(contrato.fechaFin || '');
    setTipoLimite(contrato.tipoLimite);
    setMaxVisitas(String(contrato.maxVisitas ?? 10));
    setServicios(contrato.serviciosIncluidos ?? []);
    setSistemaIds(contrato.sistemaIds ?? []);
    setNotas(contrato.notas ?? '');
  }, [open, contrato]);

  const toggleServicio = (ts: TipoServicio) => {
    setServicios(prev => prev.some(s => s.tipoServicioId === ts.id)
      ? prev.filter(s => s.tipoServicioId !== ts.id)
      : [...prev, { tipoServicioId: ts.id, tipoServicioNombre: ts.nombre }]);
  };
  const toggleSistema = (id: string) => {
    setSistemaIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    if (!fechaInicio || !fechaFin) { alert('Completá la vigencia'); return; }
    if (servicios.length === 0) { alert('El contrato necesita al menos un servicio incluido'); return; }
    setSaving(true);
    try {
      await contratosService.update(contrato.id, {
        fechaInicio,
        fechaFin,
        tipoLimite,
        maxVisitas: tipoLimite === 'ilimitado' ? null : (Number(maxVisitas) || 10),
        serviciosIncluidos: servicios,
        sistemaIds,
        notas: notas || null,
      } as Partial<Contrato>);
      onSaved();
      onClose();
    } catch (err) {
      console.error('[EditContratoModal] guardar:', err);
      alert('Error al guardar el contrato');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Editar contrato ${contrato.numero}`}
      subtitle={contrato.clienteNombre} maxWidth="xl"
      footer={<>
        <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" size="sm" onClick={() => void handleSave()} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </>}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={lbl}>Fecha inicio *</label>
            <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={lbl}>Fecha fin *</label>
            <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={lbl}>Tipo de limite</label>
            <select value={tipoLimite} onChange={e => setTipoLimite(e.target.value as TipoLimiteContrato)} className={inputClass}>
              {Object.entries(TIPO_LIMITE_CONTRATO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        {tipoLimite !== 'ilimitado' && (
          <div className="w-32">
            <label className={lbl}>{tipoLimite === 'visitas' ? 'Max visitas' : 'Max horas'}</label>
            <input type="number" min="1" value={maxVisitas} onChange={e => setMaxVisitas(e.target.value)} className={inputClass} />
          </div>
        )}

        <div>
          <label className={lbl}>Servicios incluidos *</label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {tiposServicio.map(ts => (
              <button key={ts.id} type="button" onClick={() => toggleServicio(ts)}
                className={chip(servicios.some(s => s.tipoServicioId === ts.id))}>
                {ts.nombre}
              </button>
            ))}
          </div>
          {/* Cupo anual POR EQUIPO (2026-08-17): "preventivo 1" = uno para cada
              equipo del contrato por año, no uno para todo el contrato. Vacío =
              sin tope (el caso de los correctivos). */}
          {servicios.length > 0 && (
            <div className="mt-2.5 border border-slate-200 rounded-lg divide-y divide-slate-100">
              <div className="px-2.5 py-1.5 bg-slate-50 flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wide text-slate-500 flex-1">
                  Cantidad anual por equipo
                </span>
                <span className="text-[10px] text-slate-400">vacío = sin tope</span>
              </div>
              {servicios.map(s => (
                <div key={s.tipoServicioId} className="px-2.5 py-1.5 flex items-center gap-3">
                  <span className="text-xs text-slate-700 flex-1 truncate">{s.tipoServicioNombre}</span>
                  <input
                    type="number" min={1} placeholder="—"
                    value={s.cantidadAnualPorEquipo ?? ''}
                    onChange={e => {
                      const v = e.target.value.trim();
                      const n = v === '' ? null : Math.max(1, Number(v) || 1);
                      setServicios(prev => prev.map(x =>
                        x.tipoServicioId === s.tipoServicioId ? { ...x, cantidadAnualPorEquipo: n } : x));
                    }}
                    className="w-20 border border-slate-200 rounded px-2 py-1 text-xs text-center" />
                  <span className="text-[10px] text-slate-400 w-24">por equipo/año</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className={lbl}>Sistemas cubiertos</label>
          {sistemasCliente.length === 0 ? (
            <p className="text-[11px] text-slate-400 mt-1">El cliente no tiene equipos cargados.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {sistemasCliente.map(s => (
                <button key={s.id} type="button" onClick={() => toggleSistema(s.id)}
                  className={chip(sistemaIds.includes(s.id))}>
                  {s.nombre}{s.codigoInternoCliente ? ` (${s.codigoInternoCliente})` : ''}
                </button>
              ))}
            </div>
          )}
          <p className="text-[10px] text-slate-400 mt-1">
            Al guardar, los equipos agregados quedan marcados "En contrato" y los quitados se liberan
            (salvo que otro contrato vigente los cubra).
          </p>
        </div>

        <div>
          <label className={lbl}>Notas</label>
          <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} className={inputClass}
            placeholder="Observaciones del contrato..." />
        </div>
      </div>
    </Modal>
  );
};
