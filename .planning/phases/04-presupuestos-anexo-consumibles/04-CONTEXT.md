# Phase 4: Presupuestos — Anexo consumibles por módulo - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Generar automáticamente un PDF anexo con el listado de consumibles requeridos por módulo cuando un presupuesto incluye servicios marcados con flag `requiereAnexoConsumibles` (operacionalmente: MPCC = Mantenimiento Preventivo Con Consumibles). El sistema matchea los módulos del sistema seleccionado contra el catálogo `consumiblesPorModulo` por `codigo` exacto, y adjunta uno o varios anexos al email de envío del presupuesto.

**Fuera de scope (fases futuras):**
- Auto-sugerencia de consumibles basada en historial real de consumos (post v1, requiere ≥1 año de data acumulada).
- Edición manual del contenido del anexo desde la UI de envío.
- Almacenamiento del PDF anexo en Storage o Firestore (regeneración fresh on-demand).

</domain>

<decisions>
## Implementation Decisions

### Trigger detection
- **Flag `requiereAnexoConsumibles: boolean`** (default `false`) en `TipoEquipoServicio` (vive en `@ags/shared`). Se tilda al definir/editar el servicio en el catálogo de tipos de equipo.
- **Schema-flexible**: cualquier `tipo` (`'mantenimiento' | 'regulatorio' | 'consumible' | 'otro'`) puede llevar el flag. Operacionalmente solo los servicios MPCC (Mantenimiento Preventivo Con Consumibles) lo van a tildar — el flag es ortogonal al `tipo`.
- **N anexos separados**: si un presupuesto tiene K items con flag (de mismo o distinto tipo de equipo), se generan K PDFs y se adjuntan los K al email. NO se mergea en un único PDF combinado.
- **Matcheo automático**: cuando un item del presupuesto referencia un `servicioCode` cuyo registro en `tiposEquipoPlantillas[X].servicios[Y]` tiene `requiereAnexoConsumibles: true`, se dispara la generación del anexo para ese item.

### Catálogo de consumibles (`consumiblesPorModulo`)
- **Colección Firestore separada** `consumibles_por_modulo` (snake_case, igual que `condiciones_pago`, `plantillas_texto_presupuesto`).
- **Keyed por `codigo` del módulo** (ej: `"G7129A"`, `"G1322A"`). Un solo documento por código de módulo, reusable entre todas las plantillas que lo incluyan (ej: G7129A puede aparecer en HPLC 1260 y HPLC 1290 — se declara una sola vez).
- **Schema de cada consumible** (mínimo informativo, sin precios): `{ codigo: string, descripcion: string, cantidad: number }`.
  - Sin `precio` — el costo está implícito en el ítem MPCC del PDF principal. Mostrar precios separados generaría fricción comercial.
  - Sin `periodicidad` — el goal es un listado, no un cronograma.
- **Audit fields** estándar (`createdAt`, `updatedAt`, `createdBy`, `updatedBy` — todos `string | null` para respetar la regla Firestore-undefined).

### Match de módulos contra catálogo
- **Híbrido**: si el sistema del cliente tiene módulos reales registrados (con `moduloModelo` y/o `codigo` cargados), se usan esos códigos para mirar `consumiblesPorModulo`. Si no, se cae a `TipoEquipoPlantilla.componentes[]` y se usan esos códigos. Mismo patrón que ya rige para componentes en presupuestos de contrato.
- **Match exacto por `codigo`**: `G7129A` solo matchea `G7129A`. Variantes (G7129B, G7129AR) se declaran aparte en el catálogo. Los part numbers Agilent son códigos cerrados, mezclar variantes con un prefijo es peligroso.
- **Failure handling (mix)**:
  - **Caso (i) Módulo sin `codigo`** (legacy/datos incompletos): el módulo aparece en el anexo con marca interna "Consumibles no especificados — sin código". Warning visible al vendedor en `EnviarPresupuestoModal`.
  - **Caso (ii) `codigo` existe pero no está en `consumiblesPorModulo`** (catálogo incompleto): mismo tratamiento que (i) — marca en PDF + warning al enviar.
  - **Caso (iii) `codigo` existe en catálogo pero su lista de consumibles está vacía** (declarado intencionalmente): skip silencioso. Es un "no lleva consumibles" deliberado, no un error.
- **Caso terminal** — sistema sin módulos reales Y sin matcheo de plantilla:
  - **Warn al enviar** (no bloquear, no skip silencioso): banner amarillo en `EnviarPresupuestoModal` "El item X lleva anexo de consumibles pero no se encontraron módulos para el sistema Y. ¿Enviar sin anexo?". El vendedor decide en el momento. Cancelable.

