import type { Cliente } from '@ags/shared';

const selectClass = 'w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500';
const labelClass = 'text-[11px] font-medium text-slate-400 mb-1 block';

interface Props {
  clienteId: string;
  razonSocial: string;
  setRazonSocial: (v: string) => void;
  setClienteSearch: (v: string) => void;
  showDropdown: boolean;
  setShowDropdown: (v: boolean) => void;
  filteredClientes: Cliente[];
  onSelect: (cli: Cliente) => void;
  onClear: () => void;
  error?: string;
}

export const LeadClienteField: React.FC<Props> = ({
  clienteId, razonSocial, setRazonSocial, setClienteSearch,
  showDropdown, setShowDropdown, filteredClientes, onSelect, onClear, error,
}) => (
  <div className="relative">
    <label className={labelClass}>Cliente / Razón Social *</label>
    {clienteId ? (
      <div className="flex items-center gap-2 border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50">
        <span className="text-xs text-slate-700 font-medium flex-1 truncate">{razonSocial}</span>
        <button onClick={onClear} className="text-[10px] text-red-500 hover:text-red-700 font-medium shrink-0">Cambiar</button>
      </div>
    ) : (
      <>
        <input type="text" value={razonSocial}
          onChange={e => { setRazonSocial(e.target.value); setClienteSearch(e.target.value); setShowDropdown(true); }}
          onFocus={() => { if (razonSocial) setShowDropdown(true); }}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          className={selectClass}
          placeholder="Buscar cliente o escribir razón social nueva..." />
        {error && <span className="text-[10px] text-red-500 mt-0.5 block">{error}</span>}
        {showDropdown && filteredClientes.length > 0 && (
          <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {filteredClientes.map(c => (
              <button key={c.id} onMouseDown={() => onSelect(c)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-teal-50 text-slate-700 border-b border-slate-100 last:border-0">
                {c.razonSocial}
              </button>
            ))}
          </div>
        )}
      </>
    )}
  </div>
);
