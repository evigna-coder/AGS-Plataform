import { useState } from 'react';
import { importacionesService } from '../../services/firebaseService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import type { Importacion, DocumentoImportacion } from '@ags/shared';

interface Props {
  imp: Importacion;
  onUpdate: () => void;
}

const TIPOS_DOCUMENTO = [
  { value: 'invoice', label: 'Invoice' },
  { value: 'packing_list', label: 'Packing List' },
  { value: 'bl', label: 'B/L' },
  { value: 'certificado_origen', label: 'Certificado de origen' },
  { value: 'otro', label: 'Otro' },
];

export const ImportacionDocumentosSection: React.FC<Props> = ({ imp, onUpdate }) => {
  const [saving, setSaving] = useState(false);
  const [newDoc, setNewDoc] = useState<Partial<DocumentoImportacion> | null>(null);

  const handleAdd = () => {
    setNewDoc({ tipo: 'invoice', nombre: '', fecha: '', notas: '' });
  };

  const handleSaveNew = async () => {
    if (!newDoc?.nombre) { alert('Ingresa un nombre'); return; }
    try {
      setSaving(true);
      const documento: DocumentoImportacion = {
        id: crypto.randomUUID(),
        tipo: newDoc.tipo || 'otro',
        nombre: newDoc.nombre || '',
        url: newDoc.url || null,
        fecha: newDoc.fecha || null,
        notas: newDoc.notas || null,
      };
      await importacionesService.update(imp.id, {
        documentos: [...(imp.documentos || []), documento],
      });
      setNewDoc(null);
      onUpdate();
    } catch (err) {
      alert('Error al agregar documento');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm('Eliminar este documento?')) return;
    try {
      setSaving(true);
      await importacionesService.update(imp.id, {
        documentos: (imp.documentos || []).filter(d => d.id !== docId),
      });
      onUpdate();
    } catch (err) {
      alert('Error al eliminar documento');
    } finally {
      setSaving(false);
    }
  };

  const tipoLabel = (tipo: string) => TIPOS_DOCUMENTO.find(t => t.value === tipo)?.label || tipo;

  return (
    <Card
      title="Documentos"
      compact
      actions={<Button variant="ghost" size="sm" onClick={handleAdd}>+ Agregar</Button>}
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-center text-[11px] font-medium text-slate-400 tracking-wider py-2 pr-3">Tipo</th>
              <th className="text-center text-[11px] font-medium text-slate-400 tracking-wider py-2 pr-3">Nombre</th>
              <th className="text-center text-[11px] font-medium text-slate-400 tracking-wider py-2 pr-3">Fecha</th>
              <th className="text-center text-[11px] font-medium text-slate-400 tracking-wider py-2 pr-3">Notas</th>
              <th className="text-center text-[11px] font-medium text-slate-400 tracking-wider py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(imp.documentos || []).map(d => (
              <tr key={d.id} className="border-b border-slate-50">
                <td className="text-xs py-2 pr-3">
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {tipoLabel(d.tipo)}
                  </span>
                </td>
                <td className="text-xs py-2 pr-3 text-slate-700">
                  {d.url ? (
                    <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">{d.nombre}</a>
                  ) : d.nombre}
                </td>
                <td className="text-xs py-2 pr-3 text-slate-500">{d.fecha ? new Date(d.fecha).toLocaleDateString('es-AR') : '-'}</td>
                <td className="text-xs py-2 pr-3 text-slate-500">{d.notas || '-'}</td>
                <td className="text-xs py-2 text-center">
                  <button onClick={() => handleDelete(d.id)} className="text-red-500 hover:text-red-700 text-[10px]" disabled={saving}>Eliminar</button>
                </td>
              </tr>
            ))}
            {newDoc && (
              <tr className="border-b border-slate-50 bg-teal-50/30">
                <td className="py-2 pr-2">
                  <select className="text-xs border border-slate-300 rounded px-2 py-1" value={newDoc.tipo || 'invoice'} onChange={e => setNewDoc(p => ({ ...p, tipo: e.target.value }))}>
                    {TIPOS_DOCUMENTO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </td>
                <td className="py-2 pr-2">
                  <input className="w-full text-xs border border-slate-300 rounded px-2 py-1" placeholder="Nombre" value={newDoc.nombre || ''} onChange={e => setNewDoc(p => ({ ...p, nombre: e.target.value }))} />
                </td>
                <td className="py-2 pr-2">
                  <input type="date" className="text-xs border border-slate-300 rounded px-2 py-1" value={newDoc.fecha || ''} onChange={e => setNewDoc(p => ({ ...p, fecha: e.target.value }))} />
                </td>
                <td className="py-2 pr-2">
                  <input className="w-full text-xs border border-slate-300 rounded px-2 py-1" placeholder="Notas" value={newDoc.notas || ''} onChange={e => setNewDoc(p => ({ ...p, notas: e.target.value }))} />
                </td>
                <td className="py-2 text-center">
                  <div className="flex gap-1 justify-end">
                    <button onClick={handleSaveNew} className="text-teal-600 hover:text-teal-800 text-[10px] font-medium" disabled={saving}>Guardar</button>
                    <button onClick={() => setNewDoc(null)} className="text-slate-400 hover:text-slate-600 text-[10px]">Cancelar</button>
                  </div>
                </td>
              </tr>
            )}
            {(imp.documentos || []).length === 0 && !newDoc && (
              <tr>
                <td colSpan={5} className="text-center py-6 text-xs text-slate-400">Sin documentos</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
