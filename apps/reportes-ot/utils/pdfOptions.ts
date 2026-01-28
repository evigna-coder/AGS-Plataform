/**
 * Genera las opciones de configuración para html2pdf
 * Centraliza todas las opciones de PDF para mantener consistencia
 * 
 * @param otNumber - Número de orden de trabajo para el nombre del archivo
 * @param element - Elemento HTML del contenedor del PDF
 * @param includeBackgroundColor - Si incluir backgroundColor en html2canvas (default: false)
 * @returns Objeto de opciones para html2pdf
 */
export const getPDFOptions = (
  otNumber: string,
  element: HTMLElement,
  includeBackgroundColor: boolean = false
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
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
  };

  // Agregar backgroundColor solo si se solicita (para generatePDFBlob)
  if (includeBackgroundColor) {
    baseOptions.html2canvas.backgroundColor = '#ffffff';
  }

  return baseOptions;
};
