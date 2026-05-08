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

function toIsoDate(iso: string): string {
  // Convierte una fecha ISO completa (con tiempo) a yyyy-mm-dd para input type=date
  try { return new Date(iso).toISOString().slice(0, 10); } catch { return iso.slice(0, 10); }
}

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function EditarQFModal({ qf, onClose, onSuccess }: Props) {
  const [nombre, setNombre] = useState(qf.nombre);
  const [descripcion, setDescripcion] = useState(qf.descripcion ?? '');
  const [estado, setEstado] = useState<QFEstado>(qf.estado);
  const [overrideFechaAlta, setOverrideFechaAlta] = useState(false);
  const [fechaAlta, setFechaAlta] = useState<string>(toIsoDate(qf.fechaCreacion));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fechaActualIso = toIsoDate(qf.fechaCreacion);
  const fechaAltaCambiada = overrideFechaAlta && fechaAlta !== fechaActualIso;

  const dirty =
    nombre.trim() !== qf.nombre ||
    (descripcion || '').trim() !== (qf.descripcion ?? '') ||
    estado !== qf.estado ||
    fechaAltaCambiada;

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
      if (fechaAltaCambiada) {
        await qfDocumentosService.updateFechaCreacion(qf.id, fechaAlta);
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

        <div className="pt-1 border-t border-slate-100">
          <label className="flex items-center gap-2 text-[11px] text-slate-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={overrideFechaAlta}
              onChange={(e) => setOverrideFechaAlta(e.target.checked)}
              className="rounded border-slate-300"
            />
            Modificar fecha de alta
          </label>
          {overrideFechaAlta && (
            <div className="mt-1.5">
              <input
                type="date"
                value={fechaAlta}
                onChange={(e) => setFechaAlta(e.target.value)}
                max={todayISO()}
                className="text-xs border border-slate-300 rounded-lg px-2 py-1 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">
                Actualiza tanto la fecha del documento como la fecha de la primera entrada del historial. Las versiones posteriores conservan su fecha original.
              </p>
            </div>
          )}
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
