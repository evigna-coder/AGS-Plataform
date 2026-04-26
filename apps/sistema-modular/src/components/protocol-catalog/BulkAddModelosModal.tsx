import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ModelosPicker } from './ModelosPicker';
import { categoriasEquipoService } from '../../services/firebaseService';
import type { CategoriaEquipo, TableProject } from '@ags/shared';

interface Props {
  open: boolean;
  project: TableProject | null;
  onClose: () => void;
  /** Aplica los modelos. Devuelve el resumen para mostrarlo. */
  onConfirm: (modelos: string[]) => Promise<{ updated: number; total: number }>;
}

export function BulkAddModelosModal({ open, project, onClose, onConfirm }: Props) {
  const [categorias, setCategorias] = useState<CategoriaEquipo[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ updated: number; total: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelected([]);
    setResult(null);
    categoriasEquipoService.getAll().then(setCategorias);
  }, [open]);

  const handleConfirm = async () => {
    if (selected.length === 0) return;
    setSaving(true);
    try {
      const res = await onConfirm(selected);
      setResult(res);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Agregar modelos a tablas"
      subtitle={project?.name}
      maxWidth="md"
      footer={
        result ? (
          <Button onClick={handleClose}>Cerrar</Button>
        ) : (
          <>
            <Button variant="outline" onClick={handleClose} disabled={saving}>Cancelar</Button>
            <Button onClick={handleConfirm} disabled={saving || selected.length === 0}>
              {saving ? 'Aplicando...' : selected.length > 0 ? `Agregar ${selected.length}` : 'Agregar'}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-2 py-2">
          <p className="text-sm text-slate-700">
            Se agregaron los modelos a <strong>{result.updated}</strong> de {result.total} tabla(s) del proyecto.
          </p>
          {result.updated < result.total && (
            <p className="text-xs text-slate-400">
              Las restantes ya tenían los modelos seleccionados.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Los modelos seleccionados se agregan a <strong>todas las tablas</strong> de este proyecto.
            No se reemplazan ni se duplican los modelos ya asignados.
          </p>
          <ModelosPicker
            selected={selected}
            onChange={setSelected}
            categorias={categorias}
            maxHeight="max-h-72"
          />
        </div>
      )}
    </Modal>
  );
}
