import React, { useState } from 'react';
import type { Disponibilidad } from '@ags/shared';
import { PresupuestoDisponibilidadFields } from './PresupuestoDisponibilidadFields';

interface BulkAplicarDisponibilidadButtonProps {
  itemsCount: number;
  onApplyAll: (next: { disponibilidad: Disponibilidad | null; etaDiasEstimados: number | null }) => void;
  disabled?: boolean;
}

export const BulkAplicarDisponibilidadButton: React.FC<BulkAplicarDisponibilidadButtonProps> = ({
  itemsCount,
  onApplyAll,
  disabled,
}) => {
  const [open, setOpen] = useState(false);
  const [disp, setDisp] = useState<Disponibilidad | null>(null);
  const [eta, setEta] = useState<number | null>(null);

  if (itemsCount === 0) return null;

  const handleApply = () => {
    onApplyAll({ disponibilidad: disp, etaDiasEstimados: eta });
    setOpen(false);
    // Reset for next open
    setDisp(null);
    setEta(null);
  };

  const handleClose = () => {
    setOpen(false);
    setDisp(null);
    setEta(null);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="text-[11px] font-medium text-teal-700 hover:text-teal-900 px-2 py-1 rounded hover:bg-teal-50 disabled:text-slate-400 disabled:cursor-not-allowed"
        data-testid="bulk-aplicar-disp"
      >
        Aplicar a todos ({itemsCount})
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={handleClose}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-sm w-full p-4 mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              className="text-sm font-semibold text-slate-700 mb-1"
              style={{ fontFamily: 'Newsreader, serif' }}
            >
              Aplicar disponibilidad a todos
            </h3>
            <p className="text-[11px] text-slate-500 mb-3">
              Se aplicará a los {itemsCount} items. Ajustable individualmente después.
            </p>
            <PresupuestoDisponibilidadFields
              disponibilidad={disp}
              etaDiasEstimados={eta}
              onChange={(n) => { setDisp(n.disponibilidad); setEta(n.etaDiasEstimados); }}
              variant="modal"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={handleClose}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="text-xs px-3 py-1.5 rounded-lg bg-teal-700 text-white hover:bg-teal-800"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
