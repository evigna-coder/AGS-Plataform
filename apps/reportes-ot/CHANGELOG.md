# Changelog - Reportes OT

Registro de cambios y mejoras realizadas en el proyecto reportes-OT.

---

## [2026-01-27] - Correcciones y Mejoras

### 🐛 Correcciones de Bugs

#### 1. **Firma del Especialista desaparecía al previsualizar PDF**
- **Problema**: Al firmar como especialista y luego ir a previsualizar el PDF, al volver al formulario la firma desaparecía.
- **Causa**: La firma del especialista no se guardaba en el estado cuando se completaba, solo se mantenía en el canvas del SignaturePad.
- **Solución**: Agregado `onEnd` callback al `SignaturePad` del especialista para guardar la firma en el estado (`signatureEngineer`) cada vez que se completa.
- **Archivo modificado**: `App.tsx` (línea ~1570)
- **Fecha**: 2026-01-27

#### 2. **Campos de fecha no editables después de duplicar OT**
- **Problema**: Después de duplicar una OT, los campos de fecha (`fechaInicio` y `fechaFin`) no permitían edición.
- **Causa**: El estado `status` se establecía después de otros estados, causando que `readOnly` se calculara incorrectamente antes de que React actualizara el estado.
- **Solución**: 
  - Movido `setStatus('BORRADOR')` al principio de la secuencia de estados en `duplicateOT`.
  - Agregado delay de 100ms antes de guardar en Firestore para asegurar que React actualice el estado.
  - Asegurado explícitamente que el `status` sea 'BORRADOR' al guardar en Firestore.
- **Archivo modificado**: `hooks/useOTManagement.ts` (líneas ~343-404)
- **Fecha**: 2026-01-27

#### 3. **Campos de fecha solo permitían editar dígito por dígito**
- **Problema**: Los campos de fecha no permitían seleccionar todo el texto y reemplazarlo, solo se podía editar dígito por dígito.
- **Causa**: El valor del input se calculaba en cada render desde el estado ISO, causando que cualquier cambio parcial se "rebotara" si no formaba una fecha válida inmediatamente.
- **Solución**: 
  - Implementado estados locales `fechaInicioDisplay` y `fechaFinDisplay` para manejar el valor visible en formato DD/MM/AAAA.
  - El input ahora refleja exactamente lo que el usuario escribe, permitiendo seleccionar y reemplazar todo el texto.
  - El estado ISO interno solo se actualiza cuando el texto forma una fecha válida o está vacío.
  - Agregados `useEffect` para sincronizar el display cuando la fecha ISO cambia desde fuera (carga OT, duplicado, nuevo reporte).
- **Archivos modificados**: `App.tsx` (líneas ~344-360, ~1105-1210)
- **Fecha**: 2026-01-27

### ✨ Nuevas Funcionalidades

#### 1. **Opción de Descargar PDF para OTs Finalizadas**
- **Descripción**: Agregada opción para descargar el PDF directamente cuando una OT está finalizada, además de la opción de compartir.
- **Implementación**: 
  - Nueva función `downloadPDF` en `App.tsx` que genera/usa el PDF Blob y lo descarga directamente.
  - Agregado botón "Descargar PDF" en `MobileMenu` (tanto desktop como móvil) cuando `status === 'FINALIZADO' && hasPdfBlob`.
- **Archivos modificados**: 
  - `App.tsx` (función `downloadPDF`, línea ~540)
  - `components/MobileMenu.tsx` (prop `onDownloadPDF` y botón de descarga)
- **Fecha**: 2026-01-27

### 🔧 Mejoras de UX

#### 1. **Formato de Fecha DD/MM/AAAA**
- **Descripción**: Cambiado el formato de visualización de fechas de formato americano (MM/DD/AAAA) a formato DD/MM/AAAA.
- **Implementación**: 
  - Cambiados inputs de tipo `date` a tipo `text` con formato personalizado.
  - Agregadas funciones de conversión en `services/utils.ts`:
    - `formatDateToDDMMYYYY()`: Convierte de YYYY-MM-DD a DD/MM/YYYY
    - `parseDDMMYYYYToISO()`: Convierte de DD/MM/YYYY a YYYY-MM-DD
    - `isValidDDMMYYYY()`: Valida formato DD/MM/YYYY
  - Formato automático mientras se escribe (agrega `/` automáticamente).
  - Validación al salir del campo (onBlur).
- **Archivos modificados**: 
  - `services/utils.ts` (funciones de conversión)
  - `App.tsx` (inputs de fecha)
- **Fecha**: 2026-01-27

#### 2. **Mejoras en Mensajes de Confirmación**
- **Descripción**: Cambiado el mensaje de confirmación al crear nuevo reporte de "Hay cambios sin guardar" a "Está a punto de abandonar el reporte actual, ¿está seguro?".
- **Archivo modificado**: `hooks/useOTManagement.ts` (función `newReport`)
- **Fecha**: 2026-01-27

