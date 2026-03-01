import { Link } from 'react-router-dom';
import { Card } from '../ui/Card';
import type { FichaPropiedad } from '@ags/shared';
import { ESTADO_FICHA_LABELS, ESTADO_FICHA_COLORS, VIA_INGRESO_LABELS } from '@ags/shared';

interface Props {
  ficha: FichaPropiedad;
}

function LV({ label, value, link }: { label: string; value?: string | null; link?: string }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-[11px] font-medium text-slate-400 tracking-wider">{label}</dt>
      <dd className="text-sm text-slate-700 mt-0.5">
        {link ? <Link to={link} className="text-indigo-600 hover:underline">{value}</Link> : value}
      </dd>
    </div>
  );
}

export function FichaInfoSidebar({ ficha }: Props) {
  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('es-AR'); } catch { return '-'; }
  };

  return (
    <div className="space-y-4">
      {/* Estado */}
      <Card compact>
        <div className="text-center">
          <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${ESTADO_FICHA_COLORS[ficha.estado]}`}>
            {ESTADO_FICHA_LABELS[ficha.estado]}
          </span>
          <p className="text-xs text-slate-400 mt-2">{ficha.numero}</p>
        </div>
      </Card>

      {/* Cliente */}
      <Card title="Cliente" compact>
        <dl className="space-y-2">
          <LV label="Razon social" value={ficha.clienteNombre} link={`/clientes/${ficha.clienteId}`} />
          <LV label="Establecimiento" value={ficha.establecimientoNombre} link={ficha.establecimientoId ? `/establecimientos/${ficha.establecimientoId}` : undefined} />
        </dl>
      </Card>

      {/* Ingreso */}
      <Card title="Ingreso" compact>
        <dl className="space-y-2">
          <LV label="Fecha" value={formatDate(ficha.fechaIngreso)} />
          <LV label="Via" value={VIA_INGRESO_LABELS[ficha.viaIngreso]} />
          <LV label="Traido por" value={ficha.traidoPor} />
          <LV label="OT referencia" value={ficha.otReferencia} link={ficha.otReferencia ? `/ordenes-trabajo/${ficha.otReferencia}` : undefined} />
        </dl>
      </Card>

      {/* Equipo */}
      <Card title="Equipo / Modulo" compact>
        <dl className="space-y-2">
          <LV label="Sistema" value={ficha.sistemaNombre} link={ficha.sistemaId ? `/equipos/${ficha.sistemaId}` : undefined} />
          <LV label="Modulo" value={ficha.moduloNombre} />
          {ficha.descripcionLibre && <LV label="Descripcion" value={ficha.descripcionLibre} />}
          <LV label="Part number" value={ficha.codigoArticulo} />
          <LV label="Serie" value={ficha.serie} />
          <LV label="Condicion fisica" value={ficha.condicionFisica} />
        </dl>
      </Card>

      {/* Problema */}
      <Card title="Problema" compact>
        <p className="text-sm text-slate-700">{ficha.descripcionProblema}</p>
        {ficha.sintomasReportados && (
          <p className="text-xs text-slate-500 mt-2">
            <span className="font-medium">Sintomas:</span> {ficha.sintomasReportados}
          </p>
        )}
      </Card>

      {/* Accesorios */}
      {ficha.accesorios.length > 0 && (
        <Card title="Accesorios" compact>
          <ul className="space-y-1">
            {ficha.accesorios.map(a => (
              <li key={a.id} className="text-sm text-slate-700 flex justify-between">
                <span>{a.descripcion}</span>
                <span className="text-slate-400">x{a.cantidad}</span>
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
              <Link key={ot} to={`/ordenes-trabajo/${ot}`} className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100">
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
          {ficha.fechaEntrega && <LV label="Entregada" value={formatDate(ficha.fechaEntrega)} />}
        </dl>
      </Card>
    </div>
  );
}
