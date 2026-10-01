import { useRef, useState } from 'react';
import type { FotoAdicionalDispositivo } from '@ags/shared';
import { dispositivoFotoStorageService } from '../../services/dispositivoFotoStorageService';
import { notify } from '../../utils/notify';

interface Props {
  /** Necesario para la ruta en Storage. En alta todavía no existe. */
  dispositivoId: string | null;
  fotos: FotoAdicionalDispositivo[];
  /** `persistir` = false para la nota (se guarda con Guardar cambios, no en cada tecla). */
  onChange: (fotos: FotoAdicionalDispositivo[], persistir?: boolean) => void;
}

/**
 * Fotos adicionales del dispositivo (2026-10-01): además de frente y dorso,
 * las que hagan falta (etiqueta de serie, puertos, placa GPIB, pantalla de
 * licencias…), cada una con una nota corta opcional. Se suben al elegirlas;
 * se pueden elegir varias a la vez.
 */
export const DispositivoFotosAdicionales: React.FC<Props> = ({ dispositivoId, fotos, onChange }) => {
  const input = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(0);

  const subir = async (files: File[]) => {
    if (!dispositivoId || files.length === 0) return;
    setSubiendo(files.length);
    const nuevas: FotoAdicionalDispositivo[] = [];
    for (const file of files) {
      try {
        const { url, storagePath } = await dispositivoFotoStorageService.upload(dispositivoId, 'extra', file, file.name);
        nuevas.push({ id: crypto.randomUUID(), url, path: storagePath, nota: null });
      } catch (err) {
        console.error('[DispositivoFotosAdicionales] no se pudo subir:', file.name, err);
        notify.error(`No se pudo subir ${file.name}.`);
      }
      setSubiendo(n => n - 1);
    }
    if (nuevas.length > 0) onChange([...fotos, ...nuevas]);
  };

  const quitar = async (f: FotoAdicionalDispositivo) => {
    onChange(fotos.filter(x => x.id !== f.id));
    await dispositivoFotoStorageService.remove(f.path);
  };

  const setNota = (id: string, nota: string) =>
    onChange(fotos.map(x => (x.id === id ? { ...x, nota: nota || null } : x)), false);

  return (
    <div className="mt-3">
      <span className="block text-[10px] font-mono uppercase tracking-wide text-slate-400 mb-1">
        Otras fotos{fotos.length > 0 ? ` · ${fotos.length}` : ''}
      </span>
      <div className="grid grid-cols-4 gap-2">
        {fotos.map(f => (
          <div key={f.id} className="relative group">
            <a href={f.url} target="_blank" rel="noreferrer">
              <img src={f.url} alt={f.nota ?? 'Foto del dispositivo'} className="w-full h-20 object-cover rounded-lg border border-slate-200" />
            </a>
            <button type="button" onClick={() => void quitar(f)} title="Quitar la foto"
              className="absolute top-1 right-1 bg-white/90 text-slate-500 hover:text-red-600 rounded-full w-5 h-5 text-[11px] leading-none shadow">✕</button>
            <input value={f.nota ?? ''} onChange={e => setNota(f.id, e.target.value)} placeholder="Nota"
              className="mt-1 w-full border border-slate-200 rounded px-1.5 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-teal-500" />
          </div>
        ))}
        <button type="button" disabled={!dispositivoId || subiendo > 0} onClick={() => input.current?.click()}
          className="h-20 rounded-lg border border-dashed border-slate-300 text-[11px] text-slate-400 hover:border-teal-400 hover:text-teal-600 disabled:opacity-50 disabled:hover:border-slate-300">
          {subiendo > 0 ? `Subiendo ${subiendo}…` : '+ Fotos'}
        </button>
      </div>
      <input ref={input} type="file" accept="image/*" multiple className="hidden"
        onChange={e => { const fs = Array.from(e.target.files ?? []); e.target.value = ''; void subir(fs); }} />
    </div>
  );
};
