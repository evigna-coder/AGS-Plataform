import { useState } from 'react';
import type { Sistema } from '@ags/shared';
import { SearchableSelect } from '../ui/SearchableSelect';
import { useConfirm } from '../ui/ConfirmDialog';

interface SistemasPresupuestoPanelProps {
  clienteSistemas: Sistema[];
  linkedSistemaIds: string[];
  onRemoveSistema: (sistemaId: string) => void;
}

export const SistemasPresupuestoPanel = ({
  clienteSistemas,
  linkedSistemaIds,
  onRemoveSistema,
}: SistemasPresupuestoPanelProps) => {
  const [adding, setAdding] = useState(false);
  const confirm = useConfirm();

  const linkedSistemas = clienteSistemas.filter(s => linkedSistemaIds.includes(s.id));
  const availableSistemas = clienteSistemas.filter(s => !linkedSistemaIds.includes(s.id));

  const handleRemove = async (sistemaId: string) => {
    const sistema = clienteSistemas.find(s => s.id === sistemaId);
    if (await confirm(`Desvincular "${sistema?.nombre || 'sistema'}"? Se eliminarán todos los items asociados.`)) {
      onRemoveSistema(sistemaId);
    }
  };

  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 mb-2">
        <h4 className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase">Sistemas/Equipos vinculados</h4>
        {availableSistemas.length > 0 && (
          <button
            onClick={() => setAdding(!adding)}
            className="text-[11px] text-teal-600 hover:text-teal-800 font-medium"
          >
            {adding ? 'Cerrar' : '+ Agregar sistema'}
          </button>
        )}
      </div>

      {linkedSistemas.length === 0 && !adding && (
        <p className="text-[11px] text-slate-400 italic">Sin sistemas vinculados. Agregue items con equipo para vincular.</p>
      )}

      {linkedSistemas.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {linkedSistemas.map(s => (
            <span key={s.id} className="inline-flex items-center gap-1 bg-teal-50 text-teal-700 px-2.5 py-1 rounded-full text-[11px] font-medium">
              {s.nombre}{s.codigoInternoCliente ? ` (${s.codigoInternoCliente})` : ''}
              <button onClick={() => handleRemove(s.id)} className="text-teal-400 hover:text-red-500 ml-0.5">&times;</button>
            </span>
          ))}
        </div>
      )}

      {adding && (
        <div className="max-w-xs">
          <SearchableSelect
            value=""
            onChange={(v) => { if (v) setAdding(false); }}
            options={availableSistemas.map(s => ({
              value: s.id,
              label: `${s.nombre}${s.codigoInternoCliente ? ` (${s.codigoInternoCliente})` : ''}`,
            }))}
            placeholder="Seleccionar sistema para vincular..."
          />
          <p className="text-[10px] text-slate-400 mt-1">Agregue un item al sistema para vincularlo</p>
        </div>
      )}
    </div>
  );
};
