import type { ProtocolSelection } from '../types/tableCatalog';

interface Props {
  selection: ProtocolSelection;
  readOnly?: boolean;
  isPrint?: boolean;
  signatureClient: string | null;
  signatureEngineer: string | null;
  aclaracionCliente: string;
  aclaracionEspecialista: string;
  fechaInicio: string;
  fechaFin: string;
}

export const CatalogSignaturesView: React.FC<Props> = ({
  selection,
  isPrint = false,
  signatureClient,
  signatureEngineer,
  aclaracionCliente,
  aclaracionEspecialista,
  fechaInicio,
  fechaFin,
}) => {
  const table = selection.tableSnapshot;
  const signatureMode = table.signatureMode ?? 'both';
  const showDate = table.showDate ?? 'none';
  // dateLabel may contain either a short label ("Fecha") or a full text paragraph with placeholders
  const rawDateLabel = table.dateLabel ?? '';
  const isTextParagraph = /\{fecha/i.test(rawDateLabel);
  const dateLabelShort = isTextParagraph ? 'Fecha de inicio' : (rawDateLabel || 'Fecha de inicio');
  const showTitle = table.showTitle ?? true;

  const showClient = signatureMode === 'both' || signatureMode === 'client';
  const showEngineer = signatureMode === 'both' || signatureMode === 'engineer';

  // Build date text with interpolated dates
  const formatDate = (iso: string) => {
    if (!iso) return '—';
    try {
      // Parsear como fecha local (no UTC) para evitar desfase de timezone
      const [y, m, d] = iso.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return iso; }
  };

  // Resolve text with date placeholders — editor saves "Texto con fecha" to dateLabel
  let textContent = table.dateLabel || table.textContent || '';
  textContent = textContent.replace(/\{fechaInicio\}/gi, formatDate(fechaInicio));
  textContent = textContent.replace(/\{fechaFin\}/gi, formatDate(fechaFin));

  // Date display
  const dateBlocks: { label: string; value: string }[] = [];
  if (showDate === 'inicio' || showDate === 'both') {
    dateBlocks.push({ label: dateLabelShort || 'Fecha de inicio', value: formatDate(fechaInicio) });
  }
  if (showDate === 'fin' || showDate === 'both') {
    dateBlocks.push({ label: showDate === 'both' ? 'Fecha de finalización' : (dateLabelShort || 'Fecha de finalización'), value: formatDate(fechaFin) });
  }

  return (
    <div className={`mb-6 ${isPrint ? 'border border-slate-300' : 'rounded-xl border border-slate-200 shadow-sm overflow-hidden'} bg-white`}>

      {/* Title bar */}
      {showTitle && (
        <div className={`flex items-center justify-between px-3 py-2 gap-3 ${isPrint ? 'border-b border-slate-300' : 'bg-slate-50 border-b border-slate-200'}`}>
          <p className={`font-semibold truncate ${isPrint ? 'text-[10px]' : 'text-sm text-slate-900'}`}>
            {table.name}
          </p>
        </div>
      )}

      {/* Content area: text left + signature right */}
      <div className="px-4 py-3 flex gap-6 items-start">

        {/* Left: text content */}
        <div className="flex-1 min-w-0">
          {textContent && (
            <div
              className="catalog-text-content text-[11px] leading-relaxed text-slate-700"
              dangerouslySetInnerHTML={{ __html: textContent }}
            />
          )}

          {dateBlocks.length > 0 && !textContent && (
            <div className="flex flex-col gap-1">
              {dateBlocks.map((d, i) => (
                <div key={i} className="text-[11px]">
                  <span className="font-semibold text-slate-600">{d.label}:</span>{' '}
                  <span className="text-slate-800">{d.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: signatures side by side */}
        <div className="shrink-0 flex flex-row gap-6" style={{ width: '55%' }}>
          {showClient && (
            <div className="flex-1 flex flex-col items-center">
              <div className="h-12 w-full border-b border-slate-900 flex items-end justify-center pb-1">
                {signatureClient && (
                  <img src={signatureClient} className="max-h-full max-w-full object-contain" alt="Firma Cliente" />
                )}
              </div>
              <p className="font-bold text-[11px] mt-1 text-center leading-none">
                {aclaracionCliente || 'Cliente'}
              </p>
              <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">
                Firma del cliente
              </p>
            </div>
          )}

          {showEngineer && (
            <div className="flex-1 flex flex-col items-center">
              <div className="h-12 w-full border-b border-slate-900 flex items-end justify-center pb-1">
                {signatureEngineer && (
                  <img src={signatureEngineer} className="max-h-full max-w-full object-contain" alt="Firma Técnico" />
                )}
              </div>
              <p className="font-bold text-[11px] mt-1 text-center leading-none">
                {aclaracionEspecialista || 'Especialista AGS'}
              </p>
              <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">
                Firma del Ing. de soporte técnico
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
