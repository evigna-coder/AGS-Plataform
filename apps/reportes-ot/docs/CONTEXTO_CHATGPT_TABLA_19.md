# Contexto para ChatGPT – Problema de la Tabla 19 (sec_19)

**Uso:** Copia todo el contenido **debajo de "INICIO DEL CONTEXTO"** y pégalo en el primer mensaje de un nuevo chat con ChatGPT. Incluye este documento para que entienda el proyecto, el flujo del protocolo y el problema concreto de la Tabla 19 que no se ha logrado resolver.

---

## INICIO DEL CONTEXTO

---

# 1. QUÉ ES ESTE PROYECTO

- **App:** **reportes-OT** (React + TypeScript + Vite), dentro de un monorepo. Los técnicos completan reportes de servicio de órdenes de trabajo (OT) y generan un PDF.
- **Dos partes en la app y en el PDF:**
  1. **Hoja 1 – Reporte de servicio:** formulario (cliente, equipo, OT, informe técnico, firmas). **No se debe modificar.**
  2. **Anexo – Protocolos técnicos:** documento tipo “Calificación de operación” (HPLC), que se muestra debajo del reporte y en el PDF son páginas adicionales (página 2, 3, …).

- **Restricción:** Cualquier cambio de protocolos debe hacerse solo en:
  - Componentes bajo `ProtocolView.tsx` y `components/protocol/*`
  - Tipos en `types/protocol.ts` (o `types/index.ts`)
  - JSON de plantillas en `data/calif-operacion-hplc.json`
  - Normalizadores en `utils/protocolNormalizers.ts`
  - Selector en `utils/protocolSelector.ts`
  - CSS que afecte solo al anexo.

---

# 2. FLUJO DEL PROTOCOLO (ANEXO)

1. **Origen del template:** En `App.tsx`, la plantilla se obtiene así:
   - `protocolTemplate = getProtocolTemplateById(protocolTemplateId) ?? getProtocolTemplateForServiceType(tipoServicio)`
   - Ambas funciones viven en `utils/protocolSelector.ts` y devuelven **siempre** `getNormalized(t)`, es decir `normalizeProtocolTemplate(template)`.

2. **Datos de la plantilla:** El template “en bruto” viene de `data/califOperacionHplcProtocol.ts`, que importa `calif-operacion-hplc.json` y expone `template.sections` (array de secciones: text, checklist, table, signatures).

3. **Renderizado:** `App.tsx` pasa a `ProtocolView`:
   - `template={protocolTemplate}` (el normalizado)
   - `data={protocolData}` (valores guardados por sección/fila/celda)
   - `mode="edit"` en la zona de edición del anexo

4. **ProtocolView** (`components/ProtocolView.tsx`):
   - Hace `templateToUse = normalizeProtocolTemplate(template)` (vuelve a normalizar por si acaso).
   - Itera `templateToUse.sections` y para cada una llama a `renderSection(section, sectionIndex, ...)`.
   - El **sectionIndex** que se usa en la UI es **1-based** (p. ej. la sección 19 se pinta como “19 TABLA” porque se pasa `sectionIndex = 19` a `ProtocolSectionBlock`).

5. **Para secciones tipo tabla:** Dentro de `renderSection`, si `isTableSection(section)`:
   - Se considera “tabla compuesta” si `isCompositeConclusionesTableSection(section) || sectionIndex === 19`.
   - Se usa `resolvedSection = normalizeCompositeConclusionesSection(section)` cuando es compuesta.
   - Se construye `rowsToPass` (inyectando una fila gris si la primera fila no es la gris).
   - Se renderiza `ProtocolTable` con: `headers`, `rows={rowsToPass}`, `sectionId`, `sectionIndex`, `compositeTitleRowTitle`, `getCellValue`, `onChangeCell`, etc.

