# Análisis UX: Anexo Dinámico para Reportes-OT

## 1. Explicación del Flujo UX Diseñado
El nuevo flujo transforma el protocolo de un documento fijo a una experiencia modular e interactiva:

*   **Paso 1: Selector en Blanco (Screen 1):** El usuario ingresa a la pestaña/sección del Anexo. Encuentra un área limpia donde es obligatorio seleccionar el **Tipo de Servicio** (ej. Mantenimiento Preventivo) y el **Tipo de Equipo** (ej. HPLC). Hasta que no se selecciona el equipo, se muestra un *empty state* claro, evitando que el técnico vea tablas que no corresponden.
*   **Paso 2: Selección de Módulos (Screens 2 y 3):** Al elegir "HPLC", el sistema consulta el catálogo (Firestore o local) y despliega una lista de tablas/ensayos disponibles para ese equipo específico (ej. Flujo, Temperatura, Ruido). Cada elemento tiene un checkbox. El técnico selecciona solo los ensayos que aplican al servicio actual y presiona "Aplicar Selección".
*   **Paso 3: Tablas Editables (Screen 4):** Una vez aplicadas, el selector se contrae o pasa a segundo plano, y se renderizan únicamente las tablas elegidas en pantalla completa (Modo Edición). El diseño utiliza inputs claramente delineados, labels grises neutros y radio buttons para los estados de cumplimiento, maximizando la legibilidad en campo (tabletas/móviles).
*   **Paso 4: Modo Print/PDF (Screen 5):** Al "Generar PDF", la vista cambia. Las áreas interactivas (inputs, bordes grises de los selectores, íconos de basura) desaparecen. La tabla adopta un estilo plano, de alto contraste (blanco y negro purista), incorporando el membrete de la empresa, y calculando los `page-breaks` para no cortar las filas complejas. Los checkboxes cambian por caracteres estáticos ("X" o "√") para una impresión perfecta mediante `html2canvas`.

## 2. Recomendaciones de Interacción (Micro-interacciones)
*   **Focus State:** Aplicar un anillo generoso (e.g., `ring-2 ring-blue-500`) a los inputs y selects cuando están activos para mejorar la accesibilidad táctil en campo.
*   **Hover Styles:** Sutil oscurecimiento en el botón "Aplicar Selección" y en el ícono de eliminar tabla (`trash-2`).
*   **Validación:** 
    * No habilitar el botón "Aplicar Selección" hasta que haya al menos 1 tabla tildada.
    * En el modo Edición (Screen 4), resaltar en rojo sutil (e.g., `bg-red-50`) toda la fila de la tabla si el usuario marcó "No cumple" o si el resultado tipiado escapa al rango de la especificación técnica inyectada.

## 3. Coherencia con la Arquitectura Actual
Este diseño fue pensado para convivir perfectamente con:
*   **`useReportForm` & `ProtocolView`:** El estado del componente actual ya guarda un `Record<string, ProtocolSection>`. El nuevo selector simplemente inyecta dinámicamente qué secciones entrarán en ese diccionario en lugar de cargarlas todas por defecto.
*   **`usePDFGeneration`:** El diseño de la Screen 5 (Modo Print) respeta estrictamente los anchos fijos proporcionales al tamaño A4 (210mm) utilizados en la lógica actual de escalado para `pdf-lib` e `html2canvas`. Al no utilizar modales superpuestos, el flujo se mantiene puramente dentro del DOM estándar, garantizando que el capturador no pierda nodos.
*   **Firestore & Autosave:** Como el selector altera el mismo objeto `protocolData`, los hooks recurrentes de autosave (ya implementados) registrarán silenciosamente los cambios sin saturar el hilo principal. Cuando en el futuro el *Sistema Modular* pase el equipo pre-seleccionado, la Screen 1 y 2 se automatizarán y el técnico aterrizará directamente en la Screen 4, garantizando **Full Scalability**.

> **Archivos Entregables:**
> Los diseños fuente, exportables, y las maquetas exactas de este flujo se encuentran documentados visualmente como pantallas dentro del entorno Pencil (`dynamic_protocol.pen`).
