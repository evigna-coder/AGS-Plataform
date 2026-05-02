import type { WorkOrder } from '@ags/shared';
import { useSistemaContext } from '../../hooks/useSistemaContext';

interface Props {
  ot: WorkOrder & { problemaFallaInicial?: string };
}

const SectionLabel = ({ children, count }: { children: string; count?: number }) => (
  <div className="flex items-center justify-between mb-1.5">
    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">{children}</span>
    {count !== undefined && (
      <span className="text-[10px] font-mono font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">{count}</span>
    )}
  </div>
);

const cardCls = 'bg-white rounded-xl border border-slate-200 p-4';

export default function OTDetalleTab({ ot }: Props) {
  const { sistema, modulos } = useSistemaContext(ot.sistemaId);

  const fmtDate = (d?: string) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' }); }
    catch { return d; }
  };

  const softwares = sistema?.softwares?.length
    ? sistema.softwares
    : sistema?.software
      ? [{ nombre: sistema.software, revision: sistema.softwareRevision }]
      : [];

  const presupuestos = ot.budgets?.filter(Boolean) ?? [];

  return (
    <div className="space-y-4">
      {/* Cliente */}
      <section>
        <SectionLabel>Cliente</SectionLabel>
        <div className={cardCls + ' space-y-2.5'}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-base font-semibold text-slate-900">{ot.razonSocial || '—'}</p>
            {ot.sector && (
              <span className="shrink-0 text-[10px] font-mono font-semibold bg-teal-50 text-teal-700 px-2 py-0.5 rounded-md">
                {ot.sector}
              </span>
            )}
          </div>
          {ot.contacto && (
            <div className="pt-2 border-t border-slate-100 flex items-start gap-2.5">
              <svg className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <p className="text-xs text-slate-700 leading-snug">{ot.contacto}</p>
            </div>
          )}
          {(ot.direccion || ot.localidad) && (
            <div className="flex items-start gap-2.5">
              <svg className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-xs text-slate-600">
                {[ot.direccion, ot.localidad, ot.provincia].filter(Boolean).join(', ')}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Servicio */}
      <section>
        <SectionLabel>Servicio</SectionLabel>
        <div className={cardCls + ' space-y-2.5'}>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-slate-900">{ot.tipoServicio || 'Servicio'}</p>
            {ot.esFacturable && <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">Facturable</span>}
            {ot.tieneContrato && <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">Contrato</span>}
            {ot.esGarantia && <span className="text-[10px] bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded-full font-medium">Garantía</span>}
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
            <div>
              <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-slate-400 mb-0.5">Fecha</p>
              <p className="text-xs font-medium text-slate-800 capitalize">{fmtDate(ot.fechaInicio)}</p>
            </div>
            <div>
              <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-slate-400 mb-0.5">Ingeniero</p>
              <p className="text-xs font-medium text-slate-800">{ot.ingenieroAsignadoNombre || '—'}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Problema reportado */}
      {ot.problemaFallaInicial && (
        <section>
          <SectionLabel>Problema reportado</SectionLabel>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex gap-2.5">
            <svg className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-xs text-amber-900 leading-relaxed whitespace-pre-wrap">{ot.problemaFallaInicial}</p>
          </div>
        </section>
      )}

      {/* Sistema */}
      <section>
        <SectionLabel>Sistema</SectionLabel>
        <div className={cardCls + ' space-y-3'}>
          <div>
            <p className="text-lg font-serif font-semibold text-slate-900 leading-tight">{sistema?.nombre || ot.sistema || '—'}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {sistema?.agsVisibleId && (
                <span className="text-[10px] font-mono font-semibold bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded">
                  {sistema.agsVisibleId}
                </span>
              )}
              {(sistema?.codigoInternoCliente || ot.codigoInternoCliente) && (
                <span className="text-[10px] font-mono text-slate-500">
                  Cód. cliente: {sistema?.codigoInternoCliente || ot.codigoInternoCliente}
                </span>
              )}
            </div>
          </div>

          {softwares.length > 0 && (
            <div className="pt-2.5 border-t border-slate-100">
              <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Software instalado</p>
              <ul className="space-y-1">
                {softwares.map((s, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-slate-700">
                    <svg className="w-3 h-3 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>{s.nombre}{s.revision ? ` · Rev. ${s.revision}` : ''}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {sistema?.observaciones && (
            <div className="bg-slate-50 rounded-lg p-2.5">
              <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-teal-700 mb-1">Observaciones</p>
              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{sistema.observaciones}</p>
            </div>
          )}
        </div>
      </section>

      {/* Módulos */}
      {modulos.length > 0 && (
        <section>
          <SectionLabel count={modulos.length}>Módulos</SectionLabel>
          <div className="space-y-2">
            {modulos.map(m => (
              <div key={m.id} className="bg-white rounded-xl border border-slate-200 p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {[m.marca, m.descripcion].filter(Boolean).join(' ') || m.nombre}
                    </p>
                    {m.serie && <p className="text-[10px] font-mono text-slate-500">S/N: {m.serie}</p>}
                  </div>
                  {m.nombre && (
                    <span className="shrink-0 text-[9px] font-mono font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                      {m.nombre}
                    </span>
                  )}
                </div>
                {m.firmware && (
                  <p className="text-[10px] font-mono text-slate-500">Firmware: {m.firmware}</p>
                )}
                {m.observaciones && (
                  <p className="text-[11px] text-slate-600 italic leading-snug">{m.observaciones}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Documentación vinculada */}
      {(presupuestos.length > 0 || ot.ordenCompra) && (
        <section>
          <SectionLabel>Documentación vinculada</SectionLabel>
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {presupuestos.map(p => (
              <div key={p} className="flex items-center gap-3 px-3 py-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-teal-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800">Presupuesto {p}</p>
                </div>
              </div>
            ))}
            {ot.ordenCompra && (
              <div className="flex items-center gap-3 px-3 py-2.5">
                <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-orange-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l-1 12H6L5 9z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800">Orden de compra</p>
                  <p className="text-[11px] font-mono text-slate-500">{ot.ordenCompra}</p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
