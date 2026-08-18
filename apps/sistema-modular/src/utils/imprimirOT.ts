/**
 * Imprime la hoja de una OT (2026-08-14).
 *
 * Impresion DIRECTA a la impresora predeterminada via Electron, igual que los
 * remitos: la primera version abria el PDF en una pestaña y en Electron eso cae
 * al "guardar como", que no es lo que se quiere — la hoja se imprime y se pone
 * arriba del modulo. Fuera de Electron (o si la impresion falla) cae a abrir el
 * PDF para Ctrl+P, que es el unico camino posible en el browser.
 *
 * Todo lo pesado —react-pdf, el documento, la carga de datos— entra por import
 * DINAMICO a proposito: el listado de OT y el modal de edicion viven en el
 * chunk principal, y arrastrar el pipeline de PDF ahi lo hace crecer hasta
 * romper el build de vite con "Parse error @:1:1". Solo se necesita al apretar
 * el boton.
 *
 * Devuelve `true` si salio impresa sin dialogos.
 */
export async function imprimirOT(otNumber: string): Promise<boolean> {
  const [{ cargarDatosImpresionOT }, { OTPrintablePDF }, { printRemitoSilentOrOpen }, React] =
    await Promise.all([
      import('./otPrintData'),
      import('../components/ordenes-trabajo/pdf/OTPrintablePDF'),
      import('./remitoPdfActions'),
      import('react'),
    ]);
  const datos = await cargarDatosImpresionOT(otNumber);
  return printRemitoSilentOrOpen(React.createElement(OTPrintablePDF, { d: datos }));
}
