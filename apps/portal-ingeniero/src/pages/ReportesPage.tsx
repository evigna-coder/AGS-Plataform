import { useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { REPORTES_OT_URL } from '../utils/constants';

export default function ReportesPage() {
  const [otInput, setOtInput] = useState('');
  const [loadedOT, setLoadedOT] = useState('');

  const iframeUrl = loadedOT
    ? `${REPORTES_OT_URL}?reportId=${encodeURIComponent(loadedOT)}`
    : REPORTES_OT_URL;

  const handleLoad = () => {
    const trimmed = otInput.trim();
    if (trimmed) setLoadedOT(trimmed);
  };

  return (
    <div className="h-full flex flex-col">
      <PageHeader title="Reportes" subtitle="Carga y edición de reportes de OT" actions={
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={otInput}
            onChange={e => setOtInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleLoad(); }}
            placeholder="N° OT..."
            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs w-28 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={handleLoad}
            disabled={!otInput.trim()}
            className="text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 px-3 py-1.5 rounded-lg transition-colors"
          >
            Cargar
          </button>
          {loadedOT && (
            <span className="text-[11px] text-slate-500">
              OT-<span className="font-semibold text-slate-700">{loadedOT}</span>
            </span>
          )}
        </div>
      } />

      <div className="flex-1 min-h-0">
        <iframe
          key={iframeUrl}
          src={iframeUrl}
          className="w-full h-full border-0"
          title="Reportes OT"
          allow="clipboard-write"
        />
      </div>
    </div>
  );
}
