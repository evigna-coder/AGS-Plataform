import type { ParteLoanerPrestada, PrestamoLoaner } from '@ags/shared';
import { ESTADO_PARTE_LOANER_LABELS, estadoParte, idDeParte, partesDelPrestamo } from '@ags/shared';

interface Props {
  prestamo: PrestamoLoaner;
  onVueltaBase?: (prestamo: PrestamoLoaner, parteId: string, parte: ParteLoanerPrestada) => void;
  onReinstalar?: (prestamo: PrestamoLoaner, parteId: string, parte: ParteLoanerPrestada) => void;
}

const CHIP = {
  afuera: 'bg-blue-100 text-blue-800',
  en_base: 'bg-amber-100 text-amber-800',
  instalada: 'bg-green-100 text-green-800',
} as const;

const fmt = (iso?: string | null) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('es-AR'); } catch { return ''; }
};

/**
 * Las partes de un préstamo en el historial (2026-09-08): una línea por
 * parte con su N°, serie, dónde está hoy y la acción que le toca. La vuelta
 * a la base y la reinstalación son dos hechos distintos, a propósito: entre
 * uno y otro pueden pasar semanas con la parte en el estante.
 */
export function LoanerPrestamoPartesCell({ prestamo, onVueltaBase, onReinstalar }: Props) {
  const partes = partesDelPrestamo(prestamo);
  const activo = prestamo.estado === 'activo';
  return (
    <div className="space-y-1.5">
      {partes.map((parte, i) => {
        const id = idDeParte(parte, i);
        const st = estadoParte(parte);
        return (
          <div key={id} className="text-xs text-slate-600">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-violet-100 text-violet-800">Parte</span>
              <span>{parte.descripcion}</span>
              {parte.serie && <span className="text-slate-400">· S/N {parte.serie}</span>}
              <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded-full ${CHIP[st]}`}
                title={st === 'en_base' ? `Volvió el ${fmt(parte.fechaVueltaBase)}${parte.condicionVuelta ? ` · ${parte.condicionVuelta}` : ''}`
                  : st === 'instalada' ? `Reinstalada el ${fmt(parte.fechaReinstalacion)}${parte.otReinstalacionNumber ? ` · OT ${parte.otReinstalacionNumber}` : ''}` : undefined}>
                {ESTADO_PARTE_LOANER_LABELS[st]}
              </span>
            </div>
            {/* N° de parte (2026-09-07): sin esto "Motor" no decía cuál. */}
            {parte.codigoArticulo && <span className="block font-mono text-[10px] text-teal-700">{parte.codigoArticulo}</span>}
            {activo && st !== 'instalada' && (onVueltaBase || onReinstalar) && (
              <div className="flex gap-2 mt-0.5">
                {st === 'afuera' && onVueltaBase && (
                  <button type="button" onClick={() => onVueltaBase(prestamo, id, parte)}
                    className="text-[10px] font-medium text-teal-700 hover:text-teal-900 underline underline-offset-2">
                    Volvió a la base
                  </button>
                )}
                {onReinstalar && (
                  <button type="button" onClick={() => onReinstalar(prestamo, id, parte)}
                    className="text-[10px] font-medium text-teal-700 hover:text-teal-900 underline underline-offset-2">
                    Reinstalada
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
