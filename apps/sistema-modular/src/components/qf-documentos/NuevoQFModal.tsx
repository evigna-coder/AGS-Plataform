import { useState } from 'react';
import type { QFTipo } from '@ags/shared';
import { QF_TIPO_LABELS, formatQFNumeroCompleto } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { qfDocumentosService } from '../../services/qfDocumentosService';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  defaultTipo?: QFTipo;
  defaultFamilia?: number;
}

export function NuevoQFModal({ open, onClose, onCreated, defaultTipo = 'QF', defaultFamilia = 7 }: Props) {
  const [tipo, setTipo] = useState<QFTipo>(defaultTipo);
  const [familia, setFamilia] = useState<string>(String(defaultFamilia));
  const [numero, setNumero] = useState('');
  const [versionInicial, setVersionInicial] = useState('01');
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [cambios, setCambios] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const familiaNum = Number(familia);
  const numeroPadded = numero.replace(/\D/g, '').slice(0, 4).padStart(4, '0');
  const versionPadded = versionInicial.replace(/\D/g, '').padStart(2, '0').slice(-2) || '01';
  const preview = numero && !isNaN(familiaNum)
    ? `${formatQFNumeroCompleto(tipo, familiaNum, numeroPadded)}.${versionPadded}`
    : '—';

  const reset = () => {
    setTipo(defaultTipo); setFamilia(String(defaultFamilia));
    setNumero(''); setVersionInicial('01');
    setNombre(''); setDescripcion(''); setCambios('');
    setError(null); setSaving(false);
  };

  const handleClose = () => { if (!saving) { reset(); onClose(); } };

  const handleSubmit = async () => {
    setError(null);
    if (!numero.trim() || !nombre.trim() || !cambios.trim() || isNaN(familiaNum)) {
      setError('Completá tipo, familia, número, nombre y descripción del cambio inicial.');
      return;
    }
    setSaving(true);
    try {
      await qfDocumentosService.create({
        tipo, familia: familiaNum, numero: numeroPadded,
        nombre, descripcion: descripcion || null, cambiosIniciales: cambios,
        versionInicial: versionPadded,
      });
      reset();
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear');
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Nuevo documento QF"
      maxWidth="md"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={handleClose} disabled={saving}>Cancelar</Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving}>{saving ? 'Creando…' : 'Crear'}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-4 gap-2">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wide text-slate-500 mb-1">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as QFTipo)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
            >
              {(Object.keys(QF_TIPO_LABELS) as QFTipo[]).map(t => (
                <option key={t} value={t}>{QF_TIPO_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <Input
            label="Familia"
            value={familia}
            onChange={(e) => setFamilia(e.target.value.replace(/\D/g, '').slice(0, 2))}
            placeholder="7"
            inputMode="numeric"
          />
          <Input
            label="Número"
            value={numero}
            onChange={(e) => setNumero(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="0404"
            inputMode="numeric"
          />
          <Input
            label="Versión"
            value={versionInicial}
            onChange={(e) => setVersionInicial(e.target.value.replace(/\D/g, '').slice(0, 2))}
            placeholder="01"
            inputMode="numeric"
          />
        </div>

        <div className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
          <p className="text-[10px] font-mono uppercase tracking-wide text-slate-500">Vista previa</p>
          <p className="text-sm font-mono text-teal-700">{preview}</p>
        </div>

        <Input
          label="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej: Tabla exactitud de flujos HPLC"
        />

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Descripción (opcional)</label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={2}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-700"
            placeholder="Breve detalle del documento"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Descripción de la versión {versionPadded}
          </label>
          <textarea
            value={cambios}
            onChange={(e) => setCambios(e.target.value)}
            rows={3}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-700"
            placeholder={versionPadded === '01' ? 'Qué contiene esta primera versión' : 'Qué contiene esta versión (resumen al día de alta)'}
          />
          <p className="mt-1 text-[10px] text-slate-400">
            Se guarda como primera entrada del historial. Las versiones anteriores no se registran retroactivamente.
          </p>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
