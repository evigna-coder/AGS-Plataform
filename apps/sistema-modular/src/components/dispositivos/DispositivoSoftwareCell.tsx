import type { Dispositivo } from '@ags/shared';
import { softwareDeDispositivo } from '@ags/shared';

/**
 * Resumen del software del dispositivo para el listado (2026-08-23).
 *
 * Es el dato más consultado del módulo, así que va en la grilla y no escondido
 * en la ficha. Se muestran los primeros y el resto se cuenta: una máquina con
 * tres entornos puede tener ocho productos y la fila se volvería ilegible.
 * El detalle completo, con qué corre en cada sistema, está en el tooltip y en
 * la ficha.
 */
export const DispositivoSoftwareCell: React.FC<{ dispositivo: Dispositivo; max?: number }> = ({
  dispositivo, max = 3,
}) => {
  const software = softwareDeDispositivo(dispositivo);
  if (software.length === 0) return <span className="text-slate-300">—</span>;

  const detalle = software
    .map(sw => `${sw.entorno}${sw.entornoTipo === 'virtual' ? ' (VM)' : ''}: ${sw.nombre}${sw.version ? ` ${sw.version}` : ''}`)
    .join('\n');

  return (
    <div className="flex flex-wrap gap-1 items-center" title={detalle}>
      {software.slice(0, max).map((sw, i) => (
        <span key={`${sw.entorno}-${sw.nombre}-${i}`}
          className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
          {sw.nombre}
          {sw.version && <span className="font-mono text-slate-500">{sw.version}</span>}
        </span>
      ))}
      {software.length > max && (
        <span className="text-[10px] text-slate-400">+{software.length - max}</span>
      )}
    </div>
  );
};
