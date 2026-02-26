# Ejemplos de conversión con documentos reales y revisión conjunta

> **En paralelo:** Para tener un **PDF de muestra con protocolo en 3–5 días**, ver el plan detallado en **`docs/PLAN_PDF_PROTOCOLO_3_5_DIAS.md`**. La conversión Word→JSON sigue; el PDF de muestra puede usar primero el `sample-protocol-output.json` y luego los JSON reales cuando estén listos.

## Objetivo

Generar **1–2 ejemplos de conversión** usando vuestros protocolos Word reales, revisarlos en conjunto y definir ajustes antes de seguir con la implementación en la app.

---

## Cómo generar los ejemplos (en tu máquina)

Los .docx deben estar en una ruta accesible (por ejemplo tu Escritorio). Desde la raíz del monorepo o desde la carpeta del script:

### Opción A – Desde la carpeta del script

```powershell
cd "c:\Users\Evigna\Desktop\Ags plataform\apps\reportes-ot\scripts\word-to-protocol-json"
npm install
```

Luego ejecuta el conversor con **uno o dos** de vuestros documentos reales, por ejemplo:

**Ejemplo 1 – Calificación de operación HPLC**
```powershell
node convert.mjs "C:\Users\Evigna\Desktop\QF7.0506.10_CalifOperacion HPLC 1100-1200-1260 Inf.docx" --out ejemplos/calif-operacion-hplc.json
```

**Ejemplo 2 – Recalificación o MP (elegir uno)**
```powershell
node convert.mjs "C:\Users\Evigna\Desktop\QF7.0538.05_RecalifOper HPLC 1100-1200-1260 Inf.docx" --out ejemplos/recalif-hplc.json
```
o
```powershell
node convert.mjs "C:\Users\Evigna\Desktop\QF7.0605.07 MP1100-1200-1220-1260-1290.docx" --out ejemplos/mp-1100-1290.json
```

Crea la carpeta `ejemplos` si no existe:
```powershell
mkdir ejemplos
```

### Opción B – Script por lotes (PowerShell)

Puedes usar este bloque para generar varios a la vez (ajusta las rutas si cambian):

```powershell
cd "c:\Users\Evigna\Desktop\Ags plataform\apps\reportes-ot\scripts\word-to-protocol-json"
if (-not (Test-Path ejemplos)) { New-Item -ItemType Directory -Path ejemplos }
$docs = @(
  @{ path = "C:\Users\Evigna\Desktop\QF7.0506.10_CalifOperacion HPLC 1100-1200-1260 Inf.docx"; out = "ejemplos\calif-operacion-hplc.json" },
  @{ path = "C:\Users\Evigna\Desktop\QF7.0538.05_RecalifOper HPLC 1100-1200-1260 Inf.docx"; out = "ejemplos\recalif-hplc.json" }
)
foreach ($d in $docs) {
  if (Test-Path $d.path) { node convert.mjs $d.path --out $d.out; Write-Host "Generado: $($d.out)" }
  else { Write-Host "No encontrado: $($d.path)" }
}
```

---

## Dónde dejar los JSON generados

- **Recomendado:** Guardar los 1–2 JSON en  
  `apps/reportes-ot/scripts/word-to-protocol-json/ejemplos/`  
  (nombres sugeridos: `calif-operacion-hplc.json`, `recalif-hplc.json` o `mp-1100-1290.json`).
- Así quedan en el repo para la revisión conjunta y para comparar con el Word original.

---

## Revisión conjunta – Propuesta de plazo y checklist

**Plazo sugerido:** revisión conjunta en **1 semana** a partir de que tengas los ejemplos generados.

**Checklist para la reunión:**

1. **Estructura**
   - [ ] Los títulos del Word coinciden con `title` de cada sección.
   - [ ] Las tablas tienen cabeceras y filas correctas; no faltan columnas ni filas.
   - [ ] El texto entre títulos no se pierde y está en la sección correcta.

2. **Tipos de celda**
   - [ ] Celdas de Sí/No, Cumple, etc. aparecen como `"type": "checkbox"` donde corresponde.
   - [ ] Celdas de texto libre (resultados, observaciones) como `"type": "text"`.

3. **Metadatos**
   - [ ] `serviceType` y `equipmentType` inferidos del nombre del archivo son aceptables o proponer reglas (p. ej. por código de documento).

4. **Ajustes deseados**
   - [ ] ¿Añadir detección de listas con viñetas como checklist?
   - [ ] ¿Detección de bloques de firma (Ejecutado por / Revisado por)?
   - [ ] ¿Cambios en la estructura JSON (nombres de campos, anidación)?

Tras la revisión se aplicarán los cambios acordados en el script (y en la especificación si hace falta) y se seguirá con la implementación en la app (Firestore, ProtocolSelector, DynamicProtocol, PDF).

---

## Resumen

| Paso | Responsable | Plazo |
|------|-------------|--------|
| 1. Generar 1–2 JSON con el script y vuestros .docx | Tú / equipo | Cuando tengáis los .docx a mano |
| 2. Dejar los JSON en `scripts/word-to-protocol-json/ejemplos/` (o compartir por otro canal) | Tú / equipo | Antes de la revisión |
| 3. Revisión conjunta (checklist de arriba) | Product owner + desarrollo | En 1 semana |
| 4. Ajustes al script/spec según feedback | Desarrollo | Tras la reunión |
| 5. Seguir con fases: Firestore, componentes, importación, PDF | Desarrollo | Tras validar ejemplos |

Si prefieres otro plazo (p. ej. 5 días o 2 semanas), se puede fijar en la misma reunión de planificación.
