import type { PlantillaTextoPresupuesto, TipoPresupuesto, PresupuestoSeccionesVisibles } from '@ags/shared';
import { PRESUPUESTO_SECCIONES_LABELS, TIPO_PRESUPUESTO_LABELS } from '@ags/shared';

type SeccionKey = keyof PresupuestoSeccionesVisibles;

// Strip HTML for ~100 char preview. Exported so parent or tests can reuse.
export function stripHtmlPreview(html: string, max = 100): string {
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? text.substring(0, max - 1) + '…' : text;
}

interface PlantillaRowProps {
  plantilla: PlantillaTextoPresupuesto;
  onEdit: (p: PlantillaTextoPresupuesto) => void;
  onDelete: (p: PlantillaTextoPresupuesto) => void;
}

export const PlantillaRow: React.FC<PlantillaRowProps> = ({ plantilla: p, onEdit, onDelete }) => {
  return (
    <tr className="hover:bg-slate-50">
      <td className="px-3 py-2">
        <span className="font-medium text-slate-900">{p.nombre}</span>
        <p className="text-[10px] text-slate-400 mt-0.5">{stripHtmlPreview(p.contenido)}</p>
      </td>
      <td className="px-3 py-2 text-slate-600">
        {PRESUPUESTO_SECCIONES_LABELS[p.tipo as SeccionKey]}
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1">
          {p.tipoPresupuestoAplica.map((t: TipoPresupuesto) => (
            <span key={t} className="text-[10px] bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded">
              {TIPO_PRESUPUESTO_LABELS[t]}
            </span>
          ))}
        </div>
      </td>
      <td className="px-3 py-2 text-center">{p.esDefault ? '✓' : ''}</td>
      <td className="px-3 py-2 text-center">
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${p.activo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
          {p.activo ? 'Activa' : 'Inactiva'}
        </span>
      </td>
      <td className="px-3 py-2 text-center space-x-2">
        <button className="text-teal-600 hover:underline" onClick={() => onEdit(p)}>Editar</button>
        <button className="text-red-500 hover:underline" onClick={() => onDelete(p)}>Eliminar</button>
      </td>
    </tr>
  );
};
