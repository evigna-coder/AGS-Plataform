import type { TableProject } from '@ags/shared';
import { SearchableSelect } from '../ui/SearchableSelect';

const NO_PROJECT = '__none__';

interface Props {
  projects: TableProject[];
  /** null = "Sin proyecto"; undefined = nada elegido todavía (muestra el placeholder). */
  value: string | null | undefined;
  onChange: (projectId: string | null) => void;
  placeholder?: string;
}

/**
 * Selector de proyecto con búsqueda (40+ proyectos: el desplegable plano obligaba a
 * leer toda la lista). Lo usan Duplicar, Mover a proyecto y el editor de la tabla.
 */
export function ProjectPicker({ projects, value, onChange, placeholder = 'Buscar proyecto...' }: Props) {
  return (
    <SearchableSelect
      value={value === undefined ? '' : value ?? NO_PROJECT}
      onChange={v => onChange(v === NO_PROJECT ? null : v)}
      options={[{ value: NO_PROJECT, label: 'Sin proyecto' }, ...projects.map(p => ({ value: p.id, label: p.name }))]}
      placeholder={placeholder}
      size="sm"
    />
  );
}
