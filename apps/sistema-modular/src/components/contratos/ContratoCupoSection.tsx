import { useEffect, useState } from 'react';
import type { Contrato } from '@ags/shared';
import { anioDeContrato } from '@ags/shared';
import { contratosService } from '../../services/contratosService';
import { Card } from '../ui/Card';
import type { CupoServicioEquipo } from '../../utils/contratoCupo';

interface Props {
  contrato: Contrato;
  /** id de equipo → nombre legible, para no mostrar ids crudos. */
  nombreSistema: Map<string, string>;
}

/**
 * Consumo del año de contrato vigente, por equipo y por servicio (2026-08-17).
 *
 * Responde la pregunta que el contador global `visitasUsadas` no podía: no
 * "cuántas visitas van" sino "a qué equipo le queda su preventivo". Los ceros
 * se muestran a propósito — lo que falta hacer es tan informativo como lo hecho.
 *
 * Sale de las OTs, no de un contador guardado: cancelar una OT devuelve el cupo
 * sin que nadie tenga que acordarse de restar.
 */
export function ContratoCupoSection({ contrato, nombreSistema }: Props) {
  const [filas, setFilas] = useState<CupoServicioEquipo[] | null>(null);

  useEffect(() => {
    let cancelado = false;
    contratosService.consumoDelAnioVigente(contrato.id)
      .then(f => { if (!cancelado) setFilas(f); })
      .catch(err => { console.error('[ContratoCupoSection]', err); if (!cancelado) setFilas([]); });
    return () => { cancelado = true; };
  }, [contrato.id]);

  const conCupo = (filas ?? []).filter(f => f.cupo != null);
  if (filas !== null && conCupo.length === 0) return null;

  const hoy = new Date().toISOString().slice(0, 10);
  const anio = anioDeContrato(contrato.fechaInicio, hoy);
  const nombre = (id: string) => nombreSistema.get(id) ?? id;

  // Una fila por equipo, con sus servicios al lado — se lee por equipo, que es
  // como se pregunta.
  const porEquipo = new Map<string, CupoServicioEquipo[]>();
  for (const f of conCupo) {
    const arr = porEquipo.get(f.sistemaId) ?? [];
    arr.push(f);
    porEquipo.set(f.sistemaId, arr);
  }

  return (
    <Card>
      <div className="flex items-baseline justify-between mb-3 gap-3">
        <p className="text-[9px] font-mono font-semibold text-teal-700/70 uppercase tracking-widest">
          Cupo del año {anio + 1} de contrato
        </p>
        <p className="text-[10px] text-slate-400">
          Renueva cada {contrato.fechaInicio.slice(8, 10)}/{contrato.fechaInicio.slice(5, 7)}
        </p>
      </div>

      {filas === null ? (
        <p className="text-xs text-slate-400">Calculando…</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {[...porEquipo.entries()].map(([sistemaId, servicios]) => (
            <div key={sistemaId} className="py-2 flex items-start gap-3">
              <p className="text-xs font-medium text-slate-700 w-56 shrink-0 truncate" title={nombre(sistemaId)}>
                {nombre(sistemaId)}
              </p>
              <div className="flex flex-wrap gap-1.5 flex-1">
                {servicios.map(s => {
                  const agotado = (s.restantes ?? 1) === 0;
                  return (
                    <span key={s.tipoServicioNombre}
                      title={s.otNumbers.length ? `Consumido por ${s.otNumbers.join(', ')}` : 'Sin usar este año'}
                      className={`text-[10px] px-2 py-0.5 rounded-full border ${agotado
                        ? 'bg-slate-100 text-slate-500 border-slate-200 line-through'
                        : 'bg-teal-50 text-teal-800 border-teal-200'}`}>
                      {s.tipoServicioNombre} {s.usadas}/{s.cupo}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
