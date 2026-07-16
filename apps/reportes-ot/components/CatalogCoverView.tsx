import React from 'react';
import type { ProtocolSelection } from '../types/tableCatalog';
import { useAccordionCard } from '../hooks/useAccordionCard';
import { useIsCompact } from '../hooks/useIsMobile';
import { AccordionHeaderChrome, AccordionConfirmButton } from './protocol/AccordionChrome';

interface Props {
  selection: ProtocolSelection;
  isPrint?: boolean;
  /** Datos de la OT que se inyectan automáticamente */
  otNumber?: string;
  /** Fecha mostrada en la carátula — es la fecha de FIN del servicio (pedido dirección 2026-07). */
  fecha?: string;
  sistemaNombre?: string;
  sistemaModelo?: string;
  moduloMarca?: string;
  moduloModelo?: string;
  agsVisibleId?: string;
  numeroSerie?: string;
  ingenieroNombre?: string;
  logoSrc?: string;
  /** Callback para actualizar valores de campos extra editables (coverExtraFields). */
  onChangeData?: (tableId: string, rowId: string, colKey: string, value: string) => void;
  /**
   * Si true, la grilla de datos (FECHA / MODELO / ID / N° SERIE / INGENIERO + extras)
   * se renderiza vacía con "—". El título y la línea de marca/sistema se conservan
   * para dar contexto. Para el modo "Protocolo en blanco".
   */
  blankPreviewMode?: boolean;
}

/** rowId sintético donde se guardan los valores de los coverExtraFields. */
const COVER_EXTRA_ROW_ID = '_cover_';

/**
 * Carátula del protocolo — estilo editorial AGS.
 * Logo arriba-izquierda, título grande (Inter, unificado con el resto del
 * protocolo), barra vertical con marca, datos en grilla abajo, footer con
 * QF/Rev/Fecha.
 */
