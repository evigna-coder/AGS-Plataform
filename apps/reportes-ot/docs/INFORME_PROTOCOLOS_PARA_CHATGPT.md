# Informe: Protocolos en la app de reportes OT (contexto para ChatGPT)

Este documento resume el estado actual del trabajo sobre **protocolos** en la aplicación de reportes de órdenes de trabajo (OT) y los **pasos a seguir**. Sirve como contexto para continuar el desarrollo con ChatGPT u otro asistente.

---

## 1. Contexto del proyecto

- **App:** `reportes-ot` (monorepo: `apps/reportes-ot/`).
- **Stack:** React (Vite), TypeScript, Firebase (Auth, Firestore), generación de PDF con html2pdf (html2canvas + jsPDF).
- **Funcionalidad actual:** El usuario completa un reporte de servicio (Hoja 1: datos de la OT, informe técnico, materiales, firmas) y puede generar un PDF. La Hoja 1 tiene un contenedor `#pdf-container` que html2pdf convierte en la página 1 del PDF.

---

## 2. Objetivo: protocolos como hojas anexo

Se quiere integrar **checklists y protocolos editables** derivados de documentos Word:

- Según el **tipo de servicio** elegido (ej. “Calificación de operación”), deben aparecer **hojas adicionales** en el formulario para completar el protocolo correspondiente.
- Esas hojas deben imprimirse en el PDF como **páginas adicionales** (página 2, 3, …), no como parte de la Hoja 1.

**Regla obligatoria:**

- **La Hoja 1 del formulario y del reporte de servicio es inamovible.** No se debe modificar ni en el formulario ni en el PDF final.
- Los protocolos son **anexos**: se muestran como secciones/páginas adicionales en el formulario y como páginas adicionales en el PDF.

Documento de referencia: `docs/PROTOCOLOS_COMO_ANEXOS.md`.

---

## 3. Qué existe hoy

### 3.1 Documentación

| Archivo | Contenido |
|---------|-----------|
| `docs/PROTOCOLOS_COMO_ANEXOS.md` | Concepto correcto (anexos), problema de la reversión, implicaciones técnicas. |
| `docs/PLAN_PDF_PROTOCOLO_3_5_DIAS.md` | Plan día a día (tipos, componente, persistencia, PDF multi-página, estilos, revisión). |
| `docs/PROTOCOL_TEMPLATES_SPEC.md` | Especificación del JSON de plantillas (secciones text, checklist, table, signatures) y colección Firestore `protocolTemplates`. |
| `docs/PROTOCOLO_CONVERSION_PROTOTIPO.md` | Guía del prototipo de conversión Word→JSON. |
| `docs/PROTOCOLO_EJEMPLOS_REALES_Y_REVISION.md` | Cómo generar ejemplos reales y preparar la revisión conjunta. |

### 3.2 Script de conversión Word → JSON

- **Ubicación:** `apps/reportes-ot/scripts/word-to-protocol-json/`
- **Archivo principal:** `convert.mjs` (Node.js, usa `mammoth` para .docx → HTML, luego parseo a JSON).
- **Salidas de ejemplo:** `sample-protocol-output.json`, `calif-operacion.json`, `ejemplos/calif-operacion-hplc.json`.
- **Uso:** `node convert.mjs <ruta.docx> [ruta-salida.json]` (ver `README.md` en esa carpeta).

El JSON generado sigue la estructura de la spec: `template.sections[]` con `type`: `text` | `checklist` | `table` | `signatures`.

### 3.3 Estado del código en la app

- **App.tsx:** No contiene integración de protocolos (se revirtió la inserción del protocolo dentro de la Hoja 1).
- **Componentes:** No existe `ProtocolView.tsx` en `components/` (se revirtió).
- **Tipos:** En `types.ts` no hay definiciones de protocolo (ProtocolTemplateDoc, ProtocolSection, ProtocolData, etc.); habría que volver a añadirlas según la spec.
- **Datos:** No hay `data/sample-protocol.json` ni módulo que exporte un protocolo de muestra en la app.

Es decir: la **documentación y el script de conversión** están; la **implementación en la app** (tipos, componente, muestra, integración en formulario y PDF) está por hacer siguiendo el plan.

---

## 4. Por qué se revirtió la implementación anterior

Se había colocado el bloque de protocolo **dentro** del mismo `#pdf-container` que la Hoja 1, lo que:

- Modificaba el contenido y el layout de la Hoja 1 en el formulario y en el PDF.
- Incumplía el requisito de que la Hoja 1 sea inamovible.

Por eso se retiró esa integración y se fijó el concepto: **protocolos solo como hojas anexo** (contenedor separado en UI y páginas adicionales en el PDF).

---

## 5. Pasos a seguir (resumen del plan 3–5 días)

### Día 1 – Base del protocolo como anexo

1. **Tipos TypeScript** en `types.ts` (o `types/protocol.ts`):  
   `ProtocolTemplateDoc` (id, name, serviceType, equipmentType, template.sections, version), `ProtocolSection` (unión por type: text | checklist | table | signatures), `ProtocolData` (protocolTemplateId + valores por sección).
