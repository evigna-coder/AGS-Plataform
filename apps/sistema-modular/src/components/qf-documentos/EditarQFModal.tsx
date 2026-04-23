import { useState } from 'react';
import type { QFDocumento, QFEstado } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { qfDocumentosService } from '../../services/qfDocumentosService';

interface Props {
  qf: QFDocumento;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditarQFModal({ qf, onClose, onSuccess }: Props) {
  const [nombre, setNombre] = useState(qf.nombre);
  const [descripcion, setDescripcion] = useState(qf.descripcion ?? '');
  const [estado, setEstado] = useState<QFEstado>(qf.estado);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    nombre.trim() !== qf.nombre ||
    (descripcion || '').trim() !== (qf.descripcion ?? '') ||
    estado !== qf.estado;

  const handleSubmit = async () => {
    setError(null);
    if (!nombre.trim()) {
      setError('El nombre no puede quedar vacío.');
      return;
    }
    setSaving(true);
    try {
      if (nombre.trim() !== qf.nombre || (descripcion || '').trim() !== (qf.descripcion ?? '')) {
        await qfDocumentosService.updateMetadata(qf.id, { nombre, descripcion });
      }
      if (estado !== qf.estado) {
        await qfDocumentosService.setEstado(qf.id, estado);
      }
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al actualizar');
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={() => !saving && onClose()}
      title={`Editar ${qf.numeroCompleto}`}
      maxWidth="md"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving || !dirty}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-[10px] text-slate-400">
          Editar nombre/descripción no crea nueva versión. Para registrar un cambio, usá "Nueva versión".
        </p>

        <Input
          label="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={3}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-700"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
          <div className="flex gap-2">
            <button
              onClick={() => setEstado('vigente')}
              type="button"
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                estado === 'vigente'
                  ? 'bg-teal-50 border-teal-300 text-teal-700'
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              Vigente
            </button>
            <button
              onClick={() => setEstado('obsoleto')}
              type="button"
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                estado === 'obsoleto'
                  ? 'bg-red-50 border-red-300 text-red-700'
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              Obsoleto
            </button>
          </div>
          <p className="mt-1 text-[10px] text-slate-400">
            Cambiar a obsoleto preserva el historial completo; el documento sale del listado de vigentes pero sigue consultable.
          </p>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
