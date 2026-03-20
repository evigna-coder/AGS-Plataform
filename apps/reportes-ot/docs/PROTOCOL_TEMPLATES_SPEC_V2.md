# Protocol Templates V2 — Especificación

Extensión retrocompatible de las plantillas de protocolo (anexos) para máxima fidelidad al Word: celdas combinadas, anchos de columna, estilos de fila/celda y grupos de checkboxes (Cumple/No cumple/No aplica).

## Tipos V2 (retrocompatibles)

### ProtocolTableSection

| Campo           | Tipo     | Descripción |
|-----------------|----------|-------------|
| `layout`       | `'fixed' \| 'auto'` | Layout de tabla (default `'fixed'`). |
| `columnWidths` | `string[]` | Anchos por columna, ej. `["35%","20%","25%","20%"]` o `["60mm","30mm"]`. |
| `caption`      | `string` | Título/caption opcional dentro de la tabla. |

### ProtocolTableCell

| Campo          | Tipo     | Descripción |
|----------------|----------|-------------|
| `colSpan`      | `number` | Celdas combinadas horizontalmente. |
| `rowSpan`      | `number` | Celdas combinadas verticalmente. |
| `align`        | `'left' \| 'center' \| 'right'` | Alineación. |
| `variant`      | `'normal' \| 'header' \| 'subheader' \| 'note'` | Estilo estructural (header gris, subheader, nota en itálica). |
| `placeholder`  | `string` | Placeholder para inputs. |
| `checkboxGroup` | `{ groupId: string; option: string }` | Grupo tipo “Conclusiones”: solo una opción activa por `groupId` (comportamiento tipo radio). |

### CheckboxGroup

Para filas de “Conclusiones” con columnas **Cumple / No cumple / No aplica**:

- `groupId`: mismo para las tres celdas (ej. `'conclusiones'`).
- `option`: `'cumple'`, `'no_cumple'` o `'no_aplica'`.

Al marcar una opción se desmarcan las otras del mismo grupo en esa fila.

## Ejemplo de tabla V2

```json
{
  "id": "sec_8",
  "type": "table",
  "title": "Resultados",
  "headers": ["Parámetro", "Especificación", "Resultado", "Cumple", "No cumple", "No aplica"],
  "layout": "fixed",
  "columnWidths": ["20%", "25%", "20%", "12%", "12%", "11%"],
  "rows": [
    {
      "id": "row_1",
      "cells": [
        { "type": "text", "value": "pH" },
        { "type": "text", "value": "5.0 - 7.0" },
        { "type": "text", "value": "" },
        { "type": "checkbox", "value": false, "checkboxGroup": { "groupId": "conclusiones", "option": "cumple" } },
        { "type": "checkbox", "value": false, "checkboxGroup": { "groupId": "conclusiones", "option": "no_cumple" } },
        { "type": "checkbox", "value": false, "checkboxGroup": { "groupId": "conclusiones", "option": "no_aplica" } }
      ]
    }
  ]
}
```

## Ejemplo de celda con variant y colSpan

```json
{
  "type": "text",
  "value": "Descripción del ensayo",
  "colSpan": 3,
  "variant": "subheader"
}
```

## Convertidor Word → JSON V2

En `scripts/word-to-protocol-json/convert.mjs`:

- **Merges:** se leen `colspan` y `rowspan` del HTML generado por mammoth.
- **Anchos:** se generan `columnWidths` en % repartidos por columnas.
- **Header/subheader:** si una fila tiene una sola celda que abarca todas las columnas, se asigna `variant`: `'header'` (primera fila) o `'subheader'`.
- **Conclusiones:** si los headers contienen “Cumple”, “No cumple”, “No aplica”, se asigna `checkboxGroup` a las celdas checkbox de esas columnas.

Para merges y anchos exactos desde el .docx (gridSpan, vMerge, tblGrid) haría falta parsear el XML del docx; el conversor actual usa el HTML de mammoth.

## Normalizadores

En `utils/protocolNormalizers.ts`:

- **normalizeProtocolTemplate(template):** aplica normalizadores por familia.
- **normalizeHplc:** tablas “Resultados”/“Conclusiones” con `layout: 'fixed'`, `columnWidths` por defecto y refuerzo de `checkboxGroup` en columnas Cumple/No cumple/No aplica.
- **normalizeChecklist:** reservado para reglas de checklists.

Se aplican al cargar la plantilla en `getProtocolTemplateById` y `getProtocolTemplateForServiceType`.

## Renderer (ProtocolTable)

- **colgroup** cuando existe `columnWidths`.
- **table-layout:** `fixed` o `auto` según `layout`.
- **colSpan / rowSpan** en `<td>` y `<th>`.
- **variant:** clases `.protocol-cell-header`, `.protocol-cell-subheader`, `.protocol-cell-note` (CSS en `index.css` o Tailwind).
- **checkboxGroup:** al marcar una opción se desmarcan las demás del mismo `groupId` en la fila.

## Compatibilidad

- Plantillas V1 (sin `columnWidths`, `colSpan`, `variant`, `checkboxGroup`) siguen funcionando.
- Los campos V2 son opcionales.

## Footer space

- Variable CSS `--protocol-page-footer-space: 8mm`.
- Se resta del alto útil en el paginado y se renderiza un div vacío al final de cada página del protocolo.
