import { useState } from 'react';
import type { QFDocumento } from '@ags/shared';
import { incrementQFVersion } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { qfDocumentosService } from '../../services/qfDocumentosService';

interface Props {
  qf: QFDocumento;
  onClose: () => void;
  onSuccess: () => void;
}

export function NuevaVersionModal({ qf, onClose, onSuccess }: Props) {
  const [cambios, setCambios] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nuevaVersion = incrementQFVersion(qf.versionActual);
  const numeroConVersion = `${qf.numeroCompleto}.${nuevaVersion}`;

  const handleSubmit = async () => {
    setError(null);
    if (!cambios.trim()) {
      setError('Ingresá qué cambia en esta versión.');
      return;
    }
    setSaving(true);
    try {
      await qfDocumentosService.crearNuevaVersion(qf.id, cambios);
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear la nueva versión');
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={() => !saving && onClose()}
      title="Nueva versión"
      maxWidth="md"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Creando…' : `Crear ${nuevaVersion}`}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
          <p className="text-[10px] font-mono uppercase tracking-wide text-slate-500">Documento</p>
          <p className="text-sm font-semibold text-slate-800">{qf.nombre}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs font-mono text-slate-500">
              {qf.numeroCompleto}.{qf.versionActual}
            </span>
            <span className="text-slate-300">→</span>
            <span className="text-xs font-mono font-semibold text-teal-700">{numeroConVersion}</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            ¿Qué cambia en esta versión?
          </label>
          <textarea
            value={cambios}
            onChange={(e) => setCambios(e.target.value)}
            rows={5}
            autoFocus
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-700"
            placeholder="Ej: Se actualiza la tabla exactitud de flujos con nuevos rangos 0.5-2.0 mL/min."
          />
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
