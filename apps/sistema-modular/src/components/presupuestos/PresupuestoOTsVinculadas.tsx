import React, { useState } from 'react';
import { useTabs } from '../../contexts/TabsContext';
import { cargarOTsDelPresupuesto } from '../../utils/otsDelPresupuestoFetch';
import { ordenesTrabajoService } from '../../services/firebaseService';
import { VincularOTSelect } from './VincularOTSelect';
import { notify } from '../../utils/notify';
import { otsDelPresupuesto } from '../../hooks/useControlSemanal';
import { OT_ESTADO_COLORS, OT_ESTADO_LABELS, type OTEstadoAdmin, type Presupuesto, type WorkOrder } from '@ags/shared';

interface Props {
  /** Lista de OT numbers vinculadas al presupuesto (array nuevo). */
  otsVinculadasNumbers?: string[] | null;
  /** Campo legacy singular — se muestra si no hay array. */
  otVinculadaNumber?: string | null;
  /** Número del presupuesto — habilita el join por `budgets` de la OT. */
  presupuestoNumero?: string | null;
  /** Cliente del presupuesto: habilita "Vincular OT" con sus OTs abiertas (2026-09-09). */
  clienteId?: string | null;
}

/** dd/mm — la fecha en que se trabajó; si no hay, la coordinada; si no, el alta. */
function fechaCorta(ot: WorkOrder): string {
  const raw = ot.fechaInicio || ot.fechaServicioAprox || ot.createdAt;
  if (!raw) return '';
  const d = new Date(raw);
  return Number.isNaN(d.getTime())
    ? ''
    : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * OTs de este presupuesto, con estado (2026-08-14).
 *
 * Antes era una tira de chips con el número pelado: para saber si el trabajo se
 * hizo había que abrir cada OT en otra pestaña. Ahora cada línea dice tipo de
 * servicio, estado administrativo y fecha — que es lo que se pregunta mirando un
 * presupuesto ("¿esto ya se ejecutó?", "¿por qué no se facturó?").
 *
 * Resuelve con `otsDelPresupuesto`, el mismo join que usan el control semanal y
 * los KPIs: campos del presupuesto ∪ OTs cuyo `budgets` lo mencione, descartando
 * los PADRES que tienen hijas y heredando el vínculo a ellas — el padre es solo
 * un agrupador visual, el trabajo vive siempre en las `.NN`.
 */
export const PresupuestoOTsVinculadas: React.FC<Props> = ({ otsVinculadasNumbers, otVinculadaNumber, presupuestoNumero, clienteId }) => {
  const [vinculando, setVinculando] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  /** Liga una OT abierta del cliente al presupuesto (las dos puntas, como desde la OT). */
  const vincular = async (otNumber: string) => {
    if (!otNumber || !presupuestoNumero) return;
    setVinculando(true);
    try {
      await ordenesTrabajoService.vincularPresupuesto(otNumber, presupuestoNumero);
      notify.success(`OT ${otNumber} vinculada al presupuesto ${presupuestoNumero}.`);
      setReloadKey(k => k + 1);
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'No se pudo vincular la OT');
    } finally { setVinculando(false); }
  };
  const { navigateInActiveTab } = useTabs();
  const [ots, setOts] = React.useState<WorkOrder[]>([]);
  const [cargando, setCargando] = React.useState(true);

  const vinculadasKey = (otsVinculadasNumbers ?? []).join(',');

  React.useEffect(() => {
    let cancelled = false;
    // Lectura ACOTADA (2026-08-14): antes traía la colección `reportes` entera
    // en cada apertura del presupuesto para pintar dos chips. Ahora: las OTs que
    // declaran el presupuesto + las que el presupuesto declara + las hijas de
    // los padres que aparezcan (el vínculo puede estar en el padre y el trabajo
    // en la hija).
    setCargando(true);
    (async () => {
      const { ots: encontradas } = await cargarOTsDelPresupuesto({
        numero: presupuestoNumero ?? '',
        otsVinculadasNumbers: otsVinculadasNumbers ?? null,
        otVinculadaNumber: otVinculadaNumber ?? null,
      });
      if (cancelled) return;
      setOts(encontradas);
      setCargando(false);
    })();
    return () => { cancelled = true; };
  }, [presupuestoNumero, otVinculadaNumber, vinculadasKey, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const numeros = React.useMemo(() => {
    const pres = {
      numero: presupuestoNumero ?? '',
      otsVinculadasNumbers: otsVinculadasNumbers ?? null,
      otVinculadaNumber: otVinculadaNumber ?? null,
    } as Presupuesto;
    return [...otsDelPresupuesto(pres, ots)]
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  }, [otsVinculadasNumbers, otVinculadaNumber, presupuestoNumero, ots]);

  const porNumero = React.useMemo(
    () => new Map(ots.map(o => [o.otNumber, o])), [ots]);

  return (
    <div className="px-3 py-2 border-t border-slate-100 bg-slate-50/40">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] uppercase tracking-wide text-slate-400 font-mono">
          Órdenes de trabajo{numeros.length > 0 && ` (${numeros.length})`}
        </span>
        {/* Vincular a mano (2026-09-09): un presupuesto creado sin pasar por
            la OT ni por el portal no quedaba ligado a nada. */}
        {presupuestoNumero && (
          <div className="w-72">
            <VincularOTSelect clienteId={clienteId} excluir={numeros} value="" disabled={vinculando}
              onChange={v => void vincular(v)} placeholder="Vincular una OT abierta…" />
          </div>
        )}
      </div>
      {numeros.length === 0 ? (
        // Estado vacío EXPLÍCITO (2026-08-14): antes el bloque desaparecía y no
        // se distinguía "no tiene OT" de "todavía no cargó".
        <p className="text-[11px] text-slate-400 mt-0.5">
          {cargando ? 'Buscando…' : 'Sin OTs vinculadas todavía'}
        </p>
      ) : (
        <div className="mt-1 divide-y divide-slate-200/70">
          {numeros.map(num => {
            const ot = porNumero.get(num);
            const estado = ot?.estadoAdmin as OTEstadoAdmin | undefined;
            const fecha = ot ? fechaCorta(ot) : '';
            return (
              <div key={num} className="flex items-center justify-between gap-2 py-1">
                <div className="min-w-0 flex items-baseline gap-2">
                  <button
                    onClick={() => navigateInActiveTab(`/ordenes-trabajo/${num}`)}
                    className="text-[11px] font-mono font-semibold text-teal-700 hover:underline shrink-0"
                    title={`Ir a OT ${num}`}
                  >
                    OT {num}
                  </button>
                  {ot?.tipoServicio && (
                    <span className="text-[10px] text-slate-500 truncate">{ot.tipoServicio}</span>
                  )}
                </div>
                <div className="shrink-0 flex items-center gap-1.5">
                  {fecha && <span className="text-[10px] font-mono text-slate-400">{fecha}</span>}
                  {estado && (
                    <span className={`inline-flex px-1.5 py-0.5 text-[9px] font-medium rounded-full ${OT_ESTADO_COLORS[estado] ?? 'bg-slate-100 text-slate-600'}`}>
                      {OT_ESTADO_LABELS[estado] ?? estado}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
