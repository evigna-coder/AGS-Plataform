# Protocolos como hojas anexo (concepto correcto)

## Problemática que motivó la reversión

Se había integrado el bloque de protocolo **dentro** de la Hoja 1 del reporte (mismo `#pdf-container`), modificando de hecho el formulario y el PDF del reporte de servicio. Eso contradice el requisito:

- **La Hoja 1 del formulario y del reporte de servicio es inamovible.** No se debe ni puede modificar, ni en el formulario ni en el PDF final.

## Concepto correcto

| Elemento | Comportamiento |
|----------|----------------|
| **Hoja 1** | Formulario y PDF del reporte de servicio **sin cambios**. Una sola página, estructura fija. |
| **Protocolos** | Son **hojas anexo**: se completan en el formulario como secciones/páginas adicionales y en el PDF final salen como **páginas adicionales** (página 2, 3, …), no dentro de la Hoja 1. |

## Ejemplo práctico

1. La ingeniera selecciona el tipo de servicio, por ejemplo **“Calificación de operación”**.
2. Según ese tipo, la app muestra **nuevas hojas/secciones** en el formulario para completar el protocolo correspondiente.
3. Esas hojas son las que luego se imprimen como **hojas adicionales** en el PDF (p. ej. después de la Hoja 1 del reporte).

Flujo:

- **Formulario:** Hoja 1 (reporte) + N hojas anexo (protocolos) que el usuario completa.
- **PDF final:** Página 1 = Hoja 1 del reporte (siempre igual) + Página 2, 3, … = una o más hojas de protocolo.

## Implicaciones técnicas

1. **No insertar** el contenido del protocolo dentro del `#pdf-container` actual de la Hoja 1.
2. **Formulario:** Los protocolos deben mostrarse como bloques/secciones separadas (p. ej. pestañas “Hoja 1”, “Anexo – Protocolo X”, o acordeones), no mezclados con los campos de la Hoja 1.
3. **PDF:** Generar la Hoja 1 desde su contenedor actual y, por separado, generar una o más páginas desde otro(s) contenedor(es) de protocolo, y concatenar o añadir como páginas adicionales al PDF (por ejemplo con html2pdf en modo multi-página o generando varios PDF y uniéndolos).

## Próximos pasos recomendados

- Revisar el plan en `PLAN_PDF_PROTOCOLO_3_5_DIAS.md` para que todo el desarrollo de protocolos siga este modelo de **anexos como hojas adicionales**.
- Mantener tipos, `ProtocolView` y datos de protocolo; usarlos para renderizar **solo** las hojas anexo (formulario + PDF), sin tocar la estructura de la Hoja 1.
