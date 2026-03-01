import { Link } from 'react-router-dom';
import { Card } from '../ui/Card';
import type { Loaner } from '@ags/shared';
import { ESTADO_LOANER_LABELS, ESTADO_LOANER_COLORS } from '@ags/shared';

interface Props {
  loaner: Loaner;
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

export function LoanerInfoSidebar({ loaner }: Props) {
  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('es-AR'); } catch { return '-'; }
  };

  const prestamoActivo = loaner.prestamos.find(p => p.estado === 'activo');

  return (
    <div className="space-y-4">
      {/* Estado */}
      <Card compact>
        <div className="text-center">
          <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${ESTADO_LOANER_COLORS[loaner.estado]}`}>
            {ESTADO_LOANER_LABELS[loaner.estado]}
          </span>
          <p className="text-xs text-slate-400 mt-2">{loaner.codigo}</p>
        </div>
      </Card>

      {/* Equipo */}
      <Card title="Equipo" compact>
        <dl className="space-y-2">
          <LV label="Descripcion" value={loaner.descripcion} />
          <LV label="Categoria" value={loaner.categoriaEquipo} />
          <LV label="Serie" value={loaner.serie} />
          <LV label="Condicion" value={loaner.condicion} />
        </dl>
      </Card>

      {/* Stock link */}
      {loaner.articuloId && (
        <Card title="Vinculacion a stock" compact>
          <dl className="space-y-2">
            <LV label="Articulo" value={`${loaner.articuloCodigo} — ${loaner.articuloDescripcion}`} link={`/stock/articulos/${loaner.articuloId}`} />
          </dl>
        </Card>
      )}

      {/* Ubicacion actual */}
      {prestamoActivo && (
        <Card title="Prestamo activo" compact>
          <dl className="space-y-2">
            <LV label="Cliente" value={prestamoActivo.clienteNombre} link={`/clientes/${prestamoActivo.clienteId}`} />
            <LV label="Establecimiento" value={prestamoActivo.establecimientoNombre} />
            <LV label="Desde" value={formatDate(prestamoActivo.fechaSalida)} />
            {prestamoActivo.fechaRetornoPrevista && <LV label="Retorno previsto" value={formatDate(prestamoActivo.fechaRetornoPrevista)} />}
            {prestamoActivo.fichaNumero && <LV label="Ficha vinculada" value={prestamoActivo.fichaNumero} link={`/fichas/${prestamoActivo.fichaId}`} />}
            {prestamoActivo.remitoSalidaId && <LV label="Remito" value={prestamoActivo.remitoSalidaNumero || 'Ver remito'} link={`/stock/remitos/${prestamoActivo.remitoSalidaId}`} />}
          </dl>
        </Card>
      )}

      {/* Venta */}
      {loaner.venta && (
        <Card title="Vendido" compact>
          <dl className="space-y-2">
            <LV label="Cliente" value={loaner.venta.clienteNombre} link={`/clientes/${loaner.venta.clienteId}`} />
            <LV label="Fecha" value={formatDate(loaner.venta.fecha)} />
            {loaner.venta.precio != null && <LV label="Precio" value={`${loaner.venta.moneda || 'ARS'} ${loaner.venta.precio.toLocaleString()}`} />}
          </dl>
        </Card>
      )}

      {/* Fechas */}
      <Card compact>
        <dl className="space-y-1">
          <LV label="Creado" value={formatDate(loaner.createdAt)} />
          <LV label="Actualizado" value={formatDate(loaner.updatedAt)} />
        </dl>
      </Card>
    </div>
  );
}
