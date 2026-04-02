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
  clienteNombre: string;
  onSolicitudCreated: (id: string) => void;
}

interface PresupuestoInfo {
  presupuesto: Presupuesto;
  otNumbers: string[];
  solicitudesExistentes: SolicitudFacturacion[];
}

export const CierreFacturacionWizard: React.FC<Props> = ({
  otNumber, budgets, clienteId, clienteNombre, onSolicitudCreated,
}) => {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(true);
  const [presupuestosInfo, setPresupuestosInfo] = useState<PresupuestoInfo[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

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

          // Find all OTs linked to this presupuesto
          const linkedOTs = allOTs.filter(ot =>
            !ot.otNumber.includes('.') && (ot.budgets || []).includes(budgetNum)
          );

          const solicitudes = await facturacionService.getByPresupuesto(pres.id);

          infos.push({
            presupuesto: pres,
            otNumbers: linkedOTs.map(ot => ot.otNumber),
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
  }, [budgets, clienteId]);

  const handleEnviarAFacturacion = async (pres: PresupuestoInfo) => {
    try {
      setSending(true);
      const items = pres.presupuesto.items.map(item => ({
        id: crypto.randomUUID(),
        presupuestoItemId: item.id,
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        cantidadTotal: item.cantidad,
        precioUnitario: item.precioUnitario,
        subtotal: item.subtotal,
      }));

      const solicitudId = await facturacionService.create({
        presupuestoId: pres.presupuesto.id,
        presupuestoNumero: pres.presupuesto.numero,
        clienteId,
        clienteNombre,
        condicionPago: '',
        items,
        montoTotal: pres.presupuesto.total || 0,
        moneda: pres.presupuesto.moneda,
        estado: 'pendiente',
        observaciones: `Generada desde cierre OT-${otNumber}`,
        otNumbers: [otNumber],
        solicitadoPor: usuario?.id || null,
        solicitadoPorNombre: usuario?.displayName || null,
      });

      onSolicitudCreated(solicitudId);
      setSent(true);
    } catch (err) {
      console.error('Error creando solicitud facturacion:', err);
      alert('Error al enviar a facturacion');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <p className="text-[10px] text-slate-400">Cargando info de facturacion...</p>;
  if (budgets.length === 0) return <p className="text-[10px] text-slate-400 italic">Sin presupuestos vinculados</p>;
  if (sent) return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
      <p className="text-xs text-emerald-700 font-medium">Solicitud de facturacion creada</p>
    </div>
  );

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Facturacion</p>
      {presupuestosInfo.map(info => {
        const hasExisting = info.solicitudesExistentes.length > 0;
        const multipleOTs = info.otNumbers.length > 1;
        const sym = MONEDA_SIMBOLO[info.presupuesto.moneda] || '$';
        return (
          <div key={info.presupuesto.id} className="border border-slate-200 rounded-lg p-2.5 bg-white space-y-1.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-teal-700">{info.presupuesto.numero}</p>
                <p className="text-[10px] text-slate-400">{sym} {info.presupuesto.total?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => handleEnviarAFacturacion(info)} disabled={sending}>
                {sending ? 'Enviando...' : 'Enviar a facturacion'}
              </Button>
            </div>
            {multipleOTs && (
              <p className="text-[10px] text-amber-600 bg-amber-50 px-2 py-1 rounded">
                Este presupuesto tiene {info.otNumbers.length} OTs vinculadas: {info.otNumbers.join(', ')}
              </p>
            )}
            {hasExisting && (
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
