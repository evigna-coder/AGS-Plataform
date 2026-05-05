export type TipoRemito = 'devolucion' | 'derivacion_proveedor';

interface Props {
  value: TipoRemito;
  onChange: (next: TipoRemito) => void;
}

export function RemitoTipoToggle({ value, onChange }: Props) {
  const opt = (k: TipoRemito, label: string) => (
    <button
      type="button"
      onClick={() => onChange(k)}
      className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-colors ${
        value === k
          ? 'border-teal-700 bg-teal-50 text-teal-900'
          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <p className="text-[11px] font-mono uppercase tracking-wide text-slate-500 mb-1.5">Tipo de remito</p>
      <div className="flex gap-2">
        {opt('devolucion', 'Devolución al cliente')}
        {opt('derivacion_proveedor', 'Derivación a proveedor')}
      </div>
    </div>
  );
}