2. **Datos de muestra:** Añadir `data/sample-protocol.json` (puede ser copia de `scripts/word-to-protocol-json/sample-protocol-output.json`) y un módulo que lo exporte como `ProtocolTemplateDoc`.
3. **Componente `ProtocolView`:** Renderizar secciones text, checklist, table, signatures (solo lectura al inicio). Props: `template`, `data?`, `readOnly?`.
4. **Ubicación en la UI:** Mostrar el protocolo en un **contenedor separado** (pestaña “Anexo – Protocolo”, acordeón o bloque debajo de la Hoja 1), **nunca** dentro de `#pdf-container`. Ese contenedor tendrá su propio id (ej. `#pdf-container-anexo`) para usarlo luego en la generación del PDF.

**Entregable Día 1:** Protocolo de muestra visible como hoja anexo en pantalla; tipos y componente listos para el siguiente paso.

---

### Día 2 – Persistencia y PDF multi-página

1. **Estado del reporte:** Añadir `protocolTemplateId` y `protocolData` al estado que ya se persiste en Firestore (reportState / autosave) y cargarlos al abrir una OT.
2. **Edición básica (opcional):** Checklist y celdas de tabla editables; actualizar `protocolData` y persistir.
3. **Generación de PDF:**  
   - Página 1: seguir generando desde `#pdf-container` (Hoja 1, sin cambios).  
   - Si hay protocolo: generar página(s) desde el contenedor del anexo (ej. `#pdf-container-anexo`).  
   - Unir en un solo PDF (varias páginas). Revisar opciones de html2pdf para multi-página o concatenar blobs.

**Entregable Día 2:** PDF descargable con Hoja 1 + página(s) de protocolo; datos de protocolo guardados en Firestore.

---

### Día 3 – Estilos y presentación en PDF

- Ajustar estilos del bloque de protocolo (títulos, tablas, checklist ✓/□) para que se vean bien en pantalla y en el PDF.
- Asegurar que tablas no rompan el layout (ancho controlado, `table-layout: fixed` si hace falta).
- Sección de firmas del protocolo: al menos líneas con etiqueta; opcionalmente reutilizar imágenes de firma del reporte (ejecutante/revisor) si los roles coinciden.

**Entregable Día 3:** PDF con protocolo bien formateado y legible.

---

### Día 4 – Contenido real y pulido

- Si hay JSON real (convertido con `convert.mjs`), usarlo en lugar del sample; validar que todas las secciones y tablas se vean bien en el PDF.
- Ajustar márgenes, espaciado y paginación (evitar cortes feos en tablas).
- Decidir nombre del archivo PDF (mantener el actual o añadir sufijo para reportes con protocolo).

**Entregable Día 4:** PDF de muestra con contenido real o representativo, listo para enseñar.

---

### Día 5 – Revisión y documentación

- Generar un PDF completo (Hoja 1 + protocolo) y dejarlo listo para revisión.
- Documentar: cómo activar el protocolo de muestra, dónde está el JSON y cómo reemplazarlo, cómo se genera el PDF con protocolo.
- Pequeñas correcciones según feedback; mejoras mayores (selector por tipo de servicio, carga desde Firestore) para la siguiente fase.

**Entregable Día 5:** PDF listo para revisión + documentación actualizada.

---

## 6. Implicaciones técnicas clave

- **No** meter nunca el contenido del protocolo dentro de `#pdf-container` (Hoja 1).
- **Formulario:** Protocolos en UI separada (pestañas, acordeones o sección “Anexos” debajo de la Hoja 1).
- **PDF:** Dos (o más) contenedores: uno para Hoja 1, otro(s) para anexos; generación en uno o varios pasos y unión en un único PDF.
- **Estructura del JSON de plantilla:** Ver `PROTOCOL_TEMPLATES_SPEC.md`; las secciones tienen `type`, `title` y campos específicos (content, items, headers/rows, signatures).

---

## 7. Archivos de referencia rápidos

- Concepto y reglas: `apps/reportes-ot/docs/PROTOCOLOS_COMO_ANEXOS.md`
- Plan detallado: `apps/reportes-ot/docs/PLAN_PDF_PROTOCOLO_3_5_DIAS.md`
- Spec del JSON: `apps/reportes-ot/docs/PROTOCOL_TEMPLATES_SPEC.md`
- Conversión Word→JSON: `apps/reportes-ot/scripts/word-to-protocol-json/README.md` y `convert.mjs`
- Ejemplo JSON: `apps/reportes-ot/scripts/word-to-protocol-json/sample-protocol-output.json`

---

## 8. Siguiente fase (después del PDF de muestra)

- Selector de protocolo por tipo de servicio y equipo.
- Carga de plantillas desde Firestore (colección `protocolTemplates`).
- Validación de campos obligatorios del protocolo antes de finalizar el reporte.
- Tests del componente y de la generación del PDF.

---

*Informe generado para dar contexto a ChatGPT sobre el estado y los pasos a seguir en la funcionalidad de protocolos como hojas anexo en la app reportes-ot.*
