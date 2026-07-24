import { useState } from 'react';
import { ordenesTrabajoService } from '../services/firebaseService';
import type { WorkOrder, OTEstadoAdmin } from '@ags/shared';
import { OT_ESTADO_LABELS } from '@ags/shared';

/**
 * Selección múltiple y acciones masivas del listado de OTs (borrar / cambiar estado).
 *
 * Extraído de OTList para mantener la página dentro del presupuesto de 250 líneas.
 * `confirm` se inyecta (viene de `useConfirm`) para que el hook no dependa del
 * contexto de diálogos.
 */
export function useOTBulkActions(
  ordenes: WorkOrder[],
  grouped: { ot: WorkOrder }[],
  confirm: (msg: string) => Promise<boolean>,
) {
  const [selectedOTs, setSelectedOTs] = useState<Set<string>>(new Set());

  const toggleSelect = (otNum: string) => setSelectedOTs(prev => {
    const next = new Set(prev);
    if (next.has(otNum)) next.delete(otNum);
    else next.add(otNum);
    return next;
  });

  const toggleSelectAll = () => {
    if (selectedOTs.size === grouped.length) setSelectedOTs(new Set());
    else setSelectedOTs(new Set(grouped.map(g => g.ot.otNumber)));
  };

  const clearSelection = () => setSelectedOTs(new Set());

  const handleBulkDelete = async () => {
    if (selectedOTs.size === 0) return;
    if (!await confirm(`¿Eliminar ${selectedOTs.size} OTs seleccionadas?`)) return;
    try {
      for (const otNum of selectedOTs) await ordenesTrabajoService.delete(otNum);
      clearSelection();
    } catch (err) { alert(err instanceof Error ? err.message : 'Error al eliminar'); }
  };

  const handleBulkEstado = async (nuevoEstado: OTEstadoAdmin) => {
    if (selectedOTs.size === 0) return;
    if (!await confirm(`¿Cambiar ${selectedOTs.size} OTs a ${OT_ESTADO_LABELS[nuevoEstado]}?`)) return;
    try {
      const ahora = new Date().toISOString();
      for (const otNum of selectedOTs) {
        const ot = ordenes.find(o => o.otNumber === otNum);
        await ordenesTrabajoService.update(otNum, {
          estadoAdmin: nuevoEstado, estadoAdminFecha: ahora,
          estadoHistorial: [...(ot?.estadoHistorial || []), { estado: nuevoEstado, fecha: ahora, nota: 'Cambio masivo' }],
          ...(nuevoEstado === 'FINALIZADO' ? { status: 'FINALIZADO' as const } : {}),
        });
      }
      clearSelection();
    } catch { alert('Error al cambiar estados'); }
  };

  return {
    selectedOTs, toggleSelect, toggleSelectAll, clearSelection,
    handleBulkDelete, handleBulkEstado,
    allSelected: selectedOTs.size === grouped.length && grouped.length > 0,
  };
}
