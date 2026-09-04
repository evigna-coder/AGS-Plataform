import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { Certificacion, WorkOrder, RequisitoFacturacion } from '@ags/shared';
import { REQUISITO_FACTURACION_LABELS } from '@ags/shared';
import { ordenesTrabajoService, establecimientosService } from '../../services/firebaseService';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { useAuth } from '../../contexts/AuthContext';
import { RegistrarCertificacionModal } from '../../components/certificaciones/RegistrarCertificacionModal';
import { SolicitarCertificacionModal } from '../../components/certificaciones/SolicitarCertificacionModal';
import { CertificacionesAbiertasSection } from '../../components/certificaciones/CertificacionesAbiertasSection';
import { certificacionesService } from '../../services/certificacionesService';
import { usePrompt } from '../../components/ui/PromptDialog';
import { ExportarButton } from '../../components/ui/ExportarButton';
import { PENDIENTES_DOCUMENTACION_EXPORT_COLUMNS } from '../../utils/exports/exportPendientesDocumentacion';

interface Grupo {
  clienteId: string;
  clienteNombre: string;
  /** Establecimiento del grupo (2026-08-25): la documentación se gestiona por
   *  planta — cada sede de YPF certifica lo suyo — así que la cola agrupa por
   *  cliente + establecimiento, no solo por cliente. */
  establecimientoId: string;
  establecimientoNombre: string | null;
  requisito: RequisitoFacturacion;
  ots: WorkOrder[];
}

function agrupar(ots: WorkOrder[], nombresEstablecimiento: Map<string, string>): Grupo[] {
  const map = new Map<string, Grupo>();
  for (const ot of ots) {
    const key = `${ot.clienteId || 'sin-cliente'}:${ot.establecimientoId || ''}`;
    if (!map.has(key)) {
      map.set(key, {
        clienteId: ot.clienteId || '',
        clienteNombre: ot.razonSocial || 'Sin cliente',
        establecimientoId: ot.establecimientoId || '',
        establecimientoNombre: ot.establecimientoId
          ? (nombresEstablecimiento.get(ot.establecimientoId) ?? null)
          : null,
        requisito: ot.requisitoFacturacionPendiente || 'remito_firmado',
        ots: [],
      });
    }
    map.get(key)!.ots.push(ot);
  }
  return [...map.values()].sort((a, b) =>
    a.clienteNombre.localeCompare(b.clienteNombre)
    || (a.establecimientoNombre ?? '').localeCompare(b.establecimientoNombre ?? ''));
}

const otLabel = (ot: WorkOrder) => `${ot.sistema || ''}${ot.tipoServicio ? ` · ${ot.tipoServicio}` : ''}`;

export const PendientesDocumentacionPage = () => {
  const confirm = useConfirm();
  const promptText = usePrompt();
  const { firebaseUser, usuario } = useAuth();
  const [retenidas, setRetenidas] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [certGrupo, setCertGrupo] = useState<Grupo | null>(null);
  /** Grupo para el que se está armando un pedido de certificación por lote. */
  const [loteGrupo, setLoteGrupo] = useState<Grupo | null>(null);
  /** Fuerza el refresco de los pedidos abiertos cuando cambia lo retenido. */
  const [refrescoCerts, setRefrescoCerts] = useState(0);

  /** OTs que ya están dentro de un pedido de certificación abierto. */
  const [enCertificacion, setEnCertificacion] = useState<Set<string>>(new Set());
  /** Lotes pedidos y sin cerrar: a los que se les pueden sumar OTs (2026-09-04). */
  const [lotesAbiertos, setLotesAbiertos] = useState<Certificacion[]>([]);
  /** id → nombre, para rotular los grupos (la OT solo guarda el id). */
  const [nombresEst, setNombresEst] = useState<Map<string, string>>(new Map());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ots, certs, ests] = await Promise.all([
        ordenesTrabajoService.getRetenidas(),
        certificacionesService.getAbiertas().catch(() => []),
        establecimientosService.getAll().catch(() => []),
      ]);
      setRetenidas(ots);
      setLotesAbiertos(certs);
      setNombresEst(new Map(ests.map(e => [e.id, e.nombre])));
      // Una OT ya pedida al cliente NO es un pendiente de armar: aparecía en las
      // dos listas y la de abajo la hacía parecer sin resolver (2026-08-19).
      const pedidas = new Set<string>();
      for (const c of certs) for (const it of (c.items ?? [])) if (it.otNumber) pedidas.add(it.otNumber);
      setEnCertificacion(pedidas);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const grupos = agrupar(retenidas.filter(ot => !enCertificacion.has(ot.otNumber)), nombresEst);

  /**
   * Descartar el requisito documental de una OT (2026-08-19).
   *
   * No todo lo retenido necesita el papel: trabajos de proveedor externo,
   * cortesías, cosas que no corresponden. Sin esta salida quedaban acá para
   * siempre ensuciando la lista, y la única alternativa era "Liberar", que
   * afirma que la documentación LLEGÓ — mentira distinta.
   *
   * El motivo es obligatorio y queda en las notas: dentro de un mes nadie va a
   * acordarse de por qué esta OT se sacó de la cola.
   */
  const descartar = async (ot: WorkOrder) => {
    const motivo = await promptText({
      title: `Descartar documentación de ${ot.otNumber}`,
      label: 'Motivo',
      placeholder: 'Ej: trabajo de proveedor externo — no lleva certificación',
      required: true,
      multiline: true,
      confirmLabel: 'Descartar y liberar',
    });
    if (motivo === null) return;
    setActing(true);
    try {
      await ordenesTrabajoService.descartarRequisitoDocumental(
        ot.otNumber, motivo, { uid: firebaseUser?.uid || '', name: usuario?.displayName },
      );
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo descartar');
    } finally { setActing(false); }
  };

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
          <Card key={`${g.clienteId || g.clienteNombre}:${g.establecimientoId}`} compact>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-800">{g.clienteNombre}</h3>
                {(g.establecimientoNombre || g.establecimientoId) && (
                  <span className="text-xs text-slate-500">— {g.establecimientoNombre ?? 'Establecimiento sin nombre'}</span>
                )}
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
                    {lotesAbiertos.some(c => c.clienteId === g.clienteId) ? 'Solicitar / sumar a lote' : 'Solicitar por lote'}
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
                  <div className="flex items-center gap-1.5 shrink-0">
                    {g.requisito === 'remito_firmado' && (
                      <Button size="sm" variant="outline" onClick={() => liberar(ot.otNumber)} disabled={acting}>Liberar</Button>
                    )}
                    {/* Sirve para los dos requisitos: lo que no lleva papel no
                        lleva papel, sea remito o certificación. */}
                    <button onClick={() => void descartar(ot)} disabled={acting}
                      title="No corresponde documentación para esta OT (proveedor externo, cortesía, etc.)"
                      className="text-[11px] text-slate-400 hover:text-red-600 hover:underline disabled:opacity-40">
                      Descartar
                    </button>
                  </div>
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
          lotesAbiertos={lotesAbiertos.filter(c => c.clienteId === loteGrupo.clienteId)}
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
