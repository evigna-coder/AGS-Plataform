import { Link, useLocation } from 'react-router-dom';
import type { FichaPropiedad } from '@ags/shared';
import { ESTADO_FICHA_LABELS, ESTADO_FICHA_COLORS, VIA_INGRESO_LABELS } from '@ags/shared';
import { FichaFotosSection } from './FichaFotosSection';

interface Props {
  ficha: FichaPropiedad;
  onUpdate: () => void;
}

function Row({ label, value, link, navState }: {
  label: string;
  value?: string | null;
  link?: string;
  navState?: any;
}) {
  if (!value) return null;
  return (
    <div className="flex items-baseline gap-2 text-xs">
      <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-mono shrink-0 w-20">{label}</dt>
      <dd className="text-slate-700 truncate">
        {link ? <Link to={link} state={navState} className="text-teal-600 hover:underline">{value}</Link> : value}
      </dd>
    </div>
  );
}

/**
 * Sidebar compacta — toda la info de cabecera de la ficha en una sola tarjeta,
 * más las fotos a nivel ficha en una segunda tarjeta colapsable.
 */
export function FichaInfoSidebar({ ficha, onUpdate }: Props) {
  const { pathname } = useLocation();
  const fromState = { from: pathname };
  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('es-AR'); } catch { return '-'; }
  };

  // Conteo por estado para resumen rápido
  const itemsByEstado = ficha.items.reduce<Record<string, number>>((acc, it) => {
    acc[it.estado] = (acc[it.estado] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      {/* Tarjeta única: todo lo de cabecera */}
      <div className="rounded-xl bg-white border border-slate-200 p-3 space-y-3">
        {/* Título + estado */}
        <div className="text-center pb-2 border-b border-slate-100">
          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${ESTADO_FICHA_COLORS[ficha.estado]}`}>
            {ESTADO_FICHA_LABELS[ficha.estado]}
          </span>
          <p className="text-xs text-slate-400 mt-1.5 font-mono">{ficha.numero}</p>
          <p className="text-[10px] text-slate-400 font-mono">
            {ficha.items.length} item{ficha.items.length === 1 ? '' : 's'}
          </p>
        </div>

        {/* Cliente */}
        <dl className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-mono font-semibold">Cliente</p>
          <Row label="Razón social" value={ficha.clienteNombre} link={`/clientes/${ficha.clienteId}`} navState={fromState} />
          <Row label="Establec." value={ficha.establecimientoNombre} link={ficha.establecimientoId ? `/establecimientos/${ficha.establecimientoId}` : undefined} navState={fromState} />
        </dl>

        <hr className="border-slate-100" />

        {/* Ingreso */}
        <dl className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-mono font-semibold">Ingreso</p>
          <Row label="Fecha" value={formatDate(ficha.fechaIngreso)} />
          <Row label="Vía" value={VIA_INGRESO_LABELS[ficha.viaIngreso]} />
          <Row label="Traído por" value={ficha.traidoPor} />
          <Row label="OT ref." value={ficha.otReferencia} link={ficha.otReferencia ? `/ordenes-trabajo/${ficha.otReferencia}` : undefined} navState={fromState} />
        </dl>

        {/* Resumen items por estado */}
        {Object.keys(itemsByEstado).length > 0 && (
          <>
            <hr className="border-slate-100" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-mono font-semibold mb-1.5">Resumen items</p>
              <ul className="space-y-1">
                {Object.entries(itemsByEstado).map(([estado, count]) => (
                  <li key={estado} className="text-xs flex justify-between items-center">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${ESTADO_FICHA_COLORS[estado as keyof typeof ESTADO_FICHA_COLORS]}`}>
                      {ESTADO_FICHA_LABELS[estado as keyof typeof ESTADO_FICHA_LABELS]}
                    </span>
                    <span className="text-slate-500 font-mono">{count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* OTs vinculadas */}
        {ficha.otIds.length > 0 && (
          <>
            <hr className="border-slate-100" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-mono font-semibold mb-1.5">OTs vinculadas</p>
              <div className="flex flex-wrap gap-1">
                {ficha.otIds.map(ot => (
                  <Link
                    key={ot}
                    to={`/ordenes-trabajo/${ot}`}
                    state={fromState}
                    className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded bg-teal-50 text-teal-700 hover:bg-teal-100 font-mono"
                  >
                    {ot}
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Fechas */}
        <hr className="border-slate-100" />
        <dl className="space-y-1.5">
          <Row label="Creada" value={formatDate(ficha.createdAt)} />
          <Row label="Actualizada" value={formatDate(ficha.updatedAt)} />
        </dl>
      </div>

      {/* Tarjeta de fotos — colapsable, embedded para sidebar */}
      <FichaFotosSection
        ficha={ficha}
        onUpdate={onUpdate}
        embedded
        collapsible
        readOnly={ficha.estado === 'entregado'}
      />
    </div>
  );
}
