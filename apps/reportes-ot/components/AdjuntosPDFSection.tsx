import type { AdjuntoMeta } from '../types/instrumentos';

interface Props {
  adjuntos: AdjuntoMeta[];
}

const PAGE_STYLE: React.CSSProperties = {
  width: '210mm',
  height: '297mm',
  background: 'white',
  boxSizing: 'border-box',
  padding: '10mm',
  overflow: 'hidden',
  pageBreakAfter: 'always',
};

/**
 * Páginas A4 ocultas con fotos y archivos adjuntos para el PDF.
 * Layout: 2 imágenes por página con caption.
 */
export const AdjuntosPDFSection: React.FC<Props> = ({ adjuntos }) => {
  const imageAdjuntos = adjuntos.filter(a => a.mimeType.startsWith('image/'));
  if (imageAdjuntos.length === 0) return null;

  // Agrupar de a 2 por página
  const pages: AdjuntoMeta[][] = [];
  for (let i = 0; i < imageAdjuntos.length; i += 2) {
    pages.push(imageAdjuntos.slice(i, i + 2));
  }

  return (
    <>
      {pages.map((pageItems, pageIdx) => (
        <div key={pageIdx} className="protocol-page" style={PAGE_STYLE}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px', color: '#1e293b' }}>
            Registro Fotográfico{pages.length > 1 ? ` (${pageIdx + 1}/${pages.length})` : ''}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: 'calc(100% - 30px)' }}>
            {pageItems.map(adj => (
              <div key={adj.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #e2e8f0',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  background: '#f8fafc',
                  minHeight: 0,
                }}>
                  <img
                    src={adj.url}
                    alt={adj.caption || adj.fileName}
                    crossOrigin="anonymous"
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                </div>
                {adj.caption && (
                  <p style={{ fontSize: '10px', color: '#475569', marginTop: '4px', textAlign: 'center' }}>
                    {adj.caption}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
};
