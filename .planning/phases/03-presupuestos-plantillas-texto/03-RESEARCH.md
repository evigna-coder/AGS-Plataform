# Phase 3: Presupuestos — Plantillas de textos rich text - Research

**Researched:** 2026-04-13
**Domain:** HTML rich text templates in Firestore + render inside @react-pdf/renderer PDF
**Confidence:** HIGH (stack + codebase patterns), MEDIUM (specific HTML→PDF library call site details)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Modelo de datos — `PlantillaTextoPresupuesto`**
- Nueva colección Firestore: `plantillas_texto_presupuesto` (snake_case, igual que `condiciones_pago`)
- Campos del tipo en `@ags/shared`:
  - `id: string`
  - `nombre: string` (ej: "Condiciones Comerciales — Servicio estándar")
  - `tipo: keyof PresupuestoSeccionesVisibles` — una de las 6 secciones
  - `contenido: string` — HTML rich (output de RichTextEditor)
  - `tipoPresupuestoAplica: TipoPresupuesto[]` — una plantilla puede aplicar a múltiples tipos
  - `esDefault: boolean`
  - `activo: boolean`
  - `createdAt, updatedAt` + audit trace estándar
- **No se guarda plantillaId en el presupuesto** — solo el contenido final.

**Matching y conflictos**
- Una plantilla puede ser default de varios tipos a la vez.
- Conflicto de múltiples defaults: NO bloquea el guardado. Runtime muestra selector al usuario.
- Sin default: campo queda vacío. No hay fallback a `PRESUPUESTO_TEMPLATES` hardcoded.

**Auto-aplicación y edición**
- Creación: al seleccionar `tipo`, buscar defaults y rellenar. Si conflicto → selector inline. Si no hay default → vacío.
- Cambio de `tipo` durante creación: no re-aplica automáticamente.
- Edición de presupuesto existente: al cambiar `tipo`, no se tocan los textos.
- Dropdown "Cargar plantilla" junto a cada sección.

**Editor rich text**
- Reusar `components/ui/RichTextEditor.tsx`.
- No H1/H2/H3: jerarquía via font size (hasta 24pt) + negrita.
- Font size libre (10–24pt, ya disponible).
- **Agregar botones de alineación** (izq / centro / der) — extensión mínima.
- No agregar: links, colores, tablas, imágenes.

**PDF rendering**
- Soporte mínimo: bold, italic, underline, ul, ol, font size (10–24pt), text-align.
- **Claude's Discretion**: elegir librería (ej: `react-pdf-html`, `html-react-parser`, o parser custom).

**UI de gestión**
- Gestión por modal (no página). Modal grande (~900px, 80vh).
- Tabla: Nombre, Sección, Tipos aplicables (chips), Default, Activa, Acciones.
- Preview plain-text truncado ~100 chars.
- Filtros via `useUrlFilters` dentro del modal.
- Botón "+ Nueva plantilla" abre subform con RichTextEditor a pantalla completa.
- Acceso: (a) botón "Plantillas de textos" en toolbar de `PresupuestosList.tsx`; (b) link "Gestionar plantillas →" junto al dropdown en el editor.

**Seed inicial y migración**
- Script one-shot que crea 6 plantillas principales + 2 para contrato desde `PRESUPUESTO_TEMPLATES`.
- Conversión: `\n\n` → `<br><br>`, bullets `•` → `<ul><li>`.
- Patrón browser-based (similar a `fix-inyectores-browser.mjs`) O `seedPlantillas.ts` in-page.
- Después, `PRESUPUESTO_TEMPLATES` queda como referencia histórica.

### Claude's Discretion
- Elección de librería/approach para parsear HTML → React-PDF.
- Diseño visual exacto del modal (respetando Editorial Teal).
- Implementación del selector de conflicto (inline vs modal aparte).
- Manejo de errores si el HTML tiene tags no soportados.
- Implementación del strip HTML para preview (regex simple).

### Deferred Ideas (OUT OF SCOPE)
- Relación plantilla ↔ condición de pago (placeholders dinámicos).
- Versionado de plantillas (historial).
- Roles/permisos por plantilla (irán en RBAC general).
- Plantillas específicas para PDF de contrato (tiene template propio).
- Preview HTML renderizado inline en la lista.
- Import/export de plantillas.
- Phase 4: Anexo de consumibles por módulo.
</user_constraints>

## Summary

Esta fase tiene un único gran unknown técnico: **cómo renderizar HTML rich generado por `document.execCommand` dentro de `@react-pdf/renderer` v4.3.2**. Todo lo demás (Firestore service, modal, RichTextEditor extension, seed) son aplicaciones directas de patrones ya establecidos en el codebase.

