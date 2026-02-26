# Plan detallado: PDF de muestra con protocolo real (3–5 días)

Objetivo: tener **un PDF de muestra** basado en un protocolo real (o en el JSON de ejemplo) listo para revisión en **3–5 días**, manteniendo la conversión Word→JSON y arrancando en paralelo el componente React y la generación de PDF.

---

## Concepto obligatorio: protocolos como anexos

**La Hoja 1 del formulario y del reporte de servicio es inamovible.** No se modifica ni en el formulario ni en el PDF.

Los protocolos son **hojas anexo**:
- En el **formulario**: se muestran como hojas/secciones adicionales para completar (según tipo de servicio).
- En el **PDF final**: son **páginas adicionales** (p. ej. página 2, 3…), no contenido dentro de la Hoja 1.

Ver `PROTOCOLOS_COMO_ANEXOS.md` para el detalle.

---

## Enfoque general

| Hilo | Qué se hace |
|------|-------------|
| **Conversión** | El script Word→JSON sigue disponible; se pueden generar ejemplos reales cuando tengáis los .docx. Para el PDF de muestra se usará el `sample-protocol-output.json` o un JSON ya convertido. |
| **Componente React** | Componente que renderiza el protocolo (secciones texto, checklist, tabla, firmas) **solo para las hojas anexo**, en un contenedor **distinto** al de la Hoja 1. |
| **PDF** | Hoja 1 se genera desde su `#pdf-container` actual (sin cambios). Las hojas de protocolo se generan desde **otro(s) contenedor(es)** y se añaden como **páginas adicionales** al PDF (no dentro de la página 1). |

---

## Día 1 – Tipos, datos y render estático del protocolo

### 1.1 Tipos TypeScript (app)

- **Ubicación:** `apps/reportes-ot/types.ts` o `types/protocol.ts`.
- Definir:
  - `ProtocolTemplate`: `id`, `name`, `serviceType`, `equipmentType`, `template: { sections }`, `version`.
  - `ProtocolSection`: unión discriminada por `type`: `text` | `checklist` | `table` | `signatures`, con los campos ya definidos en la spec.
  - `ProtocolData`: `protocolTemplateId` + `sections` (valores rellenados por sección/ítem/fila).
- Exportar desde un único punto para uso en componentes y hooks.

### 1.2 Cargar un protocolo de muestra

- Añadir (o dejar referenciado) el JSON de ejemplo en la app, por ejemplo:
  - `apps/reportes-ot/data/sample-protocol.json` (copia de `sample-protocol-output.json`), **o**
  - Import estático del JSON desde `scripts/word-to-protocol-json/ejemplos/` si ya tenéis uno real convertido.
- Crear un hook o util mínima: `useSampleProtocol(): ProtocolTemplate | null` que devuelva ese template (por ahora sin Firestore).

### 1.3 Componente de render (solo lectura)

- **Componente:** `ProtocolView.tsx` (o `DynamicProtocol.tsx` en modo solo lectura).
- Props: `template: ProtocolTemplate`, `data?: ProtocolData | null`, `readOnly?: boolean`.
- Renderizar cada sección según `type`:
  - **text:** título + `content` en un bloque con estilos tipo “Informe Técnico” (text-[10px]/[12px], bordes).
  - **checklist:** título + lista de ítems con checkbox (✓/□) según `value`; en pantalla puede ser `input type="checkbox"` deshabilitado o un span.
  - **table:** título + `<table>` con `headers` y `rows`; celdas `text` → texto, `checkbox` → ✓/□.
  - **signatures:** título + filas “Label: ____________” (las firmas reales se pueden enlazar después a las del reporte).
- Usar **clases CSS existentes** del reporte (text-[10px], border-slate-200, etc.) para que visualmente encaje con el resto del PDF.
- **Criterio de “listo Día 1”:** en la app se puede elegir “usar protocolo de muestra”; el protocolo se muestra como **hoja anexo** (sección o pestaña separada), no dentro de la Hoja 1 (sin edición aún).

### Entregables Día 1

- Tipos de protocolo en código.
- `sample-protocol.json` (o equivalente) cargado en la app.
- `ProtocolView` renderizando las 4 secciones con el JSON de ejemplo.
- Bloque del protocolo en un **contenedor separado** (anexo), **no** dentro del `#pdf-container` de la Hoja 1.

