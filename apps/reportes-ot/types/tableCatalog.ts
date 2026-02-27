// Tipos del catálogo de tablas, espejo de @ags/shared.
// Se definen localmente porque reportes-ot no usa el paquete shared.

export type TableCatalogColumnType =
  | 'text_input'
  | 'number_input'
  | 'checkbox'
  | 'fixed_text'
  | 'date_input'
  | 'pass_fail';

export interface TableCatalogColumn {
  key: string;
  label: string;
  type: TableCatalogColumnType;
  unit?: string | null;
  required: boolean;
  expectedValue?: string | null;
  fixedValue?: string | null;
}

export interface TableCatalogRow {
  rowId: string;
  cells: Record<string, string | number | boolean | null>;
  isTitle?: boolean;
  titleText?: string | null;
}

export interface TableCatalogRule {
  ruleId: string;
  description: string;
  sourceColumn: string;
  operator: '<=' | '>=' | '<' | '>' | '==' | '!=';
  factoryThreshold: string | number;
  unit?: string | null;
  targetColumn: string;
  valueIfPass: string;
  valueIfFail: string;
}

export interface TableCatalogEntry {
  id: string;
  name: string;
  description?: string | null;
  sysType: string;
  isDefault: boolean;
  tableType: 'validation' | 'informational' | 'instruments';
  columns: TableCatalogColumn[];
  templateRows: TableCatalogRow[];
  validationRules: TableCatalogRule[];
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

/** Una tabla del catálogo completada por el técnico durante la ejecución de una OT. */
export interface ProtocolSelection {
  tableId: string;
  tableName: string;
  /** Snapshot de la definición al momento de seleccionar (para renderizar sin Firestore) */
  tableSnapshot: TableCatalogEntry;
  /** Filas completadas con los valores medidos. key = rowId */
  filledData: Record<string, Record<string, string>>;
  observaciones?: string | null;
  resultado: 'CONFORME' | 'NO_CONFORME' | 'PENDIENTE';
  seleccionadoAt: string;
}
