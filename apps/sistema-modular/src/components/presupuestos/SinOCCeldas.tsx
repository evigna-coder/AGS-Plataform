import type { SinOCInfo } from '../../utils/presupuestosSinOC';
import { colorDiasSinOC } from '../../utils/presupuestosSinOC';

/**
 * Celdas del modo "Sin OC" del listado de presupuestos (2026-09-18): en ese
 * modo las columnas Validez y Seguimiento, que no aplican a un aprobado, pasan
 * a mostrar desde cuándo está aprobado y desde cuándo se hizo el trabajo.
 */

const fechaCorta = (iso: string | null) => {
  if (!iso) return '';
  const m = iso.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1].slice(2)}` : '';
};

const Dias = ({ dias }: { dias: number | null }) => (
  dias == null ? null : <span className={`font-mono font-semibold ${colorDiasSinOC(dias)}`}> · {dias} d</span>
);

/** Fecha de aprobación + días sin OC desde entonces. */
export function CeldaAprobadoSinOC({ info }: { info: SinOCInfo | undefined }) {
  if (!info) return <span className="text-[10px] text-slate-300">—</span>;
  if (!info.fechaAceptacion) {
    return <span className="text-[10px] text-slate-400" title="Aceptado antes de que el sistema guardara la fecha de aprobación">sin fecha</span>;
  }
  const titulo = info.fechaAceptacionAprox
    ? `Sin fecha de aprobación registrada: se toma la fecha de envío (${fechaCorta(info.fechaAceptacion)}) — ${info.diasSinOC} día(s) sin OC del cliente`
    : `Aprobado el ${fechaCorta(info.fechaAceptacion)} — ${info.diasSinOC} día(s) sin OC del cliente`;
  return (
    <span className="text-[10px] text-slate-600 whitespace-nowrap" title={titulo}>
      {info.fechaAceptacionAprox && <span className="text-slate-400">≈ </span>}{fechaCorta(info.fechaAceptacion)}<Dias dias={info.diasSinOC} />
    </span>
  );
}

/** Primer cierre técnico + días desde entonces; "sin OT cerrada" si el trabajo no se hizo. */
export function CeldaTrabajoHechoSinOC({ info }: { info: SinOCInfo | undefined }) {
  if (!info) return <span className="text-[10px] text-slate-300">—</span>;
  if (info.otsCerradas.length === 0) return <span className="text-[10px] text-slate-300">sin OT cerrada</span>;
  const ots = info.otsCerradas.join(', ');
  if (!info.fechaPrimerCierre) {
    return <span className="text-[10px] text-slate-500" title={`OT cerrada sin fecha de cierre: ${ots}`}>OT cerrada</span>;
  }
  return (
    <span className="text-[10px] text-slate-600 whitespace-nowrap" title={`Primer cierre técnico el ${fechaCorta(info.fechaPrimerCierre)} (${ots}) — ${info.diasDesdeCierre} día(s) con el trabajo hecho y sin OC`}>
      {fechaCorta(info.fechaPrimerCierre)}<Dias dias={info.diasDesdeCierre} />
    </span>
  );
}
