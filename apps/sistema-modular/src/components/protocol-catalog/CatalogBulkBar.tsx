import { useState } from 'react';
import type { TableProject } from '@ags/shared';
import { Button } from '../ui/Button';
import { ProjectPicker } from './ProjectPicker';

interface Props {
  count: number;
  /** Cuántas de las seleccionadas no están publicadas. */
  unpublished: number;
  projects: TableProject[];
  onPublish: () => void;
  onMove: (projectId: string | null) => void;
  onClear: () => void;
  onDelete: () => void;
}

/** Barra de acciones sobre las tablas seleccionadas. */
export function CatalogBulkBar({ count, unpublished, projects, onPublish, onMove, onClear, onDelete }: Props) {
  const [moving, setMoving] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap bg-teal-50 border border-teal-200 rounded-xl px-4 py-2.5 motion-safe:animate-barra-in">
      <span className="text-sm font-semibold text-teal-800">{count} seleccionada(s)</span>
      <div className="flex gap-2.5 items-center flex-wrap">
        {unpublished > 0 && <Button size="sm" onClick={onPublish}>{`Publicar ${unpublished}`}</Button>}
        {projects.length > 0 && (moving ? (
          <div className="w-72">
            <ProjectPicker projects={projects} value={undefined} placeholder="Mover a proyecto..."
              onChange={pid => { setMoving(false); onMove(pid); }} />
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setMoving(true)}>Mover a proyecto…</Button>
        ))}
        <button onClick={onClear} className="text-xs text-slate-600 hover:text-slate-900 font-medium">Deseleccionar</button>
        <Button size="sm" variant="danger" onClick={onDelete}>{`Eliminar ${count}`}</Button>
      </div>
    </div>
  );
}
