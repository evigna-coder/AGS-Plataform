import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { minikitsService, unidadesService, ingenierosService } from '../../services/firebaseService';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import type { Minikit, UnidadStock, Ingeniero, CondicionUnidad, EstadoMinikit } from '@ags/shared';

const ESTADO_LABELS: Record<EstadoMinikit, string> = {
  en_base: 'En base', en_campo: 'En campo', en_transito: 'En transito', en_revision: 'En revision',
};
const ESTADO_COLORS: Record<EstadoMinikit, string> = {
  en_base: 'bg-green-100 text-green-700', en_campo: 'bg-blue-100 text-blue-700',
  en_transito: 'bg-amber-100 text-amber-700', en_revision: 'bg-purple-100 text-purple-700',
};
const CONDICION_LABELS: Record<CondicionUnidad, string> = { nuevo: 'Nuevo', bien_de_uso: 'Bien de uso', reacondicionado: 'Reacondicionado', vendible: 'Vendible', scrap: 'Scrap' };
const CONDICION_COLORS: Record<CondicionUnidad, string> = { nuevo: 'bg-green-100 text-green-700', bien_de_uso: 'bg-blue-100 text-blue-700', reacondicionado: 'bg-amber-100 text-amber-700', vendible: 'bg-indigo-100 text-indigo-700', scrap: 'bg-red-100 text-red-700' };
const ESTADO_UNIDAD_COLORS: Record<string, string> = { disponible: 'bg-green-100 text-green-700', reservado: 'bg-amber-100 text-amber-700', asignado: 'bg-blue-100 text-blue-700', en_transito: 'bg-purple-100 text-purple-700', consumido: 'bg-slate-100 text-slate-500', vendido: 'bg-slate-100 text-slate-500', baja: 'bg-red-100 text-red-700' };

