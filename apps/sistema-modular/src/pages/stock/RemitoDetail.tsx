import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { remitosService } from '../../services/firebaseService';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import type { Remito, TipoRemito, EstadoRemito, TipoRemitoItem } from '@ags/shared';

const TIPO_LABELS: Record<TipoRemito, string> = { salida_campo: 'Salida a campo', entrega_cliente: 'Entrega a cliente', devolucion: 'Devolucion', interno: 'Interno', derivacion_proveedor: 'Derivacion proveedor', loaner_salida: 'Loaner salida' };
const ESTADO_LABELS: Record<EstadoRemito, string> = { borrador: 'Borrador', confirmado: 'Confirmado', en_transito: 'En transito', completado: 'Completado', completado_parcial: 'Parcial', cancelado: 'Cancelado' };
const ESTADO_COLORS: Record<EstadoRemito, string> = { borrador: 'bg-slate-100 text-slate-600', confirmado: 'bg-blue-100 text-blue-700', en_transito: 'bg-amber-100 text-amber-700', completado: 'bg-green-100 text-green-700', completado_parcial: 'bg-purple-100 text-purple-700', cancelado: 'bg-red-100 text-red-700' };
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

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return '--';
  try { return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return '--'; }
};

export const RemitoDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [remito, setRemito] = useState<Remito | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setRemito(await remitosService.getById(id));
    } catch (e) { console.error('Error loading remito:', e); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const transition = async (estado: EstadoRemito, extra?: Partial<Remito>) => {
    if (!id || !remito) return;
    setActing(true);
    try { await remitosService.update(id, { estado, ...extra }); await load(); }
    catch (e) { console.error('Error updating remito:', e); alert('Error al actualizar remito'); }
    finally { setActing(false); }
  };

  const toggleDevuelto = async (itemId: string, current: boolean) => {
    if (!id || !remito) return;
    const updatedItems = remito.items.map(it =>
      it.id === itemId ? { ...it, devuelto: !current, fechaDevolucion: !current ? new Date().toISOString() : null } : it,
    );
    setActing(true);
    try { await remitosService.update(id, { items: updatedItems }); await load(); }
    catch (e) { console.error('Error toggling devuelto:', e); }
    finally { setActing(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando remito...</p></div>;
  if (!remito) return (
    <div className="text-center py-12">
      <p className="text-slate-400">Remito no encontrado</p>
      <Link to="/stock/remitos" className="text-indigo-600 hover:underline mt-2 inline-block">Volver</Link>
    </div>
  );

  return (
    <div className="-m-6 h-[calc(100%+3rem)] flex flex-col bg-slate-50">
      <div className="shrink-0 bg-white border-b border-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.06)] z-10 px-5 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-600">
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
              <Button size="sm" onClick={() => transition('confirmado')} disabled={acting}>
                {acting ? 'Procesando...' : 'Confirmar'}
              </Button>
            )}
            {remito.estado === 'confirmado' && (
              <Button size="sm" onClick={() => transition('en_transito')} disabled={acting}>
                {acting ? 'Procesando...' : 'En transito'}
              </Button>
            )}
            {remito.estado === 'en_transito' && (
              <>
                <Button size="sm" onClick={() => transition('completado', { fechaDevolucion: new Date().toISOString() })} disabled={acting}>
                  {acting ? 'Procesando...' : 'Completar'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => transition('completado_parcial')} disabled={acting}>Parcial</Button>
              </>
            )}
            <Link to="/stock/remitos"><Button variant="ghost" size="sm">Volver</Button></Link>
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
                <LV label="Ingeniero" value={remito.ingenieroNombre} />
                {remito.clienteNombre && <LV label="Cliente" value={remito.clienteNombre} />}
                {remito.otNumbers && remito.otNumbers.length > 0 && <LV label="OTs asociadas" value={remito.otNumbers.join(', ')} />}
              </div>
            </Card>
            <Card compact title="Fechas">
              <div className="space-y-2.5">
                <LV label="Fecha salida" value={formatDate(remito.fechaSalida)} />
                <LV label="Fecha devolucion" value={formatDate(remito.fechaDevolucion)} />
              </div>
            </Card>
            {remito.observaciones && (
              <Card compact title="Observaciones">
                <p className="text-xs text-slate-700">{remito.observaciones}</p>
              </Card>
            )}
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
                        <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 text-left">Codigo</th>
                        <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 text-left">Descripcion</th>
                        <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 text-center">Cant.</th>
                        <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 text-left">Tipo</th>
                        <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 text-center">Dev.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {remito.items.map(item => (
                        <tr key={item.id} className="border-b border-slate-50 last:border-0">
                          <td className="text-xs py-2 pr-3 font-mono text-slate-700">{item.articuloCodigo}</td>
                          <td className="text-xs py-2 pr-3 text-slate-700">{item.articuloDescripcion}</td>
                          <td className="text-xs py-2 pr-3 text-center text-slate-700">{item.cantidad}</td>
                          <td className="text-xs py-2 pr-3">
                            <Badge label={TIPO_ITEM_LABELS[item.tipoItem]} color={item.tipoItem === 'sale_y_vuelve' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'} />
                          </td>
                          <td className="text-xs py-2 text-center">
                            {remito.estado === 'en_transito' && item.tipoItem === 'sale_y_vuelve' ? (
                              <button onClick={() => toggleDevuelto(item.id, item.devuelto)} disabled={acting}
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
    </div>
  );
};
