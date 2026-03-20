import React, { useState } from 'react';

export interface WizardStep {
  key: string;
  label: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

interface Props {
  steps: WizardStep[];
  /** Extra content rendered outside the wizard (hidden containers, modals, etc.) */
  extra?: React.ReactNode;
}

export const WizardLayout: React.FC<Props> = ({ steps, extra }) => {
  const [current, setCurrent] = useState(0);
  const total = steps.length;
  const step = steps[current];

  const canPrev = current > 0;
  const canNext = current < total - 1;

  return (
    <div className="flex flex-col min-h-[100dvh] bg-white">
      {/* ─── Progress bar + step label ─── */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
        {/* Step indicators */}
        <div className="flex items-center gap-0.5 px-3 pt-3 pb-1">
          {steps.map((s, i) => (
            <button
              key={s.key}
              onClick={() => setCurrent(i)}
              className={`flex-1 h-1.5 rounded-full transition-colors ${
                i === current
                  ? 'bg-blue-600'
                  : i < current
                  ? 'bg-blue-300'
                  : 'bg-slate-200'
              }`}
              aria-label={`Paso ${i + 1}: ${s.label}`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 px-4 py-2">
          <span className="text-slate-400">{step.icon}</span>
          <span className="text-sm font-semibold text-slate-800 tracking-tight">
            {current + 1}/{total} — {step.label}
          </span>
        </div>
      </div>

      {/* ─── Step content ─── */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {step.content}
      </div>

      {/* ─── Navigation buttons ─── */}
      <div className="sticky bottom-0 z-40 bg-white border-t border-slate-200 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setCurrent(c => c - 1)}
          disabled={!canPrev}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            canPrev
              ? 'bg-slate-100 text-slate-700 active:bg-slate-200'
              : 'bg-slate-50 text-slate-300 cursor-not-allowed'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Anterior
        </button>

        <div className="flex-1" />

        <button
          onClick={() => setCurrent(c => c + 1)}
          disabled={!canNext}
          className={`flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            canNext
              ? 'bg-blue-600 text-white active:bg-blue-700 shadow-sm'
              : 'bg-slate-50 text-slate-300 cursor-not-allowed'
          }`}
        >
          Siguiente
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Extra content (modals, hidden containers, etc.) */}
      {extra}
    </div>
  );
};
