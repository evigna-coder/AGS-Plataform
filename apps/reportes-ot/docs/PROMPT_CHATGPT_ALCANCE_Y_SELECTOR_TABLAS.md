# Prompt para ChatGPT – Alcance de la app, generación de protocolos y selector de tablas

**Uso:** Copia todo el contenido **debajo de la línea "INICIO DEL PROMPT"** en un nuevo chat con ChatGPT para que entienda la app, el alcance actual y pueda planificar los próximos pasos (incluido el cambio a selector de tablas).

---

## INICIO DEL PROMPT

---

Eres un desarrollador senior que se incorpora al proyecto. Necesito que entiendas por completo la aplicación, revises el alcance actual y planifiques los próximos pasos. Hay un cambio importante planeado: pasar de mostrar todo el protocolo a un **selector de tablas** donde el ingeniero elige qué tablas completar.

---

# 1. QUÉ ES ESTE PROYECTO

- **Nombre:** Plataforma AGS (monorepo). La app que nos interesa es **reportes-OT** (`apps/reportes-ot/`).
- **Stack:** React 18, TypeScript, Vite, Firebase (Auth, Firestore), generación de PDF con html2pdf (html2canvas + jsPDF).
- **Objetivo de negocio:** Los técnicos/especialistas completan **reportes de servicio** de órdenes de trabajo (OT) y generan un PDF final que incluye el reporte y, según el tipo de servicio, **anexos de protocolo técnico** (p. ej. Calificación de operación HPLC).

---

# 2. ESTRUCTURA DE LA APP: DOS PARTES SEPARADAS

La aplicación y el PDF tienen **dos bloques bien diferenciados**:

1. **Hoja 1 – Reporte de servicio**  
   Formulario principal: datos del cliente, equipo, OT, informe técnico, materiales, observaciones, firmas (cliente + especialista). Es el “reporte” propiamente dicho. Se renderiza en el contenedor `#pdf-container` y se captura como **página 1** del PDF.

2. **Anexos – Protocolos técnicos**  
   Documentos tipo “Calificación de operación” (p. ej. HPLC 1100–1200–1260). Se muestran **debajo** del formulario del reporte en contenedores separados (`#pdf-container-anexo` en edición, `#pdf-container-anexo-preview` en previsualización). En el PDF son **páginas adicionales** (página 2, 3, …) generadas desde ese contenedor y concatenadas al final con pdf-lib.

**Regla absoluta (no negociable):** La Hoja 1 del reporte de servicio **no se modifica**. Cualquier cambio de protocolos o anexos se hace solo en los contenedores del anexo, en `ProtocolView`, en `components/protocol/*`, en tipos de protocolo, en JSON de plantillas y en CSS que afecte solo al anexo.

---

# 3. FUNCIONALIDADES ACTUALES

## 3.1 Flujo del usuario

1. El usuario elige o carga una OT y completa el **reporte de servicio** (Hoja 1).
2. Si el **tipo de servicio** es “Calificación de operación”, se carga automáticamente la plantilla de protocolo HPLC y se muestra el **anexo** debajo del formulario.
3. El usuario rellena el protocolo: tablas (celdas editables, checkboxes, “Cumple/No cumple/No aplica”), checklists, bloques de texto y, al final, firmas del protocolo.
4. Puede **previsualizar** el anexo y **generar PDF**. El PDF final = **página 1** (Hoja 1) + **páginas 2, 3, …** (anexo), unidas en un solo documento.

## 3.2 Cómo se elige el protocolo hoy

- **Selector:** `utils/protocolSelector.ts`.  
  - `getProtocolTemplateForServiceType(serviceType)`: devuelve la plantilla según el tipo de servicio (hoy solo “Calificación de operación” tiene protocolo HPLC).  
  - `getProtocolTemplateById(id)`: resuelve por ID (para edición/preview cuando ya hay un reporte guardado).  
- **Plantilla:** Un único protocolo en uso: **Calificación de operación HPLC** (JSON en `data/calif-operacion-hplc.json`, exportado por `data/califOperacionHplcProtocol.ts`).  
- No hay hoy **selección por tablas**: el protocolo se muestra **entero** (todas las secciones en orden).

## 3.3 Estructura del protocolo (plantilla + datos)

