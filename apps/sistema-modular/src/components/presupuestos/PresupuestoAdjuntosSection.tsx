import { useState, useRef } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../services/firebaseService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import type { AdjuntoPresupuesto, TipoAdjuntoPresupuesto } from '@ags/shared';

interface Props {
  presupuestoId: string;
  adjuntos: AdjuntoPresupuesto[];
  onAdd: (adjunto: AdjuntoPresupuesto) => void;
  onRemove: (adjuntoId: string) => void;
  onSuggestAutorizado?: () => void;
}

const TIPO_LABELS: Record<TipoAdjuntoPresupuesto, string> = {
  orden_compra: 'OC',
  autorizacion_mail: 'Autorización',
  otro: 'Otro',
};

const TIPO_COLORS: Record<TipoAdjuntoPresupuesto, string> = {
  orden_compra: 'bg-green-100 text-green-700',
  autorizacion_mail: 'bg-blue-100 text-blue-700',
  otro: 'bg-slate-100 text-slate-600',
};

export const PresupuestoAdjuntosSection = ({ presupuestoId, adjuntos, onAdd, onRemove, onSuggestAutorizado }: Props) => {
  const [uploading, setUploading] = useState(false);
  const [selectedTipo, setSelectedTipo] = useState<TipoAdjuntoPresupuesto>('orden_compra');
  const [notas, setNotas] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const storageRef = ref(storage, `presupuestos/${presupuestoId}/adjuntos/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      const adjunto: AdjuntoPresupuesto = {
        id: `adj-${Date.now()}`,
        tipo: selectedTipo,
        nombre: file.name,
        url,
        fechaCarga: new Date().toISOString(),
        notas: notas.trim() || null,
      };
      onAdd(adjunto);
      setNotas('');
      if (selectedTipo === 'orden_compra' && onSuggestAutorizado) {
        onSuggestAutorizado();
      }
    } catch (err) {
      console.error('Error subiendo adjunto:', err);
      alert('Error al subir el archivo');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleRemove = (adjId: string) => {
    if (!confirm('Eliminar este adjunto?')) return;
    onRemove(adjId);
  };

  return (
    <Card compact>
      <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-3">Adjuntos</h3>

      {adjuntos.length > 0 && (
        <div className="space-y-2 mb-4">
          {adjuntos.map(a => (
            <div key={a.id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${TIPO_COLORS[a.tipo]}`}>
                {TIPO_LABELS[a.tipo]}
              </span>
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-600 hover:underline truncate flex-1">{a.nombre}</a>
              <span className="text-[10px] text-slate-400 shrink-0">{new Date(a.fechaCarga).toLocaleDateString('es-AR')}</span>
              {a.notas && <span className="text-[10px] text-slate-400 truncate max-w-[100px]" title={a.notas}>{a.notas}</span>}
              <button onClick={() => handleRemove(a.id)} className="text-red-400 hover:text-red-600 text-xs shrink-0">&times;</button>
            </div>
          ))}
        </div>
      )}

      {/* Upload form */}
      <div className="flex items-end gap-2 flex-wrap">
        <div>
          <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Tipo</label>
          <select value={selectedTipo} onChange={e => setSelectedTipo(e.target.value as TipoAdjuntoPresupuesto)}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs">
            <option value="orden_compra">Orden de compra</option>
            <option value="autorizacion_mail">Mail autorizacion</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div className="flex-1 min-w-[120px]">
          <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Notas</label>
          <input value={notas} onChange={e => setNotas(e.target.value)} placeholder="Notas opcionales..."
            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs" />
        </div>
        <div>
          <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? 'Subiendo...' : '+ Adjuntar'}
          </Button>
        </div>
      </div>
    </Card>
  );
};
