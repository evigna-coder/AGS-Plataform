import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';

interface Props {
  open: boolean;
  onClose: () => void;
  parteDescripcion: string;
  /** Ya volvió a la base o se reinstala directo desde afuera. */
  yaEnBase: boolean;
  /** OTs vinculadas al loaner, para elegir la de reinstalación. */
  otsDelLoaner: string[];
  onConfirm: (data: { fecha: string; otNumber: string | null }) => Promise<void>;
}

/**
 * Reinstalación de una parte en el módulo (2026-09-08). Es el hecho que
 * cierra el ciclo de la parte: recién acá el equipo deja de figurar
 * incompleto. Normalmente ocurre en una OT de reinstalación, que se puede
 * elegir o escribir; si no hubo OT, se registra igual.
 */
export function LoanerReinstalarModal({ open, onClose, parteDescripcion, yaEnBase, otsDelLoaner, onConfirm }: Props) {
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [otNumber, setOtNumber] = useState('');
  const [otManual, setOtManual] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!fecha) return;
    setSaving(true);
    try {
      await onConfirm({ fecha: new Date(fecha).toISOString(), otNumber: otNumber.trim() || null });
      onClose();
      setOtNumber('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Parte reinstalada en el módulo" subtitle={parteDescripcion} footer={
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" size="sm" onClick={handleConfirm} disabled={!fecha || saving}>
          {saving ? 'Guardando...' : 'Confirmar reinstalación'}
        </Button>
      </div>
    }>
      <div className="space-y-4">
        {!yaEnBase && (
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
            Esta parte figura todavía afuera. Al confirmar queda registrada como vuelta a la base y reinstalada en la misma fecha.
          </p>
        )}
        <Input label="Fecha de reinstalación *" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">OT de reinstalación <span className="text-slate-400 font-normal">(opcional)</span></label>
          {otManual || otsDelLoaner.length === 0 ? (
            <Input value={otNumber} onChange={e => setOtNumber(e.target.value)} placeholder="Ej: 30250.01" />
          ) : (
            <SearchableSelect value={otNumber} onChange={setOtNumber}
              options={[{ value: '', label: 'Sin OT' }, ...otsDelLoaner.map(n => ({ value: n, label: `OT ${n}` }))]}
              placeholder="Elegir OT del loaner" size="sm" />
          )}
          {otsDelLoaner.length > 0 && (
            <button type="button" onClick={() => setOtManual(m => !m)} className="mt-1 text-[11px] text-teal-700 hover:underline">
              {otManual ? 'Elegir entre las OTs del loaner' : 'Escribir otro número de OT'}
            </button>
          )}
        </div>
        <p className="text-[11px] text-slate-400">
          Con todas las partes reinstaladas el préstamo queda devuelto y el equipo deja de figurar incompleto.
        </p>
      </div>
    </Modal>
  );
}
