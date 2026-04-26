import { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { otService } from '../../services/firebaseService';
import type { WorkOrder } from '@ags/shared';

interface Props {
  onContinue: (ot: WorkOrder | null) => void;
}

/**
 * Paso 1 — buscar OT por número, o saltear (la ficha puede nacer sin OT
 * cuando el equipo entra antes de que se haya asignado, o cuando una OT
 * de un item se va a usar para el equipo de otro item).
 */
export function BuscarOTStep({ onContinue }: Props) {
  const [numero, setNumero] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundOT, setFoundOT] = useState<WorkOrder | null>(null);
  const [notFound, setNotFound] = useState(false);

  const handleSearch = async () => {
    const n = numero.trim();
    if (!n) return;
    setSearching(true);
    setNotFound(false);
    setFoundOT(null);
    try {
      const ot = await otService.getByOtNumber(n);
      if (ot) setFoundOT(ot);
      else setNotFound(true);
    } catch (err) {
      console.error(err);
      setNotFound(true);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500 font-mono mb-1">
          Paso 1 · OT (opcional)
        </p>
        <h2 className="text-lg font-semibold text-slate-800">
          ¿Tenés número de OT?
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Si no lo tenés todavía, podés seguir sin OT y vincularla después desde sistema-modular.
        </p>
      </div>

      <div className="flex gap-2">
        <Input
          value={numero}
          onChange={e => setNumero(e.target.value)}
          placeholder="Ej: 25660 o 25660.02"
          onKeyDown={e => { if (e.key === 'Enter') void handleSearch(); }}
          inputMode="text"
          autoCapitalize="none"
        />
        <Button onClick={() => void handleSearch()} disabled={!numero.trim() || searching}>
          {searching ? '…' : 'Buscar'}
        </Button>
      </div>

      {notFound && !foundOT && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          OT no encontrada. Podés intentar otra o seguir sin OT.
        </div>
      )}

      {foundOT && (
        <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg space-y-1 text-sm">
          <p className="font-mono text-teal-800 font-semibold">OT-{foundOT.otNumber}</p>
          <p className="text-slate-700">{foundOT.razonSocial}</p>
          <p className="text-xs text-slate-500">
            {foundOT.sistema} {foundOT.moduloModelo ? `· ${foundOT.moduloModelo}` : ''}
          </p>
          {foundOT.moduloSerie && (
            <p className="text-[11px] text-slate-500 font-mono">Serie: {foundOT.moduloSerie}</p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2 pt-2">
        <Button
          onClick={() => onContinue(foundOT)}
          disabled={!foundOT}
          size="lg"
          className="w-full"
        >
          Continuar con esta OT
        </Button>
        <Button
          onClick={() => onContinue(null)}
          variant="outline"
          size="lg"
          className="w-full"
        >
          Seguir sin OT
        </Button>
      </div>
    </div>
  );
}