6. **ProtocolTable** (`components/protocol/ProtocolTable.tsx`):
   - Recibe `headers`, `rows`, `sectionId`, `sectionIndex`, `compositeTitleRowTitle`, etc.
   - Calcula `effectiveRows`: si es sección compuesta (sec_18, sec_19 o sectionIndex === 19) y hay `compositeTitleRowTitle` y la primera fila **no** es la fila gris (celda con `variant === 'header'` y `colSpan >= 4`), antepone una fila gris con título + checkbox “Ver especificación del cliente”.
   - Construye el grid del body con `effectiveRows` y pinta `<thead>` y `<tbody>`.
   - Para celdas: si detecta “subencabezado Cumple” (fila de 3 celdas, primera celda checkbox sin label) debe mostrar el texto **"Cumple"** en lugar de un input; y en tablas compuestas no debe mostrar checkboxes como input en las columnas de conclusiones.

---

# 3. FORMATO DESEADO DE LA TABLA 19 (Y SEC_18) – “COMO LA TABLA 20”

La **Tabla 19** (sección con id `sec_19` en el JSON, mostrada en la UI como “19 TABLA”) debe verse **igual** que la Tabla 20 (y que sec_18): formato de “tabla compuesta” con varios bloques de test. Estructura deseada:

1. **Fila gris (título del bloque):**
   - Izquierda: título del test (ej. “TEST DE EXACTITUD Y PRECISIÓN DE FLUJO (CANAL A)”).
   - **Derecha: checkbox con etiqueta “Ver especificación del cliente”.** Este checkbox debe ser visible y funcional.

2. **Encabezado de tabla (una fila en el body):**
   - Columnas: **Parámetro** | **Resultado** | **Especificación** | **Conclusiones** (Conclusiones abarca 3 subcolumnas).

3. **Subencabezado de Conclusiones (una fila en el body):**
   - Tres celdas de texto: **Cumple** | **No cumple** | **No aplica**. No debe haber un cuadro de texto vacío donde va “Cumple”.

4. **Filas de datos:**
   - Parámetro, Resultado, Especificación y **tres checkboxes** (Cumple / No cumple / No aplica) por fila.

5. **Sin thead global de 2 filas:** No debe aparecer arriba de la tabla un `<thead>` con una fila “PARÁMETRO | RESULTADO | ESPECIFICACIÓN | CONCLUSIONES” y otra “Cumple | No cumple | No aplica”. Toda esa estructura debe estar solo en el `<tbody>`.

---

# 4. QUÉ TIENE HOY EL JSON PARA SEC_19 (ESTRUCTURA “EN BRUTO”)

En `data/calif-operacion-hplc.json`, la sección `sec_19` tiene:

- **headers:** `["Test de Composición de Gradiente Canales C/D", "Ver especificación del cliente"]` (2 elementos).
- **rows:**
  - **row_1:** 4 celdas de texto: Parámetro, Resultado, Especificación, Conclusiones (es el encabezado de la tabla).
  - **row_2:** 3 celdas: **checkbox** (sin label), texto "No cumple", texto "No aplica" (falta el texto "Cumple"; en el origen es un checkbox en la primera posición).
  - **row_3 y siguientes:** filas de 6 celdas (Parámetro, Resultado, Especificación, 3 checkboxes) o de 3 celdas (solo param/resultado/especificación).
  - Más adelante en sec_19 hay más “bloques” (otras filas que son títulos de test en 1 celda con texto tipo “Test de … Ver especificación del cliente”, y luego otra vez fila de 4 celdas, fila de 3 celdas, etc.).

Es decir: en crudo **no** hay una fila gris con título + checkbox; la primera fila es la de “Parámetro | Resultado | Especificación | Conclusiones”. Y la fila de subencabezado tiene 3 celdas: checkbox, “No cumple”, “No aplica” (sin texto “Cumple”). La sección `sec_18` en el JSON tiene la misma estructura en bruto; el formato deseado se obtiene por normalización y por cómo se pinta la tabla.

---

# 5. QUÉ SE HA INTENTADO (Y LA FALLA PERSISTE)

Se ha intentado que la Tabla 19 se renderice con el formato deseado haciendo lo siguiente (y aun así en la app el formato no cambia):

