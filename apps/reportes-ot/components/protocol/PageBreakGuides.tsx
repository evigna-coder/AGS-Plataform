import React from 'react';

/** Número de guías (páginas A4) a dibujar; suficiente para protocolos largos */
const NUM_GUIDES = 15;
const PAGE_HEIGHT_MM = 297;

/**
 * Líneas horizontales cada 297mm dentro del protocolo para que el usuario vea
 * dónde caerá aproximadamente el corte de hoja A4. Solo visible en pantalla (oculto al imprimir/PDF).
 */
export const PageBreakGuides: React.FC = () => {
  return (
    <div
      className="page-break-guides pointer-events-none absolute inset-0 z-10 print:hidden"
      aria-hidden
    >
      {Array.from({ length: NUM_GUIDES }, (_, i) => {
        const topMm = (i + 1) * PAGE_HEIGHT_MM;
        return (
          <div
            key={i}
            className="absolute left-0 right-0 border-t-2 border-dashed border-red-300/60"
            style={{
              top: `${topMm}mm`,
              height: 0,
            }}
          />
        );
      })}
    </div>
  );
};
