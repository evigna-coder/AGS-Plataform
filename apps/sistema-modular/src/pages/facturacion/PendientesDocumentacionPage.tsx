import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { WorkOrder, RequisitoFacturacion } from '@ags/shared';
import { REQUISITO_FACTURACION_LABELS } from '@ags/shared';
import { ordenesTrabajoService } from '../../services/firebaseService';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { useAuth } from '../../contexts/AuthContext';
import { RegistrarCertificacionModal } from '../../components/certificaciones/RegistrarCertificacionModal';
import { SolicitarCertificacionModal } from '../../components/certificaciones/SolicitarCertificacionModal';
import { CertificacionesAbiertasSection } from '../../components/certificaciones/CertificacionesAbiertasSection';
import { ExportarButton } from '../../components/ui/ExportarButton';
import { PENDIENTES_DOCUMENTACION_EXPORT_COLUMNS } from '../../utils/exports/exportPendientesDocumentacion';

interface Grupo {
  clienteId: string;
  clienteNombre: string;
  requisito: RequisitoFacturacion;
  ots: WorkOrder[];
}

function agrupar(ots: WorkOrder[]): Grupo[] {
  const map = new Map<string, Grupo>();
  for (const ot of ots) {
    const key = ot.clienteId || 'sin-cliente';
    if (!map.has(key)) {
      map.set(key, {
        clienteId: ot.clienteId || '',
        clienteNombre: ot.razonSocial || 'Sin cliente',
        requisito: ot.requisitoFacturacionPendiente || 'remito_firmado',
        ots: [],
      });
    }
    map.get(key)!.ots.push(ot);
  }
  return [...map.values()].sort((a, b) => a.clienteNombre.localeCompare(b.clienteNombre));
}

const otLabel = (ot: WorkOrder) => `${ot.sistema || ''}${ot.tipoServicio ? ` · ${ot.tipoServicio}` : ''}`;

export const PendientesDocumentacionPage = () => {
  const confirm = useConfirm();
  const { firebaseUser, usuario } = useAuth();
  const [retenidas, setRetenidas] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [certGrupo, setCertGrupo] = useState<Grupo | null>(null);
  /** Grupo para el que se está armando un pedido de certificación por lote. */
  const [loteGrupo, setLoteGrupo] = useState<Grupo | null>(null);
  /** Fuerza el refresco de los pedidos abiertos cuando cambia lo retenido. */
  const [refrescoCerts, setRefrescoCerts] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRetenidas(await ordenesTrabajoService.getRetenidas()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const grupos = agrupar(retenidas);

  const liberar = async (otNumber: string) => {
    if (!await confirm(`¿Liberar la OT ${otNumber} para facturación? La documentación requerida debe estar presente.`)) return;
    setActing(true);
    try {
      await ordenesTrabajoService.liberarParaFacturacion(otNumber, { uid: firebaseUser?.uid || '', name: usuario?.displayName });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al liberar');
    } finally { setActing(false); }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader title="Pendientes de documentación" subtitle="OTs retenidas hasta recibir remito firmado o certificación del cliente"
        actions={
          <ExportarButton
            columnas={PENDIENTES_DOCUMENTACION_EXPORT_COLUMNS}
            data={grupos.flatMap(g => g.ots)}
            titulo="Pendientes de Documentación"
            filename="pendientes-documentacion"
          />
        }
      />
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Pedidos ya enviados al cliente, para resolver OT por OT cuando
            vuelve la certificación (2026-08-17). */}
        <CertificacionesAbiertasSection key={refrescoCerts} onResuelta={() => void load()} />

        {loading ? (
          <p className="text-slate-400 text-sm">Cargando...</p>
        ) : grupos.length === 0 ? (
          <p className="text-slate-400 text-sm">No hay OTs retenidas por documentación.</p>
        ) : grupos.map(g => (
          <Card key={g.clienteId || g.clienteNombre} compact>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-800">{g.clienteNombre}</h3>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${g.requisito === 'certificacion' ? 'bg-violet-100 text-violet-700' : 'bg-amber-100 text-amber-700'}`}>
                  {REQUISITO_FACTURACION_LABELS[g.requisito]}
                </span>
                <span className="text-[11px] text-slate-400">{g.ots.length} OT{g.ots.length !== 1 ? 's' : ''}</span>
              </div>
              {g.requisito === 'certificacion' && (
                <div className="flex gap-1.5 shrink-0">
                  {/* Dos caminos según cómo certifica la planta: pedir el lote
                      y esperar, o registrar el papel que ya llegó. */}
                  <Button size="sm" variant="outline" onClick={() => setLoteGrupo(g)} disabled={acting}>
                    Solicitar por lote
                  </Button>
                  <Button size="sm" onClick={() => setCertGrupo(g)} disabled={acting}>Registrar certificación</Button>
                </div>
              )}
            </div>
            <div className="space-y-1">
              {g.ots.map(ot => (
                <div key={ot.otNumber} className="flex items-center justify-between gap-3 py-1 border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Link to={`/ordenes-trabajo/${ot.otNumber}`} className="text-xs font-mono text-teal-600 hover:underline">{ot.otNumber}</Link>
                    <span className="text-xs text-slate-500 truncate">{otLabel(ot)}</span>
                  </div>
                  {g.requisito === 'remito_firmado' && (
                    <Button size="sm" variant="outline" onClick={() => liberar(ot.otNumber)} disabled={acting} className="shrink-0">Liberar</Button>
                  )}
                </div>
              ))}
            </div>
            {g.requisito === 'remito_firmado' && (
              <p className="text-[10px] text-slate-400 mt-2">Al subir el remito firmado desde el detalle del remito, estas OTs se liberan automáticamente.</p>
            )}
          </Card>
        ))}
      </div>
      {loteGrupo && (
        <SolicitarCertificacionModal
          open={!!loteGrupo}
          onClose={() => setLoteGrupo(null)}
          onCreated={() => { setLoteGrupo(null); setRefrescoCerts(n => n + 1); void load(); }}
          clienteId={loteGrupo.clienteId}
          clienteNombre={loteGrupo.clienteNombre}
          ots={loteGrupo.ots}
        />
      )}
      {certGrupo && (
        <RegistrarCertificacionModal
          open={!!certGrupo}
          onClose={() => setCertGrupo(null)}
          onCreated={() => { setCertGrupo(null); void load(); }}
          clienteId={certGrupo.clienteId}
          clienteNombre={certGrupo.clienteNombre}
          ots={certGrupo.ots}
        />
      )}
    </div>
  );
};
