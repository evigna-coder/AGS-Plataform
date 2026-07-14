# Preferencias globales — Coco (AGS Analítica)

Aplica a todo, en cualquier proyecto. Lo específico de cada repo vive en su CLAUDE.md.

## Idioma y respuestas

- Responder en español rioplatense (voseo). Código y commits siguen la convención del repo.
- Resultado primero, sin recap de pasos ni postámbulos. Si algo falló, decirlo primero.

## Alcance

- Hacer solo lo pedido. Si el arreglo correcto tocaría código vecino (otro componente,
  un tipo compartido, un refactor), aplicar el fix mínimo y listar al final lo que quedó
  afuera — expandir es decisión mía.
- No dejar archivos sueltos: nada de `*.tmp`, scripts one-off, copias `-v2` ni componentes
  de prueba en el root del proyecto. Scratch va a un temp del sistema y se borra al terminar.
  (El root de Ags plataform ya juntó App.tsx huérfano y .tmp_* por esto.)

## Git

- Nunca commitear ni pushear por iniciativa propia. Commit solo cuando lo pido
  explícitamente; push siempre lo hago yo.

## Verificación

- Nunca reportar algo como terminado sin correr la verificación que el proyecto define
  (typecheck/tests/build). "Debería compilar" no cuenta.

## Documentos de negocio (informes, evaluaciones, propuestas)

- Lector: dirección de AGS. Español formal, sin jerga de código.
- Resumen ejecutivo primero (conclusión + recomendación), detalle después.
- La forma final es siempre un PDF, aunque se drafte en .md.