La recomendación primaria es usar **`react-pdf-html`** (peer dep `@react-pdf/renderer >=3.4.4`, compatible con la v4.3.2 del proyecto y React >=16, por lo tanto compatible con React 19). Se instala, se le pasa un `stylesheet` con overrides de tamaños y alineación, y un `renderers.font` custom para mapear `<font size="1..7">` (output de `execCommand('fontSize', ...)`) a `fontSize` en pt. Alternativa MEDIA: parser custom con `node-html-parser` que emita Text/View (~80 líneas, más control, sin dependencia nueva).

El resto del trabajo es bajo riesgo: copiar los patrones de `condicionesPagoService` / `CondicionesPagoModal.tsx` con pequeñas adaptaciones (modal `maxWidth="2xl"` que es `max-w-6xl` ≈ 1152px, suficientemente grande; un segundo botón de alineación en el toolbar del `RichTextEditor`).

**Primary recommendation:** Usar `react-pdf-html` con stylesheet + `renderers` custom para `<font>` y default para `<div style="text-align:...">`. Si hay bugs inesperados con `execCommand` output raro, fallback es un parser custom mínimo (~80 líneas) sobre `node-html-parser` (dependencia transitiva de `react-pdf-html` así que ya queda en node_modules).

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@react-pdf/renderer` | ^4.3.2 (instalado) | PDF rendering para presupuesto | Ya en uso — `PresupuestoPDFEstandar.tsx` |
| `react-pdf-html` | ^2.1.2 (latest, verificar al instalar) | Renderizar HTML string como nodos React-PDF | Peer dep `@react-pdf/renderer >=3.4.4` y `react >=16` — compatible con React 19 y v4.3.2 del proyecto |
| `firebase` (Firestore) | ^12.11.0 (instalado) | Backend CRUD | Ya en uso |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node-html-parser` | transitive via react-pdf-html | Parse HTML into tree si vamos por parser custom | Solo si vamos al plan B (parser custom). Queda en node_modules vía react-pdf-html por lo que no hay costo extra de install. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `react-pdf-html` | `html-react-parser` + mapping manual a React-PDF primitives | html-react-parser no conoce React-PDF — habría que escribir TODO el mapping (bold, italic, underline, listas, alineación, font size). Más código, sin ventajas. |
| `react-pdf-html` | Parser custom con `node-html-parser` | ~80 líneas propias, control total (podemos parsear `<font size>` directamente sin renderer override). **Plan B si react-pdf-html se atraganta con el HTML del execCommand** (nested `<font>`, `<div>` spurios, `&nbsp;`). |
| `react-pdf-html` | `@rawwee/react-pdf-html` (fork) | Fork menos mantenido; el original tiene más stars y mantenimiento. |

**Installation:**

```bash
pnpm add react-pdf-html --filter @ags/sistema-modular
```

## Architecture Patterns

### File Structure (delta a lo existente)

```
packages/shared/src/
├── types/index.ts                   # + PlantillaTextoPresupuesto (cerca línea 975)
└── utils.ts                         # PRESUPUESTO_TEMPLATES queda; marcar @deprecated en comentario

apps/sistema-modular/src/
├── services/
│   └── presupuestosService.ts       # + plantillasTextoPresupuestoService (patrón condicionesPagoService)
├── components/presupuestos/
│   ├── PresupuestoCondicionesEditor.tsx  # REFACTOR: textarea → RichTextEditor + dropdown de plantillas
│   ├── PlantillasTextoModal.tsx          # NEW — modal de gestión (lista + form)
│   ├── PlantillaTextoForm.tsx            # NEW — subform con RichTextEditor (≤ 250 líneas)
│   └── pdf/
│       ├── PresupuestoPDFEstandar.tsx    # Cambio en PDFCondiciones: <Text>content</Text> → <PDFRichText html={content} />
│       └── PDFRichText.tsx                # NEW — wrapper sobre <Html> de react-pdf-html con renderers/stylesheet
├── components/ui/
│   └── RichTextEditor.tsx           # + 3 botones (justifyLeft/Center/Right)
├── hooks/
│   ├── useCreatePresupuestoForm.ts  # + auto-aplicar defaults al cambiar tipo (creación only)
│   └── usePresupuestoEdit.ts        # NO TOCAR lógica de textos — solo permitir carga manual
├── pages/presupuestos/
│   └── PresupuestosList.tsx         # + botón "Plantillas de textos" en toolbar
└── scripts/
    └── seed-plantillas-texto-browser.mjs  # NEW — paste-in-console seed
```

### Pattern 1: Firestore Service (mirror de `condicionesPagoService`)

**What:** CRUD + `batchAudit` + ordering por `nombre`.

