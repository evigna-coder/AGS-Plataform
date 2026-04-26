/**
 * EsquemaFacturacionSection — Editor section for the cuota schema in a presupuesto.
 * Part of Phase 12 Plan 02.
 *
 * Responsibilities:
 * - Display N editable rows (EsquemaCuotaRow) for each PresupuestoCuotaFacturacion
 * - Inline Σ%=100 badge per active moneda (green OK / red error)
 * - Quick-template bar (QuickTemplateButtons) when schema is empty
 * - All-zero cuota guard banner (findEmptyCuotas)
 * - Read-only when ppto.estado !== 'borrador'
 *
 * Visibility gate: parent (EditPresupuestoModal) decides when to render.
 * This component does NOT write to Firestore — all changes flow via onChange().
 */
import React, { useState, useMemo } from 'react';
import type { PresupuestoCuotaFacturacion, MonedaCuota, MonedaPresupuesto, PresupuestoItem } from '@ags/shared';
import { Button } from '../ui/Button';
import { EsquemaCuotaRow } from './EsquemaCuotaRow';
import { QuickTemplateButtons } from './QuickTemplateButtons';
import {
  validateEsquemaSum,
  findEmptyCuotas,
  computeTotalsByCurrency,
} from '../../utils/cuotasFacturacion';

interface Props {
  esquema: PresupuestoCuotaFacturacion[];
  moneda: MonedaPresupuesto;          // 'ARS'|'USD'|'EUR'|'MIXTA'
  itemsForTotals: PresupuestoItem[];   // to compute totalsByCurrency (I3)
  readOnly: boolean;                   // ppto.estado !== 'borrador'
  onChange: (next: PresupuestoCuotaFacturacion[]) => void;
}

function newCuotaId(): string {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Derive active monedas from ppto moneda and items (for MIXTA). */
function deriveMonedasActivas(moneda: MonedaPresupuesto, items: PresupuestoItem[]): MonedaCuota[] {
  if (moneda !== 'MIXTA') return [moneda as MonedaCuota];
  const set = new Set<MonedaCuota>();
  for (const item of items) {
    // item.moneda is 'USD'|'ARS'|'EUR'|null — MIXTA never stored at item level
    const m = item.moneda as MonedaCuota | null | undefined;
    if (m) set.add(m);
  }
  if (set.size === 0) return ['USD']; // fallback for empty MIXTA ppto
  return Array.from(set);
}

export const EsquemaFacturacionSection: React.FC<Props> = ({
  esquema, moneda, itemsForTotals, readOnly, onChange,
}) => {
  const [open, setOpen] = useState(true);

  // I3: use shared helper — do NOT inline the reduce
  const totalsByCurrency = useMemo(
    () => computeTotalsByCurrency(itemsForTotals, moneda),
    [itemsForTotals, moneda],
  );

  const monedasActivas = useMemo(
    () => deriveMonedasActivas(moneda, itemsForTotals),
    [moneda, itemsForTotals],
  );

  // BILL-01: inline validation badges
  const validationErrors = useMemo(
    () => validateEsquemaSum(esquema, monedasActivas),
    [esquema, monedasActivas],
  );

  // Pitfall 7: all-zero cuota guard
  const emptyCuotas = useMemo(() => findEmptyCuotas(esquema), [esquema]);

  if (monedasActivas.length === 0) return null; // defensive early-return

  const handleRowChange = (idx: number, updated: PresupuestoCuotaFacturacion) => {
    const next = esquema.map((c, i) => (i === idx ? updated : c));
    onChange(next);
  };

  const handleRowDelete = (idx: number) => {
    const next = esquema
      .filter((_, i) => i !== idx)
      .map((c, i) => ({ ...c, numero: i + 1 })); // renumber
    onChange(next);
  };

  const handleAddCuota = () => {
    const newCuota: PresupuestoCuotaFacturacion = {
      id: newCuotaId(),
      numero: esquema.length + 1,
      porcentajePorMoneda: {},
      descripcion: '',
      hito: 'todas_ots_cerradas',
      estado: 'pendiente',
      solicitudFacturacionId: null,
      montoFacturadoPorMoneda: null,
    };
    onChange([...esquema, newCuota]);
  };

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden mt-4" data-testid="esquema-section">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <span className="text-xs font-semibold text-slate-500 tracking-wider uppercase">
          Esquema de facturación
        </span>
        <div className="flex items-center gap-2">
          {/* Σ% badges — always visible in header for quick status */}
          {esquema.length > 0 && validationErrors.length === 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wide text-teal-700 bg-teal-50 border border-teal-200 rounded px-1.5 py-0.5">
              Σ 100% ✓
            </span>
          )}
          {esquema.length > 0 && validationErrors.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wide text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
              Σ% inválido
            </span>
          )}
          <svg
            className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3">
          {/* Quick-templates — show when empty and not readOnly */}
          {esquema.length === 0 && !readOnly && (
            <div className="pt-2">
              <QuickTemplateButtons
                monedasActivas={monedasActivas}
                onApply={onChange}
                disabled={readOnly}
              />
            </div>
          )}

          {/* Cuota rows */}
          {esquema.length > 0 && (
            <div className="mt-2">
              {esquema.map((cuota, idx) => (
                <EsquemaCuotaRow
                  key={cuota.id}
                  cuota={cuota}
                  index={idx}
                  monedasActivas={monedasActivas}
                  totalsByCurrency={totalsByCurrency}
                  readOnly={readOnly}
                  onChange={(updated) => handleRowChange(idx, updated)}
                  onDelete={() => handleRowDelete(idx)}
                />
              ))}
            </div>
          )}

          {/* Σ% badges per moneda */}
          {esquema.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {monedasActivas.map(m => {
                const err = validationErrors.find(e => e.moneda === m);
                if (!err) {
                  return (
                    <span
                      key={m}
                      data-testid={`esquema-suma-badge-${m}`}
                      className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wide text-teal-700 bg-teal-50 border border-teal-200 rounded px-2 py-1"
                    >
                      Σ% ({m}): 100.00 ✓
                    </span>
                  );
                }
                return (
                  <span
                    key={m}
                    data-testid={`esquema-suma-badge-${m}`}
                    className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wide text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1"
                  >
                    Σ% ({m}): {err.sum.toFixed(2)} — debe sumar 100.00%
                  </span>
                );
              })}
            </div>
          )}

          {/* All-zero cuota banner (Pitfall 7) */}
          {emptyCuotas.length > 0 && (
            <div className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
              {emptyCuotas.map(c => (
                <div key={c.id}>
                  Cuota N° {c.numero} no factura ninguna moneda — agregá un porcentaje o eliminala.
                </div>
              ))}
            </div>
          )}

          {/* Quick-templates for non-empty (above rows) + add cuota */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {esquema.length > 0 && !readOnly && (
              <QuickTemplateButtons
                monedasActivas={monedasActivas}
                onApply={onChange}
                disabled={readOnly}
              />
            )}
            <Button
              variant="ghost"
              size="sm"
              disabled={readOnly}
              onClick={handleAddCuota}
              className="text-teal-700 hover:text-teal-900"
              data-testid="esquema-add-cuota"
            >
              + Agregar cuota
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
