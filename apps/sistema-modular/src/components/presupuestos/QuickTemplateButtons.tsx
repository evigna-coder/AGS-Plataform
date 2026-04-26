/**
 * QuickTemplateButtons — 3 quick-fill buttons for common cuota schemas.
 * Part of Phase 12 Plan 02.
 *
 * Buttons call builders from cuotasFacturacion.ts and invoke onApply with the result.
 */
import React from 'react';
import type { PresupuestoCuotaFacturacion, MonedaCuota } from '@ags/shared';
import { Button } from '../ui/Button';
import {
  buildTemplate100AlCierre,
  buildTemplate30_70,
  buildTemplate70_30PreEmbarque,
} from '../../utils/cuotasFacturacion';

interface Props {
  monedasActivas: MonedaCuota[];
  onApply: (next: PresupuestoCuotaFacturacion[]) => void;
  disabled?: boolean;
}

export const QuickTemplateButtons: React.FC<Props> = ({ monedasActivas, onApply, disabled }) => (
  <div className="flex flex-wrap items-center gap-2 py-2">
    <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
      Plantillas:
    </span>
    <Button
      variant="outline"
      size="sm"
      disabled={disabled}
      onClick={() => onApply(buildTemplate100AlCierre(monedasActivas))}
      data-testid="esquema-quick-100"
    >
      100% al cierre
    </Button>
    <Button
      variant="outline"
      size="sm"
      disabled={disabled}
      onClick={() => onApply(buildTemplate30_70(monedasActivas))}
      data-testid="esquema-quick-30-70"
    >
      30/70 anticipo+entrega
    </Button>
    <Button
      variant="outline"
      size="sm"
      disabled={disabled}
      onClick={() => onApply(buildTemplate70_30PreEmbarque(monedasActivas))}
      data-testid="esquema-quick-70-30-pre"
    >
      70/30 pre-embarque
    </Button>
  </div>
);