const Badge = ({ label, color }: { label: string; color: string }) => (
  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${color}`}>{label}</span>
);

const LV = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <p className="text-[11px] font-medium text-slate-400 mb-0.5">{label}</p>
    <p className="text-xs text-slate-700">{value || '--'}</p>
  </div>
);

export const MinikitDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [minikit, setMinikit] = useState<Minikit | null>(null);
  const [unidades, setUnidades] = useState<UnidadStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAsignar, setShowAsignar] = useState(false);
  const [ingenieros, setIngenieros] = useState<Ingeniero[]>([]);
  const [selectedIngenieroId, setSelectedIngenieroId] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [mk, allUnidades] = await Promise.all([
        minikitsService.getById(id),
        unidadesService.getAll({ activoOnly: true }),
      ]);
      setMinikit(mk);
      setUnidades(allUnidades.filter(u => u.ubicacion?.tipo === 'minikit' && u.ubicacion?.referenciaId === id));
    } catch (err) { console.error('Error cargando minikit:', err); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const openAsignar = async () => {
    try {
      const data = await ingenierosService.getAll(true);
      setIngenieros(data);
      setSelectedIngenieroId('');
      setShowAsignar(true);
    } catch { alert('Error al cargar ingenieros'); }
  };

  const handleAsignar = async () => {
    if (!id || !selectedIngenieroId) return;
    const ing = ingenieros.find(i => i.id === selectedIngenieroId);
    if (!ing) return;
    setSaving(true);
    try {
      await minikitsService.update(id, {
        estado: 'en_campo',
        asignadoA: { tipo: 'ingeniero', id: ing.id, nombre: ing.nombre, desde: new Date().toISOString() },
      });
      setShowAsignar(false);
      loadData();
    } catch { alert('Error al asignar minikit'); }
    finally { setSaving(false); }
  };

  const handleDevolver = async () => {
    if (!id || !confirm('Devolver este minikit a base?')) return;
    setSaving(true);
    try {
      await minikitsService.update(id, { estado: 'en_base', asignadoA: null });
      loadData();
    } catch { alert('Error al devolver minikit'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="-m-6 h-[calc(100%+3rem)] flex items-center justify-center bg-slate-50"><p className="text-slate-400">Cargando...</p></div>;
  if (!minikit) return (
    <div className="-m-6 h-[calc(100%+3rem)] flex flex-col items-center justify-center bg-slate-50 gap-4">
      <p className="text-slate-500">Minikit no encontrado</p>
      <Link to="/stock/minikits" className="text-indigo-600 hover:underline text-sm font-medium">Volver a minikits</Link>
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
              <h2 className="text-base font-semibold text-slate-900 tracking-tight">
                <span className="font-mono text-indigo-600">{minikit.codigo}</span>
                <span className="mx-2 text-slate-300">|</span>{minikit.nombre}
              </h2>
              <p className="text-xs text-slate-400">{minikit.descripcion || 'Minikit'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {minikit.estado !== 'en_campo' && <Button size="sm" onClick={openAsignar} disabled={saving}>Asignar</Button>}
            {minikit.asignadoA && <Button size="sm" variant="outline" onClick={handleDevolver} disabled={saving}>Devolver</Button>}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="flex gap-5">
          <div className="w-72 shrink-0 space-y-4">
            <Card compact>
              <div className="space-y-2.5">
                <LV label="Codigo" value={<span className="font-mono text-indigo-600">{minikit.codigo}</span>} />
                <LV label="Nombre" value={minikit.nombre} />
                <LV label="Descripcion" value={minikit.descripcion} />
                <LV label="Estado" value={<Badge label={ESTADO_LABELS[minikit.estado]} color={ESTADO_COLORS[minikit.estado]} />} />
                <LV label="Asignado a" value={minikit.asignadoA ? `${minikit.asignadoA.tipo === 'ingeniero' ? 'Ing.' : 'OT'} ${minikit.asignadoA.nombre}` : null} />
              </div>
            </Card>

            {showAsignar && (
              <Card compact title="Asignar a ingeniero">
                <div className="space-y-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-0.5">Ingeniero</label>
                    <SearchableSelect
                      value={selectedIngenieroId}
                      onChange={setSelectedIngenieroId}
                      options={ingenieros.map(i => ({ value: i.id, label: i.nombre }))}
                      placeholder="Buscar ingeniero..."
                      emptyMessage="No hay ingenieros"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setShowAsignar(false)}>Cancelar</Button>
                    <Button size="sm" onClick={handleAsignar} disabled={saving || !selectedIngenieroId}>
                      {saving ? 'Asignando...' : 'Confirmar'}
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </div>

          <div className="flex-1 min-w-0 space-y-4">
            <Card compact title={`Contenido (${unidades.length} unidad${unidades.length !== 1 ? 'es' : ''})`}>
              {unidades.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No hay unidades asignadas a este minikit.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 text-left">Codigo</th>
                        <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 text-left">Descripcion</th>
                        <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 text-left">Condicion</th>
                        <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 text-left">Estado</th>
                        <th className="text-[11px] font-medium text-slate-400 tracking-wider py-2 text-left">Serie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unidades.map(u => (
                        <tr key={u.id} className="border-b border-slate-50 last:border-0">
                          <td className="text-xs py-2 pr-3 font-mono text-indigo-600 font-semibold whitespace-nowrap">{u.articuloCodigo}</td>
                          <td className="text-xs py-2 pr-3 text-slate-700 truncate max-w-[200px]">{u.articuloDescripcion}</td>
                          <td className="text-xs py-2 pr-3"><Badge label={CONDICION_LABELS[u.condicion]} color={CONDICION_COLORS[u.condicion]} /></td>
                          <td className="text-xs py-2 pr-3"><Badge label={u.estado.replace('_', ' ')} color={ESTADO_UNIDAD_COLORS[u.estado] ?? 'bg-slate-100 text-slate-500'} /></td>
                          <td className="text-xs py-2 text-slate-400">{u.nroSerie ? `S/N: ${u.nroSerie}` : '--'}</td>
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