### Contenido y formato del PDF anexo
- **Estructura**: agrupado por módulo con headers. Cada módulo arranca su propia sección (título: `{codigo} — {descripcion}`, ej: `G7129A — Inyector Iso Pump`), debajo la tabla de consumibles de ese módulo.
- **Columnas de la tabla**: `Código` + `Descripción` + `Cantidad`. Sin precios ni periodicidad — listado informativo.
- **Header del PDF**: logo AGS + título "Anexo de Consumibles" + número de presupuesto + nombre del sistema + razón social del cliente + fecha de emisión. Sin AGS visible ID, sin OT futura (info redundante con el PDF principal).
- **Filename del adjunto**: `Anexo Consumibles - {numeroPresupuesto} - {nombreSistema}.pdf` (ej: `Anexo Consumibles - 1234 - HPLC 1260.pdf`). Distingue entre N adjuntos sin saturar con SN/datos extra.
- **Estilo visual**: Editorial Teal **liviano**. Misma paleta y tipografías que `PresupuestoPDFEstandar` (teal-700, Newsreader serif, JetBrains Mono labels) pero con menos peso visual — header más chico, menos color en headers de tabla, más blanco. Reusa los mismos componentes/estilos de `@react-pdf/renderer`.

### Edge cases (regeneración, cambios de catálogo, eliminación de items)
- **No se almacena el anexo** en Storage ni Firestore. Se regenera fresh cada vez que se descarga/envía. El email enviado al cliente queda como el snapshot definitivo (lo recibe en su inbox). Coherente con la estrategia diferida de "split storage" del módulo reportes-ot.
- **Cambios en `consumiblesPorModulo` afectan regeneraciones**: si se actualiza el catálogo después de enviar un presupuesto, una regeneración futura del PDF refleja la versión nueva. El email ya enviado es el "histórico" inmutable. Audit fields en la colección dejan rastro de cambios.
- **Eliminar un item con flag** del presupuesto: el próximo envío no incluye ese anexo. Trivial, no requiere lógica especial.

### Control del usuario (envío)
- **Toggle** en `EnviarPresupuestoModal`: checkbox "Adjuntar anexos de consumibles", default **ON** cuando hay items con flag en el presupuesto. Permite override caso por caso si el vendedor quiere mandar solo el principal.
- **Preview** antes de enviar: botón "Ver anexo" en el modal de envío que abre el PDF en pestaña nueva. Si hay N anexos, mostrar uno por uno con dropdown/tabs. Mismo patrón que el preview del PDF principal.
- **Edición manual del contenido**: NO en v1. El anexo es declarativo desde el catálogo. Si hay que cambiar el contenido, se cambia el catálogo (mantiene calidad de data, evita drift). Diferido si aparece necesidad real.

### Claude's Discretion
- Implementación exacta del lookup de plantilla del sistema (puede reusar `findPlantillaForSistema()` substring longest-first si conviene, o substring exacto — el planner decide según el código existente).
- Diseño exacto del banner de warning al enviar (estilo, ubicación, wording).
- Estructura del componente de preview del anexo (reusar pattern del preview principal o algo más simple).
- UI de la página admin para gestionar `consumiblesPorModulo` (crud por código de módulo) — patrón list-page-conventions.
- Nombre exacto y localización del nuevo servicio (`consumiblesPorModuloService.ts` en `services/`).

</decisions>

<specifics>
## Specific Ideas

