import { useEffect, useState } from 'react';
import type { AgendaPrevision, Ingeniero } from '@ags/shared';
import { previsionesService } from '../../services/previsionesService';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { DateInput } from '../ui/DateInput';
import { SearchableSelect } from '../ui/SearchableSelect';
import { diffDias, sumarDias } from '../../utils/previsionesFechas';

interface Props {
  prevision: AgendaPrevision | null;
  ingenieros: Ingeniero[];
  onClose: () => void;
  onSaved: () => void;
}

const lbl = 'block text-[10px] font-mono font-medium text-slate-500 mb-0.5 uppercase tracking-wide';

/**
 * Reprograma una previsión (fecha y/o ingeniero). Al guardar queda en estado
 * `reprogramada`, que blinda el registro contra la próxima corrida del generador.
 */
export const ReprogramarPrevisionModal: React.FC<Props> = ({ prevision, ingenieros, onClose, onSaved }) => {
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [ingenieroId, setIngenieroId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!prevision) return;
    setFechaInicio(prevision.fechaInicio);
    setFechaFin(prevision.fechaFin);
    setIngenieroId(prevision.ingenieroId);
  }, [prevision]);

  if (!prevision) return null;

  // Mover el inicio arrastra el fin manteniendo la duración del bloque.
  const cambiarInicio = (iso: string) => {
    if (iso && fechaInicio && fechaFin) {
      const duracion = Math.max(0, diffDias(fechaInicio, fechaFin));
      setFechaFin(sumarDias(iso, duracion));
    }
    setFechaInicio(iso);
  };

  const handleSave = async () => {
    if (!fechaInicio || !fechaFin) { alert('Indicá fecha de inicio y de fin'); return; }
    if (fechaFin < fechaInicio) { alert('La fecha de fin no puede ser anterior al inicio'); return; }
    const ing = ingenieros.find(i => (i.usuarioId || i.id) === ingenieroId);
    setSaving(true);
    try {
      await previsionesService.reprogramar(prevision.id, {
        fechaInicio, fechaFin,
        ingenieroId,
        ingenieroNombre: ing?.nombre ?? prevision.ingenieroNombre ?? '',
      });
      onSaved();
      onClose();
    } catch (err) {
      console.error('Error reprogramando previsión:', err);
      alert('Error al reprogramar la previsión');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} maxWidth="sm" minimizable={false}
      title="Reprogramar previsión"
      subtitle={`${prevision.clienteNombre} · ${prevision.tipoServicio}`}
      footer={<>
        <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Inicio</label>
            <DateInput value={fechaInicio} onChange={cambiarInicio} />
          </div>
          <div>
            <label className={lbl}>Fin</label>
            <DateInput value={fechaFin} onChange={setFechaFin} />
          </div>
        </div>
        <div>
          <label className={lbl}>Ingeniero</label>
          <SearchableSelect
            size="sm"
            value={ingenieroId}
            onChange={setIngenieroId}
            options={ingenieros.map(i => ({ value: i.usuarioId || i.id, label: i.nombre }))}
            placeholder="Sin asignar"
          />
        </div>
        <p className="text-[11px] text-slate-400">
          Al guardar, la previsión queda marcada como <span className="font-medium">reprogramada</span> y
          las próximas corridas del generador ya no la pisan.
        </p>
      </div>
    </Modal>
  );
};