- **Plantilla (`ProtocolTemplateDoc`):**  
  - `id`, `name`, `serviceType`, `equipmentType`, `version`.  
  - `template.sections`: array de secciones en orden.  
- **Tipos de sección:**  
  - `text`: bloque de texto (título, contenido).  
  - `checklist`: ítems con checkbox.  
  - `table`: tabla con headers, filas, celdas (text, checkbox, input), colSpan/rowSpan, variantes (header, subheader, note), grupos “Cumple/No cumple/No aplica”.  
  - `signatures`: bloque de firmas del protocolo.  
- **Datos del protocolo (`ProtocolData`):**  
  - `protocolTemplateId` + valores por sección/celda (guardados en Firestore con el reporte, vía autosave).  
- **Render:** `ProtocolView.tsx` recibe `template`, `data`, `onChangeData`, `mode` ('edit' | 'print'). Itera `template.sections` y para cada una renderiza el bloque correspondiente (`ProtocolTable`, `ProtocolChecklist`, `ProtocolTextBlock`, `ProtocolSignaturesSection`). Las tablas usan `ProtocolTable.tsx` (lógica compleja para tablas compuestas de 6 columnas, filas título con checkbox “Ver especificación del cliente”, subheader “Cumple/No cumple/No aplica”, etc.).

## 3.4 Tablas en la plantilla HPLC actual

- La plantilla tiene muchas **secciones de tipo tabla** (p. ej. sec_1 a sec_23 en el JSON; entre ellas sec_6 “Configuración”, sec_8–sec_10 “Descripción de los ensayos” en 3 partes, sec_16 “Resultados”, sec_18/sec_19 tablas compuestas, sec_20/sec_21, sec_23 “Documentos adjuntos”).  
- Cada sección `table` tiene `headers`, `rows`, y opcionalmente `pageBreakBefore` para forzar salto de página antes de esa tabla en el PDF.  
- **Regla crítica:** Una tabla no debe cortarse entre páginas; si es muy alta, se divide en varias secciones (Parte 1, Parte 2, …) con `pageBreakBefore: true` desde la segunda.

## 3.5 Generación del PDF

- **Hook:** `hooks/usePDFGeneration.ts`.  
- **Opciones:** `utils/pdfOptions.ts` (getPDFOptions para Hoja 1 y para anexo).  
- Hoja 1: captura de `#pdf-container`.  
- Anexo: captura de `#pdf-container-anexo` (o el de preview) con opciones que respetan saltos de página (pagebreak css/legacy).  
- Se concatenan los blobs en un solo PDF.

## 3.6 Persistencia

- El estado del reporte (incluido `protocolTemplateId` y `protocolData`) se persiste en Firestore (autosave). Al abrir una OT se cargan la plantilla y los datos del protocolo.

---

# 4. ALCANCE ACTUAL DEL PROYECTO (RESUMEN)

- **Completado:**  
  - Hoja 1 + anexos separados en UI y en PDF.  
  - Un protocolo por tipo de servicio (HPLC Calificación de operación).  
  - Plantilla con secciones text, checklist, table, signatures; tablas con celdas editables, checkboxes, grupos Cumple/No cumple/No aplica, filas título compuestas (sec_18/sec_19).  
  - Normalizadores de plantilla (`protocolNormalizers.ts`) para comportamiento uniforme de tablas compuestas.  
  - PDF multi-página (Hoja 1 + páginas de anexo), sin cortar tablas (pageBreakBefore y CSS break-inside: avoid).  
- **No implementado (o parcial):**  
  - Selector de tablas: hoy **no** existe; el ingeniero ve y completa **todas** las tablas del protocolo.  
  - Múltiples plantillas por tipo de servicio o por equipo (solo una plantilla HPLC en uso).  
  - Carga de plantillas desde Firestore (se usan JSON locales).  
  - Validación explícita de campos obligatorios del protocolo antes de generar PDF.

---

# 5. CAMBIO PLANIFICADO: SELECTOR DE TABLAS

**Objetivo:** Modificar la generación y el flujo del protocolo para que **no se muestren todas las tablas por defecto**, sino que el **ingeniero seleccione qué tablas** del protocolo debe completar. Solo esas tablas (secciones de tipo `table`) se mostrarán en el anexo para rellenar y solo ellas formarán parte del PDF del protocolo.

