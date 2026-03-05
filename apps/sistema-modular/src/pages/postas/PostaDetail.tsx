import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  POSTA_CATEGORIA_LABELS, POSTA_CATEGORIA_COLORS,
  POSTA_TIPO_ENTIDAD_LABELS,
  POSTA_ESTADO_LABELS, POSTA_ESTADO_COLORS,
  POSTA_PRIORIDAD_LABELS, POSTA_PRIORIDAD_COLORS,
} from '@ags/shared';
import type { PostaWorkflow, PostaHandoff } from '@ags/shared';
import { postasService } from '../../services/firebaseService';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DerivarPostaModal } from '../../components/postas/DerivarPostaModal';

const ENTIDAD_ROUTES: Record<string, string> = {
  orden_compra: '/stock/ordenes-compra',
  importacion: '/stock/importaciones',
  presupuesto: '/presupuestos',
  requerimiento: '/stock/requerimientos',
  agenda: '/agenda',
};

export const PostaDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [posta, setPosta] = useState<PostaWorkflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDerivar, setShowDerivar] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const data = await postasService.getById(id);
    setPosta(data);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleComplete = async () => {
    if (!posta || !confirm('Completar esta posta?')) return;
    await postasService.complete(posta.id);
    if (usuario) {
      const handoff: PostaHandoff = {
        fecha: new Date().toISOString(),
        deUsuarioId: usuario.id,
        deUsuarioNombre: usuario.displayName,
        aUsuarioId: usuario.id,
        aUsuarioNombre: usuario.displayName,
        accion: 'Completar',
        comentario: null,
      };
      await postasService.addHandoff(posta.id, handoff);
    }
    await load();
  };

  const handleCancel = async () => {
    if (!posta || !confirm('Cancelar esta posta?')) return;
    await postasService.cancel(posta.id);
    await load();
  };

  const handleStartProgress = async () => {
    if (!posta) return;
    await postasService.update(posta.id, { estado: 'en_proceso' });
    await load();
  };

  const handleDerived = async () => {
    setShowDerivar(false);
    await load();
  };

  if (loading) return <div className="flex items-center justify-center py-12"><p className="text-slate-400">Cargando posta...</p></div>;
  if (!posta) return <div className="flex items-center justify-center py-12"><p className="text-slate-400">Posta no encontrada</p></div>;

  const entidadRoute = ENTIDAD_ROUTES[posta.tipoEntidad];
  const entidadLink = entidadRoute && posta.tipoEntidad !== 'agenda' ? `${entidadRoute}/${posta.entidadId}` : entidadRoute;
  const isActive = posta.estado === 'pendiente' || posta.estado === 'en_proceso';

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader title={`Posta - ${posta.entidadNumero}`} subtitle={posta.entidadDescripcion}
        actions={<Button size="sm" variant="outline" onClick={() => navigate('/postas')}>Volver</Button>} />

      <div className="flex-1 overflow-y-auto px-5 pb-4">
        <div className="flex gap-5 mt-3">
          {/* Sidebar */}
          <div className="w-72 shrink-0 space-y-3">
            <Card>
              <div className="p-4 space-y-3">
                <InfoRow label="Estado">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${POSTA_ESTADO_COLORS[posta.estado]}`}>
                    {POSTA_ESTADO_LABELS[posta.estado]}
                  </span>
                </InfoRow>
                <InfoRow label="Prioridad">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${POSTA_PRIORIDAD_COLORS[posta.prioridad]}`}>
                    {POSTA_PRIORIDAD_LABELS[posta.prioridad]}
                  </span>
                </InfoRow>
                <InfoRow label="Categoria">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${POSTA_CATEGORIA_COLORS[posta.categoria]}`}>
                    {POSTA_CATEGORIA_LABELS[posta.categoria]}
                  </span>
                </InfoRow>
                <InfoRow label="Tipo entidad">
                  <span className="text-xs text-slate-700">{POSTA_TIPO_ENTIDAD_LABELS[posta.tipoEntidad]}</span>
                </InfoRow>
                <InfoRow label="Responsable">
                  <span className="text-xs font-medium text-slate-700">{posta.responsableNombre}</span>
                </InfoRow>
                <InfoRow label="Creado por">
                  <span className="text-xs text-slate-600">{posta.creadoPorNombre}</span>
                </InfoRow>
                <InfoRow label="Fecha creacion">
                  <span className="text-xs text-slate-600">{new Date(posta.fechaCreacion).toLocaleDateString('es-AR')}</span>
                </InfoRow>
                {posta.fechaVencimiento && (
                  <InfoRow label="Vencimiento">
                    <span className="text-xs text-slate-600">{new Date(posta.fechaVencimiento).toLocaleDateString('es-AR')}</span>
                  </InfoRow>
                )}
                {posta.fechaCompletada && (
                  <InfoRow label="Completada">
                    <span className="text-xs text-emerald-600">{new Date(posta.fechaCompletada).toLocaleDateString('es-AR')}</span>
                  </InfoRow>
                )}
                {entidadLink && (
                  <div className="pt-2 border-t border-slate-100">
                    <Link to={entidadLink} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                      Ver {POSTA_TIPO_ENTIDAD_LABELS[posta.tipoEntidad]} →
                    </Link>
                  </div>
                )}
              </div>
            </Card>

            {isActive && (
              <Card>
                <div className="p-4 space-y-2">
                  {posta.estado === 'pendiente' && (
                    <Button size="sm" className="w-full" onClick={handleStartProgress}>Tomar en proceso</Button>
                  )}
                  <Button size="sm" variant="outline" className="w-full" onClick={() => setShowDerivar(true)}>Derivar</Button>
                  <Button size="sm" variant="outline" className="w-full" onClick={handleComplete}>Completar</Button>
                  <Button size="sm" variant="ghost" className="w-full text-red-500 hover:text-red-700" onClick={handleCancel}>Cancelar</Button>
                </div>
              </Card>
            )}
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-3">
            <Card>
              <div className="p-4">
                <h3 className="text-[11px] font-medium text-slate-400 mb-1">Accion requerida</h3>
                <p className="text-sm text-slate-800">{posta.accionRequerida}</p>
                {posta.comentario && (
                  <>
                    <h3 className="text-[11px] font-medium text-slate-400 mt-3 mb-1">Comentario</h3>
                    <p className="text-xs text-slate-600">{posta.comentario}</p>
                  </>
                )}
              </div>
            </Card>

            <Card>
              <div className="p-4">
                <h3 className="text-[11px] font-medium text-slate-400 mb-3">Historial de derivaciones</h3>
                {posta.historial.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Sin movimientos registrados</p>
                ) : (
                  <div className="space-y-3">
                    {posta.historial.map((h, i) => (
                      <div key={i} className="flex gap-3 items-start">
                        <div className="w-2 h-2 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium text-slate-700">{h.deUsuarioNombre}</span>
                            <span className="text-[10px] text-slate-400">→</span>
                            <span className="text-xs font-medium text-slate-700">{h.aUsuarioNombre}</span>
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">{h.accion}</span>
                          </div>
                          {h.comentario && <p className="text-[11px] text-slate-500 mt-0.5">{h.comentario}</p>}
                          <p className="text-[10px] text-slate-400 mt-0.5">{new Date(h.fecha).toLocaleString('es-AR')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {showDerivar && (
        <DerivarPostaModal posta={posta} onClose={() => setShowDerivar(false)} onDerived={handleDerived} />
      )}
    </div>
  );
};

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-slate-400 mb-0.5">{label}</p>
      {children}
    </div>
  );
}
