import { useState, useEffect, useRef, type FC } from 'react';
import type { CertificadoIngeniero, CategoriaPatron } from '@ags/shared';
import { CATEGORIA_PATRON_LABELS } from '@ags/shared';
import { certificadosIngenieroService } from '../services/personalService';
import { useConfirm } from './ui/ConfirmDialog';

const CATEGORIAS: CategoriaPatron[] = ['gc', 'hplc', 'uv', 'osmometro', 'polarimetro'];

interface Props {
  ingenieroId: string;
  ingenieroNombre: string;
}

function estadoCert(vencimiento: string | null): 'vigente' | 'por_vencer' | 'vencido' | 'sin_fecha' {
  if (!vencimiento) return 'sin_fecha';
  const diff = Math.ceil((new Date(vencimiento).getTime() - Date.now()) / 86400000);
  if (diff < 0) return 'vencido';
  if (diff <= 30) return 'por_vencer';
  return 'vigente';
}

const ESTADO_BADGE: Record<string, string> = {
  vigente: 'bg-emerald-100 text-emerald-700',
  por_vencer: 'bg-amber-100 text-amber-700',
  vencido: 'bg-red-100 text-red-700',
  sin_fecha: 'bg-slate-100 text-slate-500',
};

const ESTADO_LABEL: Record<string, string> = {
  vigente: 'Vigente',
  por_vencer: 'Por vencer',
  vencido: 'Vencido',
  sin_fecha: 'Sin fecha',
};

export const IngenieroCertificados: FC<Props> = ({ ingenieroId, ingenieroNombre }) => {
  const [certs, setCerts] = useState<CertificadoIngeniero[]>([]);
  const [showForm, setShowForm] = useState(false);
  const confirm = useConfirm();
  const [categoria, setCategoria] = useState<CategoriaPatron>('gc');
  const [descripcion, setDescripcion] = useState('');
  const [fechaEmision, setFechaEmision] = useState('');
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    unsubRef.current?.();
    unsubRef.current = certificadosIngenieroService.subscribeByIngeniero(
      ingenieroId, setCerts,
      (err) => console.error('Error cargando certificados:', err),
    );
    return () => { unsubRef.current?.(); };
  }, [ingenieroId]);

  const resetForm = () => {
    setCategoria('gc'); setDescripcion(''); setFechaEmision(''); setFechaVencimiento('');
    setFile(null); if (fileRef.current) fileRef.current.value = ''; setShowForm(false);
  };

  const handleCreate = async () => {
    if (!file || !descripcion.trim()) return;
    setSaving(true);
    try {
      await certificadosIngenieroService.create({
        ingenieroId, ingenieroNombre, categoria,
        descripcion: descripcion.trim(),
        fechaEmision: fechaEmision || null,
        fechaVencimiento: fechaVencimiento || null,
      }, file);
      resetForm();
    } catch { alert('Error al subir certificado'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (cert: CertificadoIngeniero) => {
    if (!await confirm(`¿Eliminar certificado "${cert.descripcion}"?`)) return;
    try { await certificadosIngenieroService.delete(cert.id, cert.certificadoStoragePath); }
    catch { alert('Error al eliminar'); }
  };

  return (
    <div className="mt-1 border-t border-slate-100 pt-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Certificados ({certs.length})</span>
        <button onClick={() => setShowForm(v => !v)} className="text-teal-600 hover:underline font-medium text-[11px]">
          {showForm ? 'Cancelar' : '+ Agregar'}
        </button>
      </div>
      {showForm && (
        <div className="bg-slate-50 rounded p-2 mb-2 space-y-1.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Categoría</label>
              <select value={categoria} onChange={e => setCategoria(e.target.value as CategoriaPatron)}
                className="w-full border border-slate-300 rounded px-2 py-1 text-xs bg-white">
                {CATEGORIAS.map(c => <option key={c} value={c}>{CATEGORIA_PATRON_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Descripción *</label>
              <input type="text" value={descripcion} onChange={e => setDescripcion(e.target.value)}
                className="w-full border border-slate-300 rounded px-2 py-1 text-xs" placeholder="Ej: Curso GC avanzado 2025" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Fecha Emisión</label>
              <input type="date" value={fechaEmision} onChange={e => setFechaEmision(e.target.value)}
                className="w-full border border-slate-300 rounded px-2 py-1 text-xs" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Fecha Vencimiento</label>
              <input type="date" value={fechaVencimiento} onChange={e => setFechaVencimiento(e.target.value)}
                className="w-full border border-slate-300 rounded px-2 py-1 text-xs" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Archivo PDF *</label>
            <input ref={fileRef} type="file" accept=".pdf" onChange={e => setFile(e.target.files?.[0] || null)} className="w-full text-xs" />
          </div>
          <div className="flex justify-end">
            <button onClick={handleCreate} disabled={saving || !file || !descripcion.trim()}
              className="bg-teal-600 text-white px-3 py-1 rounded text-[11px] font-medium disabled:opacity-50 hover:bg-teal-700">
              {saving ? 'Subiendo...' : 'Subir certificado'}
            </button>
          </div>
        </div>
      )}
      {certs.length > 0 && (
        <div className="space-y-1">
          {certs.map(cert => {
            const estado = estadoCert(cert.fechaVencimiento);
            return (
              <div key={cert.id} className="flex items-center gap-2 text-[11px] bg-slate-50/60 rounded px-2 py-1">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${ESTADO_BADGE[estado]}`}>
                  {CATEGORIA_PATRON_LABELS[cert.categoria]}
                </span>
                <span className="text-slate-700 truncate flex-1">{cert.descripcion}</span>
                {cert.fechaVencimiento && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${ESTADO_BADGE[estado]}`}>
                    {ESTADO_LABEL[estado]} — {new Date(cert.fechaVencimiento).toLocaleDateString('es-AR')}
                  </span>
                )}
                <a href={cert.certificadoUrl} target="_blank" rel="noopener noreferrer"
                  className="text-blue-600 hover:underline shrink-0">Ver</a>
                <button onClick={() => handleDelete(cert)} className="text-red-500 hover:underline shrink-0">Eliminar</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
