import type { Certificacion } from '@ags/shared';
import { abrirVentanaParaPdf } from './ventanaPdf';

/**
 * Abre el resumen de servicios a certificar en una pestaña nueva (2026-08-17).
 *
 * Import DINAMICO: react-pdf y los logos en base64 pesan, y este modulo lo
 * consume una pantalla del chunk principal. Solo se necesita al apretar el
 * boton — mismo patron que la hoja de OT y los remitos.
 */
export async function abrirPdfCertificacion(cert: Certificacion): Promise<void> {
  // PRIMERA instrucción, sin ningún await antes: si la ventana se pide después
  // de un await el navegador ya no ve el click y bloquea el pop-up (2026-08-23).
  const ventana = abrirVentanaParaPdf(`Certificación ${cert.clienteNombre ?? ''}`.trim());

  try {
    const [{ CertificacionLotePDF }, { openRemitoPdfInNewTab }, shared, React] = await Promise.all([
      import('../components/certificaciones/pdf/CertificacionLotePDF'),
      import('./remitoPdfActions'),
      import('@ags/shared'),
      import('react'),
    ]);
    const items = shared.itemsDeCertificacion(cert);
    const totales = shared.totalesCertificados(shared.recibidasDeCertificacion(cert));
    await openRemitoPdfInNewTab(
      React.createElement(CertificacionLotePDF, { cert, items, totales }), ventana,
    );
  } catch (err) {
    // Sin esto queda una pestaña en blanco abierta para siempre y el usuario
    // no entiende qué pasó.
    ventana?.close();
    throw err;
  }
}
