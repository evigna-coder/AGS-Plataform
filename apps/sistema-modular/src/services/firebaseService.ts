// Barrel re-export for backward compatibility
// All services have been split into domain-specific files.
// This file re-exports everything so existing imports continue to work.

export * from './firebase';
export * from './clientesService';
export * from './establecimientosService';
export * from './equiposService';
export * from './otService';
export * from './leadsService';
export * from './presupuestosService';
export * from './stockService';
export * from './catalogService';
export * from './patronesService';
export * from './columnasService';
export * from './personalService';
export * from './agendaService';
export * from './fichasService';
// Phase 15 (VLN-02): explicit re-exports — loanersService also exports
// `__setTestFirestore` (test-DI hook) which collides with the same name from
// patronesService. The test hook MUST NOT leak through the barrel; callers
// reach it via `import { __setTestFirestore } from './loanersService'` directly.
// `registrarVenta` (named export) is also test-friendly; production callers use
// `loanersService.registrarVenta(...)` via the object.
export { loanersService } from './loanersService';
export type { RegistrarVentaParams, RegistrarVentaResult } from './loanersService';
export * from './importacionesService';
export * from './asignacionesService';
export * from './ingresoEmpresasService';
export * from './vehiculosService';
export * from './dispositivosService';
export * from './facturacionService';
export * from './contratosService';
export {
  linkEquivalencia,
  unlinkEquivalencia,
  findOrigenDeDestino,
  desagregarUnidades,
  recomputeEquivalenciaDenormalization,
} from './equivalenciasService';
