import { useRef, useState } from 'react';
import type { FotoAdicionalDispositivo } from '@ags/shared';
import { dispositivoFotoStorageService } from '../../services/dispositivoFotoStorageService';
import { notify } from '../../utils/notify';

interface Props {
  /** Necesario para la ruta en Storage. En alta todavía no existe. */
  dispositivoId: string | null;
  fotos: FotoAdicionalDispositivo[];
  onChange: (fotos: FotoAdicionalDispositivo[]) => void;
}

/**
 * Fotos del dispositivo (2026-10-01): una sola galería, sin frente/dorso, sin
 * orden ni descripción. Se suben al elegirlas (varias a la vez) y se ven
 * grandes; un clic abre la foto completa.
 */
export const DispositivoGaleria: React.FC<Props> = ({ dispositivoId, fotos, onChange }) => {
  const input = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(0);

  const subir = async (files: File[]) => {
    if (!dispositivoId || files.length === 0) return;
    setSubiendo(files.length);
    const nuevas: FotoAdicionalDispositivo[] = [];
    for (const file of files) {
      try {
        const { url, storagePath } = await dispositivoFotoStorageService.upload(dispositivoId, file, file.name);
        nuevas.push({ id: crypto.randomUUID(), url, path: storagePath });
      } catch (err) {
        console.error('[DispositivoGaleria] no se pudo subir:', file.name, err);
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

  return (
    <div>
      <label className="block text-[11px] font-medium text-slate-500 mb-1">
        Fotos{fotos.length > 0 ? ` · ${fotos.length}` : ''}
      </label>
      {!dispositivoId && (
        <p className="text-[10px] text-slate-400 mb-1.5">Guardá el dispositivo primero y después cargá las fotos.</p>
      )}
      <div className="grid grid-cols-3 gap-2">
        {fotos.map(f => (
          <div key={f.id} className="relative group">
            <a href={f.url} target="_blank" rel="noreferrer" title="Ver la foto completa">
              <img src={f.url} alt="Foto del dispositivo" loading="lazy"
                className="w-full h-36 object-cover rounded-lg border border-slate-200 hover:border-teal-400" />
            </a>
            <button type="button" onClick={() => void quitar(f)} title="Quitar la foto"
              className="absolute top-1 right-1 bg-white/90 text-slate-500 hover:text-red-600 rounded-full w-5 h-5 text-[11px] leading-none shadow">✕</button>
          </div>
        ))}
        <button type="button" disabled={!dispositivoId || subiendo > 0} onClick={() => input.current?.click()}
          className="h-36 rounded-lg border border-dashed border-slate-300 text-[11px] text-slate-400 hover:border-teal-400 hover:text-teal-600 disabled:opacity-50 disabled:hover:border-slate-300">
          {subiendo > 0 ? `Subiendo ${subiendo}…` : '+ Fotos'}
        </button>
      </div>
      <input ref={input} type="file" accept="image/*" multiple className="hidden"
        onChange={e => { const fs = Array.from(e.target.files ?? []); e.target.value = ''; void subir(fs); }} />
    </div>
  );
};
