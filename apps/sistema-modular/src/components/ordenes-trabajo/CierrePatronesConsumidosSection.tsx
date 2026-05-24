/**
 * Phase 14 BOM-05 — UI del paso "Patrones consumidos" del cierre administrativo.
 *
 * Sub-componente extraído de OTCierreAdminSection (244 LOC, cerca del 250-LOC
 * budget de .claude/rules/components.md). Renderiza 3 estados:
 *  - loading: spinner italic
 *  - read-only: banner verde "Ya descontado" (idempotency) o estado terminal
 *    tras confirmar
 *  - editable: tabla de filas (patrón, lote, componente, sugerido, real, motivo)
 *    con add/remove/edit + botón "Confirmar descuento de patrones"
 *
 * El reporte técnico queda intocable: el hook solo lee patronesSeleccionados y
 * divergencias se anotan en el motivo del MovimientoStock por componente.
 */
import type { PatronSeleccionado } from '@ags/shared';
import { useCierrePatronesConsumidos } from '../../hooks/useCierrePatronesConsumidos';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export interface CierrePatronesConsumidosSectionProps {
  otNumber: string;
  patronesSeleccionados: PatronSeleccionado[];
  onConfirmed?: (result: { movimientoIds: string[]; requerimientosCreados: string[] }) => void;
}

export function CierrePatronesConsumidosSection({
  otNumber,
  patronesSeleccionados,
  onConfirmed,
}: CierrePatronesConsumidosSectionProps) {
  const ctx = useCierrePatronesConsumidos(otNumber, patronesSeleccionados);

  if (ctx.loading) {
    return (
      <section className="border-t border-slate-200 pt-6 mt-6" data-testid="cierre-bom-section">
        <h3 className="font-serif text-lg text-slate-900 mb-2">Patrones consumidos</h3>
        <p className="text-sm text-slate-500 italic" data-testid="cierre-bom-loading">
          Cargando patrones consumidos…
        </p>
      </section>
    );
  }

  // Skip silencioso cuando no hay patrones BOM-aware: la sección informa sin
  // ofrecer acciones (legacy patrones siguen sin BOM y no se descuentan).
  if (!ctx.readOnly && ctx.rows.length === 0) {
    return (
      <section className="border-t border-slate-200 pt-6 mt-6" data-testid="cierre-bom-section">
        <h3 className="font-serif text-lg text-slate-900 mb-2">Patrones consumidos</h3>
        <p className="text-sm text-slate-500 italic" data-testid="cierre-bom-empty">
          No hay patrones con BOM en esta OT. Sin descuento de componentes.
        </p>
      </section>
    );
  }

  return (
    <section className="border-t border-slate-200 pt-6 mt-6" data-testid="cierre-bom-section">
      <h3 className="font-serif text-lg text-slate-900 mb-3">Patrones consumidos</h3>

      {ctx.readOnly && ctx.readOnlyInfo && (
        <div
          className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
          data-testid="cierre-bom-readonly-banner"
        >
          <strong>Ya descontado</strong>{' '}
          {ctx.readOnlyInfo.fecha !== '-' && (
            <>el {ctx.readOnlyInfo.fecha} </>
          )}
          por {ctx.readOnlyInfo.creadoPor}
          {ctx.readOnlyInfo.count > 0 && <> ({ctx.readOnlyInfo.count} movimientos)</>}
        </div>
      )}

      {ctx.error && !ctx.readOnly && (
        <div className="mb-3 rounded border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <strong>Error:</strong> {ctx.error}
        </div>
      )}

      {!ctx.readOnly && ctx.rows.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-mono uppercase tracking-wide text-slate-600 border-b border-slate-200">
                  <th className="py-2 pr-3">Patrón</th>
                  <th className="py-2 pr-3">Lote</th>
                  <th className="py-2 pr-3">Componente</th>
                  <th className="py-2 pr-3">Sugerido</th>
                  <th className="py-2 pr-3">Real</th>
                  <th className="py-2 pr-3">Motivo (si difiere)</th>
                  <th className="py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {ctx.rows.map((r, idx) => (
                  <tr
                    key={`${r.patronId}-${r.lote}-${r.codigoComponente}-${idx}`}
                    className="border-b border-slate-100 align-top"
                    data-testid="cierre-bom-row"
                    data-codigo={r.codigoComponente}
                  >
                    <td className="py-2 pr-3 text-sm">
                      {r.patronCodigo}
                      <br />
                      <span className="text-[10px] text-slate-500">{r.patronDescripcion}</span>
                    </td>
                    <td className="py-2 pr-3 text-sm">
                      <Input
                        value={r.lote}
                        onChange={e => ctx.updateRow(idx, { lote: e.target.value })}
                        disabled={ctx.submitting}
                        inputSize="sm"
                        className="w-32"
                        data-testid="cierre-bom-lote-input"
                      />
                    </td>
                    <td className="py-2 pr-3 text-sm">
                      {r.codigoComponente}
                      <br />
                      <span className="text-[10px] text-slate-500">{r.descripcionComponente}</span>
                    </td>
                    <td className="py-2 pr-3 text-sm text-slate-500" data-testid="cierre-bom-sugerido">
                      {r.cantidadSugerida}
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        type="number"
                        value={String(r.cantidad)}
                        onChange={e => ctx.updateRow(idx, { cantidad: Number(e.target.value) || 0 })}
                        disabled={ctx.submitting}
                        inputSize="sm"
                        className="w-20"
                        data-testid="cierre-bom-real-input"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      {r.cantidad !== r.cantidadSugerida && (
                        <Input
                          value={r.motivo ?? ''}
                          onChange={e => ctx.updateRow(idx, { motivo: e.target.value })}
                          placeholder="¿por qué difiere?"
                          disabled={ctx.submitting}
                          inputSize="sm"
                          data-testid="cierre-bom-motivo-input"
                        />
                      )}
                    </td>
                    <td className="py-2 text-center">
                      <button
                        type="button"
                        onClick={() => ctx.removeRow(idx)}
                        disabled={ctx.submitting}
                        className="text-rose-600 hover:text-rose-800 disabled:opacity-30 text-lg leading-none"
                        aria-label="Quitar fila"
                        data-testid="cierre-bom-remove-btn"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-[11px] text-slate-500 italic">
              El reporte técnico queda intocable; divergencias se anotan en el motivo del movimiento.
            </p>
            <Button
              variant="primary"
              size="sm"
              disabled={ctx.submitting || ctx.rows.length === 0}
              onClick={async () => {
                try {
                  const result = await ctx.submit();
                  onConfirmed?.(result);
                } catch {
                  /* error ya está en ctx.error */
                }
              }}
              data-testid="cierre-bom-confirm-btn"
            >
              {ctx.submitting ? 'Descontando…' : 'Confirmar descuento de patrones'}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
