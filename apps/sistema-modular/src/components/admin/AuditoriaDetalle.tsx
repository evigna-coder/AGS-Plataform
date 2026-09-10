import { useState } from 'react';
import type { AuditLogEntry } from '@ags/shared';
import { cambiosLegibles, fieldLabel, valorLegible } from '../../utils/auditHumano';

const th = 'px-2 py-1 text-left text-[10px] font-mono uppercase tracking-wide text-slate-400';

/**
 * Detalle expandido de un registro de auditoría (2026-09-09). Antes era el
 * JSON crudo del cambio; ahora es una tabla campo / antes / después en
 * castellano, con el JSON escondido detrás de "Ver detalle técnico".
 */
export function AuditoriaDetalle({ entry }: { entry: AuditLogEntry }) {
  const [tecnico, setTecnico] = useState(false);
  const cambios = cambiosLegibles(entry);
  const conAntes = cambios.some(c => c.antes !== null);
  const detalles = Object.entries(entry.details ?? {}).filter(([k]) => k !== 'id');

  return (
    <div className="text-[11px] text-slate-600 space-y-3">
      {cambios.length > 0 && (
        <div>
          <p className="text-slate-400 mb-1">{entry.action === 'create' ? 'Datos cargados' : 'Campos modificados'}</p>
          <table className="w-full max-w-3xl border border-slate-200 rounded bg-white">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className={`${th} w-48`}>Campo</th>
                {conAntes && <th className={th}>Antes</th>}
                <th className={th}>{conAntes ? 'Después' : 'Valor'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cambios.map(c => (
                <tr key={c.campo}>
                  <td className="px-2 py-1 text-slate-500 align-top">{c.campo}</td>
                  {conAntes && <td className="px-2 py-1 text-slate-400 align-top line-through decoration-slate-300">{c.antes ?? '—'}</td>}
                  <td className="px-2 py-1 text-slate-800 align-top break-words">{c.despues}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {detalles.length > 0 && (
        <div>
          <p className="text-slate-400 mb-1">Detalle del evento</p>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-0.5 max-w-3xl">
            {detalles.map(([k, val]) => (
              <div key={k} className="contents">
                <dt className="text-slate-500">{fieldLabel(k)}</dt>
                <dd className="text-slate-800 break-words">{valorLegible(k, val, entry.collection)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {cambios.length === 0 && detalles.length === 0 && (
        <p className="text-slate-400">Sin detalle de campos para este registro.</p>
      )}
      <div className="flex items-center gap-3">
        <span className="text-slate-400">ID del documento: <code className="text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded">{entry.documentId}</code></span>
        {(entry.changes || entry.details) && (
          <button type="button" onClick={() => setTecnico(t => !t)} className="text-teal-600 hover:underline">
            {tecnico ? 'Ocultar detalle técnico' : 'Ver detalle técnico'}
          </button>
        )}
      </div>
      {tecnico && (
        <pre className="text-[10px] bg-white border border-slate-200 rounded p-2 overflow-auto max-h-64">
          {JSON.stringify({ changes: entry.changes ?? null, details: entry.details ?? null }, null, 2)}
        </pre>
      )}
    </div>
  );
}