export const CatalogCoverView: React.FC<Props> = ({
  selection,
  isPrint = false,
  otNumber,
  fecha,
  sistemaNombre,
  sistemaModelo,
  moduloMarca,
  moduloModelo,
  agsVisibleId,
  numeroSerie,
  ingenieroNombre,
  logoSrc,
  onChangeData,
  blankPreviewMode = false,
}) => {
  const table = selection.tableSnapshot;
  const titulo = table.name || 'Protocolo';
  // Línea principal de marca:
  // - default: "sistema / marca módulo"
  // - coverAutoFillFromModulo: "marca módulo / modelo módulo" (mantenimiento de accesorios)
  // En modo blank preview, el ingeniero puede sobreescribir el brand line manualmente
  // (lo guardamos en filledData[_cover_][_brand_line_]); si no hay override, usamos
  // el computado de sistema/módulo.
  const brandLineComputed = table.coverAutoFillFromModulo
    ? [moduloMarca, moduloModelo].filter(Boolean).join(' / ')
    : [sistemaNombre || sistemaModelo, moduloMarca].filter(Boolean).join(' / ');
  const BRAND_LINE_KEY = '_brand_line_';
  const brandLineOverride = selection.filledData[COVER_EXTRA_ROW_ID]?.[BRAND_LINE_KEY];
  const brandLine = brandLineOverride !== undefined ? brandLineOverride : brandLineComputed;
  // Línea secundaria: description del catálogo (ej. "Series 1100 / 1120 / 1200")
  const modelLine = table.description || '';

  const formatFecha = (iso?: string) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('es-AR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return iso; }
  };

  // Separar título: primera parte grande, resto como subtítulo
  const titleParts = titulo.split('/').map(s => s.trim());
  const mainTitle = titleParts[0] || titulo;
  const subTitle = titleParts.length > 1 ? titleParts.slice(1).join(' / ') : '';

  // Carátula PDF: quiebre del título en el guión (' - ' / ' – ' rodeado de espacios;
  // NO parte palabras como "Semi-Micro"). Cada parte va en su propia línea y el guión
  // queda al final de la línea, no colgando suelto.
  const dashSegments = mainTitle.split(/\s+[-–]\s+/).map(s => s.trim()).filter(Boolean);
  const titleLines = dashSegments.length > 1
    ? dashSegments.map((s, i) => (i < dashSegments.length - 1 ? `${s} -` : s))
    : [mainTitle];
  // Auto-ajuste de tamaño: la línea más larga define el tamaño para que entre en una
  // sola línea (heurística por caracteres, estable para html2canvas que no mide el DOM).
  const longestLineLen = Math.max(1, ...titleLines.map(s => s.length));
  const titleFontSize = Math.max(18, Math.min(50, Math.floor(880 / longestLineLen)));
  // El subtítulo acompaña proporcionalmente, con un piso para que siga legible.
  const subTitleFontSize = Math.max(17, Math.round(titleFontSize * 0.48));

  // En blank preview, los datos del bloque grilla se vacían pero la línea de marca/título
  // se conserva. Modelo/fecha/ID/serie/ingeniero quedan en "—" para que el cliente los
  // complete manualmente. Los coverExtraFields también arrancan vacíos.
  const modeloValue = blankPreviewMode
    ? '—'
    : (table.coverAutoFillFromModulo
        ? (moduloModelo || sistemaNombre || sistemaModelo || '—')
        : (sistemaNombre || sistemaModelo || '—'));

  // Campos extra editables (coverExtraFields) — el ingeniero los completa, se persisten
  // en selection.filledData['_cover_'][fieldId]. Se insertan antes de "Ing. de Soporte Técnico".
  const extras: { label: string; value: string; mono?: boolean; editable: true; fieldId: string }[] =
    (table.coverExtraFields ?? []).map(f => ({
      label: f.label || '(sin etiqueta)',
      value: blankPreviewMode ? '' : (selection.filledData[COVER_EXTRA_ROW_ID]?.[f.id] ?? ''),
      editable: true,
      fieldId: f.id,
    }));
  type DatoStatic = { label: string; value: string; mono?: boolean; editable?: false; fieldId?: undefined };
  type DatoEditable = { label: string; value: string; mono?: boolean; editable: true; fieldId: string };
  type DatoEntry = DatoStatic | DatoEditable;
  const datos: DatoEntry[] = [
    { label: 'Fecha', value: blankPreviewMode ? '—' : formatFecha(fecha) },
    { label: 'Modelo', value: modeloValue },
    { label: 'ID', value: blankPreviewMode ? '—' : (agsVisibleId || '—'), mono: true },
    { label: 'N° de Serie', value: blankPreviewMode ? '—' : (numeroSerie || '—'), mono: true },
    ...extras,
    { label: 'Ing. de Soporte Técnico', value: blankPreviewMode ? '—' : (ingenieroNombre || '—') },
  ];

  // Footer data from catalog entry
  const coverQF = table.coverQF || '';
  const coverRevision = table.coverRevision || '';
  const coverFecha = table.coverFecha || '';
  const hasFooter = coverQF || coverRevision || coverFecha;

  const isCompact = useIsCompact();
  const { expanded, toggle, completed, markCompleted } = useAccordionCard(selection.tableId);
  const accordionActive = isCompact && !isPrint;
  const showBody = !accordionActive || expanded;
  const isCompletedStyle = accordionActive && completed;

  if (!isPrint) {
    // Vista previa en formulario — card compacta
    return (
      <div className={`mb-6 rounded-xl border shadow-sm overflow-hidden bg-white ${isCompletedStyle ? 'border-emerald-300' : 'border-slate-200'}`}>
        <div className={`text-white px-4 py-2 flex items-center gap-2 ${isCompletedStyle ? 'bg-emerald-700' : 'bg-slate-800'}`}>
          {accordionActive ? (
            <AccordionHeaderChrome isCompact={accordionActive} expanded={expanded} onToggle={toggle} completed={completed}>
              <p className="text-xs font-bold uppercase tracking-wide text-white">Carátula</p>
            </AccordionHeaderChrome>
          ) : (
            <p className="text-xs font-bold uppercase tracking-wide">Carátula</p>
          )}
        </div>
        <div className="p-6" hidden={!showBody}>
          <div className="flex items-start justify-between mb-4">
            {logoSrc && <img src={logoSrc} alt="AGS" style={{ width: 80 }} />}
          </div>
          <p className="text-xl font-bold text-slate-900 mb-0.5" style={{ fontFamily: 'Inter, sans-serif' }}>{mainTitle}</p>
          {subTitle && <p className="text-sm text-slate-400 mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>{subTitle}</p>}
          {(brandLine || blankPreviewMode) && (
            <div className="flex items-start gap-2 mb-4">
              <div className="w-[3px] rounded bg-blue-900 self-stretch shrink-0" />
              <div className="flex-1">
                {blankPreviewMode ? (
                  <input
                    type="text"
                    value={brandLine}
                    placeholder="Equipo / Marca (editable en blank preview)"
                    onChange={(e) => onChangeData?.(selection.tableId, COVER_EXTRA_ROW_ID, BRAND_LINE_KEY, e.target.value)}
                    className="w-full text-xs font-medium text-slate-700 border border-dashed border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400"
                  />
                ) : (
                  <p className="text-xs font-medium text-slate-700">{brandLine}</p>
                )}
                {modelLine && <p className="text-xs text-slate-500">{modelLine}</p>}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 max-w-sm text-left">
            {datos.map(d => (
              <div key={d.editable ? d.fieldId : d.label}>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400" style={{ fontFamily: 'Inter, sans-serif' }}>{d.label}</p>
                {d.editable ? (
                  <input
                    type="text"
                    value={d.value}
                    onChange={(e) => onChangeData?.(selection.tableId, COVER_EXTRA_ROW_ID, d.fieldId, e.target.value)}
                    placeholder="—"
                    className="w-full text-xs text-slate-700 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-300"
                  />
                ) : (
                  <p className={`text-xs text-slate-700 ${d.mono ? 'font-mono font-medium' : ''}`}>{d.value}</p>
                )}
              </div>
            ))}
          </div>
          {hasFooter && (
            <div className="mt-4 pt-2 border-t border-slate-200 flex justify-between text-[9px] text-slate-400 font-mono">
              {coverQF && <span>{coverQF}</span>}
              {coverRevision && <span>{coverRevision}</span>}
              {coverFecha && <span>{coverFecha}</span>}
            </div>
          )}
        </div>
        {accordionActive && expanded && <AccordionConfirmButton onConfirm={markCompleted} completed={completed} />}
      </div>
    );
  }

  // Vista PDF — estilo editorial AGS
  return (
    <div style={{
      width: '100%',
      height: '100%',
      position: 'relative',
      fontFamily: 'Inter, sans-serif',
      boxSizing: 'border-box',
      overflow: 'hidden',
    }}>
      {/* Fondo degradé diagonal azul — mitad inferior (SVG para compatibilidad con html2canvas) */}
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' preserveAspectRatio='none' viewBox='0 0 100 100'><defs><linearGradient id='g' gradientUnits='userSpaceOnUse' x1='25' y1='-10' x2='75' y2='110'><stop offset='0' stop-color='rgb(255,255,255)' stop-opacity='0'/><stop offset='0.4' stop-color='rgb(255,255,255)' stop-opacity='0'/><stop offset='0.65' stop-color='rgb(30,58,95)' stop-opacity='0.09'/><stop offset='0.85' stop-color='rgb(14,165,233)' stop-opacity='0.06'/><stop offset='1' stop-color='rgb(255,255,255)' stop-opacity='0'/></linearGradient></defs><rect width='100' height='100' fill='url(%23g)'/></svg>")`,
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
        pointerEvents: 'none',
      }} />

      {/* Contenido */}
      <div style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        padding: '10mm 28mm 10mm 28mm',
        height: '100%',
        boxSizing: 'border-box',
      }}>
        {/* Logo arriba-izquierda */}
        {logoSrc && (
          <img src={logoSrc} alt="AGS Analítica" style={{ width: 180, height: 'auto', alignSelf: 'flex-start' }} />
        )}

        {/* Título grande — alineado izquierda */}
        <div style={{ marginTop: '12mm' }}>
          {titleLines.map((line, i) => (
            <p key={i} style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: titleFontSize,
              fontWeight: 700,
              color: '#1e293b',
              lineHeight: 1.1,
              textAlign: 'left',
              margin: 0,
            }}>{line}</p>
          ))}
          {subTitle && (
            <p style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: subTitleFontSize,
              fontWeight: 400,
              color: '#94a3b8',
              lineHeight: 1.3,
              textAlign: 'left',
              marginTop: '6mm',
            }}>{subTitle}</p>
          )}
        </div>

        {/* Barra vertical + marca/modelo */}
        {brandLine && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            marginTop: '10mm',
          }}>
            <div style={{
              width: 3,
              minHeight: 36,
              borderRadius: 2,
              background: '#1e3a5f',
              flexShrink: 0,
              alignSelf: 'stretch',
            }} />
            <div>
              <p style={{
                fontSize: 16,
                fontWeight: 500,
                color: '#334155',
              }}>{brandLine}</p>
              {modelLine && (
                <p style={{
                  fontSize: 16,
                  fontWeight: 400,
                  color: '#64748b',
                  marginTop: 2,
                }}>{modelLine}</p>
              )}
            </div>
          </div>
        )}

        {/* Spacer flexible */}
        <div style={{ flex: 1 }} />

        {/* Datos — grilla 2 columnas */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '14px 30px',
          maxWidth: 460,
          width: '100%',
          marginBottom: '46mm',
        }}>
          {datos.map(d => (
            <div key={d.editable ? d.fieldId : d.label}>
              <p style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 9,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 1.5,
                color: '#94a3b8',
                marginBottom: 3,
              }}>{d.label}</p>
              <p style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: d.mono ? 13 : 15,
                fontWeight: d.mono ? 500 : 400,
                color: '#1e293b',
                paddingBottom: 6,
                borderBottom: '1px solid #e2e8f0',
              }}>{d.value || '—'}</p>
            </div>
          ))}
        </div>

        {/* Footer — QF / Rev / Fecha */}
        {hasFooter && (
          <>
            <div style={{
              width: '100%',
              height: 1,
              backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='1' preserveAspectRatio='none' viewBox='0 0 100 1'><defs><linearGradient id='d' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='%231e293b'/><stop offset='0.5' stop-color='%230EA5E9'/><stop offset='1' stop-color='%231e293b' stop-opacity='0.8'/></linearGradient></defs><rect width='100' height='1' fill='url(%23d)'/></svg>")`,
              backgroundSize: '100% 100%',
              backgroundRepeat: 'no-repeat',
            }} />
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: 6,
            }}>
              {coverQF && <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 500, color: '#94a3b8' }}>{coverQF}</p>}
              {coverRevision && <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 500, color: '#94a3b8' }}>{coverRevision}</p>}
              {coverFecha && <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 500, color: '#94a3b8' }}>{coverFecha}</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
