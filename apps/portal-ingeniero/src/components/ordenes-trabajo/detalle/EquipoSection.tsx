import type { Pendiente, Sistema, ModuloSistema, WorkOrder } from '@ags/shared';
import { GCard, FRow } from './atoms';

/** Tarjeta EQUIPO: sistema, ID AGS, serie, software, código cliente + observaciones. */
export function EquipoCard({ ot, sistema }: { ot: WorkOrder; sistema: Sistema | null }) {
  const softwares = sistema?.softwares?.length
    ? sistema.softwares
    : sistema?.software
      ? [{ nombre: sistema.software, revision: sistema.softwareRevision }]
      : [];

  return (
    <GCard label="Equipo">
      <p className="font-serif text-lg font-medium leading-tight text-slate-900 mb-1">
        {sistema?.nombre || ot.sistema || '—'}
      </p>
      {sistema?.agsVisibleId && <FRow k="ID AGS" mono>{sistema.agsVisibleId}</FRow>}
      {(ot.moduloSerie || ot.moduloModelo) && (
        <FRow k="Módulo" mono>{[ot.moduloModelo, ot.moduloSerie && `S/N ${ot.moduloSerie}`].filter(Boolean).join(' · ')}</FRow>
      )}
      {softwares.length > 0 && (
        <FRow k="Software">
          {softwares.map((s, i) => (
            <span key={i} className="block">{s.nombre}{s.revision ? ` · Rev. ${s.revision}` : ''}</span>
          ))}
        </FRow>
      )}
      {(sistema?.codigoInternoCliente || ot.codigoInternoCliente) && (
        <FRow k="Cód. cliente" mono>{sistema?.codigoInternoCliente || ot.codigoInternoCliente}</FRow>
      )}
      {sistema?.sector && <FRow k="Sector">{sistema.sector}</FRow>}
      {sistema?.observaciones && (
        <p className="mt-2 pt-2 border-t border-dashed border-slate-200 text-xs italic text-slate-500 whitespace-pre-wrap">
          {sistema.observaciones}
        </p>
      )}
    </GCard>
  );
}

/** Tarjeta ámbar de tareas pendientes del equipo (colección `pendientes`). */
export function TareasPendientesCard({ pendientes }: { pendientes: Pendiente[] }) {
  if (pendientes.length === 0) return null;
  return (
    <GCard label="Tareas pendientes del equipo" amber>
      <div className="space-y-2">
        {pendientes.map(p => (
          <div key={p.id} className="text-[13.5px] font-semibold text-amber-700">
            ⚠ {p.descripcion}
            {p.origenTicketRazonSocial && (
              <span className="block font-normal opacity-85 mt-0.5 text-xs">Origen: ticket de {p.origenTicketRazonSocial}</span>
            )}
          </div>
        ))}
      </div>
    </GCard>
  );
}

/** Configuración del sistema: todos los módulos con serie + observaciones. */
export function ConfiguracionCard({ modulos }: { modulos: ModuloSistema[] }) {
  if (modulos.length === 0) return null;
  return (
    <GCard label="Configuración del sistema">
      {modulos.map(m => (
        <div key={m.id} className="py-2 border-b border-slate-200 last:border-b-0 text-[13px]">
          <div className="flex items-baseline gap-2.5 flex-wrap">
            {m.nombre && <span className="font-mono text-xs font-semibold text-teal-900 shrink-0">{m.nombre}</span>}
            <span className="font-semibold text-slate-900 flex-1 min-w-0">
              {[m.marca, m.descripcion].filter(Boolean).join(' ') || '—'}
            </span>
            {m.serie && <span className="font-mono text-[11px] text-slate-500">S/N {m.serie}</span>}
          </div>
          {m.firmware && <p className="font-mono text-[11px] text-slate-500 mt-0.5">Firmware {m.firmware}</p>}
          {m.observaciones && <p className="text-xs text-slate-500 mt-0.5">{m.observaciones}</p>}
        </div>
      ))}
    </GCard>
  );
}
