# Contexto para ChatGPT – Instrucciones y estado del proyecto reportes-OT

**Uso:** Copia y pega todo el contenido **debajo de la línea "INICIO DEL CONTEXTO"** en el primer mensaje de un nuevo chat con ChatGPT. Así tendrá el contexto completo del proyecto, el código, las restricciones y en qué se está trabajando ahora.

---

---

## INICIO DEL CONTEXTO

---

# 1. QUÉ ES ESTE PROYECTO

- **App:** **reportes-OT** (React + TypeScript + Vite + Firebase), dentro de un monorepo.
- **Objetivo:** Los técnicos completan **reportes de servicio** de órdenes de trabajo (OT) y generan un PDF final.
- **Dos mundos separados en la app (y en el PDF):**
  1. **Hoja 1 – Reporte de servicio:** formulario con datos del cliente, equipo, OT, informe técnico, materiales, observaciones y firmas (cliente + especialista). Es el “reporte” propiamente dicho.
  2. **Anexos – Protocolos técnicos:** documentos tipo “Calificación de operación” (p. ej. HPLC), que se muestran debajo del reporte y en el PDF son **páginas adicionales** (página 2, 3, …).

---

# 2. RESTRICCIÓN ABSOLUTA (NO NEGOCIABLE)

- **La Hoja 1 del reporte de servicio es intocable.**
- **No se debe modificar:** el JSX, los estilos ni la estructura del contenedor `#pdf-container`, ni `CompanyHeader`, ni el formulario principal del reporte (datos cliente/equipo, informe técnico, materiales, firmas de la Hoja 1).
- **No se debe tocar** la lógica de generación de la **página 1** del PDF (solo se añade o ajusta lógica para anexos).
- Cualquier cambio de protocolos o anexos debe hacerse **solo** en:
  - `#pdf-container-anexo` (edición)
  - `#pdf-container-anexo-preview` (previsualización)
  - Componentes bajo `ProtocolView.tsx` y `components/protocol/*`
  - Tipos en `types/protocol.ts`
  - JSON de plantillas en `data/calif-operacion-hplc.json`
  - CSS/estilos que afecten solo al anexo (p. ej. `public/index.css` para clases de protocolo).

---

# 3. QUÉ HACE EL CÓDIGO (ALCANCE ACTUAL)

## 3.1 Flujo general

1. El usuario elige/ carga una OT y completa el **reporte de servicio** (Hoja 1).
2. Si el tipo de servicio es “Calificación de operación”, se carga la plantilla de protocolo (HPLC) y se muestra el **anexo** debajo del formulario.
3. El usuario rellena datos del protocolo (tablas, checklists, etc.) y puede previsualizar y generar PDF.
4. El PDF final = **página 1** (Hoja 1 desde `#pdf-container`) + **páginas 2, 3, …** (anexo desde `#pdf-container-anexo`), unidas con pdf-lib.

## 3.2 Generación del PDF

- **Hook:** `hooks/usePDFGeneration.ts`.
- **Opciones centralizadas:** `utils/pdfOptions.ts` → `getPDFOptions(otNumber, element, includeBackgroundColor, forAnexo)`.
- **Hoja 1:** se captura `#pdf-container` con `forAnexo: false` (pagebreak con `avoid-all` para no cortar).
- **Anexo:** se captura `#pdf-container-anexo` con `forAnexo: true` → `pagebreak: { mode: ['css', 'legacy'] }` para que html2pdf respete saltos de página (clases `.break-before-page` y `.html2pdf__page-break`).
- Los dos blobs se concatenan en un solo PDF (página 1 + páginas del anexo).

## 3.3 Protocolos: tipos y datos

- **Tipos:** `types/protocol.ts`.
  - Secciones: `text` | `checklist` | `table` | `signatures`.
  - En **cada tipo de sección** existe `pageBreakBefore?: boolean` (opcional).
  - En **celdas de tabla** (`ProtocolTableCell`): `readOnly?: boolean`, `defaultValue?: string | number | boolean`, `hidden?: boolean`.
- **Plantilla estática:** `data/calif-operacion-hplc.json` (estructura bajo `template.sections`).
  - Se carga vía `data/califOperacionHplcProtocol.ts` y se usa cuando el tipo de servicio incluye “Calificación de operación”.
- **Selector:** `utils/protocolSelector.ts` → `getProtocolTemplateForServiceType(serviceType)`, `getProtocolTemplateById(id)`.

