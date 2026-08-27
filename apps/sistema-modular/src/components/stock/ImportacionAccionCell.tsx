import { useState } from 'react';
import type { Importacion } from '@ags/shared';
import { importacionesService } from '../../services/firebaseService';
import { useConfirm } from '../ui/ConfirmDialog';

/**
 * Confirmación secuencial desde el listado de importaciones (2026-08-27): cada
 * fila ofrece UNA acción — la próxima del ciclo arribo → pago VEP → giro al
 * exterior. Con la impo ya en 'recibido' el arribo y el VEP se dan por
 * ocurridos (misma heurística que el flujo de fondos), así que solo puede
 * quedar el giro. Cada confirmación estampa la fecha efectiva y saca el evento
 * de los pendientes de Pagos VEP.
 */
type PasoConfirmacion = { key: 'arribo' | 'vep' | 'giro'; label: string };

export const proximaConfirmacion = (imp: Importacion): PasoConfirmacion | null => {
  if (imp.estado === 'cancelado') return null;
  const recibida = imp.estado === 'recibido';
  if (!imp.fechaArriboReal && !recibida) return { key: 'arribo', label: 'Confirmar arribo' };
  if (imp.vepPagado !== true && !recibida) return { key: 'vep', label: 'Confirmar VEP' };
  if (imp.giroPagado !== true) return { key: 'giro', label: 'Confirmar giro' };
  return null;
};

const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const MENSAJE_PASO: Record<PasoConfirmacion['key'], (imp: Importacion) => string> = {
  arribo: imp => `Se registra hoy como fecha de arribo real de la OC ${imp.ordenCompraNumero}. El arribo sale de los eventos próximos del flujo de fondos.`,
  vep: imp => `Se registra el VEP de la OC ${imp.ordenCompraNumero} como pagado hoy${imp.vepMonto != null ? ` (${imp.vepMoneda || 'ARS'} ${imp.vepMonto.toLocaleString('es-AR')})` : ''}. Sale de los pendientes de Pagos VEP.`,
  giro: imp => `Se registra el giro al exterior de la OC ${imp.ordenCompraNumero} como pagado hoy${imp.giroMonto != null ? ` (${imp.giroMoneda || 'USD'} ${imp.giroMonto.toLocaleString('es-AR')})` : ''}. Sale de los pendientes del flujo de fondos.`,
};

interface Props {
  imp: Importacion;
  onDone: () => void;
}

export const ImportacionAccionCell: React.FC<Props> = ({ imp, onDone }) => {
  const confirm = useConfirm();
  const [confirmando, setConfirmando] = useState(false);

  const paso = proximaConfirmacion(imp);
  if (!paso) {
    return imp.estado === 'cancelado'
      ? <span className="text-slate-300">—</span>
      : <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">✓ Al día</span>;
  }

  const handleConfirmar = async () => {
    const ok = await confirm({ title: paso.label, message: MENSAJE_PASO[paso.key](imp), confirmLabel: paso.label });
    if (!ok) return;
    try {
      setConfirmando(true);
      const hoy = hoyISO();
      const patch = paso.key === 'arribo'
        ? { fechaArriboReal: hoy }
        : paso.key === 'vep'
          ? { vepPagado: true, vepFechaPagado: hoy }
          : { giroPagado: true, giroFechaPagado: hoy };
      await importacionesService.update(imp.id, patch);
      onDone();
    } catch (err) {
      console.error('Error confirmando paso:', err);
      alert('Error al confirmar');
    } finally {
      setConfirmando(false);
    }
  };

  // Mismo formato que las acciones del resto de los listados (ej. Remitos):
  // link de texto por color de acción, no botón. Colores = los del evento en
  // el flujo de fondos (arribo celeste, VEP ámbar, giro teal).
  const COLOR: Record<PasoConfirmacion['key'], string> = {
    arribo: 'text-sky-600',
    vep: 'text-amber-600',
    giro: 'text-teal-600',
  };

  return (
    <button
      onClick={e => { e.stopPropagation(); void handleConfirmar(); }}
      disabled={confirmando}
      className={`text-xs ${COLOR[paso.key]} hover:underline font-medium disabled:opacity-40`}
    >
      {confirmando ? 'Confirmando…' : paso.label}
    </button>
  );
};
