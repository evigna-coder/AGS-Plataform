import { useState, type DragEvent, type ReactNode } from 'react';

interface Props {
  /** Archivos soltados (ya filtrados: nunca vacío). */
  onArchivos: (files: File[]) => void;
  /** Se soltó algo que no trae archivos (ej. un mail arrastrado directo desde Outlook). */
  onSinArchivos?: () => void;
  deshabilitado?: boolean;
  texto?: string;
  className?: string;
  children?: ReactNode;
}

/**
 * Zona para soltar archivos (2026-09-19). Envuelve el selector de archivos de
 * un modal: lo que se arrastra encima cae en `onArchivos`, con el mismo
 * tratamiento que lo elegido a mano. El selector sigue funcionando.
 */
export function ZonaArrastre({ onArchivos, onSinArchivos, deshabilitado = false, texto = 'o soltá los archivos acá', className = '', children }: Props) {
  const [encima, setEncima] = useState(false);

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (deshabilitado) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!encima) setEncima(true);
  };
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    // Solo cuando sale del contenedor, no al pasar entre hijos.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setEncima(false);
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    if (deshabilitado) return;
    e.preventDefault();
    setEncima(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length > 0) onArchivos(files);
    else onSinArchivos?.();
  };

  return (
    <div onDragOver={onDragOver} onDragEnter={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
      className={`rounded-lg border-2 border-dashed px-3 py-2 transition-colors ${
        encima ? 'border-teal-500 bg-teal-50/60' : 'border-slate-200 bg-slate-50/40'} ${className}`}>
      {children}
      <p className={`text-[10px] mt-1 ${encima ? 'text-teal-700 font-medium' : 'text-slate-400'}`}>
        {encima ? 'Soltá para adjuntar' : texto}
      </p>
    </div>
  );
}