## 3.4 Renderizado del protocolo (anexo)

- **Entrada:** `components/ProtocolView.tsx` recibe `template`, `data?`, `readOnly?`, `onChangeData?`.
  - Itera `template.sections` y para cada una:
    - Obtiene `pageBreakBefore` de la sección y se lo pasa a `ProtocolSectionBlock`.
    - Según `section.type` renderiza: `ProtocolTextBlock`, `ProtocolChecklist`, `ProtocolTable`, `ProtocolSignaturesSection`.
- **Contenedor de la “hoja” del protocolo:** `components/protocol/ProtocolLayout.tsx`
  - Hoja blanca 210mm × min-height 297mm, header con título, subtítulo, código/revisión.
  - Incluye `<PageBreakGuides />` (líneas rojas punteadas cada 297mm, solo pantalla).
- **Secciones:** `components/protocol/ProtocolSectionBlock.tsx`
  - Si `pageBreakBefore === true`: renderiza un div con clase `html2pdf__page-break break-before-page` (para que html2pdf corte ahí) y un separador visual gris (`visual-page-break-indicator`, h-12, bg-slate-200, sin texto; oculto al imprimir).
  - Luego el `<section>` con número, título y contenido (clase `protocol-section-block` para CSS).
- **Tablas:** `components/protocol/ProtocolTable.tsx`
  - Wrapper con clase `protocol-table-wrapper`.
  - `<table>` con clase `protocol-table-no-break` y `style={{ pageBreakInside: 'avoid' }}`.
  - Cada `<tr>` con clase `protocol-tr-no-break` y `style={{ pageBreakInside: 'avoid' }}`.
  - Celdas con `readOnly`/`defaultValue`: si `readOnly` es true se muestra input deshabilitado con valor (o valor por defecto); si no, input editable. `getCellValue` en ProtocolView usa `defaultValue` cuando no hay dato guardado.
- **Otros componentes de protocolo:** `ProtocolChecklist`, `ProtocolTextBlock`, `ProtocolSignaturesSection`, `ProtocolResultBlock` (exportados en `components/protocol/index.ts`).
- **Guías visuales A4:** `components/protocol/PageBreakGuides.tsx` dibuja líneas horizontales cada 297mm (solo pantalla, ocultas en print/PDF).

## 3.5 CSS global (protocolo y PDF)

- **Archivo:** `public/index.css`.
  - `.protocol-table-wrapper`, `.protocol-section-block` → `break-inside: avoid` / `page-break-inside: avoid` (y `!important` en `@media print`).
  - `.protocol-table-no-break`, `.protocol-tr-no-break` → mismo criterio para que ninguna tabla ni fila se corte.
  - `.page-break-guides` → ocultas en `@media print`.
  - `.break-before-page`, `.html2pdf__page-break` → `page-break-before: always`; en pantalla el div `html2pdf__page-break` tiene height 0 para no ocupar espacio.
  - `.visual-page-break-indicator` → oculto en print (el separador gris no debe salir en el PDF).

---

# 4. REGLA CRÍTICA SOBRE TABLAS

- **Una tabla no puede cortarse de ninguna manera; debe estar completa en la misma hoja.**
- `page-break-inside: avoid` **no** evita que una tabla que es más alta que una A4 se corte; html2pdf puede igualmente partirla.
- **Solución adoptada:** dividir tablas conceptualmente grandes en **varias secciones** de tipo `table` en el JSON, cada una con un tamaño que quepa en una hoja A4. A partir de la **segunda** parte de esa tabla lógica, la sección debe tener **`pageBreakBefore: true`** para que esa parte empiece en una página nueva.
- **Ejemplo ya aplicado en el JSON:** la tabla “Descripción de los ensayos” está en tres secciones:
  - **sec_8:** “Descripción de los ensayos (Parte 1)” – sin `pageBreakBefore` (o false).
  - **sec_9:** “Descripción de los ensayos (Parte 2)” – **`pageBreakBefore: true`**.
  - **sec_10:** “Descripción de los ensayos (Parte 3)” – **`pageBreakBefore: true`**.

Cualquier otra tabla que en el documento original abarque más de una página debe tratarse igual: varias secciones `type: "table"` con títulos tipo “(Parte 1)”, “(Parte 2)”, etc., y `pageBreakBefore: true` desde la segunda parte.

---

# 5. EN QUÉ ESTAMOS TRABAJANDO AHORA

