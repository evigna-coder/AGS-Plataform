import { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { remitosService } from '../../services/firebaseService';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { getRemitoItemCodigo, getRemitoItemDescripcion, getTipoEntidadLabel } from '../../utils/inventarioToRemitoItem';
import type { Remito, RemitoItem, TipoRemito, EstadoRemito, TipoRemitoItem } from '@ags/shared';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import { useDeclareParent } from '../../hooks/useDeclareParent';
import { useRemitoAcciones, stockRemitoLabel } from '../../hooks/useRemitoAcciones';
import { RemitoFirmaCard } from '../../components/remitos/RemitoFirmaCard';
import { RemitoDescargaModal } from '../../components/remitos/RemitoDescargaModal';
import { RetornoProveedorButton } from '../../components/remitos/RetornoProveedorButton';
import { LoanerRetornoButton } from '../../components/remitos/LoanerRetornoButton';
import { RemitoHistorialCard } from '../../components/remitos/RemitoHistorialCard';
import { itemRemitoConEfectoAplicado } from '../../services/movimientosAplicar';

const TIPO_LABELS: Record<TipoRemito, string> = { salida_campo: 'Salida a campo', entrega_cliente: 'Entrega a cliente', devolucion: 'Devolucion', interno: 'Interno', derivacion_proveedor: 'Derivacion proveedor', loaner_salida: 'Loaner salida', servicio: 'Servicio' };
const ESTADO_LABELS: Record<EstadoRemito, string> = { borrador: 'Borrador', confirmado: 'Confirmado', en_transito: 'En transito', en_proveedor: 'En proveedor externo', completado: 'Completado', completado_parcial: 'Parcial', cancelado: 'Cancelado' };
const ESTADO_COLORS: Record<EstadoRemito, string> = { borrador: 'bg-slate-100 text-slate-600', confirmado: 'bg-blue-100 text-blue-700', en_transito: 'bg-amber-100 text-amber-700', en_proveedor: 'bg-orange-100 text-orange-700', completado: 'bg-green-100 text-green-700', completado_parcial: 'bg-purple-100 text-purple-700', cancelado: 'bg-red-100 text-red-700' };
const TIPO_ITEM_LABELS: Record<TipoRemitoItem, string> = { sale_y_vuelve: 'Sale y vuelve', entrega: 'Entrega' };

const Badge = ({ label, color }: { label: string; color: string }) => (
  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${color}`}>{label}</span>
);

const LV = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <p className="text-[11px] font-medium text-slate-400 mb-0.5">{label}</p>
    <p className="text-xs text-slate-700">{value || '--'}</p>
  </div>
);

/** Días enteros desde una fecha ISO — cuánto hace que está en el proveedor. */
const diasDesde = (iso: string) => {
  const d = new Date(iso).getTime();
  if (isNaN(d)) return 0;
  return Math.max(0, Math.floor((Date.now() - d) / 86400000));
};

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return '--';
  try { return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return '--'; }
};

export const RemitoDetail = () => {
  const { id } = useParams<{ id: string }>();
  const goBack = useNavigateBack();
  const { state } = useLocation();

  // Al remito se llega desde varios contextos (ficha, loaner, movimientos, la
  // lista): si el Link trae referrer (`state.from`), Volver va AHÍ — el listado
  // de remitos es solo el fallback (2026-08-06: desde una ficha, Volver caía
  // siempre al listado).
  const from = typeof (state as { from?: unknown } | null)?.from === 'string'
    ? (state as { from: string }).from
    : null;
  useDeclareParent(from ?? '/stock/remitos');
  const [remito, setRemito] = useState<Remito | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDescarga, setShowDescarga] = useState(false);
  // Confirmar aplica el movimiento real de stock (I4); ver useRemitoAcciones.
  const { acting, transition, confirmarRemito, toggleDevuelto, subirFirma, quitarFirma, anularRemito } = useRemitoAcciones(id, remito);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    const unsub = remitosService.subscribeById(id, (data) => {
      setRemito(data);
      setLoading(false);
    }, (err) => {
      console.error('Error loading remito:', err);
      setLoading(false);
    });
    return () => unsub();
  }, [id]);

  if (loading) return <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando remito...</p></div>;

  // Devolución desde el remito: items 'sale y vuelve' sin resolver, sea de stock
  // propio (efecto aplicado) o de una asignación vinculada. El CONSUMO no pasa
  // por acá — vive en el cierre administrativo de la OT (2026-08-09).
  const hayDescargables = remito != null
    && ['confirmado', 'en_transito', 'en_proveedor', 'completado_parcial'].includes(remito.estado)
    && remito.items.some(it => !it.devuelto && !it.consumido && it.tipoItem === 'sale_y_vuelve'
      && (!!it.asignacionId || itemRemitoConEfectoAplicado(it)));

  if (!remito) return (
    <div className="text-center py-12">
      <p className="text-slate-400">Remito no encontrado</p>
      <Link to="/stock/remitos" className="text-teal-600 hover:underline mt-2 inline-block">Volver</Link>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="shrink-0 bg-white border-b border-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.06)] z-10 px-5 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => goBack()} className="text-slate-400 hover:text-slate-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div>
              <h2 className="text-base font-semibold text-slate-900 tracking-tight">{remito.numero}</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge label={TIPO_LABELS[remito.tipo]} color="bg-slate-100 text-slate-600" />
                <Badge label={ESTADO_LABELS[remito.estado]} color={ESTADO_COLORS[remito.estado]} />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {remito.estado === 'borrador' && (
              <Button size="sm" onClick={confirmarRemito} disabled={acting}>
                {acting ? 'Procesando...' : 'Confirmar'}
              </Button>
            )}
            {remito.estado === 'confirmado' && (
              <Button size="sm" onClick={() => transition('en_transito')} disabled={acting}>
                {acting ? 'Procesando...' : 'En transito'}
              </Button>
            )}
            {hayDescargables && (
              <Button size="sm" variant="outline" onClick={() => setShowDescarga(true)} disabled={acting}>
                Devolver / cerrar
              </Button>
            )}
            {/* Derivación entregada en el proveedor (2026-08-07): deja de estar
                "en tránsito" y arranca el contador de días afuera. */}
            {remito.tipo === 'derivacion_proveedor' && remito.estado === 'en_transito' && (
              <Button size="sm" variant="outline"
                onClick={() => void remitosService.marcarEntregadoEnProveedor(remito.id)}
                disabled={acting}>
                {acting ? 'Procesando...' : 'Entregado al proveedor'}
              </Button>
            )}
            {(remito.estado === 'en_transito' || remito.estado === 'en_proveedor') && (
              <>
                <Button size="sm" onClick={() => transition('completado', { fechaDevolucion: new Date().toISOString() })} disabled={acting}>
                  {acting ? 'Procesando...' : 'Completar'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => transition('completado_parcial')} disabled={acting}>Parcial</Button>
              </>
            )}
            {/* Anular: única reversa de la salida de stock (2026-08-17). Solo
                sobre remitos ya emitidos — un borrador se elimina y listo. */}
            {remito.estado !== 'borrador' && remito.estado !== 'cancelado' && (
              <Button size="sm" variant="outline" onClick={() => void anularRemito()} disabled={acting}
                className="text-red-600 border-red-200 hover:bg-red-50">
                {acting ? 'Procesando...' : 'Anular'}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={goBack}>Volver</Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="flex gap-5">
          <div className="w-72 shrink-0 space-y-4">
            <Card compact>
              <div className="space-y-2.5">
                <LV label="Numero" value={<span className="font-mono">{remito.numero}</span>} />
                <LV label="Tipo" value={TIPO_LABELS[remito.tipo]} />
                <LV label="Estado" value={<Badge label={ESTADO_LABELS[remito.estado]} color={ESTADO_COLORS[remito.estado]} />} />
                <LV label="Stock" value={stockRemitoLabel(remito)} />
                <LV label={remito.transportistaNombre && !remito.ingenieroNombre ? 'Transportista' : 'Ingeniero'}
                  value={remito.ingenieroNombre || remito.transportistaNombre} />
                {remito.clienteNombre && (
                  <LV label="Cliente" value={remito.establecimientoNombre
                    ? `${remito.clienteNombre} (${remito.establecimientoNombre})`
                    : remito.clienteNombre} />
                )}
                {remito.otNumbers && remito.otNumbers.length > 0 && <LV label="OTs asociadas" value={remito.otNumbers.join(', ')} />}
              </div>
            </Card>
            <Card compact title="Fechas">
              <div className="space-y-2.5">
                <LV label="Fecha salida" value={formatDate(remito.fechaSalida)} />
                {remito.fechaEntregaProveedor && (
                  <LV label="Entregado al proveedor" value={
                    <>
                      {formatDate(remito.fechaEntregaProveedor)}
                      {remito.estado === 'en_proveedor' && (
                        <span className="ml-1 text-orange-600 font-medium">
                          ({diasDesde(remito.fechaEntregaProveedor)} d afuera)
                        </span>
                      )}
                    </>
                  } />
                )}
                <LV label="Fecha devolucion" value={formatDate(remito.fechaDevolucion)} />
              </div>
            </Card>
            {remito.tipo === 'servicio' && (
              <RemitoFirmaCard remito={remito} acting={acting} onSubir={subirFirma} onQuitar={quitarFirma} />
            )}
            {remito.observaciones && (
              <Card compact title="Observaciones">
                <p className="text-xs text-slate-700">{remito.observaciones}</p>
              </Card>
            )}
            <RemitoHistorialCard remitoId={remito.id} />
          </div>

          <div className="flex-1 min-w-0 space-y-4">
            <Card compact title={`Items (${remito.items.length})`}>
              {remito.items.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No hay items en este remito.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 text-center">Codigo</th>
                        <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 text-center">Descripcion</th>
                        {hasMultipleTypes(remito.items) && (
                          <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 text-center">Entidad</th>
                        )}
                        <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 text-center">Cant.</th>
                        <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 text-center">Tipo</th>
                        <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 text-center">Dev.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {remito.items.map(item => (
                        <tr key={item.id} className="border-b border-slate-50 last:border-0">
                          <td className="text-xs py-2 pr-3 font-mono text-slate-700">{resolveItemCodigo(item)}</td>
                          <td className="text-xs py-2 pr-3 text-slate-700">{resolveItemDescripcion(item)}</td>
                          {hasMultipleTypes(remito.items) && (
                            <td className="text-xs py-2 pr-3">
                              {item.tipoEntidad ? (
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{getTipoEntidadLabel(item.tipoEntidad)}</span>
                              ) : '--'}
                            </td>
                          )}
                          <td className="text-xs py-2 pr-3 text-center text-slate-700">{item.cantidad}</td>
                          <td className="text-xs py-2 pr-3">
                            <Badge label={TIPO_ITEM_LABELS[item.tipoItem]} color={item.tipoItem === 'sale_y_vuelve' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'} />
                          </td>
                          <td className="text-xs py-2 text-center">
                            {item.consumido ? (
                              <span className="text-[10px] font-medium text-orange-600" title={item.fechaConsumo ? `Consumido el ${formatDate(item.fechaConsumo)}` : 'Consumido en campo'}>
                                Consumido
                              </span>
                            ) : remito.tipo === 'derivacion_proveedor' && item.unidadId && !item.devuelto ? (
                              /* Parte propia de stock en el proveedor (2026-08-07) */
                              <RetornoProveedorButton item={item} />
                            ) : remito.tipo === 'derivacion_proveedor' && item.loanerId && !item.devuelto ? (
                              /* Loaner derivado al proveedor (2026-08-12): la vuelta
                                 marca la línea devuelta + calificación pendiente. */
                              <LoanerRetornoButton remitoId={remito.id} item={item} />
                            ) : remito.estado === 'en_transito' && item.tipoItem === 'sale_y_vuelve' ? (
                              <button onClick={() => toggleDevuelto(item, item.devuelto)} disabled={acting}
                                className={`w-4 h-4 rounded border inline-flex items-center justify-center transition-colors ${item.devuelto ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 hover:border-slate-400'}`}>
                                {item.devuelto && <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                              </button>
                            ) : (
                              <span className={item.devuelto ? 'text-green-600' : 'text-slate-300'}>{item.devuelto ? '\u2713' : '\u2014'}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      <RemitoDescargaModal open={showDescarga} remito={remito} onClose={() => setShowDescarga(false)} />
    </div>
  );
};

// ── Multi-type helpers ──

function resolveItemCodigo(item: RemitoItem): string {
  if (item.servicioDescripcion != null) return item.servicioCode || '';
  return getRemitoItemCodigo(item) || 'S/C';
}

function resolveItemDescripcion(item: RemitoItem): string {
  if (item.servicioDescripcion != null) {
    const refs = [
      item.presupuestoNumero && `Ppto ${item.presupuestoNumero}`,
      item.ocNumero && `OC ${item.ocNumero}`,
    ].filter(Boolean).join(' · ');
    return refs ? `${item.servicioDescripcion} — ${refs}` : item.servicioDescripcion;
  }
  // Sin tipoEntidad (líneas de ficha) hay que caer igual a fichaDescripcion:
  // con el gate anterior la descripción salía vacía (2026-08-07).
  return getRemitoItemDescripcion(item) || item.articuloDescripcion || '';
}

function hasMultipleTypes(items: RemitoItem[]): boolean {
  return items.some(i => i.tipoEntidad != null);
}
