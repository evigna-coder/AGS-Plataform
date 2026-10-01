import type { TableCatalogEntry } from '@ags/shared';

/**
 * Advertencias antes de publicar una tabla de la biblioteca.
 *
 * Vivía dentro de la página del editor, así que publicar desde la lista (una o
 * varias) no validaba nada. Ahora la usan el editor, la lista y "Publicar todo".
 * Son advertencias, no bloqueos: el usuario puede publicar igual.
 */
export function validateForPublish(entry: TableCatalogEntry): string[] {
  const errors: string[] = [];
  // Los bloques de texto y firmas suelen ir sin título a propósito (separadores, "Resultados").
  if (!entry.name?.trim() && entry.tableType !== 'text' && entry.tableType !== 'signatures') errors.push('Nombre vacío');
  if (!entry.sysType) errors.push('Tipo de sistema no asignado');
  if (entry.tableType === 'text') {
    if (!entry.textContent?.trim()) errors.push('El contenido de texto está vacío');
  } else if (entry.tableType === 'checklist') {
    if (!entry.checklistItems || entry.checklistItems.length === 0) errors.push('El checklist no tiene ítems');
    entry.checklistItems?.forEach((item, i) => {
      if (!item.label.trim()) errors.push(`Ítem ${i + 1}: texto vacío`);
    });
  } else if (entry.tableType !== 'cover' && entry.tableType !== 'signatures' && (entry.columns ?? []).length === 0) {
    errors.push('La tabla no tiene columnas');
  }
  if (entry.tableType === 'validation') {
    const colKeys = new Set((entry.columns ?? []).map(c => c.key));
    (entry.validationRules ?? []).forEach((r, i) => {
      if (!r.operator || r.factoryThreshold === '' || !r.targetColumn || !r.valueIfPass || !r.valueIfFail) {
        errors.push(`Regla ${i + 1}: campos incompletos`);
      }
      // Una regla que apunta a una columna borrada no calcula nada en campo.
      for (const k of [r.sourceColumn, r.targetColumn, r.specColumn, r.referenceColumn]) {
        if (k && !colKeys.has(k)) errors.push(`Regla ${i + 1}: la columna "${k}" no existe`);
      }
    });
  }
  return errors;
}
