import React from 'react';

interface ObservationsBillingSectionProps {
  readOnly: boolean;
  accionesTomar: string;
  setAccionesTomar: (v: string) => void;
  accionesInternaOnly: boolean;
  setAccionesInternaOnly: (v: boolean) => void;
  budgets: string[];
  onAddBudget: () => void;
  onUpdateBudget: (index: number, value: string) => void;
  onRemoveBudget: (index: number) => void;
  esFacturable: boolean;
  setEsFacturable: (v: boolean) => void;
  tieneContrato: boolean;
  setTieneContrato: (v: boolean) => void;
  esGarantia: boolean;
  setEsGarantia: (v: boolean) => void;
}

export const ObservationsBillingSection: React.FC<ObservationsBillingSectionProps> = ({
  readOnly,
  accionesTomar, setAccionesTomar,
  accionesInternaOnly, setAccionesInternaOnly,
  budgets, onAddBudget, onUpdateBudget, onRemoveBudget,
  esFacturable, setEsFacturable,
  tieneContrato, setTieneContrato,
  esGarantia, setEsGarantia,
}) => {
  return (
    <div className="no-print grid grid-cols-1 md:grid-cols-12 gap-6 mb-8 items-start">
      <div className="md:col-span-8">
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] font-black text-slate-400 uppercase">OBSERVACIONES / ACCIONES A TOMAR</label>
          <label className={`flex items-center gap-1.5 text-[10px] font-bold ${
            readOnly ? 'cursor-not-allowed text-slate-400' : 'cursor-pointer text-amber-700'
          }`}>
            <input
              type="checkbox"
              checked={accionesInternaOnly}
              onChange={e => {
                if (readOnly) return;
                setAccionesInternaOnly(e.target.checked);
              }}
              disabled={readOnly}
              className="accent-amber-600 w-3.5 h-3.5"
            />
            Solo AGS (no imprime en reporte)
          </label>
        </div>
        <textarea
          value={accionesTomar}
          onChange={e => {
            if (readOnly) return;
            setAccionesTomar(e.target.value);
          }}
          rows={5}
          disabled={readOnly}
          className={`w-full border rounded-xl px-4 py-2 text-sm outline-none ${
            readOnly
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200'
              : 'bg-white border-slate-200 focus:ring-1 focus:ring-blue-500'
          }`}
          placeholder="Recomendaciones o trabajos pendientes..."
        />
      </div>
      <div className="md:col-span-4 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4 shadow-inner self-start">
        <div className="flex justify-between items-center">
          <label className="text-[10px] font-black text-slate-400 uppercase">Facturación</label>
          <button
            onClick={() => {
              if (readOnly) return;
              onAddBudget();
            }}
            disabled={readOnly}
            className={`text-[10px] font-black uppercase ${
              readOnly
                ? 'text-slate-400 cursor-not-allowed'
                : 'text-blue-600 hover:underline'
            }`}
          >
            + Presup.
          </button>
        </div>
        {budgets.map((b, idx) => (
          <div key={idx} className="flex gap-1">
            <input
              value={b}
              maxLength={15}
              onChange={e => {
                if (readOnly) return;
                onUpdateBudget(idx, e.target.value);
              }}
              disabled={readOnly}
              placeholder="PRE-0000"
              className={`w-full border rounded px-2 py-1 text-xs font-bold ${
                readOnly
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200'
                  : 'bg-white border-slate-300'
              }`}
            />
            <button
              onClick={() => {
                if (readOnly) return;
                onRemoveBudget(idx);
              }}
              disabled={readOnly}
              className={`${
                readOnly
                  ? 'text-slate-400 cursor-not-allowed'
                  : 'text-red-400 hover:text-red-600'
              }`}
            >
              ×
            </button>
          </div>
        ))}
        <div className="pt-2 border-t flex flex-col gap-2">
          <label className={`flex items-center gap-2 text-[10px] font-bold uppercase ${
            readOnly ? 'cursor-not-allowed text-slate-400' : 'cursor-pointer text-slate-600'
          }`}>
            <input
              type="checkbox"
              checked={esFacturable}
              onChange={e => {
                if (readOnly) return;
                setEsFacturable(e.target.checked);
              }}
              disabled={readOnly}
              className="accent-slate-800 w-4 h-4 bg-white border border-slate-400 rounded focus:ring-2 focus:ring-slate-300"
            />
            Facturable
          </label>
          <label className={`flex items-center gap-2 text-[10px] font-bold uppercase ${
            readOnly ? 'cursor-not-allowed text-slate-400' : 'cursor-pointer text-slate-600'
          }`}>
            <input
              type="checkbox"
              checked={tieneContrato}
              onChange={e => {
                if (readOnly) return;
                setTieneContrato(e.target.checked);
              }}
              disabled={readOnly}
              className="accent-slate-800 w-4 h-4 bg-white border border-slate-400 rounded focus:ring-2 focus:ring-slate-300"
            />
            Contrato
          </label>
          <label className={`flex items-center gap-2 text-[10px] font-bold uppercase ${
            readOnly ? 'cursor-not-allowed text-slate-400' : 'cursor-pointer text-slate-600'
          }`}>
            <input
              type="checkbox"
              checked={esGarantia}
              onChange={e => {
                if (readOnly) return;
                setEsGarantia(e.target.checked);
              }}
              disabled={readOnly}
              className="accent-slate-800 w-4 h-4 bg-white border border-slate-400 rounded focus:ring-2 focus:ring-slate-300"
            />
            Garantía
          </label>
        </div>
      </div>
    </div>
  );
};
