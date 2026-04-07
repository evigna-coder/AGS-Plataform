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
 * Carátula del protocolo. Se renderiza como página completa A4.
 * Los datos dinámicos (fecha, OT, equipo, ingeniero) se inyectan desde la OT.
 * El título y subtítulo vienen de la tabla del catálogo (name / description).
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
  // Subtítulo dinámico: "sistema — marca" (ej. "HPLC 1260 — Agilent")
  const partes = [sistemaNombre || sistemaModelo, moduloMarca].filter(Boolean);
  const subtitulo = partes.length > 0 ? partes.join(' — ') : (table.description || '');

  const formatFecha = (iso?: string) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return iso; }
  };

  const datos = [
    { label: 'Fecha', value: formatFecha(fechaInicio) },
    { label: 'Orden de Servicio', value: otNumber || '—', mono: true },
    { label: 'ID Equipo', value: agsVisibleId || '—', mono: true },
    { label: 'N° de Serie', value: numeroSerie || '—' },
    { label: 'Realizado por', value: ingenieroNombre || '—' },
  ];

  if (!isPrint) {
    // Vista previa en formulario — card compacta
    return (
      <div className="mb-6 rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
        <div className="bg-slate-800 text-white px-4 py-2">
          <p className="text-xs font-bold uppercase tracking-wide">Carátula</p>
        </div>
        <div className="p-6 text-center">
          {logoSrc && <img src={logoSrc} alt="AGS" className="mx-auto mb-4" style={{ width: 100 }} />}
          <p className="text-lg font-semibold text-slate-900 mb-1" style={{ fontFamily: 'Newsreader, serif' }}>{titulo}</p>
          {subtitulo && <p className="text-sm text-slate-500 mb-4" style={{ fontFamily: 'Newsreader, serif' }}>{subtitulo}</p>}
          <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto text-left">
            {datos.map(d => (
              <div key={d.label}>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{d.label}</p>
                <p className={`text-xs text-slate-700 ${d.mono ? 'font-mono font-medium' : ''}`}>{d.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Vista PDF — página completa A4 con fondo agua diagonal
  return (
    <div style={{
      width: '100%',
      height: '100%',
      position: 'relative',
      fontFamily: 'Inter, sans-serif',
      boxSizing: 'border-box',
      overflow: 'hidden',
    }}>
      {/* Fondo degradé diagonal desde esquina inferior derecha */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(30deg, rgba(13,110,110,0.13) 0%, rgba(14,165,233,0.06) 35%, rgba(255,255,255,0) 60%)',
        pointerEvents: 'none',
      }} />
      {/* Halo radial decorativo esquina inferior derecha */}
      <div style={{
        position: 'absolute',
        bottom: -50,
        right: -50,
        width: 400,
        height: 400,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(14,165,233,0.08) 0%, rgba(14,165,233,0) 70%)',
        pointerEvents: 'none',
      }} />

      {/* Contenido */}
      <div style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '18mm 20mm 20mm',
        height: '100%',
        boxSizing: 'border-box',
      }}>
        {/* Logo arriba */}
        {logoSrc && (
          <img src={logoSrc} alt="AGS Analítica" style={{ width: 200, height: 'auto' }} />
        )}

        {/* Título + separador + subtítulo — zona superior */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '7mm',
          marginTop: '30mm',
        }}>
          <p style={{
            fontFamily: 'Newsreader, serif',
            fontSize: 36,
            fontWeight: 600,
            color: '#1e293b',
            lineHeight: 1.2,
            textAlign: 'center',
          }}>{titulo}</p>

          <div style={{
            width: 60,
            height: 2,
            background: 'linear-gradient(90deg, #0D6E6E, #0EA5E9)',
          }} />

          {subtitulo && (
            <p style={{
              fontFamily: 'Newsreader, serif',
              fontSize: 20,
              fontWeight: 400,
              color: '#64748b',
              lineHeight: 1.3,
              textAlign: 'center',
            }}>{subtitulo}</p>
          )}
        </div>

        {/* Spacer flexible — empuja datos hacia abajo, con tope */}
        <div style={{ flex: 1, maxHeight: '50mm' }} />

        {/* Datos — grilla 2 columnas */}
        <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px 36px',
            maxWidth: 460,
            width: '100%',
            marginTop: '8mm',
          }}>
            {datos.map(d => (
              <div key={d.label}>
                <p style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 8,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: 1.5,
                  color: '#64748b',
                  marginBottom: 3,
                }}>{d.label}</p>
                <p style={{
                  fontFamily: d.mono ? 'JetBrains Mono, monospace' : 'Inter, sans-serif',
                  fontSize: d.mono ? 12 : 13,
                  fontWeight: d.mono ? 500 : 400,
                  color: '#1e293b',
                  paddingBottom: 6,
                  borderBottom: '1px solid #e2e8f0',
                }}>{d.value}</p>
              </div>
            ))}
          </div>
      </div>
    </div>
  );
};