- **Objetivo actual:** que el protocolo (anexo) se comporte como un **formulario inteligente** que respete el diseño del documento original: información fija pre-cargada (AGS, especificaciones), saltos de página en los mismos sitios que el PDF original, y **ninguna tabla partida**.
- **Hecho hasta ahora:**
  - Tipos extendidos: `pageBreakBefore` en secciones; `readOnly`, `defaultValue`, `hidden` en celdas.
  - Componentes de protocolo con diseño tipo informe A4 (escala 11–13px, tablas densas, secciones numeradas).
  - Separador visual de salto de página (franja gris, sin texto); elemento `html2pdf__page-break` para corte en PDF.
  - Guías de corte cada 297mm en pantalla (PageBreakGuides).
  - CSS para no cortar tablas ni secciones (`break-inside: avoid` en wrapper, table y tr).
  - JSON: sec_4 con datos fijos AGS (Dirección, Provincia, Tel, Email) con `readOnly` y `defaultValue`; columnas de especificación en tablas de ensayos con `readOnly` y `defaultValue`; `pageBreakBefore: true` en sec_16 (Resultados), sec_21 (Resultados/certificación), sec_23 (Documentos adjuntos); sec_8/9/10 “Descripción de los ensayos” en tres partes con `pageBreakBefore` en 9 y 10.
- **Lo que puede seguir:** revisar otras tablas largas en el JSON y partirlas en secciones con `pageBreakBefore` donde corresponda; ajustes finos de márgenes/guías; carga de plantillas desde Firestore; validación de campos obligatorios del protocolo; pruebas de PDF con el cliente.

---

# 6. RUTAS CLAVE DEL CÓDIGO

| Qué | Dónde |
|-----|--------|
| Hoja 1 (no tocar) | `App.tsx` – contenedor `#pdf-container` y todo su contenido |
| Contenedores del anexo | `App.tsx` – `#pdf-container-anexo`, `#pdf-container-anexo-preview` |
| Vista del protocolo | `components/ProtocolView.tsx` |
| Componentes de protocolo | `components/protocol/*` (ProtocolLayout, ProtocolSectionBlock, ProtocolTable, PageBreakGuides, etc.) |
| Tipos del protocolo | `types/protocol.ts` |
| Plantilla HPLC (JSON) | `data/calif-operacion-hplc.json` (estructura `template.sections`) |
| Carga de plantilla | `data/califOperacionHplcProtocol.ts`, `utils/protocolSelector.ts` |
| Generación PDF | `hooks/usePDFGeneration.ts`, `utils/pdfOptions.ts` |
| CSS protocolo/PDF | `public/index.css` |
| Spec JSON y anexos | `docs/PROTOCOL_TEMPLATES_SPEC.md`, `docs/PROTOCOLOS_COMO_ANEXOS.md` |
| Conversión Word→JSON | `scripts/word-to-protocol-json/` (mammoth, convert.mjs) |

---

# 7. QUÉ NO TOCAR

- Cualquier cosa dentro de `#pdf-container` (Hoja 1 del reporte de servicio).
- CompanyHeader y el formulario principal del reporte (cliente, equipo, OT, informe técnico, materiales, firmas de la Hoja 1).
- La generación de la **primera página** del PDF (solo se modifican opciones o lógica que afecten al anexo).

---

# 8. RESUMEN PARA INSTRUCCIONES

- **Proyecto:** App reportes-OT (React + TS + Vite + Firebase) para reportes de servicio con PDF (Hoja 1 + anexos de protocolo).
- **Regla absoluta:** Hoja 1 intocable; todo el trabajo de protocolos va en anexos (`#pdf-container-anexo`, `#pdf-container-anexo-preview`, `ProtocolView`, `components/protocol/*`, tipos, JSON de plantillas, CSS de protocolo).
- **Tablas:** Nunca cortar una tabla; dividir en varias secciones `type: "table"` en el JSON y usar `pageBreakBefore: true` desde la segunda parte.
- **Estado actual:** Protocolo tipo informe A4 con datos fijos (readOnly/defaultValue), saltos de página explícitos (pageBreakBefore + html2pdf__page-break), “Descripción de los ensayos” en 3 partes (sec_8, sec_9, sec_10) con pageBreakBefore en 9 y 10, y CSS para evitar cortes en tablas/secciones.

Cuando me pidas cambios, asumir siempre: **Hoja 1 intocable; protocolos solo como anexos; tablas nunca cortadas (dividir en secciones con pageBreakBefore).**
