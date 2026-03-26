import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { asignacionesService } from '../../services/firebaseService';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import type { Asignacion, ItemAsignacion, EstadoItemAsignacion } from '@ags/shared';

const ESTADO_COLORS: Record<EstadoItemAsignacion, string> = {
  asignado: 'bg-blue-100 text-blue-700',
  devuelto: 'bg-green-100 text-green-700',
  consumido: 'bg-slate-100 text-slate-500',
};

export const AsignacionDetail = () => {
  const { id } = useParams<{ id: string }>();
  const goBack = useNavigateBack();
  const [asg, setAsg] = useState<Asignacion | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent) setLoading(true);
    try { setAsg(await asignacionesService.getById(id)); }
    catch (err) { console.error('Error:', err); }
    finally { if (!silent) setLoading(false); }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDevolver = async (item: ItemAsignacion) => {
    if (!id || !confirm(`¿Devolver "${item.articuloCodigo || item.minikitCodigo}"?`)) return;
    setSaving(true);
    try {
      await asignacionesService.devolverItems(id, [{ itemId: item.id, cantidad: item.cantidad - item.cantidadDevuelta - item.cantidadConsumida }]);
      await loadData(true);
    } catch { alert('Error al devolver'); }
    finally { setSaving(false); }
  };

  const handleConsumir = async (item: ItemAsignacion) => {
    if (!id) return;
    const ot = prompt('Número de OT (opcional):');
    setSaving(true);
    try {
      await asignacionesService.consumirItems(id, [{ itemId: item.id, cantidad: item.cantidad - item.cantidadDevuelta - item.cantidadConsumida, otNumber: ot || undefined }]);
      await loadData(true);
    } catch { alert('Error al consumir'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="h-full flex items-center justify-center bg-slate-50"><p className="text-slate-400">Cargando...</p></div>;
  if (!asg) return (
    <div className="h-full flex flex-col items-center justify-center bg-slate-50 gap-4">
      <p className="text-slate-500">Asignación no encontrada</p>
      <Link to="/stock/asignaciones/historial" className="text-teal-600 hover:underline text-sm font-medium">Volver</Link>
    </div>
  );

  const itemsActivos = asg.items.filter(i => i.estado === 'asignado');
  const itemsFinalizados = asg.items.filter(i => i.estado !== 'asignado');

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="shrink-0 bg-white border-b border-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.06)] z-10 px-5 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => goBack()} className="text-slate-400 hover:text-slate-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div>
              <h2 className="text-base font-semibold text-slate-900 tracking-tight">
                <span className="font-mono text-teal-600">{asg.numero}</span>
                <span className="mx-2 text-slate-300">|</span>{asg.ingenieroNombre}
              </h2>
              <p className="text-xs text-slate-400">
                {asg.clienteNombre && `${asg.clienteNombre} · `}
                {new Date(asg.createdAt).toLocaleDateString('es-AR')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
              asg.estado === 'activa' ? 'bg-green-100 text-green-700' :
              asg.estado === 'completada' ? 'bg-slate-100 text-slate-500' : 'bg-red-100 text-red-700'
            }`}>{asg.estado}</span>
            {asg.remitoId && (
              <Link to={`/stock/remitos/${asg.remitoId}`} className="text-[11px] text-teal-600 hover:underline">Ver remito</Link>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {asg.observaciones && (
          <Card compact>
            <p className="text-[11px] font-medium text-slate-400 mb-0.5">Observaciones</p>
            <p className="text-xs text-slate-700">{asg.observaciones}</p>
          </Card>
        )}

        {itemsActivos.length > 0 && (
          <Card compact title={`Items activos (${itemsActivos.length})`}>
            <div className="space-y-2">
              {itemsActivos.map(item => (
                <ItemRow key={item.id} item={item} onDevolver={handleDevolver} onConsumir={handleConsumir} saving={saving} />
              ))}
            </div>
          </Card>
        )}

        {itemsFinalizados.length > 0 && (
          <Card compact title={`Finalizados (${itemsFinalizados.length})`}>
            <div className="space-y-2">
              {itemsFinalizados.map(item => (
                <ItemRow key={item.id} item={item} saving={saving} />
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

const ItemRow = ({ item, onDevolver, onConsumir, saving }: {
  item: ItemAsignacion;
  onDevolver?: (item: ItemAsignacion) => void;
  onConsumir?: (item: ItemAsignacion) => void;
  saving: boolean;
}) => {
  const codigo = item.articuloCodigo || item.minikitCodigo || item.loanerCodigo || item.vehiculoPatente || '';
  const desc = item.articuloDescripcion || item.instrumentoNombre || item.dispositivoDescripcion || item.minikitCodigo || item.loanerCodigo || '';
  const remaining = item.cantidad - item.cantidadDevuelta - item.cantidadConsumida;
  const canAct = item.estado === 'asignado' && remaining > 0;

  return (
    <div className="flex items-center justify-between bg-slate-50 rounded px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-mono text-[11px] text-teal-700 font-semibold">{codigo}</span>
        <span className="text-xs text-slate-700 truncate">{desc}</span>
        <span className="text-[10px] bg-slate-200 text-slate-600 px-1 py-0.5 rounded">{item.tipo}</span>
        {item.permanente && <span className="text-[10px] bg-purple-50 text-purple-700 px-1 py-0.5 rounded">Permanente</span>}
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_COLORS[item.estado]}`}>{item.estado}</span>
        {item.clienteNombre && <span className="text-[10px] text-slate-400">→ {item.clienteNombre}</span>}
      </div>
      {canAct && !item.permanente && (
        <div className="flex gap-1.5 shrink-0">
          {onDevolver && <Button size="sm" variant="outline" onClick={() => onDevolver(item)} disabled={saving}>Devolver</Button>}
          {onConsumir && <Button size="sm" variant="ghost" onClick={() => onConsumir(item)} disabled={saving}>Consumir</Button>}
        </div>
      )}
    </div>
  );
};