#### 3. **Sistema de Modales Personalizados**
- **Descripción**: Reemplazo de todos los `alert()` y `window.confirm()` nativos por un sistema de modales personalizados.
- **Implementación**: 
  - Creado `components/Modal.tsx` con componentes `Modal`, `AlertModal`, `ConfirmModal`.
  - Creado `hooks/useModal.ts` con funciones `showAlert` y `showConfirm`.
  - Integrado en `App.tsx` y reemplazados todos los `alert()` y `confirm()`.
- **Archivos creados**: 
  - `components/Modal.tsx`
  - `hooks/useModal.ts`
- **Archivos modificados**: 
  - `App.tsx`
  - `hooks/useOTManagement.ts`
  - `hooks/usePDFGeneration.ts`
- **Fecha**: 2026-01-27

#### 4. **Mejoras en Layout Móvil**
- **Descripción**: Ajustes en el layout móvil para evitar superposiciones.
- **Cambios**:
  - Agregado `mt-4` al contenedor del formulario en móvil para evitar que se superponga con el header.
  - Cambiado grid de campos de fecha/hora de `grid-cols-4` a `grid-cols-2 md:grid-cols-4` para mejor visualización en móvil.
  - Reducido padding y tamaño de fuente de campos de fecha en móvil (`px-2 md:px-3 text-[10px] md:text-xs`).
- **Archivo modificado**: `App.tsx`
- **Fecha**: 2026-01-27

---

## [2026-01-27] - Mejoras en Duplicación de OT

### 🐛 Correcciones

#### 1. **Bug en Duplicación de OT - OT Finalizada**
- **Problema**: Al duplicar una OT (ej: `30000.01`), si la siguiente OT sugerida (`30000.02`) ya existía y estaba `FINALIZADO`, el sistema aún la sugería y permitía su creación/edición.
- **Solución**: 
  - Creada función `findNextAvailableOT` en `services/utils.ts` que busca iterativamente la siguiente OT disponible (que no exista o esté en 'BORRADOR').
  - Modificado `DuplicateOTModal` para usar `findNextAvailableOT` al abrir, mostrando estado de carga.
  - Modificado `duplicateOT` en `useOTManagement.ts` para usar `findNextAvailableOT` y pre-validar la OT antes de crear.
- **Archivos modificados**: 
  - `services/utils.ts` (función `findNextAvailableOT`)
  - `App.tsx` (componente `DuplicateOTModal`)
  - `hooks/useOTManagement.ts` (función `duplicateOT`)
- **Fecha**: 2026-01-27

---

## [2026-01-27] - Refactorización Estructural

### 📁 Estructura de Archivos

#### Hooks Extraídos
- ✅ `hooks/useReportForm.ts` - Centraliza todos los estados del formulario
- ✅ `hooks/useOTManagement.ts` - Gestión de carga, creación y duplicación de OTs
- ✅ `hooks/usePDFGeneration.ts` - Generación de PDFs y finalización de reportes
- ✅ `hooks/useAutosave.ts` - Lógica de autosave con debounce
- ✅ `hooks/useModal.ts` - Sistema de modales personalizados

#### Componentes Extraídos
- ✅ `components/SignaturePad.tsx` - Componente de firma digital
- ✅ `components/MobileMenu.tsx` - Menú responsive para acciones móviles
- ✅ `components/Modal.tsx` - Componentes de modales (Modal, AlertModal, ConfirmModal)

#### Utilidades Extraídas
- ✅ `utils/pdfOptions.ts` - Configuración centralizada de opciones de PDF
- ✅ `services/utils.ts` - Funciones utilitarias (uid, incrementSuffix, findNextAvailableOT, conversión de fechas)

### 📝 Documentación Creada
- `REFACTORING_PLAN.md` - Plan de refactorización inicial
- `ANALISIS_PROYECTO.md` - Análisis completo del proyecto y estado de refactorización
- `ANALISIS_MEJORAS_2026.md` - Análisis de mejoras estructurales pendientes
- `GUIA_PRUEBAS.md` - Guía completa para pruebas del sistema
- `SOLUCION_ERROR_PERMISOS.md` - Solución para errores de permisos de Firebase
- `DEPLOY_FIRESTORE_RULES.md` - Guía para desplegar reglas de Firestore
- `CHANGELOG.md` - Este archivo

---

## Notas Importantes

### ⚠️ Reglas de Desarrollo
- **NO se pueden modificar estilos visuales, clases CSS, márgenes, padding, posiciones**
- **NO se puede modificar el renderizado del formulario, header o footer**
- **NO se puede alterar el layout del PDF**
- **SÍ se puede reorganizar código, extraer funciones, crear hooks, separar componentes**
- **SÍ se puede mejorar la estructura y mantenibilidad del código**

### 🔍 Estado de Refactorización
- **App.tsx**: Reducido de ~2700 líneas a ~2593 líneas
- **Hooks extraídos**: 5 hooks personalizados
- **Componentes extraídos**: 3 componentes reutilizables
- **Utils extraídos**: 2 archivos de utilidades

---

**Última actualización**: 2026-01-27
