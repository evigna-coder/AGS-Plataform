import type { AddressValidationRow } from '../../hooks/useBulkAddressValidation';

interface Props {
  filteredRows: AddressValidationRow[];
  clienteMap: Record<string, string>;
  onApply: (row: AddressValidationRow) => void;
}

export const BulkValidationTable: React.FC<Props> = ({ filteredRows, clienteMap, onApply }) => (
  <div className="max-h-[400px] overflow-y-auto border border-slate-200 rounded-lg">
    <table className="w-full text-xs">
      <thead className="sticky top-0 bg-slate-50 z-10">
        <tr className="border-b border-slate-200">
          <th className="px-2 py-1.5 text-center text-[10px] font-medium text-slate-400">Establecimiento</th>
          <th className="px-2 py-1.5 text-center text-[10px] font-medium text-slate-400">Dirección actual</th>
          <th className="px-2 py-1.5 text-center text-[10px] font-medium text-slate-400">Google sugiere</th>
          <th className="px-2 py-1.5 text-center text-[10px] font-medium text-slate-400">Diferencias</th>
          <th className="px-2 py-1.5 text-center text-[10px] font-medium text-slate-400">Acción</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {filteredRows.map(row => (
          <tr key={row.est.id} className={
            row.applied ? 'bg-blue-50' :
            row.diffs.length > 0 ? 'bg-amber-50' :
            row.status === 'error' ? 'bg-red-50' : ''
          }>
            <td className="px-2 py-1.5 align-top">
              <div className="text-xs text-slate-700 font-medium truncate max-w-[140px]" title={row.est.nombre}>
                {row.est.nombre}
              </div>
              <div className="text-[9px] text-slate-400 truncate max-w-[140px]">
                {clienteMap[row.est.clienteCuit] || ''}
              </div>
            </td>
            <td className="px-2 py-1.5 align-top">
              <div className="text-[10px] text-slate-600 max-w-[160px]">
                {row.est.direccion}
                {(row.est.localidad || row.est.provincia) && (
                  <div className="text-slate-400">{[row.est.localidad, row.est.provincia].filter(Boolean).join(', ')}</div>
                )}
                {row.est.codigoPostal && <div className="text-slate-400">CP: {row.est.codigoPostal}</div>}
              </div>
            </td>
            <td className="px-2 py-1.5 align-top">
              {row.status === 'validating' && <span className="text-[9px] text-teal-500 animate-pulse">Consultando...</span>}
              {row.status === 'pending' && <span className="text-[9px] text-slate-300">pendiente</span>}
              {row.status === 'skipped' && <span className="text-[9px] text-slate-300">sin dirección</span>}
              {row.status === 'error' && <span className="text-[9px] text-red-500">No encontrada</span>}
              {row.status === 'done' && row.result && (
                <div className="text-[10px] text-slate-600 max-w-[180px]">
                  {row.result.formattedAddress}
                </div>
              )}
            </td>
            <td className="px-2 py-1.5 align-top">
              {row.applied && (
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">Corregido</span>
              )}
              {row.status === 'done' && !row.applied && row.diffs.length === 0 && (
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">OK</span>
              )}
              {row.diffs.length > 0 && !row.applied && (
                <div className="space-y-0.5">
                  {row.diffs.filter(d => !['lat', 'lng', 'placeId'].includes(d.field)).map(d => (
                    <div key={d.field} className="text-[9px]">
                      <span className="text-slate-400">{d.label}:</span>{' '}
                      <span className="text-red-500 line-through">{d.current || '(vacío)'}</span>{' -> '}
                      <span className="text-green-700 font-medium">{d.google}</span>
                    </div>
                  ))}
                  {row.diffs.some(d => ['lat', 'lng', 'placeId'].includes(d.field)) && (
                    <div className="text-[9px] text-slate-400">+ coordenadas/placeId</div>
                  )}
                </div>
              )}
            </td>
            <td className="px-2 py-1.5 text-center align-top whitespace-nowrap">
              {row.diffs.length > 0 && !row.applied && (
                <button onClick={() => onApply(row)}
                  className="text-[9px] font-medium text-amber-600 hover:text-amber-800 px-1.5 py-0.5 rounded hover:bg-amber-100">
                  Corregir
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
