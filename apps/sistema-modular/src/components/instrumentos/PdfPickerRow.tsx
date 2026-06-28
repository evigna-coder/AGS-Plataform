import { useRef } from 'react';
import { Button } from '../ui/Button';

interface Props {
  label: string;
  file: File | null;
  onPick: (file: File) => void;
}

/** Selector de un PDF con label + estado "archivo elegido / cambiar". */
export function PdfPickerRow({ label, file, onPick }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <label className="block text-[11px] font-mono uppercase tracking-wide text-slate-500 mb-1.5">
        {label}
      </label>
      {file ? (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-teal-700 font-medium truncate max-w-xs">{file.name}</span>
          <button onClick={() => fileRef.current?.click()}
            className="text-slate-500 hover:text-slate-700 underline">
            Cambiar
          </button>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          Seleccionar PDF…
        </Button>
      )}
      <input ref={fileRef} type="file" accept=".pdf" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ''; }} />
    </div>
  );
}
