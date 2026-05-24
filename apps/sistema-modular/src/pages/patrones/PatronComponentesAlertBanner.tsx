/**
 * Phase 14 BOM-06 — Alert banner para PatronEditorPage.
 *
 * Lista los pares `(lote, componente)` cuyo saldo BOM cayó al stockMinimo o por
 * debajo. Self-hides si no hay ningún problema (return null) — el caller puede
 * renderizar incondicionalmente.
 */

import type { Patron } from '@ags/shared';
import {
  computeSaldoComponente,
  computeLoteStatus,
} from '@ags/shared/utils/patronBom';

interface PatronComponentesAlertBannerProps {
  patron: Patron;
}

interface ProblematicEntry {
  loteCodigo: string;
  loteStatus: 'bloqueado' | 'agotado';
  codigoComponente: string;
  saldo: number;
  minimo: number;
}

export function PatronComponentesAlertBanner({ patron }: PatronComponentesAlertBannerProps) {
  const componentes = patron.componentes ?? [];
  if (componentes.length === 0) return null;

  const entries: ProblematicEntry[] = [];
  for (const lote of patron.lotes ?? []) {
    const status = computeLoteStatus(patron, lote);
    if (status === 'active') continue;
    for (const comp of componentes) {
      const saldo = computeSaldoComponente(patron, lote, comp.codigoComponente);
      const minimo = comp.stockMinimo ?? 0;
      if (saldo <= minimo) {
        entries.push({
          loteCodigo: lote.lote,
          loteStatus: status,
          codigoComponente: comp.codigoComponente,
          saldo,
          minimo,
        });
      }
    }
  }

  if (entries.length === 0) return null;

  return (
    <div
      className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3"
      role="alert"
      data-testid="patron-componentes-alert-banner"
    >
      <h3 className="text-[11px] font-mono uppercase tracking-wide text-rose-700 mb-2">
        Componentes bajo el mínimo ({entries.length})
      </h3>
      <ul className="space-y-1 text-sm text-rose-900">
        {entries.map((e, i) => (
          <li key={`${e.loteCodigo}-${e.codigoComponente}-${i}`}>
            <span className="font-mono text-xs text-rose-700">[{e.loteStatus.toUpperCase()}]</span>{' '}
            Lote <span className="font-mono">{e.loteCodigo || '(sin código)'}</span> · componente{' '}
            <span className="font-mono">{e.codigoComponente}</span>: saldo{' '}
            <span className="font-semibold">{e.saldo}</span> (mínimo {e.minimo})
          </li>
        ))}
      </ul>
    </div>
  );
}
