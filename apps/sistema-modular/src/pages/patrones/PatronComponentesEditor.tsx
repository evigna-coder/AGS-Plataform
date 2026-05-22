/**
 * Phase 14 BOM-04 — Editor declarativo de Componentes (BOM) por patrón.
 *
 * Sub-componente extraído de PatronEditorPage para respetar el budget de 250 LOC
 * (components.md). El parent es source-of-truth: este componente recibe
 * `componentes` y propaga el array completo via `onChange`.
 *
 * Guards:
 *  - UI rename guard: cuando un codigoComponente está en `lockedCodigos` (porque
 *    algún lote tiene componentesConsumidos referenciándolo), el input se renderiza
 *    disabled con icono de candado y se bloquea la eliminación de la fila.
 *  - Defense-in-depth: el service patronesService.update lleva el mismo guard
 *    (Task 3) para casos donde la UI fallara open.
 */

import { useCallback } from 'react';
import type { ComponentePatron } from '@ags/shared';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export interface PatronComponentesEditorProps {
  componentes: ComponentePatron[];
  onChange: (next: ComponentePatron[]) => void;
  /** Codigos que no se pueden renombrar (tienen consumos previos en lotes) */
  lockedCodigos?: Set<string>;
  disabled?: boolean;
}

const labelHeadCls =
  'py-2 pr-3 text-left text-[10px] font-mono uppercase tracking-wide text-slate-600';

export function PatronComponentesEditor({
  componentes,
  onChange,
  lockedCodigos,
  disabled,
}: PatronComponentesEditorProps) {
  const locked = lockedCodigos ?? new Set<string>();

  const updateRow = useCallback(
    (idx: number, patch: Partial<ComponentePatron>) => {
      const next = componentes.map((c, i) => (i === idx ? { ...c, ...patch } : c));
      onChange(next);
    },
    [componentes, onChange],
  );

  const addRow = useCallback(() => {
    onChange([
      ...componentes,
      {
        codigoComponente: '',
        descripcion: '',
        cantidadPorKit: 1,
        unidadMedida: 'ampolla',
        stockMinimo: 0,
      },
    ]);
  }, [componentes, onChange]);

  const removeRow = useCallback(
    (idx: number) => {
      const target = componentes[idx];
      if (target && locked.has(target.codigoComponente)) {
        alert(
          `No se puede eliminar el componente "${target.codigoComponente}" porque tiene consumos registrados en lotes.`,
        );
        return;
      }
      onChange(componentes.filter((_, i) => i !== idx));
    },
    [componentes, onChange, locked],
  );

  return (
    <section className="border-t border-slate-200 pt-6 mt-6">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-serif text-xl text-slate-900">Componentes (BOM)</h2>
        <span className="text-[10px] font-mono uppercase tracking-wide text-slate-500">
          {componentes.length} componente{componentes.length === 1 ? '' : 's'}
        </span>
      </div>

      {componentes.length === 0 ? (
        <div className="rounded border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
          Sin componentes declarados. Este patrón funciona como kit entero (sin
          desagregación). Agregá componentes para activar el BOM (caso típico:
          ampollas dentro de un kit).
          <div className="mt-3">
            <Button variant="secondary" onClick={addRow} disabled={disabled}>
              + Agregar componente
            </Button>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className={labelHeadCls}>Código</th>
                <th className={labelHeadCls}>Descripción</th>
                <th className={labelHeadCls}>Cantidad por kit</th>
                <th className={labelHeadCls}>Unidad</th>
                <th className={labelHeadCls}>Stock mínimo</th>
                <th className="py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {componentes.map((c, idx) => {
                const isLocked = !!c.codigoComponente && locked.has(c.codigoComponente);
                return (
                  <tr key={idx} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-3">
                      <Input
                        value={c.codigoComponente}
                        onChange={(e) =>
                          updateRow(idx, { codigoComponente: e.target.value })
                        }
                        placeholder="amp-A"
                        disabled={disabled || isLocked}
                        title={
                          isLocked
                            ? 'Este componente ya tiene consumos registrados; no se puede renombrar.'
                            : undefined
                        }
                      />
                      {isLocked && (
                        <p className="mt-1 text-[10px] font-mono uppercase tracking-wide text-slate-500">
                          🔒 Con consumos
                        </p>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        value={c.descripcion}
                        onChange={(e) => updateRow(idx, { descripcion: e.target.value })}
                        placeholder="Ampolla cafeína"
                        disabled={disabled}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        type="number"
                        min="1"
                        value={String(c.cantidadPorKit)}
                        onChange={(e) =>
                          updateRow(idx, {
                            cantidadPorKit: Number(e.target.value) || 1,
                          })
                        }
                        disabled={disabled}
                        className="w-24"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        value={c.unidadMedida}
                        onChange={(e) => updateRow(idx, { unidadMedida: e.target.value })}
                        placeholder="ampolla"
                        disabled={disabled}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        type="number"
                        min="0"
                        value={String(c.stockMinimo ?? 0)}
                        onChange={(e) =>
                          updateRow(idx, { stockMinimo: Number(e.target.value) || 0 })
                        }
                        disabled={disabled}
                        className="w-24"
                      />
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        disabled={disabled}
                        className="text-rose-600 hover:text-rose-800 disabled:opacity-30 text-lg leading-none"
                        aria-label="Eliminar componente"
                        title="Eliminar componente"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-3">
            <Button variant="secondary" onClick={addRow} disabled={disabled}>
              + Agregar componente
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
