import type { EstadoLoaner } from '@ags/shared';
import { ESTADO_LOANER_LABELS } from '@ags/shared';
import { Button } from '../ui/Button';
import { MenuButton, type MenuButtonItem } from '../ui/MenuButton';

const ESTADOS = Object.keys(ESTADO_LOANER_LABELS) as EstadoLoaner[];

/** Estados seleccionados, desde el string separado por comas de la URL. */
export function parseEstados(raw: string): EstadoLoaner[] {
  return raw.split(',').map(s => s.trim()).filter(Boolean) as EstadoLoaner[];
}

interface Props {
  busq: string;
  onBusqChange: (v: string) => void;
  /** CSV de estados; vacío = todos. */
  estados: string;
  soloCompletos: boolean;
  showInactivos: boolean;
  setFilter: (key: string, value: string | boolean) => void;
  onReset: () => void;
}

/**
 * Barra de filtros de Loaners. Extraída de LoanersList (presupuesto de 250
 * líneas) al agregar la selección múltiple de estados, 2026-09-01.
 *
 * El estado dice DÓNDE está el equipo; "completo" dice si sirve. Por eso son dos
 * filtros distintos y "Disponibles" es el atajo que combina los dos.
 */
export function LoanersFiltersBar({
  busq, onBusqChange, estados, soloCompletos, showInactivos, setFilter, onReset,
}: Props) {
  const sel = parseEstados(estados);

  const toggleEstado = (e: EstadoLoaner) => {
    const next = sel.includes(e) ? sel.filter(x => x !== e) : [...sel, e];
    setFilter('estados', next.join(','));
  };

  const etiquetaEstado = sel.length === 0
    ? 'Estado: todos'
    : sel.length === 1
      ? `Estado: ${ESTADO_LOANER_LABELS[sel[0]]}`
      : `Estado: ${sel.length} seleccionados`;

  const items: MenuButtonItem[] = [
    {
      label: 'Disponibles (en base y completos)',
      onClick: () => { setFilter('estados', 'en_base'); setFilter('soloCompletos', true); },
    },
    {
      label: 'Todos los estados',
      separador: true,
      onClick: () => { setFilter('estados', ''); setFilter('soloCompletos', false); },
    },
    ...ESTADOS.map(e => ({
      label: ESTADO_LOANER_LABELS[e],
      checked: sel.includes(e),
      keepOpen: true,
      onClick: () => toggleEstado(e),
    })),
  ];

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <input
        value={busq}
        onChange={e => onBusqChange(e.target.value)}
        placeholder="Buscar por código, equipo, categoría, cliente, proveedor…"
        className="w-80 text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
      />
      <MenuButton label={etiquetaEstado} items={items} title="Filtrar por uno o varios estados" />
      <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer"
        title="Excluye los loaners marcados INCOMPLETO (les falta reponer alguna parte)">
        <input
          type="checkbox"
          checked={soloCompletos}
          onChange={e => setFilter('soloCompletos', e.target.checked)}
          className="rounded border-slate-300"
        />
        Solo completos
      </label>
      <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
        <input
          type="checkbox"
          checked={showInactivos}
          onChange={e => setFilter('showInactivos', e.target.checked)}
          className="rounded border-slate-300"
        />
        Mostrar inactivos
      </label>
      <Button size="sm" variant="ghost" onClick={onReset}>Limpiar</Button>
    </div>
  );
}
