# Prototipo: conversión Word → JSON para protocolos

## Objetivo

Tener un **prototipo revisable** del flujo **Word → JSON estructurado** antes de implementar en la app los componentes (ProtocolSelector, DynamicProtocol), Firestore, importación y PDF.

## Entregables del prototipo

| Entregable | Ubicación |
|------------|-----------|
| Especificación del JSON y de Firestore | `docs/PROTOCOL_TEMPLATES_SPEC.md` |
| Script de conversión Word → JSON | `scripts/word-to-protocol-json/convert.mjs` |
| Dependencia (mammoth) | `scripts/word-to-protocol-json/package.json` |
| Ejemplo de salida (manual) | `scripts/word-to-protocol-json/sample-protocol-output.json` |
| Uso e instalación del script | `scripts/word-to-protocol-json/README.md` |

## Cómo revisar el prototipo

### 1. Instalar y ejecutar el script

```bash
cd apps/reportes-ot/scripts/word-to-protocol-json
npm install
node convert.mjs "C:\Users\Evigna\Desktop\QF7.0506.10_CalifOperacion HPLC 1100-1200-1260 Inf.docx" --out calif-operacion.json
```

Repite con los otros dos Word si quieres:

- `QF7.0538.05_RecalifOper HPLC 1100-1200-1260 Inf.docx`
- `QF7.0605.07 MP1100-1200-1220-1260-1290.docx`

### 2. Revisar el JSON generado

- ¿Los **títulos** de sección coinciden con el Word?
- ¿Las **tablas** tienen cabeceras y filas correctas?
- ¿Las celdas de Sí/No o “Cumple” salen como `type: "checkbox"`?
- ¿El **texto** entre títulos se pierde o se agrupa mal?

### 3. Comparar con el ejemplo de la spec

Abre `scripts/word-to-protocol-json/sample-protocol-output.json`. Ahí verás:

- Una sección `text` (Objetivo, Alcance).
- Una sección `checklist` (ítems con `label`, `required`, `value`).
- Una sección `table` (headers + rows con celdas `text` y `checkbox`).
- Una sección `signatures` (roles ejecutor/revisor).

El script **no** genera checklists ni firmas por ahora; solo texto y tablas. Los checklists y firmas se pueden añadir a mano en el JSON o en una segunda versión del script según tu feedback.

### 4. Qué definir antes de la siguiente fase

- Si la estructura de `template.sections` (text / table / checklist / signatures) es correcta para vuestros protocolos.
- Si hace falta que el script intente detectar **listas con viñetas** como checklist.
- Si hace falta detectar **bloques de firma** (líneas “Ejecutado por”, “Revisado por”) y generar `type: "signatures"`.
- Si los nombres inferidos `serviceType` y `equipmentType` (a partir del nombre del archivo) son suficientes o queréis mapeos distintos (p. ej. por código de documento).

## Siguiente fase (tras aprobar el prototipo)

1. **Estructura de datos en la app**: tipos TypeScript para `ProtocolTemplate` y para `template.sections`.
2. **Firestore**: colección `protocolTemplates` y reglas de lectura/escritura.
3. **Componentes**: ProtocolSelector (por tipo de servicio/equipo), DynamicProtocol (render y edición).
4. **Importación**: función/script para subir los JSON generados a Firestore con versionado.
5. **Persistencia**: guardar en el reporte los datos rellenados (`protocolData`) y autosave.
6. **PDF**: incluir el protocolo en el PDF (tablas, checkboxes, firmas) respetando el formato.
7. **Tests y documentación**: tests unitarios del parser y guía de uso/actualización de protocolos.

## Notas

- Los archivos Word que mencionaste están en tu escritorio; el script se ejecuta con la **ruta local** a cada .docx.
- No se requiere backend ni service accounts; el script es Node puro y la futura importación a Firestore usará el SDK de Firebase ya existente en la app.