**Implicaciones deseadas (a definir contigo):**

- **Modelo de datos:**  
  - En `ProtocolData` (o equivalente) guardar no solo valores por celda, sino también **qué secciones/tablas están incluidas** (p. ej. lista de `sectionId` o de “tablas seleccionadas”).  
  - La plantilla sigue definiendo **todas** las tablas posibles; el “selector” es un subconjunto que el usuario elige para ese reporte.

- **UI:**  
  - Antes (o al inicio) de mostrar el protocolo editable: pantalla o paso donde el ingeniero **selecciona las tablas** que aplican a esta OT (checkboxes o lista seleccionable por nombre/título de tabla).  
  - Luego, en el anexo solo se renderizan las secciones **seleccionadas** (y opcionalmente texto/checklist/firmas en el orden definido, filtrando tablas no elegidas).

- **PDF:**  
  - El anexo en el PDF debe contener solo las tablas seleccionadas (y el resto de secciones no tabulares que se decida mantener), en el mismo orden y con el mismo diseño que hoy.

- **Compatibilidad:**  
  - Reportes ya guardados sin “tablas seleccionadas” pueden tratarse como “todas las tablas” para no romper datos existentes.

Necesito que **revisés el alcance actual**, **validés esta dirección** y **planifiques los próximos pasos** (tareas, orden sugerido, consideraciones de datos y UI) para implementar el selector de tablas sin romper Hoja 1 ni el flujo actual de PDF.

---

# 6. RUTAS CLAVE DEL CÓDIGO (PARA TU CONTEXTO)

| Qué | Dónde |
|-----|--------|
| Hoja 1 (no tocar) | `App.tsx` – contenedor `#pdf-container` y formulario del reporte |
| Contenedores del anexo | `App.tsx` – `#pdf-container-anexo`, `#pdf-container-anexo-preview` |
| Vista del protocolo | `components/ProtocolView.tsx` |
| Componentes de protocolo | `components/protocol/*` (ProtocolLayout, ProtocolSectionBlock, ProtocolTable, ProtocolChecklist, ProtocolSignaturesSection, ProtocolTextBlock, PageBreakGuides) |
| Tipos del protocolo | `types/protocol.ts` (ProtocolTemplateDoc, ProtocolSection, ProtocolTableSection, ProtocolData, etc.) |
| Plantilla HPLC (JSON) | `data/calif-operacion-hplc.json` (estructura `template.sections`) |
| Carga de plantilla | `data/califOperacionHplcProtocol.ts`, `utils/protocolSelector.ts` |
| Normalizadores | `utils/protocolNormalizers.ts` |
| Generación PDF | `hooks/usePDFGeneration.ts`, `utils/pdfOptions.ts` |
| CSS protocolo/PDF | `public/index.css` (clases protocol-*, saltos de página) |
| Documentación existente | `docs/CONTEXTO_CHATGPT_INSTRUCCIONES_PROYECTO.md`, `docs/INFORME_PROTOCOLOS_PARA_CHATGPT.md`, `docs/PROTOCOL_TEMPLATES_SPEC.md`, `docs/PROTOCOL_TEMPLATES_SPEC_V2.md` |

---

# 7. QUÉ TE PIDO

1. **Confirmar entendimiento:** Resumir con tus palabras la app (Hoja 1 vs anexos), el flujo actual del protocolo y la regla de no tocar la Hoja 1.  
2. **Revisar alcance:** Indicar si el resumen del alcance actual (punto 4) es correcto y qué añadirías o matizarías.  
3. **Planificar el selector de tablas:** Proponer pasos concretos (orden, datos a guardar, cambios en ProtocolView/plantilla, UI del selector, compatibilidad con datos antiguos) para que el ingeniero elija qué tablas completar y solo esas se muestren y se incluyan en el PDF.  
4. **Otros próximos pasos:** Sugerir otras mejoras o tareas prioritarias (p. ej. múltiples plantillas, validación, carga desde Firestore) una vez cerrado el tema del selector de tablas.

Responde en español. Si necesitas más detalle de algún archivo o flujo, indícalo y lo complementamos.
