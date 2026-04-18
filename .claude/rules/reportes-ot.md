# Rule: `reportes-ot` is a frozen surface

## Invariant

The app at [apps/reportes-ot/](apps/reportes-ot/) is the field-technician PWA. Its UI, UX, and PDF generation pipeline are considered **production-critical and frozen**. Do not edit files under `apps/reportes-ot/` unless the user explicitly asks for changes *inside that app*.

## Why

- Técnicos en campo lo usan en tablets sin supervisión; un cambio visual roto deja una inspección incompleta en terreno.
- El pipeline de PDF (Hoja 1 via html2pdf → Protocolos via html2canvas per-page → Fotos → Merge con pdf-lib) tiene workarounds frágiles ya encontrados por regresiones pasadas:
  - `html2canvas` recorta títulos si el clon tiene `overflow:hidden` + `border-radius` → remover overflow del clon.
  - `RichTextEditor` emite `<font size="X">` que se agranda al renderizar → hay CSS `font-size: inherit !important` que lo neutraliza.
- Detalles en [memory/reportes-ot-pdf.md](memory/reportes-ot-pdf.md).

## How to apply

- Tareas que mencionan "reportes-ot", "técnico", "PDF del informe", "hoja 1", "protocolo en campo" → tocar estos archivos está autorizado.
- Cualquier otra tarea: **no** editar nada en `apps/reportes-ot/`. Si creés un nuevo tipo compartido, ponelo en [packages/shared/](packages/shared/) y consumilo desde ambas apps.
- Si un hook (`guard-reportes-ot`) bloquea una edición y estás *seguro* de que la tarea lo justifica, la variable `CLAUDE_ALLOW_REPORTES_OT=1` en el entorno lo desactiva. Es un gate deliberado, no un molestia a saltear.
- Cambios cross-cutting (rename de tipo en `@ags/shared`) que toquen `reportes-ot` requieren confirmación explícita del usuario antes de aplicarlos.

## Mismo espíritu en otras apps

`sistema-modular` y `portal-ingeniero` admiten iteración libre. Solo `reportes-ot` tiene este gate.
