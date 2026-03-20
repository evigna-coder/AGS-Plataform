/**
 * Genera las opciones de configuración para html2pdf
 * Centraliza todas las opciones de PDF para mantener consistencia
 *
 * @param otNumber - Número de orden de trabajo para el nombre del archivo
 * @param element - Elemento HTML del contenedor del PDF
 * @param includeBackgroundColor - Si incluir backgroundColor en html2canvas (default: false)
 * @param forAnexo - Si es true, usa pagebreak que permite múltiples páginas (css + legacy) para anexos largos
 * @returns Objeto de opciones para html2pdf
 */
export const getPDFOptions = (
  otNumber: string,
  element: HTMLElement,
  includeBackgroundColor: boolean = false,
  forAnexo: boolean = false
): any => {
  const baseOptions: any = {
    margin: [3, 0, 3, 1], // [top, right, bottom, left] en mm
    filename: `${otNumber}_Reporte_AGS.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: Math.max(window.devicePixelRatio * 2, 3),
      useCORS: true,
      logging: false,
      letterRendering: true,
      allowTaint: false,
      x: 0,
      y: 0,
      scrollX: 0,
      scrollY: 0,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight
    },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait',
      compress: true
    },
    // Anexo: permitir cortes con .break-before-page / .html2pdf__page-break (css + legacy). Hoja 1: evitar cortes.
    pagebreak: forAnexo
      ? { mode: ['css', 'legacy'] }
      : { mode: ['avoid-all', 'css', 'legacy'] }
  };

  // Hoja 1 o anexo: fondo blanco para evitar transparencias en PDF
  if (includeBackgroundColor || forAnexo) {
    baseOptions.html2canvas.backgroundColor = '#ffffff';
  }

  return baseOptions;
};