1. **Normalizador** (`utils/protocolNormalizers.ts`):
   - `normalizeCompositeConclusionesTable(section)`: para sec_18 y sec_19 (por id) construye una primera fila “gris” con título (desde `section.headers[0]`) y celda con checkbox “Ver especificación del cliente”, luego fila de encabezado (Parámetro | Resultado | Especificación | Conclusiones), luego fila de subencabezado con **Cumple | No cumple | No aplica** (con `makeRowConclusionesSubheader()`), y el resto de filas en 6 columnas. Devuelve `headers: []` para que no se pinte thead global.
   - `normalizeProtocolTemplate(template)` llama a `normalizeCompositeConclusionesFirst(template)`, que aplica este normalizador a las secciones que `isCompositeConclusionesTable(section)` considera compuestas (p. ej. sec_18, sec_19).
   - Se exporta `normalizeCompositeConclusionesSection(section)` para poder normalizar una sección desde la vista.
   - Reglas adicionales: filas de 1 celda con “Ver especificación del cliente” se convierten en fila gris; filas con variant `header` no se filtran como vacías.

2. **ProtocolView** (`components/ProtocolView.tsx`):
   - Se normaliza el template al recibirlo: `templateToUse = normalizeProtocolTemplate(template)` (sin useMemo, en cada render).
   - Para tablas compuestas se usa `isComposite = isCompositeConclusionesTableSection(section) || sectionIndex === 19`.
   - Se llama a `normalizeCompositeConclusionesSection(section)` y, si la primera fila de `rowsToPass` no es la fila gris, se **inyecta** una fila gris (título + checkbox) al inicio de `rowsToPass`.
   - Se pasa a `ProtocolTable`: `headers={[]}` cuando es compuesta, `rows={rowsToPass}`, `sectionId={section.id}`, `sectionIndex={sectionIndex}`, `compositeTitleRowTitle={...}` (título desde headers[0] o primera celda).

3. **ProtocolTable** (`components/protocol/ProtocolTable.tsx`):
   - Se añadieron `sectionId`, `sectionIndex`, `compositeTitleRowTitle`.
   - Si `sectionId === 'sec_18' | 'sec_19'` o `sectionIndex === 19`, y hay `compositeTitleRowTitle` y la primera fila de `rows` no es la gris, se antepone una fila gris (`makeGreyTitleRow(compositeTitleRowTitle)`) a `rows` para formar `effectiveRows`.
   - El thead se pinta vacío (una fila de altura cero) cuando `headers.length === 0` o cuando la primera fila del body es la gris (`firstRowIsGreyTitle`).
   - Para la celda que debe decir “Cumple”: se detecta el caso “fila de 3 celdas, primera celda checkbox sin checkboxLabel” (`isSubheaderCumpleCell`) y se renderiza el texto “Cumple” en lugar de un input; y se evita que los checkboxes de conclusiones se rendericen como input (`renderCheckboxAsInput` excluye ese caso y las columnas de conclusiones en tablas compuestas).

4. **ProtocolView – detección por índice:** Se forzó también el formato compuesto cuando `sectionIndex === 19`, por si la sección mostrada como “19 TABLA” no tuviera `id === 'sec_19'`.

A pesar de todo esto, en la aplicación la Tabla 19 **sigue mostrando**:
- Sin checkbox “Ver especificación del cliente” en la fila gris (o sin fila gris).
- Donde debería decir “Cumple” en el subencabezado, un **cuadro de texto vacío** (input).
- Posiblemente las dos filas de thead arriba (PARÁMETRO | RESULTADO | ESPECIFICACIÓN | CONCLUSIONES y Cumple | No cumple | No aplica).

Es decir: o bien la normalización/inyección no se está aplicando a la sección que el usuario ve como “19 TABLA”, o bien el renderer no está usando `effectiveRows` / las props correctas para esa tabla, o hay otra ruta (otro componente o otra fuente de template/datos) que pinta esa tabla.

---

# 6. ARCHIVOS CLAVE Y DÓNDE MIRAR

