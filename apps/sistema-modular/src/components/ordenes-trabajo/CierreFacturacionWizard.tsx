import { useState, useEffect } from 'react';
import { presupuestosService, facturacionService } from '../../services/firebaseService';
import { ordenesTrabajoService } from '../../services/firebaseService';
import { useAuth } from '../../contexts/AuthContext';
import type { Presupuesto, SolicitudFacturacion } from '@ags/shared';
import { MONEDA_SIMBOLO } from '@ags/shared';
import { Button } from '../ui/Button';

interface Props {
  otNumber: string;
  budgets: string[];
  clienteId: string;
  /** Ya no se usa (generarAvisoFacturacion lo resuelve del ppto); se acepta por compat. */
  clienteNombre?: string;
  onSolicitudCreated: (id: string) => void;
}

interface PresupuestoInfo {
  presupuesto: Presupuesto;
  /** OTs del ppto (universo = vinculadas ∪ budgets, mismo criterio que otService). */
  otNumbers: string[];
  /** OTs sin cierre administrativo, excluida la OT en curso (se está cerrando acá). */
  otsPendientes: string[];
  solicitudesExistentes: SolicitudFacturacion[];
}

const OT_CERRADA_ADMIN = new Set(['CIERRE_ADMINISTRATIVO', 'FINALIZADO']);

/**
 * Bloque "Facturación" del cierre administrativo. Regla (UAT 2026-07-17/18):
 * el aviso a facturación de un presupuesto se habilita RECIÉN al cerrar la
 * última de sus OTs — acá se deshabilita el botón si quedan otras abiertas,
 * y al click se re-verifica contra el estado real del ppto (server truth).
 */
export const CierreFacturacionWizard: React.FC<Props> = ({
  otNumber, budgets, clienteId, onSolicitudCreated,
}) => {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(true);
  const [presupuestosInfo, setPresupuestosInfo] = useState<PresupuestoInfo[]>([]);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (budgets.length === 0) { setLoading(false); return; }

    const load = async () => {
      try {
        const allPresupuestos = await presupuestosService.getAll({ clienteId });
        const allOTs = await ordenesTrabajoService.getAll();

        const infos: PresupuestoInfo[] = [];
        for (const budgetNum of budgets) {
          const pres = allPresupuestos.find(p => p.numero === budgetNum);
          if (!pres) continue;

          // Universo de OTs del ppto: vinculadas ∪ OTs cuyo budgets contiene el
          // número (incluye hijas .NN) — mismo criterio que el gate de otService.
          const nums = new Set<string>([
            ...(pres.otsVinculadasNumbers ?? []),
            ...(pres.otVinculadaNumber ? [pres.otVinculadaNumber] : []),
          ]);
          const estadoPorOt = new Map<string, string>();
          for (const ot of allOTs) {
            if ((ot.budgets || []).includes(budgetNum)) nums.add(ot.otNumber);
            estadoPorOt.set(ot.otNumber, ot.estadoAdmin ?? '');
          }
          const otsPendientes = [...nums].filter(num =>
            num !== otNumber &&
            estadoPorOt.has(num) &&
            !OT_CERRADA_ADMIN.has(estadoPorOt.get(num) as string));

          const solicitudes = await facturacionService.getByPresupuesto(pres.id);

          infos.push({
            presupuesto: pres,
            otNumbers: [...nums],
            otsPendientes,
            solicitudesExistentes: solicitudes.filter(s => s.estado !== 'anulada'),
          });
        }
        setPresupuestosInfo(infos);
      } catch (err) {
        console.error('Error loading facturacion info:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [budgets, clienteId, otNumber]);

  const handleEnviarAFacturacion = async (info: PresupuestoInfo) => {
    try {
      setSendingId(info.presupuesto.id);
      // Re-read del ppto al click: el estado real lo escribe el cierre admin
      // (otsListasParaFacturar + pendiente_facturacion con la ÚLTIMA OT cerrada).
      const fresh = await presupuestosService.getById(info.presupuesto.id);
      if (!fresh) throw new Error('Presupuesto no encontrado');
      const otsListas = fresh.otsListasParaFacturar ?? [];
      if (fresh.estado !== 'pendiente_facturacion' || otsListas.length === 0) {
        alert('El aviso a facturación se habilita al cerrar la última OT del presupuesto. '
          + 'Guardá primero el cierre administrativo de esta OT y volvé a intentar.');
        return;
      }
      // Camino unificado: crea la solicitud + ticket a Administración + marca el ppto.
      const { solicitudId } = await presupuestosService.generarAvisoFacturacion(
        info.presupuesto.id,
        otsListas,
        { observaciones: `Generada desde cierre OT-${otNumber}` },
        usuario ? { uid: usuario.id, name: usuario.displayName || undefined } : undefined,
      );
      onSolicitudCreated(solicitudId);
      setSentIds(prev => new Set(prev).add(info.presupuesto.id));
    } catch (err) {
      console.error('Error creando solicitud facturacion:', err);
      alert(err instanceof Error ? err.message : 'Error al enviar a facturacion');
    } finally {
      setSendingId(null);
    }
  };

  if (loading) return <p className="text-[10px] text-slate-400">Cargando info de facturacion...</p>;
  if (budgets.length === 0) return <p className="text-[10px] text-slate-400 italic">Sin presupuestos vinculados</p>;

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Facturacion</p>
      {presupuestosInfo.map(info => {
        const hasExisting = info.solicitudesExistentes.length > 0;
        const bloqueada = info.otsPendientes.length > 0;
        const sent = sentIds.has(info.presupuesto.id);
        const sym = MONEDA_SIMBOLO[info.presupuesto.moneda] || '$';
        return (
          <div key={info.presupuesto.id} className="border border-slate-200 rounded-lg p-2.5 bg-white space-y-1.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-teal-700">{info.presupuesto.numero}</p>
                <p className="text-[10px] text-slate-400">{sym} {info.presupuesto.total?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
              </div>
              {sent ? (
                <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1">
                  Aviso enviado
                </span>
              ) : (
                <Button
                  size="sm" variant="outline"
                  onClick={() => handleEnviarAFacturacion(info)}
                  disabled={sendingId !== null || bloqueada}
                  title={bloqueada ? 'Se habilita al cerrar la última OT del presupuesto' : undefined}
                >
                  {sendingId === info.presupuesto.id ? 'Enviando...' : 'Enviar a facturacion'}
                </Button>
              )}
            </div>
            {bloqueada && !sent && (
              <p className="text-[10px] text-amber-700 bg-amber-50 px-2 py-1 rounded">
                El aviso se habilita al cerrar la última OT del presupuesto.
                Quedan sin cerrar: {info.otsPendientes.join(', ')}
              </p>
            )}
            {hasExisting && !sent && (
              <p className="text-[10px] text-blue-600 bg-blue-50 px-2 py-1 rounded">
                Ya existen {info.solicitudesExistentes.length} solicitud(es) de facturacion para este presupuesto
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};
