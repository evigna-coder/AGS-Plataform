# docs/ — entregables, no código

Acá viven documentos que lee gente (dirección, técnicos), no el compilador.
Las reglas de código del repo (componentes, Firestore, etc.) no aplican acá.

- Documentos nuevos para dirección → `docs/informes/` (crearla si no existe).
- Naming: PDF en `Title-Case-Con-Guiones-AGS.pdf` con su fuente `.md` al lado
  (ej. `Evaluacion-Seguridad-Accesos-AGS.pdf` + su `.md`). Sin espacios en nombres nuevos.
- Los manuales HTML (`manual-*.html`, `checklist-*.html`) se generan con los
  `render-*.cjs` de esta carpeta: editar la fuente y regenerar, nunca el HTML a mano.
