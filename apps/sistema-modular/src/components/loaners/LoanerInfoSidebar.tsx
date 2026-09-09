import { Link, useLocation } from 'react-router-dom';
import { Card } from '../ui/Card';
import type { Loaner } from '@ags/shared';
import { ESTADO_LOANER_LABELS, ESTADO_LOANER_COLORS, ESTADO_PARTE_LOANER_LABELS, TIPO_ORIGEN_LOANER_LABELS, prestamoModuloActivo, prestamosDeParteActivos, partesDelPrestamo, estadoParte, idDeParte, quienTieneElPrestamo } from '@ags/shared';

interface Props {
  loaner: Loaner;
}

function LV({ label, value, link, navState }: { label: string; value?: string | null; link?: string; navState?: any }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-[11px] font-medium text-slate-400 tracking-wider">{label}</dt>
      <dd className="text-xs text-slate-700 mt-0.5">
        {link ? <Link to={link} state={navState} className="text-teal-600 hover:underline">{value}</Link> : value}
      </dd>
    </div>
  );
}

export function LoanerInfoSidebar({ loaner }: Props) {
  const { pathname } = useLocation();
  const fromState = { from: pathname };
  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('es-AR'); } catch { return '-'; }
  };

  const prestamoActivo = prestamoModuloActivo(loaner);
  const partesPrestadas = prestamosDeParteActivos(loaner);

  return (
    <div className="space-y-3">
      {/* Estado */}
      <Card compact>
        <div className="text-center">
          <span className={`inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full ${ESTADO_LOANER_COLORS[loaner.estado]}`}>
            {ESTADO_LOANER_LABELS[loaner.estado]}
          </span>
          <p className="text-[11px] text-slate-400 mt-1.5">{loaner.codigo}</p>
        </div>
      </Card>

      {/* Equipo */}
      <Card title="Equipo" compact>
        <dl className="space-y-1.5">
          <LV label="Descripcion" value={loaner.descripcion} />
          <LV label="Categoria" value={loaner.categoriaEquipo} />
          <LV label="Categoria de modulo" value={loaner.categoriaModuloNombre} />
          <LV label="Modelo" value={loaner.moduloCodigo ? `${loaner.moduloCodigo}${loaner.moduloDescripcion ? ` — ${loaner.moduloDescripcion}` : ''}` : null} />
          <LV label="Serie" value={loaner.serie} />
          <LV label="Condicion" value={loaner.condicion} />
        </dl>
      </Card>

      {/* Origen (2026-09-09) */}
      <Card title="Origen" compact>
        {loaner.origen ? (
          <dl className="space-y-1.5">
            <LV label="Tipo" value={TIPO_ORIGEN_LOANER_LABELS[loaner.origen.tipo]} />
            {loaner.origen.proveedorNombre && <LV label="Proveedor" value={loaner.origen.proveedorNombre} />}
            {loaner.origen.clienteNombre && <LV label="Cliente" value={loaner.origen.clienteNombre} link={loaner.origen.clienteId ? `/clientes/${loaner.origen.clienteId}` : undefined} navState={fromState} />}
            {loaner.origen.fecha && <LV label="Fecha" value={loaner.origen.fecha.split('-').reverse().join('/')} />}
            {loaner.origen.referencia && <LV label="Referencia" value={loaner.origen.referencia} />}
            {loaner.origen.costo != null && <LV label="Costo" value={`${loaner.origen.moneda ?? 'USD'} ${loaner.origen.costo.toLocaleString('es-AR')}`} />}
            {loaner.origen.observaciones && <LV label="Obs." value={loaner.origen.observaciones} />}
          </dl>
        ) : (
          <p className="text-[11px] text-amber-700">Sin declarar. <Link to={`/loaners/${loaner.id}/editar`} state={fromState} className="underline">Completar</Link></p>
        )}
      </Card>

      {/* Stock link */}
      {loaner.articuloId && (
        <Card title="Vinculacion a stock" compact>
          <dl className="space-y-1.5">
            <LV label="Articulo" value={`${loaner.articuloCodigo} — ${loaner.articuloDescripcion}`} link={`/stock/articulos/${loaner.articuloId}`} navState={fromState} />
          </dl>
        </Card>
      )}

      {/* Ubicacion actual */}
      {prestamoActivo && (
        <Card title="Prestamo activo" compact>
          <dl className="space-y-1.5">
            <LV label="Cliente" value={prestamoActivo.clienteNombre} link={`/clientes/${prestamoActivo.clienteId}`} navState={fromState} />
            <LV label="Establecimiento" value={prestamoActivo.establecimientoNombre} />
            <LV label="Desde" value={formatDate(prestamoActivo.fechaSalida)} />
            {prestamoActivo.fechaRetornoPrevista && <LV label="Retorno previsto" value={formatDate(prestamoActivo.fechaRetornoPrevista)} />}
            {prestamoActivo.fichaNumero && <LV label="Ficha vinculada" value={prestamoActivo.fichaNumero} link={`/fichas/${prestamoActivo.fichaId}`} navState={fromState} />}
            {prestamoActivo.remitoSalidaId && <LV label="Remito" value={prestamoActivo.remitoSalidaNumero || 'Ver remito'} link={`/stock/remitos/${prestamoActivo.remitoSalidaId}`} navState={fromState} />}
          </dl>
        </Card>
      )}

      {/* Partes prestadas (2026-09-04; por parte y con estado desde 2026-09-08):
          el módulo está en base, pero una parte suya está afuera o en el
          estante sin instalar. Una tarjeta por parte. */}
      {partesPrestadas.flatMap(p => partesDelPrestamo(p).filter(x => !x.fechaReinstalacion).map((x, i) => {
        const st = estadoParte(x);
        return (
          <Card key={`${p.id}:${idDeParte(x, i)}`} title={st === 'en_base' ? 'Parte en base, sin instalar' : 'Parte prestada'} compact>
            <dl className="space-y-1.5">
              <LV label="Parte" value={`${x.descripcion || 'Parte'}${x.serie ? ` · S/N ${x.serie}` : ''}`} />
              {x.codigoArticulo && <LV label="N° de parte" value={x.codigoArticulo} />}
              <LV label="Estado" value={ESTADO_PARTE_LOANER_LABELS[st]} />
              {st === 'afuera' && (p.destino === 'ingeniero'
                ? <LV label="Con" value={quienTieneElPrestamo(p)} link={p.asignacionId ? `/stock/asignaciones/${p.asignacionId}` : undefined} navState={fromState} />
                : <LV label="Cliente" value={p.clienteNombre} link={`/clientes/${p.clienteId}`} navState={fromState} />)}
              {st === 'afuera' && p.establecimientoNombre && <LV label="Establecimiento" value={p.establecimientoNombre} />}
              <LV label="Salió" value={formatDate(p.fechaSalida)} />
              {x.fechaVueltaBase && <LV label="Volvió" value={formatDate(x.fechaVueltaBase)} />}
              {st === 'afuera' && p.fechaRetornoPrevista && <LV label="Retorno previsto" value={formatDate(p.fechaRetornoPrevista)} />}
              {p.remitoSalidaId && <LV label="Remito" value={p.remitoSalidaNumero || 'Ver remito'} link={`/stock/remitos/${p.remitoSalidaId}`} navState={fromState} />}
            </dl>
          </Card>
        );
      }))}

      {/* Venta */}
      {loaner.venta && (
        <Card title="Vendido" compact>
          <dl className="space-y-1.5">
            <LV label="Cliente" value={loaner.venta.clienteNombre} link={`/clientes/${loaner.venta.clienteId}`} navState={fromState} />
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
