import { useState } from 'react';
import { minikitsService } from '../../services/firebaseService';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { Minikit } from '@ags/shared';

interface Props {
  source: Minikit;
  onClose: () => void;
  onCreated: (newId: string) => void;
}

export const DuplicateMinikitModal = ({ source, onClose, onCreated }: Props) => {
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState(`${source.nombre} (copia)`);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!codigo.trim() || !nombre.trim()) return;
    setCreating(true);
    try {
      const newId = await minikitsService.create({
        codigo: codigo.trim(),
        nombre: nombre.trim(),
        descripcion: source.descripcion ?? null,
        estado: 'en_base',
        asignadoA: null,
        requeridos: source.requeridos ? source.requeridos.map(r => ({ ...r })) : [],
        sectores: source.sectores ? [...source.sectores] : [],
        activo: true,
      });
      onCreated(newId);
    } catch {
      alert('Error al duplicar minikit');
    } finally {
      setCreating(false);
    }
  };

  const reqCount = source.requeridos?.length ?? 0;

  return (
    <Modal open title="Duplicar minikit" onClose={onClose} maxWidth="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleCreate} disabled={creating || !codigo.trim() || !nombre.trim()}>
            {creating ? 'Creando...' : 'Crear copia'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          Se creará un minikit nuevo copiando los {reqCount} artículo{reqCount !== 1 ? 's' : ''} requerido{reqCount !== 1 ? 's' : ''} de <span className="font-medium">{source.codigo}</span>.
          La copia es independiente — editarla no afecta al original. Empieza en base, sin asignar.
        </p>
        <Input label="Código *" value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="Ej: MKGC2" autoFocus />
        <Input label="Nombre *" value={nombre} onChange={e => setNombre(e.target.value)} />
      </div>
    </Modal>
  );
};
