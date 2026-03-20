# Contexto para nuevo chat con ChatGPT – Protocolos y reportes OT

Copia y pega este bloque en un **nuevo chat con ChatGPT** para darle el contexto del trabajo actual desde que se digitalizó el archivo Word "Calificación de operación".

---

## Cómo usar este documento

Pega todo el texto que está **debajo de la línea de guiones** en el primer mensaje del chat. Así ChatGPT tendrá el contexto del proyecto, las reglas críticas y el estado actual del desarrollo.

---

---

## CONTEXTO DEL PROYECTO (pegar desde aquí)

Soy desarrollador de la aplicación **reportes-OT** (React + TypeScript + Vite + Firebase), dentro de un monorepo. La app sirve para que los técnicos completen **reportes de servicio** de órdenes de trabajo (OT), con generación de PDF.

**Funcionalidad principal actual:**
- **Hoja 1 del reporte:** formulario con datos del cliente, equipo, OT, informe técnico, materiales, observaciones y firmas (cliente + especialista). Todo eso se renderiza en un contenedor con id `#pdf-container` y se convierte en la **página 1 del PDF** con html2pdf (html2canvas + jsPDF).

**Regla crítica (no romper):**
- **La Hoja 1 del reporte de servicio es intocable.** No se debe modificar ni el diseño, ni el JSX, ni los estilos del contenedor `#pdf-container`, ni CompanyHeader, ni el formulario principal. Cualquier cambio de protocolos o anexos debe quedar **fuera** de la Hoja 1.

---

## Origen: digitalización del Word "Calificación de operación"

A partir de un documento Word real (**Calificación de operación** para HPLC 1100-1200-1260) se definió:

1. **Conversión Word → JSON:** hay un script en Node.js (`apps/reportes-ot/scripts/word-to-protocol-json/`) que usa `mammoth` para convertir .docx a HTML y luego a un JSON estructurado. Comando típico:
   - `node convert.mjs "ruta/al/documento.docx" --out ejemplos/calif-operacion-hplc.json`

2. **Especificación del JSON:** el formato de las plantillas de protocolo está definido en `docs/PROTOCOL_TEMPLATES_SPEC.md`. Las secciones pueden ser:
   - `text` (bloque de texto)
   - `checklist` (ítems con checkbox)
   - `table` (tabla con cabeceras y filas; celdas `text` o `checkbox`)
   - `signatures` (bloque de firmas con label y role)

3. **Concepto de protocolos como anexos:** los protocolos **no** van dentro de la Hoja 1. Son **hojas anexo**: en el formulario se muestran en contenedores separados (p. ej. debajo de la Hoja 1) y en el PDF salen como **páginas adicionales** (página 2, 3, …). Ver `docs/PROTOCOLOS_COMO_ANEXOS.md`.

---

## Estado actual de la implementación

**Ya implementado:**

- **Tipos TypeScript:** en `types.ts` y `types/protocol.ts`: `ProtocolTemplateDoc`, `ProtocolSection` (text | checklist | table | signatures), `ProtocolData`, etc., según la spec.

- **Datos del protocolo real:** el JSON convertido del Word "Calificación de operación" (HPLC) está en `data/calif-operacion-hplc.json` y se exporta desde `data/califOperacionHplcProtocol.ts`. Ese template se usa cuando el tipo de servicio es "Calificación de operación".

- **Selector de plantilla:** `utils/protocolSelector.ts` expone:
  - `getProtocolTemplateForServiceType(serviceType)` → devuelve la plantilla de Calificación de operación solo si el tipo incluye "Calificación de operación"; si no, `null`.
  - `getProtocolTemplateById(id)` → resuelve un id a la plantilla (para edición/preview).

- **Componente ProtocolView:** `components/ProtocolView.tsx` renderiza un protocolo a partir de `template` (ProtocolTemplateDoc), `data?` (ProtocolData), `readOnly?`, `onChangeData?`. Usa componentes auxiliares bajo `components/protocol/`:
  - `ProtocolLayout` – contenedor tipo hoja (fondo gris, hoja blanca, header con badge "Protocolo técnico", título, subtítulo, código/versión).
  - `ProtocolSectionBlock` – sección numerada (1, 2, 3…) con barra vertical.
  - `ProtocolTable` – tabla estilizada solo para protocolos.
  - `ProtocolChecklist` – checklist estilizada.
  - `ProtocolTextBlock` – bloque de texto.
  - `ProtocolSignaturesSection` – sección de firmas del protocolo.
  - `ProtocolResultBlock` – bloque de prueba con observaciones y radios CUMPLE/NO CUMPLE/N/A (listo para uso futuro si se mapea desde JSON).

- **Ubicación en la UI:**
  - **Edición:** el protocolo se muestra dentro de un div con id `#pdf-container-anexo` (debajo del formulario principal, **nunca** dentro de `#pdf-container`).
  - **Preview:** el anexo se muestra en un div con id `#pdf-container-anexo-preview` (debajo de la previsualización de la Hoja 1), con ancho A4 (210mm).

- **Estado y persistencia:** en App.tsx se mantiene `protocolTemplateId` y `protocolData`; se cargan/guardan con el resto del estado del reporte (autosave / Firestore).

- **PDF multipágina:** la generación de PDF (hook `usePDFGeneration` o lógica equivalente) genera la página 1 desde `#pdf-container` (Hoja 1, sin cambios) y, si hay protocolo, página(s) adicionales desde `#pdf-container-anexo`, uniendo todo en un solo PDF.

**Documentación de referencia en el repo:**
- `docs/PROTOCOL_TEMPLATES_SPEC.md` – especificación del JSON de plantillas y colección Firestore `protocolTemplates`.
- `docs/PROTOCOLOS_COMO_ANEXOS.md` – concepto: protocolos solo como hojas anexo, no dentro de Hoja 1.
- `docs/PLAN_PDF_PROTOCOLO_3_5_DIAS.md` – plan día a día (tipos, componente, persistencia, PDF, estilos, revisión).
- `docs/PROTOCOLO_EJEMPLOS_REALES_Y_REVISION.md` – cómo generar ejemplos con documentos reales y checklist de revisión conjunta.
- `docs/INFORME_PROTOCOLOS_PARA_CHATGPT.md` – informe de estado y pasos (puede estar algo desactualizado respecto al código actual).
- `scripts/word-to-protocol-json/README.md` – uso del conversor Word → JSON.

---

## Qué NO tocar

- El JSX, estilos o estructura de la **Hoja 1** (contenedor `#pdf-container`, CompanyHeader, datos cliente/equipo, informe técnico, materiales, firmas del reporte).
- La lógica de generación de PDF para la **página 1** (Hoja 1); solo se añade lógica para anexos desde `#pdf-container-anexo`.
- No introducir headers/navegación de otras apps (Dashboard, Equipos, Reportes, avatar, etc.) en esta app.

---

## Próximos pasos / trabajo abierto

- Carga de plantillas desde Firestore (colección `protocolTemplates`) en lugar de solo el JSON estático.
- Selector de protocolo por tipo de servicio **y** tipo de equipo (varios protocolos según equipo).
- Validación de campos obligatorios del protocolo antes de finalizar el reporte.
- Revisión del PDF de muestra (Hoja 1 + anexo Calificación de operación) con producto/QA.
- Posible extensión del script Word→JSON para más detección (checklists desde viñetas, firmas, etc.) según revisión conjunta.

Cuando me pidas cambios, asumir siempre: **Hoja 1 intocable; protocolos solo como anexos en contenedores separados y como páginas adicionales en el PDF.**