- **Plantilla en bruto:** `apps/reportes-ot/data/calif-operacion-hplc.json` → buscar `"id": "sec_19"` y su `headers` y `rows`.
- **Carga de plantilla:** `apps/reportes-ot/data/califOperacionHplcProtocol.ts` (exporta el objeto con `sections` del JSON).
- **Selector y normalización al cargar:** `apps/reportes-ot/utils/protocolSelector.ts` → `getProtocolTemplateById`, `getProtocolTemplateForServiceType` → siempre devuelven `normalizeProtocolTemplate(t)`.
- **Normalizadores:** `apps/reportes-ot/utils/protocolNormalizers.ts`:
  - `normalizeProtocolTemplate`, `normalizeCompositeConclusionesFirst`, `normalizeCompositeConclusionesTable`, `normalizeCompositeConclusionesSection` (exportada).
  - `isCompositeConclusionesTable`, `isAlreadyCompositeNormalized`, `makeRowConclusionesSubheader`, `makeGreyTitleRow` (o lógica equivalente de fila gris).
- **Vista del protocolo:** `apps/reportes-ot/components/ProtocolView.tsx`:
  - Uso de `templateToUse`, `sectionsToRender`, `renderSection(section, sectionIndex, ...)`.
  - Para tablas: `isComposite`, `resolvedSection`, `rowsToPass`, inyección de fila gris, props pasadas a `ProtocolTable`.
- **Tabla:** `apps/reportes-ot/components/protocol/ProtocolTable.tsx`:
  - `effectiveRows`, `isCompositeSection`, thead vacío vs. thead de 2 filas, rama que pinta “Cumple” (`isSubheaderCumpleCell`), rama que evita pintar checkbox como input en conclusiones.
- **App:** `apps/reportes-ot/App.tsx` → de dónde sale `protocolTemplate` y que se pase a `ProtocolView` (solo para confirmar que no se usa otra fuente de template).

---

# 7. LO QUE NECESITAMOS QUE RESUELVA CHATGPT

1. **Identificar por qué el formato de la Tabla 19 no cambia en la UI** aunque existan normalización, inyección de fila gris y reglas en ProtocolTable. Posibles líneas a comprobar:
   - Si la sección que se muestra como “19 TABLA” es realmente la de `id === 'sec_19'` o la que está en el índice 19 (1-based) de `templateToUse.sections`.
   - Si el template que recibe `ProtocolView` es siempre el devuelto por `getProtocolTemplateById` / `getProtocolTemplateForServiceType` (normalizado) o si en algún flujo (p. ej. carga de reporte guardado) se usa otra plantilla o datos que no pasan por esa normalización.
   - Si en el árbol de componentes la tabla que pinta “19 TABLA” es efectivamente la que recibe `sectionId="sec_19"` y `sectionIndex={19}` y las `rows` ya con la fila gris y el subencabezado correcto.

2. **Proponer una solución concreta** (cambios de código y archivos) para que la Tabla 19 se renderice con:
   - Fila gris con título + checkbox “Ver especificación del cliente”.
   - Subencabezado con el texto “Cumple” (no un input).
   - Sin thead global de 2 filas.
   - Mismo aspecto que la Tabla 20 / sec_18.

3. **Si hace falta**, sugerir una forma de depurar en runtime (p. ej. un `console.log` o un data-attribute temporal) para ver qué `section.id`, `sectionIndex`, `headers.length` y número de filas recibe la tabla que se muestra como “19 TABLA”.

---

# 8. ESTRUCTURA DE CARPETAS RELEVANTE

```
apps/reportes-ot/
  App.tsx
  components/
    ProtocolView.tsx
    protocol/
      ProtocolTable.tsx
      ProtocolSectionBlock.tsx
      index.ts
  data/
    calif-operacion-hplc.json
    califOperacionHplcProtocol.ts
  utils/
    protocolNormalizers.ts
    protocolSelector.ts
  types/
    protocol.ts (o types/index.ts)
  docs/
    CONTEXTO_CHATGPT_TABLA_19.md  (este archivo)
```

---

Fin del contexto para ChatGPT.