```typescript
// Source: apps/sistema-modular/src/services/presupuestosService.ts:696 (condicionesPagoService)
export const plantillasTextoPresupuestoService = {
  async getAll(): Promise<PlantillaTextoPresupuesto[]> {
    const snap = await getDocs(collection(db, 'plantillas_texto_presupuesto'));
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() })) as PlantillaTextoPresupuesto[];
    items.sort((a, b) => a.nombre.localeCompare(b.nombre));
    return items;
  },

  async getDefaultsForTipo(tipo: TipoPresupuesto): Promise<PlantillaTextoPresupuesto[]> {
    const all = await this.getAll(); // puede aprovechar cache — ver Pitfall #4
    return all.filter(p => p.activo && p.esDefault && p.tipoPresupuestoAplica.includes(tipo));
  },

  async create(data: Omit<PlantillaTextoPresupuesto, 'id' | 'createdAt' | 'updatedAt'>) {
    const payload = cleanFirestoreData({
      ...data,
      ...getCreateTrace(),
      activo: data.activo ?? true,
      esDefault: data.esDefault ?? false,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const ref = newDocRef('plantillas_texto_presupuesto');
    const batch = createBatch();
    batch.set(ref, payload);
    batchAudit(batch, { action: 'create', collection: 'plantillas_texto_presupuesto', documentId: ref.id, after: payload as any });
    await batch.commit();
    return ref.id;
  },

  async update(id: string, data: Partial<...>) { /* idem condicionesPagoService */ },
  async delete(id: string) { /* idem */ },
};
```

### Pattern 2: HTML → PDF con `react-pdf-html`

**What:** Wrapper que acepta `html: string` y renderiza con estilos mapeados al look del PDF existente.

**When to use:** Dentro de `PDFCondiciones` en `PresupuestoPDFEstandar.tsx`, reemplazando `<Text style={S.condicionText}>{section.content}</Text>`.

```tsx
// Source: proposed new file components/presupuestos/pdf/PDFRichText.tsx
// API verified from: https://github.com/danomatic/react-pdf-html
import Html from 'react-pdf-html';
import { COLORS } from './pdfStyles';

// execCommand('fontSize', null, '1..7') emits <font size="N"> in Firefox
// and <font> / <span style="font-size: ...webkit..."> in Chromium.
// FONT_SIZES in RichTextEditor uses values '1'..'6' → mapear a pt:
const FONT_SIZE_MAP: Record<string, number> = {
  '1': 7,   // 10px visual → 7pt PDF (PDF text is small by convention)
  '2': 8,   // 12px
  '3': 9,   // 14px
  '4': 10,  // 16px
  '5': 12,  // 20px
  '6': 14,  // 24px
};
// NOTE: pt vs px ratios here aim to preserve proportion relative to S.condicionText baseline (7pt).
// If rendered too small, bump all values by +1pt uniformly.

const stylesheet = {
  // Base paragraph — matches existing condicionText
  p: { fontSize: 7, lineHeight: 1.5, color: COLORS.text, marginBottom: 2 },
  div: { fontSize: 7, lineHeight: 1.5, color: COLORS.text },
  // Formatting
  strong: { fontWeight: 'bold' },
  b: { fontWeight: 'bold' },
  i: { fontStyle: 'italic' },
  em: { fontStyle: 'italic' },
  u: { textDecoration: 'underline' },
  // Lists
  ul: { marginLeft: 10, marginBottom: 3 },
  ol: { marginLeft: 10, marginBottom: 3 },
  li: { fontSize: 7, lineHeight: 1.5, marginBottom: 1 },
};

// Custom renderer for <font size="N"> — mapped from execCommand output
const renderers = {
  font: (el: any) => {
    const size = el.attributes?.size;
    const pt = size && FONT_SIZE_MAP[size] ? FONT_SIZE_MAP[size] : undefined;
    return pt ? { style: { fontSize: pt } } : {};
  },
};

export function PDFRichText({ html }: { html: string }) {
  if (!html?.trim()) return null;
  return (
    <Html stylesheet={stylesheet} renderers={renderers} resetStyles>
      {html}
    </Html>
  );
}
```

> **Integration code in `PresupuestoPDFEstandar.tsx` (function `PDFCondiciones`):**
>
> ```tsx
> // Replace line 351 (<Text style={S.condicionText}>{section.content}</Text>):
> <View style={S.condicionBody}>
>   <PDFRichText html={section.content} />
> </View>
> ```

### Pattern 3: RichTextEditor — agregar botones de alineación

**What:** Extender el array `TOOLBAR_BUTTONS` con 3 entradas (justifyLeft, justifyCenter, justifyRight), y extender `updateActiveFormats()` para leer el estado.

