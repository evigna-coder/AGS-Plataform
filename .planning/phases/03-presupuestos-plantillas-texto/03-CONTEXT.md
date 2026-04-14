# Phase 3: Presupuestos — Plantillas de textos rich text - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Gestión de plantillas rich text para las 6 secciones de texto legal/comercial de un presupuesto (notasTecnicas, notasAdministrativas, garantia, variacionTipoCambio, condicionesComerciales, aceptacionPresupuesto). Las plantillas se cargan por Firestore, se filtran por tipo de presupuesto, se pueden marcar como default (auto-aplicables al crear), y el PDF final renderiza el HTML rich (negritas, listas, font sizes, alineación).

Hoy los textos default están hardcodeados en `PRESUPUESTO_TEMPLATES` ([packages/shared/src/utils.ts:22](packages/shared/src/utils.ts#L22)) y no son editables desde UI. Este phase lo resuelve.

**Fuera de scope (fases futuras):**
- Relación plantilla ↔ condición de pago (filtrado/placeholders)
- Anexo de consumibles por módulo (Phase 4)
- Plantillas para PDF de contrato específicamente (el flujo de contrato tiene su propio PDF — se aborda después si es necesario)

</domain>

<decisions>
## Implementation Decisions

### Modelo de datos — `PlantillaTextoPresupuesto`
- Nueva colección Firestore: `plantillas_texto_presupuesto` (snake_case, igual que `condiciones_pago`)
- Campos del tipo en `@ags/shared`:
  - `id: string`
  - `nombre: string` (ej: "Condiciones Comerciales — Servicio estándar")
  - `tipo: keyof PresupuestoSeccionesVisibles` — una de las 6 secciones
  - `contenido: string` — HTML rich (output de RichTextEditor)
  - `tipoPresupuestoAplica: TipoPresupuesto[]` — **una plantilla puede aplicar a múltiples tipos** (ej: `['servicio', 'partes', 'mixto']`)
  - `esDefault: boolean` — si es el default para los tipos que aplica
  - `activo: boolean`
  - `createdAt, updatedAt` + audit trace estándar
- **No se guarda plantillaId en el presupuesto** — solo el contenido final. Cambios futuros a la plantilla no afectan presupuestos existentes.

### Matching y conflictos
- **Una plantilla puede ser default de varios tipos a la vez** — se evita duplicar contenido idéntico entre tipos.
- **Conflicto de múltiples defaults** (2+ plantillas con `esDefault=true` que aplican al mismo tipo+sección): el sistema **NO bloquea el guardado**. En runtime, al crear un presupuesto, si hay conflicto para una sección, se muestra **selector** al usuario para elegir cuál cargar (lista de defaults candidatos con preview).
- **Sin default disponible** para el tipo del presupuesto en una sección: el campo queda **vacío**. El usuario puede cargar manualmente desde el dropdown "Cargar plantilla" (que muestra todas las activas que apliquen al tipo). **No hay fallback** a `PRESUPUESTO_TEMPLATES` hardcoded (ese catálogo se migra y luego queda obsoleto).

### Auto-aplicación y edición
- **Creación**: al seleccionar el `tipo` inicial del presupuesto, el sistema busca defaults por sección y rellena los campos automáticamente. Si hay conflicto por sección → muestra selector inline. Si no hay default para esa sección + tipo → deja vacío.
- **Cambio de tipo durante creación** (antes de guardar): **no re-aplica** automáticamente. Respeta lo que el usuario haya modificado.
- **Edición de presupuesto existente**: al cambiar `tipo` de un presupuesto ya creado, **no se tocan los textos** automáticamente. El usuario puede cargar manualmente una plantilla nueva desde el dropdown si quiere.
- Dropdown "Cargar plantilla" junto a cada sección en el editor — filtrado por `tipoPresupuestoAplica` ⊇ tipo actual. Reemplaza el contenido con confirmación si el campo ya tiene texto.

### Editor rich text (RichTextEditor)
- Reusar el componente existente en [components/ui/RichTextEditor.tsx](apps/sistema-modular/src/components/ui/RichTextEditor.tsx).
- **No agregar H1/H2/H3**: los subtítulos de "condiciones de entrega", "tipos de cambio", etc. se resuelven con **font size (hasta 24pt) + negrita**. El usuario controla jerarquía visual sin semantic headings.
- Font size libre (10–24pt, ya disponible).
- **Agregar botones de alineación** (izq / centro / der) al toolbar del RichTextEditor — extensión mínima al editor existente.
- No agregar: links, colores, tablas, imágenes (fuera de scope).

### PDF rendering (HTML rich)
- El PDF actual ([PresupuestoPDFEstandar.tsx](apps/sistema-modular/src/components/presupuestos/pdf/PresupuestoPDFEstandar.tsx)) usa `@react-pdf/renderer`, que **no acepta HTML directamente**.
- Aproximación: parser HTML → componentes React-PDF (`Text`, `View`) con mapeo de estilos (`<b>` → `fontWeight: bold`, `<ul>/<li>` → bullets, `<div style="text-align: center">` → `textAlign: 'center'`, `<font size="5">` → font size mapping).
- Soporte mínimo requerido: bold, italic, underline, unordered list, ordered list, font size (10–24pt via execCommand), text-align (left/center/right).
- **Claude's Discretion**: elegir librería auxiliar (ej: `html-react-parser` + mapping custom, o `react-pdf/html`, o parser custom) — el planner/executor decide.

### UI de gestión — Modal
- **Gestión por modal**, no página dedicada. Patrón igual a [CondicionesPagoModal.tsx](apps/sistema-modular/src/components/presupuestos/CondicionesPagoModal.tsx), pero **modal grande** (ancho ~900px, alto ~80vh) para que el RichTextEditor tenga espacio.
- Modal tiene:
  - Lista de plantillas (tabla) con columnas: Nombre, Sección, Tipos aplicables (chips), Default (✓), Activa (✓), Acciones.
  - Preview plain-text truncado a ~100 chars (strip HTML con regex simple) como subtítulo debajo del nombre.
  - Filtros (via `useUrlFilters` incluso dentro del modal — ya patrón del proyecto): por sección, por tipo de presupuesto, por activas/todas.
  - Botón "+ Nueva plantilla" abre subform/drawer dentro del mismo modal con el RichTextEditor en pantalla completa.
- **Acceso al modal**:
  - Botón "Plantillas de textos" en la toolbar de [PresupuestosList.tsx](apps/sistema-modular/src/pages/presupuestos/PresupuestosList.tsx) (junto a "Condiciones de Pago", "Categorías", etc.).
  - Link "Gestionar plantillas →" junto al dropdown "Cargar plantilla" dentro del editor de presupuesto.

### Seed inicial y migración
- Script de seed one-shot que crea plantillas iniciales en Firestore a partir de `PRESUPUESTO_TEMPLATES`:
  - 6 plantillas principales (una por sección) marcadas `esDefault=true`, `tipoPresupuestoAplica=['servicio', 'partes', 'ventas', 'mixto']` (todos menos contrato — ese tiene templates propios).
  - 2 plantillas adicionales del sub-objeto `PRESUPUESTO_TEMPLATES.contrato` (notasSobrePresupuesto → `tipo=notasTecnicas`, condicionesComerciales): `esDefault=true`, `tipoPresupuestoAplica=['contrato']`.
  - Contenido: convertir plain text con newlines a HTML básico (`\n\n` → `<br><br>`, preservar bullets `•` como `<ul><li>`).
- Patrón: browser-based script similar a `apps/sistema-modular/scripts/fix-inyectores-browser.mjs` o [seedPlantillas.ts](apps/sistema-modular/src/pages/tipos-equipo/seedPlantillas.ts) — admin lo corre una vez desde la consola del browser.
- Después del seed, `PRESUPUESTO_TEMPLATES` queda como referencia histórica pero **el editor deja de usarlo** (toda carga viene de Firestore).

### Claude's Discretion
- Elección de librería/approach para parsear HTML → React-PDF primitives
- Diseño visual exacto del modal de gestión (respetando Editorial Teal tokens — teal-700, Newsreader, JetBrains Mono)
- Implementación del selector de conflicto (inline en el editor vs modal aparte)
- Manejo de errores en el PDF si el HTML tiene tags no soportados (fallback a texto plano strip)
- Implementación exacta del strip HTML para preview (regex simple)

</decisions>

<specifics>
## Specific Ideas

- El usuario explícitamente mencionó: "textos largos, con subtítulos como condiciones de entrega, tipos de cambio, básicamente un aviso sobre la política comercial". Esto refuerza que el rich text debe soportar estructura jerárquica visual (aunque sea solo con font size + negrita).
- Mantener UX consistente con el patrón ya existente de `CondicionesPagoModal` (ejemplo de catálogo modal tamaño pequeño) — pero escalar a tamaño grande para acomodar rich text.
- El botón "Cargar plantillas" en el editor actual ([PresupuestoCondicionesEditor.tsx:77](apps/sistema-modular/src/components/presupuestos/PresupuestoCondicionesEditor.tsx#L77)) carga todas de PRESUPUESTO_TEMPLATES a la vez — **mantener** esa UX pero que cargue defaults de Firestore por tipo del presupuesto.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`RichTextEditor`** en [components/ui/RichTextEditor.tsx](apps/sistema-modular/src/components/ui/RichTextEditor.tsx): B/I/U + UL/OL + font size 10-24pt. Output HTML. Ya usado en `ProtocolCatalogEditorPage`. **Extender con alineación** (execCommand('justifyLeft/Center/Right')).
- **`PresupuestoCondicionesEditor`** en [components/presupuestos/PresupuestoCondicionesEditor.tsx](apps/sistema-modular/src/components/presupuestos/PresupuestoCondicionesEditor.tsx): editor existente con 6 toggles + textarea + botón "Plantilla" que carga de PRESUPUESTO_TEMPLATES. **Refactor principal**: reemplazar textarea por RichTextEditor, reemplazar `getTemplate()` por llamada a servicio `plantillasTextoPresupuestoService.getDefaults(tipo, seccion)`.
- **`condicionesPagoService`** en [services/presupuestosService.ts:696](apps/sistema-modular/src/services/presupuestosService.ts#L696): patrón CRUD + batchAudit limpio. Copiar para `plantillasTextoPresupuestoService`.
- **`CondicionesPagoModal`** en [components/presupuestos/CondicionesPagoModal.tsx](apps/sistema-modular/src/components/presupuestos/CondicionesPagoModal.tsx): patrón de modal de gestión — pero ese modal es chico. El nuevo modal debe ser `size="lg"` o similar para el RichTextEditor.
- **`useUrlFilters`**: hard rule del proyecto, usar para filtros de la lista de plantillas.
- **`Modal`, `Card`, `Button`, `Input`, `SearchableSelect`**: UI atoms listos.
- **`PresupuestoSeccionesVisibles`, `PRESUPUESTO_SECCIONES_LABELS`, `PRESUPUESTO_SECCIONES_DEFAULT`** en `@ags/shared` — tipos existentes para las 6 secciones.
- **`TipoPresupuesto`** en [packages/shared/src/types/index.ts:703](packages/shared/src/types/index.ts#L703): `'servicio' | 'partes' | 'ventas' | 'contrato' | 'mixto'` + labels.
- **`TIPO_PRESUPUESTO_LABELS`**: ya existen para mostrar chips legibles.

### Established Patterns
- Servicios: objetos con CRUD methods + `subscribe()` con `onSnapshot`, `batchAudit` inmutable para audit trail.
- `deepCleanForFirestore()` para datos nested antes de escribir — el HTML rich puede tener nested data si se usa un format estructurado, pero como es string simple, `cleanFirestoreData()` top-level alcanza.
- `getCreateTrace()` / `getUpdateTrace()` para metadata de audit.
- Modales: pattern con `open`, `onClose`, `title`, `subtitle` (ver `CondicionesPagoModal`).
- Filtros con `useUrlFilters` incluso en modales (ya hay precedente).
- Seed scripts: browser-based MJS en `apps/sistema-modular/scripts/` o tsx en páginas (`seedPlantillas.ts`).

### Integration Points
- **`packages/shared/src/types/index.ts`**: agregar `PlantillaTextoPresupuesto` interface cerca de `PresupuestoSeccionesVisibles` (líneas ~975).
- **`apps/sistema-modular/src/services/presupuestosService.ts`**: agregar `plantillasTextoPresupuestoService` (export new const).
- **`apps/sistema-modular/src/components/presupuestos/PresupuestoCondicionesEditor.tsx`**: refactor mayor — de textarea + template hardcoded a RichTextEditor + servicio remoto + dropdown de plantillas.
- **`apps/sistema-modular/src/components/presupuestos/pdf/PresupuestoPDFEstandar.tsx`**: renderizado de HTML rich en las secciones de texto (hoy es plain string).
- **`apps/sistema-modular/src/hooks/useCreatePresupuestoForm.ts`**: al inicializar el form con un `tipo`, hacer fetch de defaults y pre-rellenar `notasTecnicas`, `condicionesComerciales`, etc.
- **`apps/sistema-modular/src/pages/presupuestos/PresupuestosList.tsx`**: agregar botón "Plantillas de textos" en la toolbar.
- **`apps/sistema-modular/src/components/ui/RichTextEditor.tsx`**: extender toolbar con alignment buttons (execCommand justifyLeft/justifyCenter/justifyRight).
- Nueva colección Firestore: `plantillas_texto_presupuesto`.
- **Skill `list-page-conventions`** disponible — aplica si alguna parte se implementa como lista tabular.

### Project Hard Rules (from CLAUDE.md / PROJECT.md)
- NUNCA `undefined` en Firestore (usar `null` o omitir)
- Componentes React ≤ 250 líneas — extraer hooks/subcomponentes si se pasa
- Filtros de listas siempre con `useUrlFilters`, nunca `useState`
- No tocar `apps/reportes-ot`
- Design system: Editorial Teal (teal-700 primary, Newsreader serif titles, JetBrains Mono labels, Inter body)

</code_context>

<deferred>
## Deferred Ideas

- **Relación plantilla ↔ condición de pago** — filtrado adicional o placeholders dinámicos tipo `[[CONDICION_PAGO]]` dentro del texto de la plantilla. Fase futura si hay necesidad real.
- **Versionado de plantillas** — historial de cambios a una plantilla (ver qué se modificó y cuándo). Fuera de scope por ahora; solo queda last-modified via audit trace.
- **Roles / permisos por plantilla** — no todos los roles deberían poder editar plantillas comerciales. Se manejará dentro del sistema RBAC general del proyecto, no aquí.
- **Plantillas específicas para PDF de contrato** — el flujo de contrato tiene su propio template ([components/presupuestos/pdf/contrato/](apps/sistema-modular/src/components/presupuestos/pdf/contrato/)). Si se necesita rich text allí también, se aborda en una fase propia.
- **Preview HTML renderizado inline en la lista de plantillas** — puede ser útil pero aumenta peso visual. Por ahora solo preview plain-text.
- **Import/export de plantillas** (backup/sharing) — fuera de scope.
- **Phase 4: Anexo de consumibles por módulo** — ya listado en ROADMAP.md, se planifica después de completar Phase 3.

</deferred>

---

*Phase: 03-presupuestos-plantillas-texto*
*Context gathered: 2026-04-14*
