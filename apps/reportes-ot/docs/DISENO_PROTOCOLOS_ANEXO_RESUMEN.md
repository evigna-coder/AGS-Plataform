# Resumen de diseño – Protocolos como anexo (estilo informe A4)

Cambios aplicados solo a anexos (`#pdf-container-anexo`, `#pdf-container-anexo-preview`) y componentes bajo `ProtocolView` / `components/protocol/*`. **Hoja 1 (#pdf-container) no fue modificada.**

---

## Componentes tocados

| Componente | Cambios |
|------------|--------|
| **ProtocolLayout.tsx** | Hoja fija 210mm × min 297mm, sombra suave, header con jerarquía (label “Protocolo técnico” 10px uppercase, título 18px extra-bold, subtítulo 13px), código/revisión a la derecha. Márgenes en mm (px-[10mm], py-[5mm]). |
| **ProtocolSectionBlock.tsx** | Sección compacta: número en círculo 5×5 (11px), título sección 13px uppercase, `space-y-2` entre bloques. Quitada barra lateral para ganar espacio. |
| **ProtocolTable.tsx** | Tabla densa: borde fino, cabecera `bg-slate-100` (gris claro), texto cabecera 10px uppercase, celdas 11px, `px-2 py-1`. Inputs con `text-[11px]`, `py-0.5`. |
| **ProtocolChecklist.tsx** | Checkboxes 3×3, texto 11px, `space-y-1`. Items en una línea (checkbox + label + “requerido”). |
| **ProtocolTextBlock.tsx** | Título opcional 10px, contenido 11px, `leading-snug`. |
| **ProtocolSignaturesSection.tsx** | Grid 3 columnas, líneas de firma más bajas (min-h 24px), labels 10px uppercase, márgenes en mm. |
| **ProtocolResultBlock.tsx** | Escala reducida: header 12px, observaciones/resultado 10–11px, radios en una sola línea con `gap-3`, radio 3×3. |
| **App.tsx** | Solo contenedores anexo: edición con `bg-[#f1f5f9]`, centrado, `maxWidth: 210mm`; preview con wrapper gris y hoja blanca 210mm `shadow-md` (sin div interno extra de padding; ProtocolLayout ya lleva el padding). |

---

## Decisiones para aproximar al estilo Stitch

1. **Escala general**  
   Texto base 11px, títulos de sección 13px, título principal 18px. Sensación de “PDF A4 al 100%”, no formulario web.

2. **Hoja A4 explícita**  
   `ProtocolLayout` con `width: 210mm`, `minHeight: 297mm`, para que en edición y en preview la hoja blanca sea claramente A4.

3. **Fondo gris y centrado**  
   Contenedores en App con `#f1f5f9`, contenido del anexo centrado; la hoja no queda como “card” pequeña.

4. **Tablas tipo informe**  
   Cabecera gris claro (no oscura), bordes finos, celdas con poco padding para que quepan más filas por página.

5. **Secciones numeradas**  
   Número en badge pequeño (5×5), título en uppercase, poco espacio vertical entre secciones.

6. **Checklists y firmas**  
   Menos espacio entre ítems; firmas en grid compacto con labels pequeños.

7. **Resultado (CUMPLE/NO CUMPLE/N/A)**  
   Radios en una sola línea, tamaños de fuente reducidos para coherencia con el resto del informe.

8. **Unidades**  
   Donde importa para el PDF, uso de `mm` (ej. `10mm`, `5mm`) para alinear con salida A4.

---

## Revisión fina sugerida

- **ProtocolLayout:** márgenes del header (pt/pb en mm) si se quiere más o menos aire.
- **ProtocolTable:** `py-1` vs `py-1.5` en celdas según legibilidad en PDF.
- **ProtocolSectionBlock:** `space-y-2` entre hijos; subir a `space-y-3` si se ve demasiado apretado.