```tsx
// Source: derived from apps/sistema-modular/src/components/ui/RichTextEditor.tsx existing pattern

// Add to BtnId type:
type BtnId = 'bold' | 'italic' | 'underline' | 'insertUnorderedList' | 'insertOrderedList'
  | 'justifyLeft' | 'justifyCenter' | 'justifyRight';

// Add to TOOLBAR_BUTTONS after insertOrderedList (with divider):
{ id: 'justifyLeft', label: '≡', title: 'Alinear izquierda' },
{ id: 'justifyCenter', label: '≡', title: 'Centrar' },
{ id: 'justifyRight', label: '≡', title: 'Alinear derecha' },

// In updateActiveFormats():
if (document.queryCommandState('justifyLeft')) formats.add('justifyLeft');
if (document.queryCommandState('justifyCenter')) formats.add('justifyCenter');
if (document.queryCommandState('justifyRight')) formats.add('justifyRight');
```

execCommand `justifyLeft/Center/Right` emits `<div style="text-align: left|center|right">`. `react-pdf-html` honors inline `style` through its css-tree parser → `textAlign` in `Text` style.

### Pattern 4: Modal grande con filtros + form inline

**What:** Reusar `Modal` component con `maxWidth="2xl"` (= `max-w-6xl` ≈ 1152px), suficientemente amplio para el RichTextEditor.

```tsx
// Source: apps/sistema-modular/src/components/presupuestos/CondicionesPagoModal.tsx pattern
<Modal open={open} onClose={onClose} maxWidth="2xl" title="Plantillas de textos" subtitle={`${plantillas.length} plantillas`}>
  {!showForm && <PlantillasTextoList plantillas={filtered} filters={filters} ... />}
  {showForm && <PlantillaTextoForm plantilla={editing} onSave={...} onCancel={...} />}
</Modal>
```

**useUrlFilters dentro del modal** — ya es patrón ("ver precedente" en CONTEXT.md). El query param persiste entre open/close del modal.

```tsx
const [filters, setFilter] = useUrlFilters({
  plantilla_seccion: { type: 'string', default: '' },
  plantilla_tipo: { type: 'string', default: '' },
  plantilla_soloActivas: { type: 'boolean', default: true },
});
```

### Pattern 5: Auto-apply en creación (solo creación, no edit)

**What:** En `useCreatePresupuestoForm.ts`, efecto que escucha cambio de `form.tipo` **solo la primera vez** (no en cambio subsecuente).

```tsx
// Source: new effect in useCreatePresupuestoForm.ts
const [autoAppliedOnce, setAutoAppliedOnce] = useState(false);

useEffect(() => {
  if (!open || !form.tipo || autoAppliedOnce) return;

  (async () => {
    const defaults = await plantillasTextoPresupuestoService.getDefaultsForTipo(form.tipo);
    // Group by seccion
    const bySeccion = defaults.reduce<Record<string, PlantillaTextoPresupuesto[]>>((acc, p) => {
      (acc[p.tipo] ||= []).push(p);
      return acc;
    }, {});

    const toApply: Partial<PresupuestoFormState> = {};
    const conflicts: Record<string, PlantillaTextoPresupuesto[]> = {};
    for (const [seccion, lista] of Object.entries(bySeccion)) {
      if (lista.length === 1) toApply[seccion as keyof PresupuestoFormState] = lista[0].contenido as any;
      else conflicts[seccion] = lista; // user decides via selector
    }
    setForm(prev => ({ ...prev, ...toApply }));
    setPendingConflicts(conflicts);  // new state — surfaces selector UI
    setAutoAppliedOnce(true);
  })();
}, [open, form.tipo, autoAppliedOnce]);
```

### Anti-Patterns to Avoid