- "Cuando definamos los tipos de servicio le tildamos que requiere anexo de consumibles. Ahí luego va a matchear con el tipo de sistema y sus módulos." — el flujo declarativo desde catálogo es la espina dorsal de la fase.
- "Podemos definir en los modelos de módulos los consumibles que llevan y declararlo en cada uno, por ejemplo inyector G7129A lleva tal tal y tal" — operación natural por código de módulo, reusable entre tipos de equipo.
- "Como mejora futura cuando ya hayamos pasado un año de consumos, el sistema va a registrar los consumos del año anterior para cada equipo entonces cuando uno tenga que preparar el presupuesto, si ya hay historial, el sistema ya va a saber." — capturado en Deferred.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`TipoEquipoServicio`** en [packages/shared/src/types/index.ts:1366](packages/shared/src/types/index.ts#L1366): tiene `tipo: TipoServicioPlantilla` y `precioDefault?`. Agregar `requiereAnexoConsumibles?: boolean` (opcional con default `false` para no romper plantillas existentes).
- **`TipoEquipoComponente`** en [packages/shared/src/types/index.ts:1357](packages/shared/src/types/index.ts#L1357): tiene `codigo: string` (Part number Agilent). Es la fuente de códigos para matchear contra `consumiblesPorModulo` cuando se cae al fallback de plantilla.
- **`TipoEquipoPlantilla`** en [packages/shared/src/types/index.ts:1377](packages/shared/src/types/index.ts#L1377): el flag se vive en `servicios[]`, los códigos de módulos se sacan de `componentes[]`. Ya tiene seed con 7 plantillas (HPLC 1100, 1260, 1260 Infinity, etc.).
- **`tiposEquipoService`** en `apps/sistema-modular/src/services/tiposEquipoService.ts`: CRUD pattern + audit. Espejo para el nuevo `consumiblesPorModuloService`.
- **`findPlantillaForSistema()`** (memoria del proyecto): substring longest-first match. Reusar para resolver plantilla del sistema cuando se cae al fallback B.1.a.
- **`gmailService.attachments[]`** en [apps/sistema-modular/src/services/gmailService.ts:12](apps/sistema-modular/src/services/gmailService.ts#L12): ya soporta `Array<{ filename, mimeType, base64Data }>`. No necesita extension — pasar N attachments en lugar de 1.
- **`EnviarPresupuestoModal`** en [apps/sistema-modular/src/components/presupuestos/EnviarPresupuestoModal.tsx](apps/sistema-modular/src/components/presupuestos/EnviarPresupuestoModal.tsx): integra el flujo token-first OAuth (Phase 7). Agregar checkbox + preview button + lógica para producir múltiples adjuntos.
- **`useEnviarPresupuesto`** hook: extender para producir blob[] en vez de blob.
- **`PresupuestoPDFEstandar`** en `apps/sistema-modular/src/components/presupuestos/pdf/`: tokens Editorial Teal + branding. Reusar styles para anexo liviano.
- **`@react-pdf/renderer`** y **`react-pdf-html`** ya instalados (Phase 3).

### Established Patterns
- **Servicios Firestore**: objetos con CRUD methods, `subscribe()` con `onSnapshot`, `batchAudit` inmutable. Una colección por archivo. `cleanFirestoreData` para writes top-level (consumibles tienen estructura simple, no requiere `deepCleanForFirestore`).
- **Audit traces**: `getCreateTrace()` / `getUpdateTrace()` para metadata.
- **List pages**: `list-page-conventions` skill para CRUD admin de `consumiblesPorModulo`. `useUrlFilters` obligatorio si hay filtros.
- **Modales**: ≤250 líneas. Extraer hooks/subcomponentes si crece.
- **N adjuntos en email**: cada uno con `{ filename, mimeType: 'application/pdf', base64Data: pdfToBase64(blob) }`.

### Integration Points
- **`packages/shared/src/types/index.ts`**: agregar `requiereAnexoConsumibles?: boolean` a `TipoEquipoServicio`. Agregar `ConsumibleModulo` interface (codigo/descripcion/cantidad) y `ConsumiblesPorModulo` doc shape (`{ codigoModulo: string, consumibles: ConsumibleModulo[], descripcion?: string, activo: boolean, audit fields }`).
- **`apps/sistema-modular/src/services/`**: nuevo `consumiblesPorModuloService.ts` (CRUD por `codigoModulo` único).
- **`apps/sistema-modular/src/components/presupuestos/pdf/`**: nuevo `AnexoConsumiblesPDF.tsx` con tokens Editorial Teal liviano.
- **`apps/sistema-modular/src/components/presupuestos/EnviarPresupuestoModal.tsx`**: checkbox "Adjuntar anexos" + botón preview + lógica de generar y adjuntar N anexos.
- **`apps/sistema-modular/src/hooks/useEnviarPresupuesto.ts`**: extender para producir `attachments[]`.
- **Página admin nueva** (probablemente `apps/sistema-modular/src/pages/consumibles-por-modulo/`): list + editor por código de módulo.
- **`apps/sistema-modular/src/pages/tipos-equipo/TipoEquipoNestedEditors.tsx`** (o donde se editan los servicios de plantillas): agregar checkbox para `requiereAnexoConsumibles` en el formulario de servicio.
- **`apps/sistema-modular/src/services/tiposEquipoService.ts`** y seed `seedPlantillas.ts`: actualizar para soportar el nuevo campo (default `false`, migración trivial).

### Project Hard Rules (from CLAUDE.md)
- NUNCA `undefined` en Firestore (usar `null` o omitir).
- Componentes React ≤ 250 líneas — extraer hooks/subcomponentes si se pasa.
- Filtros de listas siempre con `useUrlFilters`, nunca `useState`.
- No tocar `apps/reportes-ot`.
- Design system: Editorial Teal (teal-700 primary, Newsreader serif titles, JetBrains Mono labels, Inter body).

</code_context>

<deferred>
## Deferred Ideas

- **Auto-sugerencia desde historial real de consumos**: tras ≥1 año de operación, registrar consumos efectivos por equipo y auto-sugerir consumibles al generar el anexo en función del historial real (no solo del catálogo declarativo). Requiere telemetría de consumos que aún no existe. Retomar post v2.0.
- **Edición manual del contenido del anexo** desde `EnviarPresupuestoModal` (override one-shot sin tocar catálogo). Diferido a v1.1 si aparece necesidad real — por ahora "cambiar el catálogo" es la disciplina.
- **Versionado de catálogo de consumibles**: histórico de cambios para ver "qué consumibles tenía declarado el módulo G7129A en marzo 2026". Por ahora solo audit fields last-modified.
- **Anexo combinado** (un solo PDF con todas las secciones): por si en el futuro el cliente prefiere un solo adjunto en vez de N. Opuesto a la decisión A.3.b. No implementar por ahora.
- **Almacenamiento del PDF anexo en Storage**: paralelo a la decisión "split storage" del módulo reportes-ot. Si en el futuro se necesita rastrear "qué anexo se mandó cuándo", se reactiva. Por ahora email del cliente = snapshot definitivo.

</deferred>

---

*Phase: 04-presupuestos-anexo-consumibles*
*Context gathered: 2026-04-29*
