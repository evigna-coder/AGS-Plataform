import React from 'react';

export type ProtocolResultValue = 'cumple' | 'no-cumple' | 'na' | '';

export interface ProtocolResultBlockProps {
  title: string;
  code?: string;
  children: React.ReactNode;
  resultValue: ProtocolResultValue;
  onChangeResult: (value: ProtocolResultValue) => void;
  observations: string;
  onChangeObservations: (text: string) => void;
  readOnly?: boolean;
}

/**
 * Bloque de resultado de prueba: valor medido destacado, rango/criterio, radios CUMPLE/NO CUMPLE/N/A en una línea.
 * Estilo informe A4 (escala reducida).
 */
export const ProtocolResultBlock: React.FC<ProtocolResultBlockProps> = ({
  title,
  code,
  children,
  resultValue,
  onChangeResult,
  observations,
  onChangeObservations,
  readOnly = false,
}) => {
  return (
    <div className="border border-slate-200 rounded-sm overflow-hidden bg-white">
      <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-1">
        <h3 className="font-bold text-slate-800 text-[12px] uppercase tracking-wide">
          {title}
        </h3>
        {code && (
          <span className="text-[10px] font-mono text-slate-400">{code}</span>
        )}
      </div>
      <div className="p-3">
        {children}
        <div className="mt-4 pt-3 border-t border-dashed border-slate-200 space-y-3">
          <div>
            <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-0.5">
              Observaciones técnicas
            </label>
            {readOnly ? (
              <p className="text-[11px] text-slate-700 whitespace-pre-wrap">
                {observations || '—'}
              </p>
            ) : (
              <textarea
                value={observations}
                onChange={(e) => onChangeObservations(e.target.value)}
                className="w-full text-[11px] p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                rows={2}
              />
            )}
          </div>
          <div>
            <span className="block text-[10px] font-semibold text-slate-600 uppercase mb-1">
              Resultado final
            </span>
            <div className="flex flex-wrap gap-3 items-center">
              {(['cumple', 'no-cumple', 'na'] as const).map((opt) => (
                <label
                  key={opt}
                  className="inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="result"
                    checked={resultValue === opt}
                    onChange={() => onChangeResult(opt)}
                    disabled={readOnly}
                    className="rounded-full border-slate-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
                  />
                  <span className="text-[11px] text-slate-700 capitalize">
                    {opt === 'na' ? 'N/A' : opt === 'cumple' ? 'Cumple' : 'No cumple'}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