---

## Día 2 – Integración en el reporte y persistencia

### 2.1 Estado del reporte

- Añadir al estado del reporte (o al `reportState` que ya se persiste):
  - `protocolTemplateId: string | null`
  - `protocolData: ProtocolData | null`
- Si el reporte ya tiene `reportState`/autosave, incluir estos dos campos en el objeto que se guarda en Firestore (y en la carga al abrir una OT).
- No es obligatorio en Día 2 tener selector por tipo de servicio/equipo; puede ser “un solo protocolo de muestra” asignable con un botón/checkbox.

### 2.2 Edición básica (opcional para Día 2)

- Si da tiempo: que las celdas de tabla `text` y los ítems del checklist sean editables cuando no está en solo lectura (inputs controlados por `protocolData`).
- Callback o setter para actualizar `protocolData` y que el autosave lo persista.
- Si no da tiempo, se puede dejar el protocolo en solo lectura y rellenar `protocolData` por defecto desde el template (valores vacíos/false) para que el PDF ya muestre la estructura.

### 2.3 Inclusión en el PDF (como anexos)

- El bloque que renderiza `ProtocolView` debe estar en un **contenedor distinto** al de la Hoja 1 (p. ej. `#pdf-container-anexo` o similar).
- La generación de PDF debe: (1) generar la página 1 desde `#pdf-container` (Hoja 1, sin cambios); (2) si hay protocolo, generar página(s) adicionales desde el contenedor del protocolo; (3) unir todo en un solo PDF (varias páginas).
- Comprobar que el PDF final tiene la Hoja 1 igual que siempre y el protocolo como página(s) adicionales.

### Entregables Día 2

- `protocolTemplateId` y `protocolData` en estado y en persistencia (Firestore).
- Protocolo visible como hoja anexo en la vista del reporte; PDF con Hoja 1 + página(s) de protocolo.
- Generación de PDF incluyendo el bloque de protocolo (sin necesidad de edición completa aún).

---

## Día 3 – Estilo tipo Word y tablas/firmas en PDF

### 3.1 Estilos print-friendly

- Revisar que el bloque del protocolo use:
  - Títulos de sección con el mismo criterio que “Informe Técnico” / “Datos de la Orden de trabajo” (font-black, uppercase, text-[9px]/[10px]).
  - Tablas con bordes y celdas alineadas (igual que la tabla de materiales).
  - Checklist con símbolos que se impriman bien (✓ / □ o cuadros con borde).
- Añadir clases `print:` si hace falta (por ejemplo evitar colores que se pierdan al imprimir).

### 3.2 Tablas y checkboxes en el PDF

- Asegurar que las tablas del protocolo no rompan el layout (ancho fijo o porcentaje, `table-layout: fixed` si conviene).
- Que los checkboxes se vean claramente en el PDF (✓ cuando `value === true`, □ cuando `false`).

### 3.3 Firmas del protocolo

- En la sección `signatures` del template, mostrar cada ítem como “Label: _____________”.
- Opción A (rápida): solo líneas; las firmas del reporte (especialista/cliente) siguen siendo las que ya existen en el pie.
- Opción B (si da tiempo): reutilizar la imagen de firma del especialista en “Ejecutado por” y la del cliente en “Revisado por” si los `role` coinciden.

### Entregables Día 3

- PDF generado con el protocolo bien formateado (títulos, tablas, checks).
- Firmas del protocolo al menos como líneas con etiqueta; opcionalmente enlazadas a las firmas ya existentes.

---

## Día 4 – Protocolo real y pulido

### 4.1 Usar un JSON real (si está disponible)

- Si ya tenéis un JSON convertido desde un Word real (por ejemplo desde `convert.mjs`), sustituir o añadir como opción el protocolo de muestra para generar el PDF con ese contenido.
- Comprobar que no falten secciones, que las tablas tengan el número correcto de columnas y que el texto largo no rompa el layout en el PDF.

### 4.2 Ajustes de maquetación

- Ajustar márgenes, espaciado entre secciones y tamaño de fuente si algo se corta o se ve apretado en A4.
- Probar con 2–3 secciones de texto, una tabla grande y una checklist larga para validar paginación (html2pdf ya usa `pagebreak`; comprobar que no corte tablas por la mitad si es posible).

