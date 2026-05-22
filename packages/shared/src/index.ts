// Exportar tipos compartidos
export * from './types';

// Exportar servicios compartidos
export * from './services/fcm';
export * from './services/leads';
export * from './services/qfDocumentos';

// Exportar hooks compartidos
export * from './hooks/useResizableColumns';
export * from './hooks/useUrlFilters';

// Exportar utilidades compartidas
export * from './utils';
// Phase 14 BOM-02 — helpers puros de Patron BOM. Re-export flat para `from '@ags/shared'`
// (los consumidores que prefieran el deep import siguen usando `from '@ags/shared/utils/patronBom'`).
export * from './utils/patronBom';
