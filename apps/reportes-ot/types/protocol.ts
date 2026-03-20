/**
 * Tipos para plantillas y datos de protocolo (anexos al reporte).
 * Ver docs/PROTOCOL_TEMPLATES_SPEC.md
 */

export type ProtocolSectionType = 'text' | 'checklist' | 'table' | 'signatures';

/** Modo de render del protocolo: edit (sin paginar), preview (con spacer), pdf (paginado A4). */
export type ProtocolRenderMode = 'edit' | 'preview' | 'pdf';

/** Modo simplificado: edit = scroll continuo; print = preview/PDF con paginado y no cortar tablas. */
export type ProtocolViewMode = 'edit' | 'print';

export interface ProtocolTextSection {
  id: string;
  type: 'text';
  title?: string;
  content: string;
  /** Fuerza salto de página CSS antes de renderizar la sección (para html2pdf). */
  pageBreakBefore?: boolean;
}

export interface ProtocolChecklistItem {
  id: string;
  label: string;
  required?: boolean;
  value?: boolean;
}

export interface ProtocolChecklistSection {
  id: string;
  type: 'checklist';
  title?: string;
  items: ProtocolChecklistItem[];
  pageBreakBefore?: boolean;
}

/** Opciones de grupo tipo "Cumple / No cumple / No aplica" (solo una opción por grupo). */
export interface ProtocolTableCellCheckboxGroup {
  groupId: string;
  option: string;
}

/** Tipo de celda: text | checkbox | input (input = cuadro de texto editable). */
export type ProtocolCellType = 'text' | 'checkbox' | 'input';

export interface ProtocolTableCell {
  type: ProtocolCellType;
  value?: string | boolean;
  /** Si true, el input estará deshabilitado (solo lectura). */
  readOnly?: boolean;
  /** Valor inicial si no hay data guardada. */
  defaultValue?: string | number | boolean;
  /** Para ocultar labels redundantes si hace falta. */
  hidden?: boolean;
  /** V2: celdas combinadas */
  colSpan?: number;
  rowSpan?: number;
  /** V2: alineación y estilo estructural */
  align?: 'left' | 'center' | 'right';
  variant?: 'normal' | 'header' | 'subheader' | 'note';
  placeholder?: string;
  /** V2: grupo de checkboxes (Cumple/No cumple/No aplica) — comportamiento tipo radio por groupId */
  checkboxGroup?: ProtocolTableCellCheckboxGroup;
  /** V2: label junto al checkbox (ej. "Ver especificación del cliente") en celdas header */
  checkboxLabel?: string;
  /** Si false u omitido, se muestra como texto plano (fidelidad Word). Si true, se muestra input editable. */
  editable?: boolean;
  /** Checkboxes horizontales multi-select dentro de la celda (ej. VWD/MWD/DAD/RID). */
  inlineCheckboxes?: { key: string; label: string }[];
  /** Texto opcional antes de los inline checkboxes (ej. "Detector con el que se realiza el test:"). */
  inlineCheckboxPrefix?: string;
  /** Contenido inline en la celda: texto y/o checkboxes (multi-select). */
  inline?: Array<
    | { kind: 'text'; text: string }
    | { kind: 'checkbox'; groupId: string; option: string; label?: string }
  >;
  /**
   * Fuerza cómo se dibuja la celda sin cambiar type en el JSON.
   * Si 'input': se renderiza como <input type="text"> aunque type sea 'checkbox'.
   * Útil cuando el Word/JSON trae checkbox pero es un campo a completar.
   */
  renderAs?: 'checkbox' | 'input';
}

export interface ProtocolTableRow {
  id: string;
  cells: ProtocolTableCell[];
}

export interface ProtocolTableSection {
  id: string;
  type: 'table';
  title?: string;
  headers: string[];
  rows: ProtocolTableRow[];
  pageBreakBefore?: boolean;
  /** V2: layout de tabla */
  layout?: 'fixed' | 'auto';
  /** V2: anchos de columna (ej. ["35%","20%","25%","20%"] o ["60mm","30mm"]) */
  columnWidths?: string[];
  /** V2: título/caption opcional dentro de la tabla */
  caption?: string;
}

export interface ProtocolSignatureItem {
  id: string;
  label: string;
  role: string;
}

export interface ProtocolSignaturesSection {
  id: string;
  type: 'signatures';
  title?: string;
  signatures: ProtocolSignatureItem[];
  pageBreakBefore?: boolean;
}

export type ProtocolSection =
  | ProtocolTextSection
  | ProtocolChecklistSection
  | ProtocolTableSection
  | ProtocolSignaturesSection;

export interface ProtocolTemplateDoc {
  id: string;
  name: string;
  serviceType?: string;
  equipmentType?: string;
  version?: string;
  sections: ProtocolSection[];
}

/** Datos rellenados por el usuario; por ahora solo definimos estructura base */
export interface ProtocolData {
  protocolTemplateId: string;
  sections: {
    [sectionId: string]:
      | { content: string }
      | { checkedItemIds: string[] }
      | { rows: { [rowId: string]: { [cellId: string]: string } } }
      | { [role: string]: { name?: string } };
  };
}
