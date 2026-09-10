import { useState } from 'react';
import type { OTEstadoAdmin } from '@ags/shared';
import type { NivelReapertura } from '@ags/shared';
import { Button } from '../ui/Button';
import { ReabrirOTModal } from './ReabrirOTModal';

interface Props {
  otNumber: string;
  estadoAdmin?: OTEstadoAdmin;
  /** Refrescar la OT tras reabrir (las páginas con suscripción pueden omitirlo). */
  onReabierta?: () => void;
  className?: string;
  /** 'banner' = franja con texto explicativo (detalle en cierre técnico); 'boton' = solo el botón. */
  variante?: 'boton' | 'banner';
}

const ESTADOS_REABRIBLES: OTEstadoAdmin[] = ['CIERRE_TECNICO', 'CIERRE_ADMINISTRATIVO', 'FINALIZADO'];

/**
 * Botón "Reabrir OT" + modal (2026-09-10). Aparece solo en estados cerrados.
 * Desde cierre técnico propone la reapertura técnica; desde cierre
 * administrativo o finalizado, la administrativa.
 */
export const ReabrirOTButton: React.FC<Props> = ({ otNumber, estadoAdmin, onReabierta, className, variante = 'boton' }) => {
  const [open, setOpen] = useState(false);
  if (!estadoAdmin || !ESTADOS_REABRIBLES.includes(estadoAdmin)) return null;
  const nivelInicial: NivelReapertura = estadoAdmin === 'CIERRE_TECNICO' ? 'tecnica' : 'administrativa';
  const boton = (
    <Button size="sm" variant="outline" onClick={() => setOpen(true)}
      className={className ?? 'text-amber-700 border-amber-300 hover:bg-amber-50'}>
      Reabrir OT…
    </Button>
  );
  return (
    <>
      {variante === 'banner' ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-600">
            Cerrada técnicamente. Si el reporte tiene un error o falta algo, se puede reabrir con motivo: el técnico lo corrige y vuelve a firmar con el cliente.
          </p>
          {boton}
        </div>
      ) : boton}
      <ReabrirOTModal open={open} otNumber={otNumber} nivelInicial={nivelInicial}
        onClose={() => setOpen(false)} onReabierta={() => onReabierta?.()} />
    </>
  );
};
