import { useState, useCallback } from 'react';
import { requerimientosService } from '../services/firebaseService';
import type { RequerimientoCompra, UrgenciaRequerimiento } from '@ags/shared';

type EditableField = 'cantidad' | 'urgencia' | 'proveedorSugeridoId';

export interface EditingCell {
  id: string;
  field: EditableField;
}

export function useRequerimientoInlineEdit() {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const startEdit = useCallback((req: RequerimientoCompra, field: EditableField) => {
    setEditingCell({ id: req.id, field });
    if (field === 'cantidad') setEditValue(String(req.cantidad));
    else if (field === 'urgencia') setEditValue(req.urgencia ?? 'media');
    else if (field === 'proveedorSugeridoId') setEditValue(req.proveedorSugeridoId ?? '');
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditValue('');
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingCell) return;
    setSaving(true);
    try {
      const { id, field } = editingCell;
      if (field === 'cantidad') {
        const qty = parseInt(editValue, 10);
        if (!isNaN(qty) && qty > 0) await requerimientosService.update(id, { cantidad: qty });
      } else if (field === 'urgencia') {
        await requerimientosService.update(id, { urgencia: editValue as UrgenciaRequerimiento });
      } else if (field === 'proveedorSugeridoId') {
        await requerimientosService.update(id, {
          proveedorSugeridoId: editValue || null,
        });
      }
      setEditingCell(null);
      setEditValue('');
    } catch (err) {
      console.error('[useRequerimientoInlineEdit] saveEdit:', err);
    } finally {
      setSaving(false);
    }
  }, [editingCell, editValue]);

  return { editingCell, editValue, setEditValue, saving, startEdit, cancelEdit, saveEdit };
}
