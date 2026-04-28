import { Link, useLocation } from 'react-router-dom';
import { Card } from '../ui/Card';
import type { FichaPropiedad } from '@ags/shared';
import { ESTADO_FICHA_LABELS, ESTADO_FICHA_COLORS, VIA_INGRESO_LABELS } from '@ags/shared';

interface Props {
  ficha: FichaPropiedad;
}

function LV({ label, value, link, navState }: { label: string; value?: string | null; link?: string; navState?: any }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-[11px] font-medium text-slate-400 tracking-wider">{label}</dt>
      <dd className="text-sm text-slate-700 mt-0.5">
        {link ? <Link to={link} state={navState} className="text-teal-600 hover:underline">{value}</Link> : value}
      </dd>
    </div>
  );
}

export function FichaInfoSidebar({ ficha }: Props) {
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
    <div className="space-y-4">
      {/* Estado */}
      <Card compact>
        <div className="text-center">
          <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${ESTADO_FICHA_COLORS[ficha.estado]}`}>
            {ESTADO_FICHA_LABELS[ficha.estado]}
          </span>
          <p className="text-xs text-slate-400 mt-2">{ficha.numero}</p>
          <p className="text-[11px] text-slate-400 mt-1">
            {ficha.items.length} item{ficha.items.length === 1 ? '' : 's'}
          </p>
        </div>
      </Card>

      {/* Cliente */}
      <Card title="Cliente" compact>
        <dl className="space-y-2">
          <LV label="Razon social" value={ficha.clienteNombre} link={`/clientes/${ficha.clienteId}`} navState={fromState} />
          <LV label="Establecimiento" value={ficha.establecimientoNombre} link={ficha.establecimientoId ? `/establecimientos/${ficha.establecimientoId}` : undefined} navState={fromState} />
        </dl>
      </Card>

      {/* Ingreso */}
      <Card title="Ingreso" compact>
        <dl className="space-y-2">
          <LV label="Fecha" value={formatDate(ficha.fechaIngreso)} />
          <LV label="Via" value={VIA_INGRESO_LABELS[ficha.viaIngreso]} />
          <LV label="Traido por" value={ficha.traidoPor} />
          <LV label="OT referencia" value={ficha.otReferencia} link={ficha.otReferencia ? `/ordenes-trabajo/${ficha.otReferencia}` : undefined} navState={fromState} />
        </dl>
      </Card>

      {/* Resumen items */}
      {ficha.items.length > 0 && (
        <Card title="Resumen items" compact>
          <ul className="space-y-1">
            {Object.entries(itemsByEstado).map(([estado, count]) => (
              <li key={estado} className="text-sm flex justify-between">
                <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${ESTADO_FICHA_COLORS[estado as keyof typeof ESTADO_FICHA_COLORS]}`}>
                  {ESTADO_FICHA_LABELS[estado as keyof typeof ESTADO_FICHA_LABELS]}
                </span>
                <span className="text-slate-500">{count}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* OTs vinculadas */}
      {ficha.otIds.length > 0 && (
        <Card title="OTs vinculadas" compact>
          <div className="flex flex-wrap gap-1.5">
            {ficha.otIds.map(ot => (
              <Link key={ot} to={`/ordenes-trabajo/${ot}`} state={fromState} className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-teal-50 text-teal-700 hover:bg-teal-100">
                {ot}
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Fechas */}
      <Card compact>
        <dl className="space-y-1">
          <LV label="Creada" value={formatDate(ficha.createdAt)} />
          <LV label="Actualizada" value={formatDate(ficha.updatedAt)} />
        </dl>
      </Card>
    </div>
  );
}
