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
  /**
   * '<=' | '>=' | '<' | '>' | '==' | '!=' : compara sourceColumn contra factoryThreshold
   * 'vs_spec' : compara sourceColumn (Resultado) contra el valor por fila en specColumn (Especificación)
   */
  operator: '<=' | '>=' | '<' | '>' | '==' | '!=' | 'vs_spec';
  /** Umbral fijo. Para 'vs_spec', almacena la clave de specColumn como referencia. */
  factoryThreshold: string | number;
  /** Para 'vs_spec': clave de la columna que contiene la especificación esperada por fila. */
  specColumn?: string | null;
  unit?: string | null;
  targetColumn: string;
  valueIfPass: string;
  valueIfFail: string;
}

// --- Checklist types (espejo de @ags/shared) ---

export type ChecklistItemType = 'checkbox' | 'value_input' | 'pass_fail';

export interface ChecklistItem {
  itemId: string;
  label: string;
  itemType: ChecklistItemType;
  unit?: string | null;
  depth: 0 | 1 | 2 | 3;
  canBeNA?: boolean;
  numberPrefix?: string | null;
}

export type ChecklistItemAnswer =
  | { itemType: 'checkbox'; checked: boolean }
  | { itemType: 'value_input'; value: string }
  | { itemType: 'pass_fail'; result: 'CUMPLE' | 'NO_CUMPLE' | 'NA' | '' };

export interface TableCatalogEntry {
  id: string;
  name: string;
  description?: string | null;
  sysType: string;
  isDefault: boolean;
  tableType: 'validation' | 'informational' | 'instruments' | 'checklist';
  columns: TableCatalogColumn[];
  templateRows: TableCatalogRow[];
  validationRules: TableCatalogRule[];
  allowClientSpec?: boolean;
  tipoServicio?: string[];
  /** Ítems del checklist (solo cuando tableType === 'checklist') */
  checklistItems?: ChecklistItem[];
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

/** Una tabla/checklist del catálogo completada por el técnico durante la ejecución de una OT. */
export interface ProtocolSelection {
  tableId: string;
  tableName: string;
  /** Snapshot de la definición al momento de seleccionar (para renderizar sin Firestore) */
  tableSnapshot: TableCatalogEntry;
  /** Filas completadas. key = rowId (solo para tableType != 'checklist') */
  filledData: Record<string, Record<string, string>>;
  observaciones?: string | null;
  resultado: 'CONFORME' | 'NO_CONFORME' | 'PENDIENTE';
  seleccionadoAt: string;
  clientSpecEnabled?: boolean;
  /** Respuestas del técnico (solo para tableType === 'checklist') */
  checklistData?: Record<string, ChecklistItemAnswer>;
  /** itemIds de secciones marcadas "No Aplica" por el técnico */
  collapsedSections?: string[];
}
