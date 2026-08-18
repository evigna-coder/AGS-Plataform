import { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { contratosService, sistemasService } from '../../services/firebaseService';
import { ContratoCupoSection } from '../../components/contratos/ContratoCupoSection';
import type { Contrato, EstadoContrato } from '@ags/shared';
import { ESTADO_CONTRATO_LABELS, ESTADO_CONTRATO_COLORS, TIPO_LIMITE_CONTRATO_LABELS } from '@ags/shared';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EditContratoModal } from '../../components/contratos/EditContratoModal';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import { useDeclareParent } from '../../hooks/useDeclareParent';

const lbl = "block text-[10px] font-mono font-medium text-slate-500 mb-1 uppercase tracking-wide";

export const ContratoDetail = () => {
  const { id } = useParams<{ id: string }>();
  const goBack = useNavigateBack();
  const { pathname } = useLocation();
  const [contrato, setContrato] = useState<Contrato | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  // Nombres de los equipos cubiertos (antes se mostraba el id crudo).
  const [nombreSistema, setNombreSistema] = useState<Map<string, string>>(new Map());

  useDeclareParent('/contratos');

  const load = () => {
    if (!id) return;
    contratosService.getById(id).then(data => { setContrato(data); setLoading(false); });
  };
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    sistemasService.getAll()
      .then(list => setNombreSistema(new Map(list.map(s => [s.id, `${s.nombre}${s.codigoInternoCliente ? ` (${s.codigoInternoCliente})` : ''}`]))))
      .catch(() => {});
  }, []);

  const handleEstadoChange = async (estado: EstadoContrato) => {
    if (!id || !contrato) return;
    try {
      setSaving(true);
      await contratosService.update(id, { estado });
      setContrato(prev => prev ? { ...prev, estado } : prev);
    } catch { alert('Error al cambiar estado'); }
    finally { setSaving(false); }
  };

  if (loading) return <p className="text-center text-sm text-slate-400 py-12">Cargando...</p>;
  if (!contrato) return <p className="text-center text-sm text-red-400 py-12">Contrato no encontrado</p>;

  const fmtDate = (iso: string | null | undefined) => iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
  const visitasRestantes = contrato.tipoLimite === 'visitas' && contrato.maxVisitas !== null ? contrato.maxVisitas - contrato.visitasUsadas : null;
  const today = new Date().toISOString().split('T')[0];
  const isVencido = contrato.fechaFin < today;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{contrato.numero}</h2>
            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-medium ${ESTADO_CONTRATO_COLORS[contrato.estado]}`}>
              {ESTADO_CONTRATO_LABELS[contrato.estado]}
            </span>
            {isVencido && contrato.estado === 'activo' && (
              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">Vigencia vencida</span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-0.5">{contrato.clienteNombre}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setShowEdit(true)}>Editar</Button>
          {contrato.estado === 'activo' && (
            <Button variant="outline" size="sm" onClick={() => handleEstadoChange('suspendido')} disabled={saving}>Suspender</Button>
          )}
          {contrato.estado === 'suspendido' && (
            <Button variant="outline" size="sm" onClick={() => handleEstadoChange('activo')} disabled={saving}>Reactivar</Button>
          )}
          <Button variant="outline" onClick={() => goBack()}>Volver</Button>
        </div>
      </div>

      {/* Metadata */}
      <Card>
        <div className="grid grid-cols-4 gap-4">
          <div><p className={lbl}>Vigencia</p><p className="text-xs text-slate-700">{fmtDate(contrato.fechaInicio)} — {fmtDate(contrato.fechaFin)}</p></div>
          <div><p className={lbl}>Tipo de limite</p><p className="text-xs text-slate-700">{TIPO_LIMITE_CONTRATO_LABELS[contrato.tipoLimite]}</p></div>
          <div>
            <p className={lbl}>Visitas</p>
            {visitasRestantes !== null ? (
              <p className={`text-sm font-bold ${visitasRestantes <= 2 ? 'text-red-600' : visitasRestantes <= 5 ? 'text-amber-600' : 'text-teal-700'}`}>
                {contrato.visitasUsadas} / {contrato.maxVisitas} <span className="text-[10px] font-normal text-slate-400">({visitasRestantes} restantes)</span>
              </p>
            ) : <p className="text-xs text-slate-400">Ilimitado</p>}
          </div>
          <div>
            <p className={lbl}>Presupuesto</p>
            {contrato.presupuestoId ? (
              <Link to={`/presupuestos/${contrato.presupuestoId}`} state={{ from: pathname }} className="text-xs text-teal-600 hover:underline font-medium">
                {contrato.presupuestoNumero}
              </Link>
            ) : <p className="text-xs text-slate-400">—</p>}
          </div>
        </div>
      </Card>

      {/* Servicios incluidos */}
      <Card>
        <p className="text-[9px] font-mono font-semibold text-teal-700/70 uppercase tracking-widest mb-3">Servicios incluidos</p>
        <div className="flex flex-wrap gap-2">
          {contrato.serviciosIncluidos.map(s => (
            <div key={s.tipoServicioId} className="px-3 py-1.5 bg-teal-50 border border-teal-200 rounded-lg">
              <p className="text-xs font-medium text-teal-700">{s.tipoServicioNombre}</p>
              {s.entregables && s.entregables.length > 0 && (
                <p className="text-[10px] text-teal-500 mt-0.5">{s.entregables.join(', ')}</p>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Cupo por equipo y servicio del año de contrato vigente (2026-08-17). */}
      <ContratoCupoSection contrato={contrato} nombreSistema={nombreSistema} />

      {/* Sistemas cubiertos */}
      {contrato.sistemaIds.length > 0 && (
        <Card>
          <p className="text-[9px] font-mono font-semibold text-teal-700/70 uppercase tracking-widest mb-3">Sistemas cubiertos</p>
          <div className="flex flex-wrap gap-2">
            {contrato.sistemaIds.map(sid => (
              <Link key={sid} to={`/equipos/${sid}`} state={{ from: pathname }}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 hover:border-teal-300 transition-colors">
                {nombreSistema.get(sid) ?? sid}
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Notas */}
      {contrato.notas && (
        <Card>
          <p className={lbl}>Notas</p>
          <p className="text-xs text-slate-600">{contrato.notas}</p>
        </Card>
      )}

      <EditContratoModal
        open={showEdit}
        contrato={contrato}
        onClose={() => setShowEdit(false)}
        onSaved={load}
      />
    </div>
  );
};
