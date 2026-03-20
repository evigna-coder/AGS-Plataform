# Prototipo: Word → JSON para protocolos

Convierte documentos Word (.docx) de protocolos/calificaciones a un JSON estructurado compatible con la colección Firestore `protocolTemplates` y con los componentes React previstos (ProtocolSelector, DynamicProtocol).

## Requisitos

- Node.js 18+
- Los archivos Word deben estar en tu máquina (rutas locales).

## Instalación

```bash
cd apps/reportes-ot/scripts/word-to-protocol-json
npm install
```

## Uso

Convertir un documento:

```bash
node convert.mjs "C:\Users\Evigna\Desktop\QF7.0506.10_CalifOperacion HPLC 1100-1200-1260 Inf.docx"
```

Guardar la salida en un archivo:

```bash
node convert.mjs "C:\Users\Evigna\Desktop\QF7.0506.10_CalifOperacion HPLC 1100-1200-1260 Inf.docx" --out protocolo-calif-operacion.json
```

Con rutas con espacios, usa comillas como en los ejemplos.

## Salida

El script imprime (o escribe en `--out`) un único objeto JSON con:

- `id`, `name`, `serviceType`, `equipmentType`: inferidos del nombre del archivo.
- `template.sections`: array de secciones con `type`: `text`, `table`, `checklist` o `signatures`.
- `version`, `createdAt`, `updatedAt`.

La especificación completa está en `apps/reportes-ot/docs/PROTOCOL_TEMPLATES_SPEC.md`.

## Limitaciones del prototipo

- **Tablas**: La primera fila se toma como encabezados; el resto como filas de datos. Celdas que parezcan Sí/No o vacías se marcan como `checkbox`.
- **Checklists**: No se detectan automáticamente desde listas con viñetas; hay que añadirlos o derivarlos en una pasada manual sobre el JSON.
- **Firmas**: No se detectan automáticamente; se pueden añadir a mano en el JSON siguiendo el tipo `signatures`.
- **Formato**: Se prioriza estructura (títulos, tablas) sobre el formato visual exacto (negritas, tamaños). El PDF posterior recreará el aspecto a partir de este JSON.

## Ejemplos reales y revisión conjunta

Para validar con **documentos reales** y acordar un **plazo de revisión** (p. ej. una semana):

1. Genera 1–2 JSON con tus .docx y guárdalos en la carpeta `ejemplos/` (crea la carpeta si no existe).
2. Usa la guía **`apps/reportes-ot/docs/PROTOCOLO_EJEMPLOS_REALES_Y_REVISION.md`**: ahí están los comandos exactos y un checklist para la reunión de revisión.
3. Tras la revisión conjunta, se aplican los ajustes al script y se avanza con la implementación en la app.

## Revisión rápida (sin reunión)

1. Ejecuta el script con uno de tus .docx (p. ej. QF7.0506.10, QF7.0538.05, QF7.0605.07).
2. Revisa el JSON generado: títulos, tablas y texto.
3. Compara con `sample-protocol-output.json` (ejemplo manual de la spec).
4. Indica qué ajustes quieres (más detección de checklists, firmas, nombres de sección, etc.) antes de seguir con la implementación en la app (ProtocolSelector, DynamicProtocol, Firestore, PDF).
