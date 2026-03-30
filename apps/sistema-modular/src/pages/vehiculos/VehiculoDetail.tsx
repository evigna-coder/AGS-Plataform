import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { vehiculosService, serviciosVehiculoService, historialTallerService, registrosKmService } from '../../services/firebaseService';
import { ServiciosPanel } from '../../components/vehiculos/ServiciosPanel';
import { HistorialTallerPanel } from '../../components/vehiculos/HistorialTallerPanel';
import { RegistroKmPanel } from '../../components/vehiculos/RegistroKmPanel';
import type { Vehiculo, ServicioVehiculo, VisitaTaller, RegistroKm } from '@ags/shared';

type Tab = 'servicios' | 'historial' | 'km';

export const VehiculoDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [vehiculo, setVehiculo] = useState<Vehiculo | null>(null);
  const [servicios, setServicios] = useState<ServicioVehiculo[]>([]);
  const [historial, setHistorial] = useState<VisitaTaller[]>([]);
  const [registrosKm, setRegistrosKm] = useState<RegistroKm[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('servicios');

  const loadSubcollections = useCallback(async () => {
    if (!id) return;
    const [s, h, km] = await Promise.all([
      serviciosVehiculoService.getAll(id),
      historialTallerService.getAll(id),
      registrosKmService.getAll(id),
    ]);
    setServicios(s);
    setHistorial(h);
    setRegistrosKm(km);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    const unsub = vehiculosService.subscribeById(id, async (v) => {
      setVehiculo(v);
      await loadSubcollections();
      setLoading(false);
    }, (err) => {
      console.error('Error cargando vehiculo:', err);
      setLoading(false);
    });
    return () => unsub();
  }, [id, loadSubcollections]);

  if (loading) return <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando...</p></div>;
  if (!vehiculo) return <div className="flex items-center justify-center py-12"><p className="text-slate-400">Vehículo no encontrado</p></div>;

  const latestKm = registrosKm.length > 0 ? registrosKm[0].km : vehiculo.kmActual ?? 0;

  const tabCls = (t: Tab) => `px-4 py-2 text-xs font-mono font-medium uppercase tracking-wider border-b-2 transition-colors ${tab === t ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/vehiculos')} className="text-slate-400 hover:text-slate-600 text-sm">← Volver</button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="font-mono text-xl font-bold tracking-wider text-slate-900">{vehiculo.patente}</h1>
              <span className="text-sm text-slate-500">{[vehiculo.marca, vehiculo.modelo, vehiculo.anio].filter(Boolean).join(' ')}</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Asignado a: <span className="text-slate-700 font-medium">{vehiculo.asignadoA}</span></p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">KM Actual</p>
            <p className="text-lg font-mono font-bold text-teal-700">{latestKm.toLocaleString('es-AR')} km</p>
          </div>
        </div>

        {/* Vencimientos inline */}
        {vehiculo.vencimientos.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {vehiculo.vencimientos.map((vc, i) => {
              const diff = vc.fecha ? (new Date(vc.fecha).getTime() - Date.now()) / (1000 * 60 * 60 * 24) : 999;
              const cls = diff < 0 ? 'bg-red-100 text-red-800' : diff < 30 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700';
              return (
                <span key={i} className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${cls}`}>
                  {vc.tipo}: {vc.fecha ? new Date(vc.fecha).toLocaleDateString('es-AR') : 'Sin fecha'}
                  {diff < 0 && ' (VENCIDO)'}
                </span>
              );
            })}
          </div>
        )}

        {/* Criterios resumen */}
        {vehiculo.criteriosServicio.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-3">
            {vehiculo.criteriosServicio.map((c, i) => (
              <div key={i} className="text-[10px] text-slate-500">
                <span className="font-medium text-slate-700">{c.servicio}:</span>{' '}
                {c.cadaKm ? `${c.cadaKm.toLocaleString('es-AR')} km` : ''}{c.cadaKm && c.cadaTiempo ? ' / ' : ''}{c.cadaTiempo ?? ''}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-6 flex gap-0">
        <button onClick={() => setTab('servicios')} className={tabCls('servicios')}>Servicios</button>
        <button onClick={() => setTab('historial')} className={tabCls('historial')}>Historial Taller</button>
        <button onClick={() => setTab('km')} className={tabCls('km')}>Registro KM</button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {tab === 'servicios' && (
          <ServiciosPanel vehiculoId={vehiculo.id} servicios={servicios} criterios={vehiculo.criteriosServicio} kmActual={latestKm} onChanged={loadSubcollections} />
        )}
        {tab === 'historial' && (
          <HistorialTallerPanel vehiculoId={vehiculo.id} historial={historial} onChanged={loadSubcollections} />
        )}
        {tab === 'km' && (
          <RegistroKmPanel vehiculoId={vehiculo.id} registros={registrosKm} onChanged={loadSubcollections} />
        )}
      </div>
    </div>
  );
};