- **Refactorizar `usePresupuestoEdit.ts` para auto-aplicar** — explícitamente prohibido por CONTEXT.md. Solo `useCreatePresupuestoForm.ts` auto-aplica.
- **Guardar `plantillaId` en el presupuesto** — CONTEXT.md: "solo el contenido final".
- **Usar `setState` para los filtros del modal** — rompe la hard rule. Usar `useUrlFilters`.
- **Bloquear el guardado si hay múltiples defaults** — CONTEXT.md: no bloquear; mostrar selector en runtime.
- **Heredar `style` inline sin reset** — en `<Html>` del RichTextEditor, si no se pasa `resetStyles`, navega los estilos default del browser (h1 grande, etc.) que el usuario nunca puso. Pasar `resetStyles` cuando el HTML viene de contentEditable.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Parse HTML en el PDF | Expresiones regex sobre el string HTML | `react-pdf-html` (primera opción) o `node-html-parser` (plan B) | Regex sobre HTML es siempre frágil (nested tags, atributos con quotes, entidades, etc.). |
| Strip HTML para preview | Regex `.replace(/<[^>]*>/g, '')` cuidadosamente | OK: para preview de ~100 chars, un regex simple es aceptable (Claude's Discretion según CONTEXT.md) | Excepción: es el único approach simple suficiente; pitfall menor (entities no decodificadas como `&nbsp;`). |
| Modal draggable / minimize | Custom drag logic | `Modal` component ya tiene drag + minimize built-in | Trabajo ya hecho. |
| Confirmar reemplazo de contenido | `window.confirm` | `useConfirm()` hook | Ya es el patrón del proyecto. |
| Audit trail | Custom logging | `batchAudit` + `getCreateTrace/getUpdateTrace` | Ya establecido. |
| Filtros con URL persistence | `useState` | `useUrlFilters` | Hard rule. |

**Key insight:** Casi todo lo que toca esta fase ya tiene un patrón existente que replicar. El único componente que requiere trabajo nuevo real es `PDFRichText.tsx` (~30 líneas si `react-pdf-html` funciona bien, ~80 si hay que caer al plan B).

## Common Pitfalls

### Pitfall 1: `<font size="N">` en el output del execCommand no renderiza en React-PDF
**What goes wrong:** `react-pdf-html` no tiene `font` en su lista de tags soportados por default (confirmado viendo README). El contenido dentro de `<font size="5">` se renderiza sin el ajuste de tamaño.
**Why it happens:** `document.execCommand('fontSize', null, '5')` emite `<font size="5">` en Firefox y `<font>` con CSS inline en Chromium — es HTML legacy.
**How to avoid:** Registrar un `renderer` custom para `font` en el `<Html>` como muestra el Pattern 2 arriba. Alternativa: pre-procesar el HTML antes de pasarlo a `<Html>` con una regex única (`replace(/<font size="(\d)">/g, (_, s) => <span style="font-size: ...">)`) — acepta el plan B.
**Warning signs:** En el PDF, el texto con "tamaño grande" aparece igual que el resto.

### Pitfall 2: Existing RichTextEditor inflation bug en el PDF (ya documentado en memoria)
**What goes wrong:** Según la memoria del proyecto (reportes-ot-pdf.md), `<font size="X">` agranda texto desproporcionadamente en html2pdf. En React-PDF no aplica html2pdf, pero la misma causa (el mapeo de `<font size>`) puede dar pt muy grande y saltar de página.
**Why it happens:** Los valores de `execCommand` son `1..7` pero sus mappings default a tamaños tipográficos son "xx-small" a "xx-large" — muy agresivos.
**How to avoid:** Usar el `FONT_SIZE_MAP` explícito del Pattern 2 (pt moderado: 7–14pt). No dejar que `react-pdf-html` haga su propio mapping default.
**Warning signs:** Una sección de "condiciones comerciales" ocupa toda una página sola.

### Pitfall 3: `undefined` escrito a Firestore
**What goes wrong:** Si se guarda una plantilla nueva con `descripcion` vacía (no definida), Firestore rechaza el write.
**Why it happens:** Hard rule conocida del proyecto.
**How to avoid:** Siempre pasar el payload por `cleanFirestoreData()` antes de `batch.set`. Seguir el patrón de `conceptosServicioService.create` ([services/presupuestosService.ts:783](apps/sistema-modular/src/services/presupuestosService.ts#L783)).
**Warning signs:** Error `FirebaseError: Function WriteBatch.set() called with invalid data. Unsupported field value: undefined`.

### Pitfall 4: Cache de servicios + lista de plantillas stale
**What goes wrong:** Si el usuario crea una plantilla nueva desde el modal, cierra, crea un presupuesto nuevo — el dropdown puede mostrar la lista vieja por 2 min (TTL del `serviceCache.ts`).
**Why it happens:** La memoria del proyecto documenta "Cache de servicios: 2 min TTL en serviceCache.ts" (aplicado en servicios de tickets).
**How to avoid:** **No usar cache en `plantillasTextoPresupuestoService`** para la primera versión. Si se detecta lentitud, agregar cache con invalidación explícita en `create/update/delete`. CONTEXT.md lo deja en Claude's Discretion implícitamente — elección recomendada: sin cache.
**Warning signs:** Plantilla creada no aparece en dropdown hasta refrescar la página.

### Pitfall 5: `react-pdf-html` con HTML raro de contentEditable
**What goes wrong:** contentEditable produce HTML como `<div><br></div>` al presionar Enter en líneas vacías, `&nbsp;` en espacios después de ciertas operaciones, y anida tags (`<b><i><b>...`). `react-pdf-html` puede comportarse inconsistentemente con este "HTML sucio".
**Why it happens:** Es HTML producido por el browser para su propio rendering, no HTML "lindo" pensado para imprimir.
**How to avoid:**
  1. **En el editor**, antes de persistir, pasar por un cleanup básico: reemplazar `<div><br></div>` por `<br>`, `<div></div>` por `<br>`, decodificar `&nbsp;` a espacio normal.
  2. **En el `<Html>`**, pasar `resetStyles` para ignorar default user-agent styles.
  3. **Fallback** en `PDFRichText`: try-catch alrededor de `<Html>`. Si falla, stripear a plain text (regex) y renderizar en un `<Text style={S.condicionText}>`.
**Warning signs:** Errores al renderizar el PDF ("Unexpected node type") o contenido que aparece en blanco.

### Pitfall 6: Modal `max-w-6xl` vs 900px requerido
**What goes wrong:** CONTEXT.md dice "modal grande (~900px, 80vh)". El mayor preset del Modal actual es `max-w-6xl` = 72rem = **1152px**. Si se quiere exactamente 900px, hay que extender el Modal o usar estilos inline.
**Why it happens:** El preset no calza exactamente con el requisito.
**How to avoid:** **Opción A (recomendada):** usar `maxWidth="2xl"` (1152px) — es "grande" en el espíritu del requisito, y no requiere modificar el Modal. **Opción B:** agregar un preset `3xl` al `widthMap` del Modal (e.g. `max-w-4xl` = 896px ≈ 900px). Decidir en planning.
**Warning signs:** Modal ocupa todo el viewport en monitores chicos. En ese caso, Opción B.

### Pitfall 7: execCommand deprecation
**What goes wrong:** Los compiladores / linters flagean `document.execCommand` como deprecated; en alguna futura version de Chromium podría no funcionar.
**Why it happens:** Deprecation desde hace años, sin alternativa oficial. Aún funciona en 2026 en todos los browsers modernos.
**How to avoid:** Dejar un comentario en `RichTextEditor.tsx` notando la deprecation + confirmar (vía ops real) que seguirá funcionando. **No migrar a Selection API / Input Events Level 2** en esta fase — scope creep innecesario.
**Warning signs:** Warnings en devtools; futura decisión del browser.

## Code Examples

### Tipo en `@ags/shared`

```typescript
// Source: proposed addition to packages/shared/src/types/index.ts near line 975
export interface PlantillaTextoPresupuesto {
  id: string;
  nombre: string;
  tipo: keyof PresupuestoSeccionesVisibles; // 'notasTecnicas' | 'notasAdministrativas' | ...
  contenido: string;                         // HTML del RichTextEditor
  tipoPresupuestoAplica: TipoPresupuesto[]; // ['servicio', 'partes', 'mixto'] etc.
  esDefault: boolean;
  activo: boolean;

  // audit trace estándar (como CondicionPago/CategoriaPresupuesto)
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  createdByName?: string;
  updatedBy?: string;
  updatedByName?: string;
}
```

### Conversión `PRESUPUESTO_TEMPLATES` → HTML para seed

```typescript
// Source: proposed logic for seed-plantillas-texto-browser.mjs
function plainToHtml(text) {
  const lines = text.split('\n');
  const blocks = [];
  let currentList = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('•')) {
      if (!currentList) currentList = [];
      currentList.push(trimmed.substring(1).trim());
    } else {
      if (currentList) {
        blocks.push(`<ul>${currentList.map(i => `<li>${i}</li>`).join('')}</ul>`);
        currentList = null;
      }
      if (trimmed) blocks.push(`<div>${trimmed}</div>`);
      else blocks.push('<br>');
    }
  }
  if (currentList) blocks.push(`<ul>${currentList.map(i => `<li>${i}</li>`).join('')}</ul>`);
  return blocks.join('');
}

// Then seed each: nombre, tipo, contenido: plainToHtml(PRESUPUESTO_TEMPLATES[tipo]), ...
```

### Preview plain text (Claude's Discretion)

```typescript
// Simple strip — acceptable for preview ≤100 chars per CONTEXT.md
function stripHtmlPreview(html: string, max = 100): string {
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? text.substring(0, max - 1) + '…' : text;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `PRESUPUESTO_TEMPLATES` hardcoded en `packages/shared/src/utils.ts` | Colección Firestore editable desde UI | Esta fase | Los textos legales/comerciales dejan de requerir rebuild y deploy para modificarse |
| `<textarea>` en `PresupuestoCondicionesEditor` | `RichTextEditor` con font size + alineación | Esta fase | Los presupuestos PDF tienen formato (negrita, bullets, subtítulos por font size) |
| `PDFCondiciones` renderiza `<Text>{content}</Text>` (plain) | `PDFCondiciones` renderiza `<PDFRichText html={content} />` | Esta fase | PDF refleja el formato del editor |

**Deprecated after this phase:**
- `PRESUPUESTO_TEMPLATES` export en `@ags/shared/utils.ts` — marcar `@deprecated` en JSDoc. NO borrar en esta fase (fases futuras pueden usarlo como referencia histórica). El editor de presupuesto deja de consumirlo.
- `PresupuestoCondicionesEditor.handleLoadTemplate` / `handleLoadAll` — se refactoran a consumir `plantillasTextoPresupuestoService`, no `PRESUPUESTO_TEMPLATES`.

## Open Questions

1. **¿El pt mapping del `FONT_SIZE_MAP` es visualmente correcto?**
   - What we know: `S.condicionText.fontSize = 7` (base). `S.condicionTitle.fontSize = 8`. El mapping propuesto va 7→14pt para "24px visual".
   - What's unclear: Sin un test real de render, el ratio px-editor → pt-PDF es empírico.
   - Recommendation: Ejecutor ajusta el mapping después de un render de prueba. Bump uniforme si queda chico.

2. **¿El seed se ejecuta como browser script o como in-app admin button?**
   - What we know: Ambos patrones existen (`fix-inyectores-browser.mjs` vs `seedPlantillas.ts`). Browser-based es one-shot, simple; in-app permite re-seed idempotente.
   - What's unclear: CONTEXT.md dice "similar a `fix-inyectores-browser.mjs`" pero también menciona `seedPlantillas.ts`.
   - Recommendation: Browser-based MJS por simplicidad. Idempotencia garantizada por un check inicial ("si ya existen plantillas con `esDefault=true`, abortar con mensaje").

3. **¿Hace falta `_hasSeenSelector` por sección para que el selector de conflicto no sea molesto?**
   - What we know: CONTEXT.md dice "si hay conflicto se muestra selector".
   - What's unclear: ¿Inline o modal? ¿Se muestra una sola vez o cada vez que cambia algo?
   - Recommendation: Inline en el dropdown "Cargar plantilla" de cada sección — cuando hay múltiples defaults, el dropdown muestra las candidatas. En creación, el modal de `PresupuestoCrearModal` puede mostrar una pila de conflicts arriba ("Hay 2 plantillas default para la sección X, elige una") — solo visible si hay conflicts.

4. **¿`PRESUPUESTO_TEMPLATES.contrato` migra como plantillas con `tipoPresupuestoAplica=['contrato']` aun cuando el PDF de contrato tiene su propio template?**
   - What we know: CONTEXT.md explícitamente dice sí: 2 plantillas adicionales para contrato.
   - What's unclear: Si el PDF de contrato NO usa estas plantillas (tiene su propio template según CONTEXT.md), ¿para qué se migran?
   - Recommendation: Migrarlas de todas formas. Tienen valor como contenido default que alguien pueda copy-paste al editor del presupuesto de contrato. Si en el futuro se integran al PDF de contrato, ya están en Firestore. Cost: ~zero.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (e2e only) — detectado en `package.json:scripts.e2e` |
| Config file | `apps/sistema-modular/playwright.config.ts` (verificar existencia) |
| Quick run command | `pnpm --filter @ags/sistema-modular e2e` — full suite (no hay split) |
| Full suite command | `pnpm --filter @ags/sistema-modular e2e:full` (incluye report) |

**No unit test framework detected.** No `vitest`, `jest`, `mocha` en dependencies. No directorios `test/`, `tests/`, `__tests__/`. Este proyecto valida via:
1. TypeScript strict (type gate)
2. Playwright e2e (flujos críticos)
3. UAT manual del equipo de AGS

### Phase Requirements → Test Map

| Req (from Scope) | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| Create plantilla flow | Abrir modal, crear, aparece en lista | e2e | `npx playwright test --project=chromium -g "plantillas-texto"` | ❌ Wave 0 |
| Edit plantilla flow | Editar plantilla existente, se actualiza | e2e | idem grep | ❌ Wave 0 |
| Auto-apply defaults al crear presupuesto | Seleccionar tipo, textos aparecen | e2e | idem | ❌ Wave 0 |
| Dropdown "Cargar plantilla" en editor | Seleccionar del dropdown, contenido cambia | e2e | idem | ❌ Wave 0 |
| Selector de conflicto (2+ defaults) | Con dos defaults para misma sección, muestra selector | e2e | idem | ❌ Wave 0 |
| PDF render HTML rich | Generar PDF, inspeccionar visualmente | manual-only | — | — |
| HTML → PDF bold | bold en editor → bold en PDF | unit (puro) — PDFRichText renderer map | _no framework; manual_ | — |
| TypeScript strict no errors | `tsc --noEmit` passes | gate | `pnpm --filter @ags/sistema-modular exec tsc --noEmit` | ✅ existing |
| Seed idempotente | Ejecutar 2 veces, no duplica | manual | — | — |

**Justification for manual-only:**
- **PDF render**: react-pdf es visual; no hay framework práctico para snapshot-testing PDFs en este proyecto. Validation = render + abrir + inspección ocular según CONTEXT.md. UAT checklist: (1) todas las 6 secciones renderizan; (2) bold/italic/underline visible; (3) listas con bullets y numeración; (4) font-size respetado; (5) alineación respetada.
- **Seed idempotente**: one-shot script, se ejecuta en producción 1 vez. Validación manual via console output del script.

### Sampling Rate
- **Per task commit:** `pnpm --filter @ags/sistema-modular exec tsc --noEmit` (must pass).
- **Per wave merge:** e2e playwright suite si existe e2e nueva para la fase. Si no, solo tsc.
- **Phase gate:** (a) tsc green, (b) UAT manual de los 5 flujos listados arriba por el usuario.

### Wave 0 Gaps
- [ ] Si se decide escribir e2e: `apps/sistema-modular/e2e/plantillas-texto.spec.ts` — flujos de create/edit/list + auto-apply.
- [ ] Definir "fixture data": al menos 1 plantilla de cada tipo para que los tests e2e no dependan del seed de prod.
- [ ] Decisión explícita en planning: ¿escribimos e2e o solo UAT manual? Given que el resto del proyecto es UAT-heavy (ver ausencia de vitest), **recomendación: UAT manual con checklist, no escribir e2e nuevos**. Documentar explícitamente en el PLAN de la fase.

## Sources

### Primary (HIGH confidence)
- Codebase local (authoritative):
  - `apps/sistema-modular/src/components/ui/RichTextEditor.tsx` — estado actual del editor
  - `apps/sistema-modular/src/components/presupuestos/PresupuestoCondicionesEditor.tsx` — punto de integración
  - `apps/sistema-modular/src/components/presupuestos/CondicionesPagoModal.tsx` — patrón de modal catálogo
  - `apps/sistema-modular/src/services/presupuestosService.ts:696` — patrón de servicio CRUD
  - `apps/sistema-modular/src/components/presupuestos/pdf/PresupuestoPDFEstandar.tsx` — PDF existente
  - `apps/sistema-modular/src/components/ui/Modal.tsx` — max-w-6xl es el tamaño máximo existente
  - `apps/sistema-modular/src/hooks/useCreatePresupuestoForm.ts` — hook de creación
  - `apps/sistema-modular/src/hooks/useUrlFilters.ts` — filtros URL
  - `apps/sistema-modular/scripts/fix-inyectores-browser.mjs` — patrón de seed browser-based
  - `apps/sistema-modular/src/pages/tipos-equipo/seedPlantillas.ts` — patrón de seed in-app
  - `apps/sistema-modular/package.json` — confirmó @react-pdf/renderer ^4.3.2, React 19, no unit test framework
  - `packages/shared/src/utils.ts:22` — `PRESUPUESTO_TEMPLATES` a migrar
  - `packages/shared/src/types/index.ts:703, 975-1000` — tipos existentes
  - `.claude/skills/react-pdf/SKILL.md` — skill disponible
- [danomatic/react-pdf-html README](https://github.com/danomatic/react-pdf-html) — tags supported, API
- [react-pdf-html package.json](https://github.com/danomatic/react-pdf-html/blob/main/package.json) — peerDeps: `@react-pdf/renderer >=3.4.4`, `react >=16`
- [@react-pdf/renderer npm](https://www.npmjs.com/package/@react-pdf/renderer) — v4.4.1 latest (proyecto usa 4.3.2, compatible)

### Secondary (MEDIUM confidence)
- [MDN execCommand](https://developer.mozilla.org/en-US/docs/Web/API/Document/execCommand) — deprecated pero funciona
- [execCommand fontSize output cross-browser discussion](https://bugzilla.mozilla.org/show_bug.cgi?id=480647) — confirma `<font size="1..7">` output
- WebSearch agregado: `execCommand fontSize chrome` confirma `<font>` vs `<span>` por browser

### Tertiary (LOW confidence)
- Ninguna afirmación crítica apoyada solo por fuentes no verificadas.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `react-pdf-html` peer deps verificadas vs package.json del proyecto
- Architecture: HIGH — todos los patterns son extensiones directas de código existente leído
- Pitfalls: MEDIUM-HIGH — pitfalls #1, #2, #3, #4, #6 son verificables del codebase/docs; #5, #7 son heurísticos sólidos
- HTML→PDF library: MEDIUM — react-pdf-html está ampliamente usado pero no testeamos aún en vivo con el output exacto de este RichTextEditor. Plan B (parser custom) listo por si falla.

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (estabilidad de libs; si `react-pdf-html` cambia major antes, revisar)
