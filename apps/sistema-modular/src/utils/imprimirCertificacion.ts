import type { Certificacion } from '@ags/shared';
import type { DocumentProps } from '@react-pdf/renderer';
import type { ReactElement } from 'react';
import { abrirVentanaParaPdf } from './ventanaPdf';

/**
 * Abre el resumen de servicios a certificar (2026-08-17).
 *
 * En ELECTRON el PDF se guarda como archivo temporal y lo abre el visor del
 * sistema, igual que el presupuesto (2026-09-04). Antes se intentaba
 * `window.open` + blob: Electron manda cualquier ventana que no sea de la app
 * al navegador externo, y Windows respondía "obtener una aplicación para
 * abrir este vínculo blob".
 *
 * En el navegador va a una pestaña nueva pedida ANTES de generar: si se pide
 * después de un await el navegador ya no ve el click y bloquea el pop-up.
 *
 * Import DINAMICO: react-pdf y los logos en base64 pesan, y este modulo lo
 * consume una pantalla del chunk principal.
 */
export async function abrirPdfCertificacion(cert: Certificacion): Promise<void> {
  const enElectron = !!window.electronAPI?.saveTempAndOpen;
  const ventana = enElectron ? null : abrirVentanaParaPdf(`Certificación ${cert.clienteNombre ?? ''}`.trim());

  try {
    const [{ CertificacionLotePDF }, acciones, shared, React, { clientesService, establecimientosService }] = await Promise.all([
      import('../components/certificaciones/pdf/CertificacionLotePDF'),
      import('./remitoPdfActions'),
      import('@ags/shared'),
      import('react'),
      import('../services/firebaseService'),
    ]);
    const items = shared.itemsDeCertificacion(cert);
    const totales = shared.totalesCertificados(shared.recibidasDeCertificacion(cert));
    // Cliente y planta para el bloque de la cabecera. La planta solo si el
    // lote es de una sola; con varias, cada línea de la tabla dice la suya.
    const [cliente, establecimiento] = await Promise.all([
      cert.clienteId ? clientesService.getById(cert.clienteId).catch(() => null) : Promise.resolve(null),
      cert.establecimientoIds?.length === 1
        ? establecimientosService.getById(cert.establecimientoIds[0]).catch(() => null)
        : Promise.resolve(null),
    ]);
    const documento = React.createElement(CertificacionLotePDF, { cert, items, totales, cliente, establecimiento }) as unknown as ReactElement<DocumentProps>;

    if (enElectron) {
      const { pdf } = await import('@react-pdf/renderer');
      const blob = await pdf(documento).toBlob();
      const nombre = `certificacion-${(cert.clienteNombre ?? 'cliente').replace(/[^\w.\- ]/g, '_')}-${cert.periodo ?? cert.id.slice(0, 6)}.pdf`;
      await window.electronAPI!.saveTempAndOpen!(new Uint8Array(await blob.arrayBuffer()), nombre);
      return;
    }
    await acciones.openRemitoPdfInNewTab(documento, ventana);
  } catch (err) {
    // Sin esto queda una pestaña en blanco abierta para siempre y el usuario
    // no entiende qué pasó.
    ventana?.close();
    throw err;
  }
}
