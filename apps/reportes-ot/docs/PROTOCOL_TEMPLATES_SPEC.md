# Especificación: Plantillas de protocolos (Word → JSON → Firestore)

## Objetivo
Convertir protocolos en Word a un JSON estructurado que la app pueda renderizar, editar y exportar a PDF, manteniendo la estructura y el formato visual lo más fiel posible al original.

---

## Colección Firestore: `protocolTemplates`

Cada documento representa una plantilla de protocolo.

| Campo          | Tipo    | Descripción |
|----------------|---------|-------------|
| `id`           | string  | Identificador único (p. ej. código del documento: QF7.0506.10) |
| `name`         | string  | Nombre legible del protocolo |
| `serviceType`  | string  | Tipo de servicio (ej. "Calificación de operación", "Recalificación", "Mantenimiento preventivo") |
| `equipmentType`| string  | Tipo de equipo (ej. "HPLC 1100-1200-1260", "MP 1100-1200-1220-1260-1290") |
| `template`     | object  | Estructura del protocolo (ver abajo) |
| `version`      | string  | Versión semántica para control de cambios (ej. "1.0.0") |
| `createdAt`    | string  | ISO timestamp de creación |
| `updatedAt`    | string  | ISO timestamp de última actualización |

---

## Estructura del objeto `template`

El `template` es un objeto con una única propiedad `sections`: array de secciones en orden.

### Tipos de sección

#### 1. `text` – Bloque de texto (párrafos)
```json
{
  "id": "sec_objetivo",
  "title": "1. Objetivo",
  "type": "text",
  "content": "Texto en una o más líneas. Puede contener saltos de línea."
}
```

#### 2. `checklist` – Lista de ítems con checkbox
```json
{
  "id": "sec_verificaciones",
  "title": "2. Verificaciones",
  "type": "checklist",
  "items": [
    { "id": "item_1", "label": "Verificación de flujo", "required": true, "value": false },
    { "id": "item_2", "label": "Verificación de presión", "required": false, "value": false }
  ]
}
```
- `value`: en la plantilla suele ser `false`; al rellenar el reporte el usuario marca true/false.
- `required`: si debe estar marcado para poder finalizar.

#### 3. `table` – Tabla con filas editables
```json
{
  "id": "sec_resultados",
  "title": "3. Resultados",
  "type": "table",
  "headers": ["Ítem", "Especificación", "Resultado", "Cumple"],
  "rows": [
    {
      "id": "row_1",
      "cells": [
        { "type": "text", "value": "1" },
        { "type": "text", "value": "Flujo 1 mL/min" },
        { "type": "text", "value": "" },
        { "type": "checkbox", "value": false }
      ]
    }
  ]
}
```
- Cada celda puede ser `text` (valor string) o `checkbox` (boolean).
- En la plantilla, las celdas fijas tienen `value`; las editables se dejan vacías o con valor por defecto.

#### 4. `signatures` – Bloque de firmas
```json
{
  "id": "sec_firmas",
  "title": "4. Aprobaciones",
  "type": "signatures",
  "signatures": [
    { "id": "sig_1", "label": "Ejecutado por", "role": "executor" },
    { "id": "sig_2", "label": "Revisado por", "role": "reviewer" }
  ]
}
```
- `role` permite mapear a firma del especialista / cliente en la app.

---

## Datos de protocolo por reporte (persistencia)

Los valores rellenados por el usuario no se guardan en la plantilla, sino en el documento del reporte (p. ej. en la colección `reportes` existente), en un campo como `protocolData`:

```json
{
  "protocolTemplateId": "QF7.0506.10",
  "sections": {
    "sec_verificaciones": {
      "items": [
        { "id": "item_1", "value": true },
        { "id": "item_2", "value": false }
      ]
    },
    "sec_resultados": {
      "rows": [
        { "id": "row_1", "cells": ["1", "Flujo 1 mL/min", "1.02", true] }
      ]
    }
  }
}
```

Así la plantilla sigue siendo reutilizable y solo se persisten los datos por OT.

---

## Conversión Word → JSON (criterios del script)

1. **Títulos**: Párrafos con estilo "Título 1" / "Título 2" o negrita destacada → `title` de sección.
2. **Tablas**: Cada tabla Word → una sección `type: "table"`. Primera fila → `headers`. Resto → `rows`. Celdas con "Sí/No", "□", "☑" o similar → `type: "checkbox"`.
3. **Listas**: Viñetas o numeración con ítems cortos → candidatos a `checklist`; el script puede marcar todos como no requeridos y el usuario puede ajustar en el JSON de revisión.
4. **Párrafos normales**: Agrupar en bloques hasta el siguiente título o tabla → sección `type: "text"`.
5. **Firmas**: Líneas con "Firma", "Nombre", "Ejecutado por", "Revisado por" → sección `type: "signatures"`.

El script prototipo no intentará detectar todo al 100%; producirá un JSON que se pueda revisar y retocar a mano antes de subirlo a Firestore.

---

## Próximos pasos (tras aprobar el prototipo)

1. Implementar **ProtocolSelector** y **DynamicProtocol** en la app.
2. Integrar con tipo de servicio y equipo del reporte.
3. Guardado automático de `protocolData` en el reporte.
4. Adaptar generación de PDF para incluir el protocolo con tablas, checks y firmas.
5. Tests y documentación de usuario.
