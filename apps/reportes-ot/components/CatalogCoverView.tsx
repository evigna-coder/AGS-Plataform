import React from 'react';
import type { ProtocolSelection } from '../types/tableCatalog';

interface Props {
  selection: ProtocolSelection;
  isPrint?: boolean;
  /** Datos de la OT que se inyectan automáticamente */
  otNumber?: string;
  fechaInicio?: string;
  sistemaNombre?: string;
  sistemaModelo?: string;
  moduloMarca?: string;
  agsVisibleId?: string;
  numeroSerie?: string;
  ingenieroNombre?: string;
  logoSrc?: string;
}

/**
 * Carátula del protocolo — estilo editorial AGS.
 * Logo arriba-izquierda, título grande serif, barra vertical con marca,
 * datos en grilla abajo, footer con QF/Rev/Fecha.
 */
export const CatalogCoverView: React.FC<Props> = ({
  selection,
  isPrint = false,
  otNumber,
  fechaInicio,
  sistemaNombre,
  sistemaModelo,
  moduloMarca,
  agsVisibleId,
  numeroSerie,
  ingenieroNombre,
  logoSrc,
}) => {
  const table = selection.tableSnapshot;
  const titulo = table.name || 'Protocolo';
  // Línea principal de marca: "sistema — marca"
  const brandLine = [sistemaNombre || sistemaModelo, moduloMarca].filter(Boolean).join(' / ');
  // Línea secundaria: description del catálogo (ej. "Series 1100 / 1120 / 1200")
  const modelLine = table.description || '';

  const formatFecha = (iso?: string) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return iso; }
  };

  // Separar título: primera parte grande, resto como subtítulo
  const titleParts = titulo.split('/').map(s => s.trim());
  const mainTitle = titleParts[0] || titulo;
  const subTitle = titleParts.length > 1 ? titleParts.slice(1).join(' / ') : '';

  const datos = [
    { label: 'Fecha', value: formatFecha(fechaInicio) },
    { label: 'Modelo', value: sistemaNombre || sistemaModelo || '—' },
    { label: 'ID', value: agsVisibleId || '—', mono: true },
    { label: 'N° de Serie', value: numeroSerie || '—', mono: true },
    { label: 'Realizado por', value: ingenieroNombre || '—' },
  ];

  // Footer data from catalog entry
  const coverQF = table.coverQF || '';
  const coverRevision = table.coverRevision || '';
  const coverFecha = table.coverFecha || '';
  const hasFooter = coverQF || coverRevision || coverFecha;

  if (!isPrint) {
    // Vista previa en formulario — card compacta
    return (
      <div className="mb-6 rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
        <div className="bg-slate-800 text-white px-4 py-2">
          <p className="text-xs font-bold uppercase tracking-wide">Carátula</p>
        </div>
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            {logoSrc && <img src={logoSrc} alt="AGS" style={{ width: 80 }} />}
          </div>
          <p className="text-xl font-bold text-slate-900 mb-0.5" style={{ fontFamily: 'Newsreader, serif' }}>{mainTitle}</p>
          {subTitle && <p className="text-sm text-slate-400 mb-3" style={{ fontFamily: 'Newsreader, serif' }}>{subTitle}</p>}
          {brandLine && (
            <div className="flex items-start gap-2 mb-4">
              <div className="w-[3px] rounded bg-blue-900 self-stretch shrink-0" />
              <div>
                <p className="text-xs font-medium text-slate-700">{brandLine}</p>
                {modelLine && <p className="text-xs text-slate-500">{modelLine}</p>}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 max-w-sm text-left">
            {datos.map(d => (
              <div key={d.label}>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{d.label}</p>
                <p className={`text-xs text-slate-700 ${d.mono ? 'font-mono font-medium' : ''}`}>{d.value}</p>
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
      {/* Fondo degradé diagonal azul — mitad inferior */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(150deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0) 40%, rgba(30,58,95,0.09) 65%, rgba(14,165,233,0.06) 85%, rgba(255,255,255,0) 100%)',
        pointerEvents: 'none',
      }} />

      {/* Contenido */}
      <div style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        padding: '22mm 28mm 10mm 28mm',
        height: '100%',
        boxSizing: 'border-box',
      }}>
        {/* Logo arriba-izquierda */}
        {logoSrc && (
          <img src={logoSrc} alt="AGS Analítica" style={{ width: 140, height: 'auto', alignSelf: 'flex-start' }} />
        )}

        {/* Título grande — alineado izquierda */}
        <div style={{ marginTop: '14mm' }}>
          <p style={{
            fontFamily: 'Newsreader, serif',
            fontSize: 46,
            fontWeight: 700,
            color: '#1e293b',
            lineHeight: 1.1,
            textAlign: 'left',
          }}>{mainTitle}</p>
          {subTitle && (
            <p style={{
              fontFamily: 'Newsreader, serif',
              fontSize: 18,
              fontWeight: 400,
              color: '#94a3b8',
              lineHeight: 1.3,
              textAlign: 'left',
              marginTop: 4,
            }}>{subTitle}</p>
          )}
        </div>

        {/* Barra vertical + marca/modelo */}
        {brandLine && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            marginTop: '8mm',
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
                fontSize: 12,
                fontWeight: 500,
                color: '#334155',
              }}>{brandLine}</p>
              {modelLine && (
                <p style={{
                  fontSize: 12,
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
          marginBottom: '12mm',
        }}>
          {datos.map(d => (
            <div key={d.label}>
              <p style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 7,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 1.5,
                color: '#94a3b8',
                marginBottom: 3,
              }}>{d.label}</p>
              <p style={{
                fontFamily: d.mono ? 'JetBrains Mono, monospace' : 'Inter, sans-serif',
                fontSize: d.mono ? 11 : 13,
                fontWeight: d.mono ? 500 : 400,
                color: '#1e293b',
                paddingBottom: 6,
                borderBottom: '1px solid #e2e8f0',
              }}>{d.value}</p>
            </div>
          ))}
        </div>

        {/* Footer — QF / Rev / Fecha */}
        {hasFooter && (
          <>
            <div style={{
              width: '100%',
              height: 1,
              background: 'linear-gradient(90deg, #1e293b, #0EA5E9, #1e293bCC)',
            }} />
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: 6,
            }}>
              {coverQF && <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 7, fontWeight: 500, color: '#94a3b8' }}>{coverQF}</p>}
              {coverRevision && <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 7, fontWeight: 500, color: '#94a3b8' }}>{coverRevision}</p>}
              {coverFecha && <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 7, fontWeight: 500, color: '#94a3b8' }}>{coverFecha}</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
