export { generatePresupuestoPDF, downloadPresupuestoPDF, previewPresupuestoPDF } from './generatePresupuestoPDF';
export type { GeneratePDFParams } from './generatePresupuestoPDF';
export type { PresupuestoPDFData } from './PresupuestoPDFEstandar';

// Phase 4 — Anexo de consumibles
export {
  AnexoConsumiblesPDF,
  generateAnexoConsumiblesPDF,
} from './AnexoConsumiblesPDF';
export type {
  AnexoConsumiblesData,
  AnexoModuloEntry,
} from './AnexoConsumiblesPDF';
export {
  buildAnexosFromPresupuesto,
} from './buildAnexosFromPresupuesto';
export type {
  AnexoBuildResult,
  AnexoBuildWarning,
  BuildAnexosInput,
} from './buildAnexosFromPresupuesto';
