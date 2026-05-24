import { useEffect, useState } from 'react';
import type { OTEstadoAdmin, SolicitudFacturacion } from '@ags/shared';
import { presupuestosService, facturacionService } from '../services/firebaseService';

type Resultado = {
  loading: boolean;
  puedeFinalizarse: boolean;
  razon: string | null;
  pendientes: number;
};

const TERMINALES: Array<SolicitudFacturacion['estado']> = ['enviada', 'facturada', 'cobrada', 'anulada'];

export function useOTFinalizable(
  estadoAdmin: OTEstadoAdmin | undefined,
  budgets: string[] | undefined,
): Resultado {
  const [loading, setLoading] = useState(true);
  const [puedeFinalizarse, setPuedeFinalizarse] = useState(false);
  const [razon, setRazon] = useState<string | null>(null);
  const [pendientes, setPendientes] = useState(0);

  useEffect(() => {
    if (estadoAdmin !== 'CIERRE_ADMINISTRATIVO') {
      setLoading(false);
      setPuedeFinalizarse(false);
      setRazon(null);
      setPendientes(0);
      return;
    }
    const nums = budgets ?? [];
    if (nums.length === 0) {
      setLoading(false);
      setPuedeFinalizarse(true);
      setRazon(null);
      setPendientes(0);
      return;
    }

    let cancelado = false;
    setLoading(true);
    (async () => {
      try {
        const todos = await presupuestosService.getAll();
        const presupuestos = todos.filter(p => nums.includes(p.numero));
        const presIds = presupuestos.map(p => p.id);
        const solicitudesPorPres = await Promise.all(
          presIds.map(id => facturacionService.getByPresupuesto(id).catch(() => [])),
        );
        const activas = solicitudesPorPres.flat().filter(s => s.estado !== 'anulada');
        const sinTerminal = activas.filter(s => !TERMINALES.includes(s.estado)).length;
        const presupuestosSinSolicitud = presIds.length - solicitudesPorPres.filter(arr => arr.length > 0).length;

        if (cancelado) return;
        if (presupuestosSinSolicitud > 0) {
          setPuedeFinalizarse(false);
          setRazon(`Falta generar solicitud de facturación para ${presupuestosSinSolicitud} presupuesto(s).`);
          setPendientes(sinTerminal);
        } else if (sinTerminal > 0) {
          setPuedeFinalizarse(false);
          setRazon(`Hay ${sinTerminal} solicitud(es) de facturación sin enviar a administración.`);
          setPendientes(sinTerminal);
        } else {
          setPuedeFinalizarse(true);
          setRazon(null);
          setPendientes(0);
        }
      } catch (err) {
        console.error('[useOTFinalizable] error:', err);
        if (cancelado) return;
        setPuedeFinalizarse(false);
        setRazon('No se pudo verificar el estado de facturación.');
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();

    return () => { cancelado = true; };
  }, [estadoAdmin, JSON.stringify(budgets ?? [])]);

  return { loading, puedeFinalizarse, razon, pendientes };
}