### 4.3 Nombre del archivo PDF

- Decidir si el PDF de reporte con protocolo se sigue llamando `{OT}_Reporte_AGS.pdf` o se añade un sufijo (por ejemplo `_Protocolo`). Mientras no se decida, mantener el nombre actual.

### Entregables Día 4

- PDF de muestra generado con un protocolo real (o el sample mejorado).
- Maquetación estable y lista para enseñar a producto/QA.

---

## Día 5 – Revisión y documentación

### 5.1 PDF de muestra para revisión

- Generar al menos un PDF completo (reporte + protocolo) y dejarlo en un lugar acordado (carpeta del repo, enlace, o enviado por canal interno) para revisión.
- Incluir en el PDF: cabecera, datos cliente/OT, informe técnico, materiales, **bloque completo del protocolo** (texto, checklist, tabla, firmas) y firmas del reporte.

### 5.2 Documentación mínima

- Actualizar o crear un doc corto (por ejemplo en `docs/`) que indique:
  - Cómo activar el protocolo de muestra en la app (botón/flag/selector simple).
  - Dónde está el JSON del protocolo y cómo reemplazarlo por otro (archivo estático o, más adelante, Firestore).
  - Cómo se genera el PDF que incluye el protocolo (mismo flujo que hoy: vista previa / descarga desde el reporte).

### 5.3 Buffer para correcciones

- Usar el día para pequeños ajustes según feedback (texto, márgenes, títulos, orden de secciones).
- No bloquear la entrega del PDF de muestra: los cambios mayores (selector por tipo de servicio, importación masiva, etc.) pueden quedar para la siguiente iteración.

### Entregables Día 5

- PDF de muestra listo para revisión.
- Doc actualizado con pasos para reproducir y sustituir el protocolo.
- Lista breve de mejoras opcionales para la siguiente fase (selector por servicio/equipo, más protocolos, conversión masiva).

---

## Resumen por día

| Día | Foco | Entregable clave |
|-----|------|-------------------|
| 1 | Tipos, carga JSON, componente de render, contenedor anexo (no Hoja 1) | Protocolo visible como hoja anexo en pantalla; preparar generación PDF multi-página |
| 2 | Estado + persistencia (protocolTemplateId, protocolData), opcional edición, PDF multi-página | PDF con Hoja 1 + página(s) de protocolo |
| 3 | Estilos, tablas/checkboxes/firmas en PDF | PDF con formato estable y legible |
| 4 | JSON real (si hay), maquetación, nombre de archivo | PDF de muestra con contenido real o representativo |
| 5 | Revisión, doc, correcciones menores | PDF listo para revisión + documentación |

---

## Dependencias y orden

- **Día 1** no depende de la conversión Word→JSON; se usa `sample-protocol-output.json` o un JSON ya convertido.
- **Día 2** depende de que el bloque del protocolo esté en un contenedor anexo y de que la generación de PDF soporte varias páginas (Hoja 1 + anexos).
- **Día 3–4** mejoran el resultado del PDF; se puede usar ya un JSON real si está disponible.
- La **conversión Word→JSON** puede seguir en paralelo; en cuanto tengáis un JSON real, se sustituye o se añade como opción para el PDF de muestra.

---

## Riesgos y mitigación

| Riesgo | Mitigación |
|--------|------------|
| html2pdf corta tablas o no pinta bien checkboxes | Usar tablas con ancho controlado y símbolos Unicode (✓/□) o bordes CSS simples que html2canvas renderice bien. |
| Demasiado contenido en una página | Aceptar segunda hoja; revisar opciones `pagebreak` en `pdfOptions.ts` si hace falta. |
| JSON real no está listo en 3–5 días | El PDF de muestra se hace con `sample-protocol-output.json`; el JSON real se integra en cuanto exista. |

---

## Siguiente fase (después del PDF de muestra)

- Selector de protocolo por tipo de servicio y equipo (ProtocolSelector).
- Carga de plantillas desde Firestore (`protocolTemplates`).
- Importación de JSON convertidos a Firestore (script o función).
- Validación de campos obligatorios del protocolo antes de finalizar el reporte.
- Tests unitarios del componente y de la estructura del PDF.
