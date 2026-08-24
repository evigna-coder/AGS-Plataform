import { useRef, useState } from 'react';
import { dispositivoFotoStorageService, type CaraFotoDispositivo } from '../../services/dispositivoFotoStorageService';

/**
 * Foto de frente y de dorso del dispositivo (2026-08-23).
 *
 * Sirven para identificarlo de un vistazo y, en las de escritorio, para ver
 * los puertos y el cableado de atrás. Es un adjunto de la ficha: no viaja al
 * portal ni participa de ningún circuito, a diferencia de fichas y loaners.
 */

export interface FotoDispositivo {
  url: string | null;
  path: string | null;
}

interface Props {
  /** Necesario para armar la ruta en Storage. En alta todavía no existe. */
  dispositivoId: string | null;
  frente: FotoDispositivo;
  dorso: FotoDispositivo;
  onChange: (cara: CaraFotoDispositivo, foto: FotoDispositivo) => void;
}

const CARAS: { cara: CaraFotoDispositivo; label: string }[] = [
  { cara: 'frente', label: 'Frente' },
  { cara: 'dorso', label: 'Dorso' },
];

export const DispositivoFotos: React.FC<Props> = ({ dispositivoId, frente, dorso, onChange }) => {
  const [subiendo, setSubiendo] = useState<CaraFotoDispositivo | null>(null);
  const inputs = {
    frente: useRef<HTMLInputElement>(null),
    dorso: useRef<HTMLInputElement>(null),
  };
  const fotoDe = (cara: CaraFotoDispositivo) => (cara === 'frente' ? frente : dorso);

  const subir = async (cara: CaraFotoDispositivo, file: File) => {
    if (!dispositivoId) return;
    setSubiendo(cara);
    try {
      const anterior = fotoDe(cara).path;
      const { url, storagePath } = await dispositivoFotoStorageService.upload(dispositivoId, cara, file, file.name);
      onChange(cara, { url, path: storagePath });
      // Recién después de que la nueva quedó arriba: si falla la subida, la
      // anterior sigue estando.
      if (anterior) await dispositivoFotoStorageService.remove(anterior);
    } catch (err) {
      console.error('[DispositivoFotos] no se pudo subir la foto:', err);
      alert('No se pudo subir la foto.');
    } finally {
      setSubiendo(null);
    }
  };

  const quitar = async (cara: CaraFotoDispositivo) => {
    const actual = fotoDe(cara);
    onChange(cara, { url: null, path: null });
    if (actual.path) await dispositivoFotoStorageService.remove(actual.path);
  };

  return (
    <div>
      <label className="block text-[11px] font-medium text-slate-500 mb-1">Fotos</label>
      {!dispositivoId && (
        <p className="text-[10px] text-slate-400 mb-1.5">
          Guardá el dispositivo primero y después cargá las fotos.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        {CARAS.map(({ cara, label }) => {
          const foto = fotoDe(cara);
          return (
            <div key={cara}>
              <span className="block text-[10px] font-mono uppercase tracking-wide text-slate-400 mb-1">{label}</span>
              {foto.url ? (
                <div className="relative group">
                  <a href={foto.url} target="_blank" rel="noreferrer">
                    <img src={foto.url} alt={`${label} del dispositivo`}
                      className="w-full h-28 object-cover rounded-lg border border-slate-200" />
                  </a>
                  <button type="button" onClick={() => void quitar(cara)}
                    className="absolute top-1 right-1 bg-white/90 text-slate-500 hover:text-red-600 rounded-full w-5 h-5 text-[11px] leading-none shadow"
                    title="Quitar la foto">✕</button>
                </div>
              ) : (
                <button type="button"
                  disabled={!dispositivoId || subiendo === cara}
                  onClick={() => inputs[cara].current?.click()}
                  className="w-full h-28 rounded-lg border border-dashed border-slate-300 text-[11px] text-slate-400 hover:border-teal-400 hover:text-teal-600 disabled:opacity-50 disabled:hover:border-slate-300">
                  {subiendo === cara ? 'Subiendo…' : '+ Foto'}
                </button>
              )}
              <input ref={inputs[cara]} type="file" accept="image/*" className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void subir(cara, f);
                }} />
            </div>
          );
        })}
      </div>
    </div>
  );
};
