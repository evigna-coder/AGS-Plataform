import { useState, useRef } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { importacionesService, storage } from '../../services/firebaseService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import type { Importacion, DocumentoImportacion } from '@ags/shared';
import { useConfirm } from '../ui/ConfirmDialog';

interface Props {
  imp: Importacion;
  onUpdate: () => void;
}

const TIPOS_DOCUMENTO = [
  { value: 'invoice', label: 'Invoice' },
  { value: 'packing_list', label: 'Packing List' },
  { value: 'bl', label: 'B/L' },
  { value: 'despacho', label: 'Despacho' },
  { value: 'certificado_origen', label: 'Certificado de origen' },
  { value: 'otro', label: 'Otro' },
];

const tipoLabel = (tipo: string) => TIPOS_DOCUMENTO.find(t => t.value === tipo)?.label || tipo;

export const ImportacionDocumentosSection: React.FC<Props> = ({ imp, onUpdate }) => {
  const [uploading, setUploading] = useState(false);
  const [tipo, setTipo] = useState('invoice');
  const [notas, setNotas] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();
  const docs = imp.documentos || [];

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const storageRef = ref(storage, `sistema-modular/importaciones/${imp.id}/documentos/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      const documento: DocumentoImportacion = {
        id: crypto.randomUUID(),
        tipo,
        nombre: file.name,
        url,
        fecha: new Date().toISOString().slice(0, 10),
        notas: notas.trim() || null,
      };
      await importacionesService.update(imp.id, { documentos: [...docs, documento] });
      setNotas('');
      onUpdate();
    } catch (err) {
      console.error('Error subiendo documento:', err);
      alert('Error al subir el documento');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = async (docId: string) => {
    if (!await confirm('¿Eliminar este documento?')) return;
    try {
      await importacionesService.update(imp.id, { documentos: docs.filter(d => d.id !== docId) });
      onUpdate();
    } catch {
      alert('Error al eliminar documento');
    }
  };

  return (
    <Card title="Documentos" compact>
      {docs.length > 0 ? (
        <div className="space-y-2 mb-3">
          {docs.map(d => (
            <div key={d.id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">{tipoLabel(d.tipo)}</span>
              {d.url
                ? <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-600 hover:underline truncate flex-1">{d.nombre}</a>
                : <span className="text-xs text-slate-700 truncate flex-1">{d.nombre}</span>}
              <span className="text-[10px] text-slate-400 shrink-0">{d.fecha ? new Date(d.fecha).toLocaleDateString('es-AR') : ''}</span>
              {d.notas && <span className="text-[10px] text-slate-400 truncate max-w-[120px]" title={d.notas}>{d.notas}</span>}
              <button onClick={() => handleDelete(d.id)} className="text-red-400 hover:text-red-600 text-sm shrink-0">×</button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400 mb-3">Sin documentos adjuntos.</p>
      )}

      <div className="flex items-end gap-2 flex-wrap border-t border-slate-100 pt-3">
        <div>
          <label className="text-[10px] font-mono uppercase tracking-wide text-slate-400 mb-0.5 block">Tipo</label>
          <select value={tipo} onChange={e => setTipo(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs">
            {TIPOS_DOCUMENTO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[120px]">
          <label className="text-[10px] font-mono uppercase tracking-wide text-slate-400 mb-0.5 block">Notas</label>
          <input value={notas} onChange={e => setNotas(e.target.value)} placeholder="Opcional..."
            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs" />
        </div>
        <div>
          <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? 'Subiendo...' : '+ Adjuntar archivo'}
          </Button>
        </div>
      </div>
    </Card>
  );
};
