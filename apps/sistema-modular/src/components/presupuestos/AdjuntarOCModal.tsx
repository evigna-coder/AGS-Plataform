import { useState, useRef } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../services/firebase';
import { presupuestosService } from '../../services/firebaseService';
import type { AdjuntoPresupuesto } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface Props {
  open: boolean;
  presupuestoId: string;
  presupuestoNumero: string;
  currentOCNumero?: string | null;
  currentAdjuntos: AdjuntoPresupuesto[];
  onClose: () => void;
  onSaved?: () => void;
}

export const AdjuntarOCModal: React.FC<Props> = ({
  open, presupuestoId, presupuestoNumero, currentOCNumero, currentAdjuntos, onClose, onSaved,
}) => {
  const [ocNumero, setOcNumero] = useState(currentOCNumero || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [adjuntos, setAdjuntos] = useState<AdjuntoPresupuesto[]>(
    currentAdjuntos.filter(a => a.tipo === 'orden_compra')
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const path = `presupuestos/${presupuestoId}/adjuntos/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        const adj: AdjuntoPresupuesto = {
          id: `adj-${Date.now()}`,
          tipo: 'orden_compra',
          nombre: file.name,
          url,
          fechaCarga: new Date().toISOString(),
          notas: null,
        };
        setAdjuntos(prev => [...prev, adj]);
      }
    } catch (err) {
      console.error('Error subiendo archivo:', err);
      alert('Error al subir el archivo');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleRemove = (id: string) => {
    setAdjuntos(prev => prev.filter(a => a.id !== id));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Merge OC adjuntos with existing non-OC adjuntos
      const otherAdjuntos = currentAdjuntos.filter(a => a.tipo !== 'orden_compra');
      const allAdjuntos = [...otherAdjuntos, ...adjuntos];
      await presupuestosService.update(presupuestoId, {
        ordenCompraNumero: ocNumero.trim() || null,
        adjuntos: allAdjuntos,
      });
      onSaved?.();
      onClose();
    } catch {
      alert('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Orden de Compra" subtitle={presupuestoNumero} maxWidth="md">
      <div className="space-y-4">
        {/* Numero de OC */}
        <Input
          label="Numero de Orden de Compra"
          value={ocNumero}
          onChange={e => setOcNumero(e.target.value)}
          placeholder="Ej: O-000100445302"
        />

        {/* Adjuntos OC existentes */}
        {adjuntos.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-mono font-medium text-slate-500 uppercase tracking-wide">Archivos adjuntos</p>
            {adjuntos.map(a => (
              <div key={a.id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700">OC</span>
                <a href={a.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-teal-600 hover:text-teal-800 font-medium truncate flex-1">
                  {a.nombre}
                </a>
                <button onClick={() => handleRemove(a.id)} className="text-red-400 hover:text-red-600 text-xs">&times;</button>
              </div>
            ))}
          </div>
        )}

        {/* Upload */}
        <div>
          <p className="text-[10px] font-mono font-medium text-slate-500 uppercase tracking-wide mb-1">Adjuntar archivo</p>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
            onChange={e => handleUpload(e.target.files)}
            className="text-xs text-slate-600 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
          />
          {uploading && <p className="text-[10px] text-teal-600 mt-1">Subiendo...</p>}
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
    </Modal>
  );
};
