import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { unidadesService } from '../../services/firebaseService';
import { Drawer } from '../ui/Drawer';
import type { MovimientoStock, UnidadStock, TipoMovimiento } from '@ags/shared';

const TIPO_LABELS: Record<TipoMovimiento, string> = {
  ingreso: 'Ingreso', egreso: 'Egreso', transferencia: 'Transferencia',
  consumo: 'Consumo', devolucion: 'Devolucion', ajuste: 'Ajuste',
};
const TIPO_COLORS: Record<TipoMovimiento, string> = {
  ingreso: 'bg-green-100 text-green-700', egreso: 'bg-red-100 text-red-700',
  transferencia: 'bg-blue-100 text-blue-700', consumo: 'bg-amber-100 text-amber-700',
  devolucion: 'bg-purple-100 text-purple-700', ajuste: 'bg-slate-100 text-slate-600',
};

const formatDateFull = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

interface Props {
  open: boolean;
  movimiento: MovimientoStock | null;
  onClose: () => void;
}

/**
 * Panel deslizable con el detalle completo de un movimiento de stock.
 * Los datos de N° de serie / lote / OC / despacho / importación / ubicación provienen
 * de la UNIDAD asociada (`unidadesService.getById`), que se lee al abrir; el resto sale
 * del propio movimiento. Si la unidad ya no existe (consumida/borrada) se avisa y se
 * muestra igual el detalle del movimiento.
 */
export function MovimientoDetailDrawer({ open, movimiento, onClose }: Props) {
  const [unidad, setUnidad] = useState<UnidadStock | null>(null);
  const [loadingUnidad, setLoadingUnidad] = useState(false);
  const [unidadNotFound, setUnidadNotFound] = useState(false);

  useEffect(() => {
    if (!open || !movimiento?.unidadId) {
      setUnidad(null); setUnidadNotFound(false); setLoadingUnidad(false);
      return;
    }
    let cancelled = false;
    setLoadingUnidad(true); setUnidad(null); setUnidadNotFound(false);
    unidadesService.getById(movimiento.unidadId)
      .then(u => {
        if (cancelled) return;
        if (u) setUnidad(u); else setUnidadNotFound(true);
      })
      .catch(() => { if (!cancelled) setUnidadNotFound(true); })
      .finally(() => { if (!cancelled) setLoadingUnidad(false); });
    return () => { cancelled = true; };
  }, [open, movimiento?.unidadId]);

  if (!movimiento) return null;
  const m = movimiento;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`${TIPO_LABELS[m.tipo]} · ${m.articuloCodigo}`}
      subtitle={m.articuloDescripcion}
      width="520px"
    >
      <div className="p-5 space-y-6">
        {/* Datos del movimiento */}
        <Section title="Movimiento">
          <Field label="Fecha y hora">{formatDateFull(m.createdAt)}</Field>
          <Field label="Tipo">
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${TIPO_COLORS[m.tipo]}`}>
              {TIPO_LABELS[m.tipo]}
            </span>
          </Field>
          <Field label="Artículo">
            <span className="font-mono text-slate-800">{m.articuloCodigo}</span>
            <span className="text-slate-500"> — {m.articuloDescripcion}</span>
          </Field>
          <Field label="Cantidad"><span className="tabular-nums font-medium">{m.cantidad}</span></Field>
          <Field label="Origen">{m.origenTipo} — {m.origenNombre}</Field>
          <Field label="Destino">{m.destinoTipo} — {m.destinoNombre}</Field>
          <Field label="Motivo">{m.motivo ?? '—'}</Field>
          <Field label="Usuario">{m.creadoPor}</Field>
          {m.ordenCompraNumero && <Field label="N° OC (mov.)">{m.ordenCompraNumero}</Field>}
          {m.despachoImportacionNumero && <Field label="N° Despacho (mov.)">{m.despachoImportacionNumero}</Field>}
          {(m.remitoId || m.otNumber) && (
            <Field label="Referencias">
              <div className="flex gap-3">
                {m.remitoId && (
                  <Link to={`/stock/remitos/${m.remitoId}`} className="text-teal-600 hover:underline font-medium">
                    Remito
                  </Link>
                )}
                {m.otNumber && (
                  <Link to={`/ordenes-trabajo/${m.otNumber}`} className="text-teal-600 hover:underline font-medium">
                    OT {m.otNumber}
                  </Link>
                )}
              </div>
            </Field>
          )}
        </Section>

        {/* Datos de trazabilidad de la unidad */}
        <Section title="Unidad / Trazabilidad">
          {loadingUnidad ? (
            <p className="text-xs text-slate-400 italic">Cargando datos de la unidad…</p>
          ) : unidadNotFound ? (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-md px-3 py-2">
              La unidad ya no existe en stock (consumida o dada de baja). Se muestra sólo el detalle del movimiento.
            </p>
          ) : unidad ? (
            <>
              <Field label="N° de serie">{unidad.nroSerie ?? '—'}</Field>
              <Field label="N° de lote">{unidad.nroLote ?? '—'}</Field>
              <Field label="N° de OC">{unidad.ordenCompraNumero ?? '—'}</Field>
              <Field label="N° de despacho">{unidad.despachoImportacionNumero ?? '—'}</Field>
              <Field label="N° de importación">{unidad.importacionNumero ?? '—'}</Field>
              <Field label="Condición">{unidad.condicion}</Field>
              <Field label="Estado">{unidad.estado}</Field>
              <Field label="Ubicación actual">
                {unidad.ubicacion ? `${unidad.ubicacion.tipo} — ${unidad.ubicacion.referenciaNombre}` : '—'}
              </Field>
            </>
          ) : (
            <p className="text-xs text-slate-400 italic">Sin datos de unidad.</p>
          )}
        </Section>
      </div>
    </Drawer>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-[10px] font-mono uppercase tracking-wide text-slate-400 mb-2 pb-1 border-b border-slate-200">
        {title}
      </h3>
      <dl className="space-y-2">{children}</dl>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-3 items-baseline">
      <dt className="text-[10px] font-mono uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-xs text-slate-700">{children}</dd>
    </div>
  );
}
