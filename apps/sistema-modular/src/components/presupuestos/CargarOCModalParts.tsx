import type { Presupuesto } from '@ags/shared';
import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';

/**
 * Subcomponents for `CargarOCModal` — extracted to keep the parent under the
 * 250-line component budget. Pure presentational: no service calls, no state.
 */

export const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
      active
        ? 'text-teal-700 border-teal-500'
        : 'text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-300'
    }`}
  >
    {children}
  </button>
);

interface NuevaOCFormProps {
  numero: string;
  fecha: string;
  notas: string;
  filesCount: number;
  onNumeroChange: (v: string) => void;
  onFechaChange: (v: string) => void;
  onNotasChange: (v: string) => void;
  onFilesChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const NuevaOCForm: React.FC<NuevaOCFormProps> = ({
  numero, fecha, notas, filesCount,
  onNumeroChange, onFechaChange, onNotasChange, onFilesChange,
}) => (
  <>
    <Input
      label="Número de OC"
      value={numero}
      onChange={e => onNumeroChange(e.target.value)}
      placeholder="Ej: O-000100445302"
      inputSize="sm"
      required
    />
    <Input
      label="Fecha"
      type="date"
      value={fecha}
      onChange={e => onFechaChange(e.target.value)}
      inputSize="sm"
    />
    <div>
      <label className="block text-[11px] font-medium text-slate-700 mb-1">
        Adjuntos (PDF / JPG / PNG) *
      </label>
      <input
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf"
        onChange={onFilesChange}
        className="text-xs text-slate-600 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
      />
      {filesCount > 0 && (
        <p className="text-[10px] text-slate-500 mt-1">{filesCount} archivo(s) seleccionado(s)</p>
      )}
    </div>
    <Input
      label="Notas (opcional)"
      value={notas}
      onChange={e => onNotasChange(e.target.value)}
      placeholder="Observaciones internas"
      inputSize="sm"
    />
  </>
);

interface ExistenteOCFormProps {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}

export const ExistenteOCForm: React.FC<ExistenteOCFormProps> = ({ value, onChange, options }) => (
  <div>
    <label className="block text-[11px] font-medium text-slate-700 mb-1">OC existente del cliente</label>
    <SearchableSelect
      value={value}
      onChange={onChange}
      options={options}
      placeholder="Seleccionar OC previa..."
      size="sm"
    />
  </div>
);

interface OtrosPresupuestosListProps {
  items: Presupuesto[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}

export const OtrosPresupuestosList: React.FC<OtrosPresupuestosListProps> = ({ items, selected, onToggle }) => {
  if (items.length === 0) return null;
  return (
    <div className="pt-2 border-t border-slate-100">
      <p className="text-[10px] font-mono font-medium text-slate-500 uppercase tracking-wide mb-2">
        Esta OC también cubre:
      </p>
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {items.map(p => (
          <label
            key={p.id}
            className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5"
          >
            <input
              type="checkbox"
              checked={selected.has(p.id)}
              onChange={() => onToggle(p.id)}
              className="rounded text-teal-600 focus:ring-teal-500"
            />
            <span className="font-medium text-teal-600">{p.numero}</span>
            <span className="text-slate-400">·</span>
            <span className="truncate">{p.responsableNombre || ''}</span>
          </label>
        ))}
      </div>
    </div>
  );
};
