import type { InstrumentoPatronOption } from '../types/instrumentos';

interface Props {
  instrumentos: InstrumentoPatronOption[];
}

/** Página A4 oculta con tabla de instrumentos/patrones para el PDF. */
export const InstrumentosPDFSection: React.FC<Props> = ({ instrumentos }) => {
  if (instrumentos.length === 0) return null;

  const formatVencimiento = (v?: string | null) => {
    if (!v) return '—';
    const d = new Date(v);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div
      className="protocol-page"
      style={{
        width: '210mm',
        height: '297mm',
        background: 'white',
        boxSizing: 'border-box',
        padding: '10mm',
        overflow: 'hidden',
        pageBreakAfter: 'always',
      }}
    >
      <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: '#1e293b' }}>
        Instrumentos y Patrones Utilizados
      </h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
        <thead>
          <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
            <th style={thStyle}>Identificación</th>
            <th style={thStyle}>Tipo</th>
            <th style={thStyle}>Marca</th>
            <th style={thStyle}>Modelo</th>
            <th style={thStyle}>Nº Serie</th>
            <th style={thStyle}>Certificado</th>
            <th style={thStyle}>Vencimiento</th>
          </tr>
        </thead>
        <tbody>
          {instrumentos.map(inst => (
            <tr key={inst.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={tdStyle}>{inst.nombre}</td>
              <td style={tdStyle}>{inst.tipo === 'patron' ? 'Patrón' : 'Instrumento'}</td>
              <td style={tdStyle}>{inst.marca || '—'}</td>
              <td style={tdStyle}>{inst.modelo || '—'}</td>
              <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{inst.serie || '—'}</td>
              <td style={tdStyle}>{inst.certificadoEmisor || '—'}</td>
              <td style={tdStyle}>{formatVencimiento(inst.certificadoVencimiento)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const thStyle: React.CSSProperties = {
  padding: '4px 6px',
  textAlign: 'left',
  fontWeight: 600,
  color: '#475569',
  borderBottom: '1px solid #cbd5e1',
};

const tdStyle: React.CSSProperties = {
  padding: '4px 6px',
  color: '#334155',
};
