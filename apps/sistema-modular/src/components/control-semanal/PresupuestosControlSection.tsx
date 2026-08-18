import { useState } from 'react';
import type { Presupuesto } from '@ags/shared';
import type { PresupuestoControlRow } from '../../hooks/useControlSemanal';
import { EmptyState } from '../ui/EmptyState';
import { PresupuestosControlTabla } from './PresupuestosControlTabla';

interface Props {
  rows: PresupuestoControlRow[];
  kpis: {
    conTrabajo: number; listosSinAviso: number; esperandoOTs: number; sinOC: number;
    anticipadas: number; sinOtAgendada: number; sinAceptar: number; arrastre: number;
  };
  mostrarEnviados: boolean;
  onToggleEnviados: (v: boolean) => void;
  onOpenPresupuesto: (id: string) => void;
  onGenerarAviso: (p: Presupuesto) => void;
  /** id del ppto cuyo aviso se está generando (deshabilita el botón). */
  generandoId: string | null;
  /** Comentario de SOPORTE sobre el estado del ppto en el control (2026-08-05). */
  onSaveComentario: (presupuestoId: string, comentario: string) => Promise<void>;
}

const Kpi = ({ label, value, tone }: { label: string; value: number; tone: string }) => (
  <div className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 flex items-center justify-between gap-2">
    <p className="text-[9px] font-mono text-slate-400 uppercase tracking-wide">{label}</p>
    <p className={`text-base font-black leading-none ${tone}`}>{value}</p>
  </div>
);

/**
 * Sección 2 del control semanal, en DOS bloques (2026-08-15).
 *
 * Arriba, el trabajo de la semana: sin OT agendada, agendados en la semana
 * visible, entregas pendientes y pagos anticipados. Abajo, plegado, el arrastre
 * — presupuestos con el trabajo ya hecho y sin facturar, que reaparecen todas
 * las semanas hasta que se resuelvan.
 *
 * Estaban mezclados y el arrastre es el grueso: la sección mostraba "muchos" y
 * no se distinguía qué había pasado ESTA semana, que es para lo que se mira.
 */
export const PresupuestosControlSection: React.FC<Props> = ({
  rows, kpis, mostrarEnviados, onToggleEnviados, onOpenPresupuesto, onGenerarAviso, generandoId,
  onSaveComentario,
}) => {
  const [verArrastre, setVerArrastre] = useState(false);
  const enviados = rows.filter(r => r.avisoEnviado);
  const visibles = mostrarEnviados ? rows : rows.filter(r => !r.avisoEnviado);
  const semana = visibles.filter(r => !r.arrastre);
  const arrastre = visibles.filter(r => r.arrastre);

  const tabla = (rs: PresupuestoControlRow[]) => (
    <PresupuestosControlTabla rows={rs} onOpenPresupuesto={onOpenPresupuesto}
      onGenerarAviso={onGenerarAviso} generandoId={generandoId} onSaveComentario={onSaveComentario} />
  );

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[10px] font-mono uppercase tracking-wide text-slate-500">
          2 · Presupuestos de la semana: sin OT agendada, agendados esta semana, entrega pendiente o pago anticipado
        </p>
        <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
          <input type="checkbox" checked={mostrarEnviados} onChange={e => onToggleEnviados(e.target.checked)}
            className="rounded border-slate-300" />
          Mostrar enviados ({enviados.length})
        </label>
      </div>

      <div className="grid grid-cols-7 gap-2">
        <Kpi label="De la semana" value={kpis.conTrabajo} tone="text-slate-700" />
        <Kpi label="Listos sin aviso" value={kpis.listosSinAviso} tone="text-teal-700" />
        <Kpi label="Esperando otras OTs" value={kpis.esperandoOTs} tone="text-red-600" />
        <Kpi label="Sin OT agendada" value={kpis.sinOtAgendada} tone="text-orange-600" />
        <Kpi label="Sin OC del cliente" value={kpis.sinOC} tone="text-amber-600" />
        <Kpi label="Pago anticipado" value={kpis.anticipadas} tone="text-purple-700" />
        <Kpi label="Arrastre" value={kpis.arrastre} tone="text-slate-400" />
      </div>

      {semana.length === 0
        ? <EmptyState message="Esta semana no hay presupuestos que trabajar" />
        : tabla(semana)}

      {arrastre.length > 0 && (
        <div className="pt-1">
          <button onClick={() => setVerArrastre(v => !v)}
            className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wide text-slate-400 hover:text-slate-600">
            <span>{verArrastre ? '▾' : '▸'}</span>
            Arrastre · trabajo hecho sin facturar ({arrastre.length})
            <span className="normal-case font-sans text-slate-300">
              — no son de esta semana; siguen apareciendo hasta que se facturen
            </span>
          </button>
          {verArrastre && <div className="mt-2">{tabla(arrastre)}</div>}
        </div>
      )}
    </section>
  );
};
