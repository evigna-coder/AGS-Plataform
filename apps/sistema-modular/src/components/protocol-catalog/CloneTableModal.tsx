import { useEffect, useState } from 'react';
import type { TableCatalogEntry, TableProject } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { ProjectPicker } from './ProjectPicker';
import { SYS_TYPES } from '../../utils/tableCatalogConstants';

interface Props {
  target: TableCatalogEntry | null;
  projects: TableProject[];
  defaultProjectId: string | null;
  onClose: () => void;
  onConfirm: (data: { name: string; sysType: string; projectId: string | null }) => Promise<void>;
}

/** Duplicar una tabla, con buscador de proyecto destino. */
export function CloneTableModal({ target, projects, defaultProjectId, onClose, onConfirm }: Props) {
  const [name, setName] = useState('');
  const [sysType, setSysType] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!target) return;
    setName(`${target.name} (copia)`);
    setSysType(target.sysType);
    setProjectId(target.projectId ?? defaultProjectId);
  }, [target, defaultProjectId]);

  const confirmar = async () => {
    setSaving(true);
    try { await onConfirm({ name, sysType, projectId }); } finally { setSaving(false); }
  };

  return (
    <Modal open={!!target} onClose={onClose} title="Duplicar tabla" subtitle={target?.name} maxWidth="sm"
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button onClick={confirmar} disabled={saving || !name.trim()} estado={saving ? 'guardando' : 'idle'}>Duplicar</Button>
      </>}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Nombre</label>
          <Input value={name} onChange={e => setName(e.target.value)} inputSize="sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de sistema</label>
          <Select value={sysType} onChange={e => setSysType(e.target.value)} className="w-full" selectSize="md">
            {SYS_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
        </div>
        {projects.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Proyecto</label>
            <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} />
          </div>
        )}
      </div>
    </Modal>
  );
}
