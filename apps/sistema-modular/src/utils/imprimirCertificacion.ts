import type { Certificacion } from '@ags/shared';

/**
 * Abre el resumen de servicios a certificar en una pestaña nueva (2026-08-17).
 *
 * Import DINAMICO: react-pdf y los logos en base64 pesan, y este modulo lo
 * consume una pantalla del chunk principal. Solo se necesita al apretar el
 * boton — mismo patron que la hoja de OT y los remitos.
 */
export async function abrirPdfCertificacion(cert: Certificacion): Promise<void> {
  const [{ CertificacionLotePDF }, { openRemitoPdfInNewTab }, shared, React] = await Promise.all([
    import('../components/certificaciones/pdf/CertificacionLotePDF'),
    import('./remitoPdfActions'),
    import('@ags/shared'),
    import('react'),
  ]);
  const items = shared.itemsDeCertificacion(cert);
  const totales = shared.totalesCertificados(shared.recibidasDeCertificacion(cert));
  await openRemitoPdfInNewTab(React.createElement(CertificacionLotePDF, { cert, items, totales }));
}
