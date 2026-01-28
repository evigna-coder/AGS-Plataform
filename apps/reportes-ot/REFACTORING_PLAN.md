# Plan de Refactorización - Reportes OT

## ⚠️ REGLA CRÍTICA
**NO SE PUEDE MODIFICAR NADA VISUAL:**
- ❌ NO cambiar estilos, clases CSS, márgenes, padding, posiciones
- ❌ NO modificar el renderizado del formulario, header o footer
- ❌ NO alterar el layout del PDF
- ✅ SÍ se puede reorganizar código, extraer funciones, crear hooks, separar componentes
- ✅ SÍ se puede mejorar la estructura y mantenibilidad del código

---

## Objetivos de la Refactorización

1. **Mejorar mantenibilidad** sin cambiar funcionalidad visual
2. **Separar responsabilidades** en módulos lógicos
3. **Reducir complejidad** del componente App principal
4. **Facilitar testing** futuro
5. **Mejorar legibilidad** del código

---

## Estructura Actual (Análisis)

### Archivo Principal: `App.tsx` (~2700 líneas)
- **Estados**: ~35 useState hooks
- **Funciones principales**: 
  - `confirmLoadOt` - Carga OT desde Firebase
  - `confirmCreateNewOt` - Crea nueva OT
  - `handleFinalSubmit` - Genera PDF final
  - `confirmClientAndFinalize` - Confirma firma cliente y finaliza
  - `generatePDFBlob` - Genera PDF como Blob
  - `handleReview` - Activa modo preview
  - `newReport` - Crea nuevo reporte
  - `duplicateOt` - Duplica OT existente
  - `handleOptimizeReport` - Optimiza reporte con AI
  - `validateBeforeClientConfirm` - Valida antes de finalizar
- **Componentes inline**: CompanyLogo, CompanyHeader, DuplicateOTModal, MobileSignatureView
- **Lógica de autosave**: useEffect con debounce 700ms
- **Lógica de PDF**: Múltiples funciones con html2pdf

---

## Fases de Refactorización

### **FASE 1: Extracción de Hooks Personalizados**

#### 1.1 `hooks/useReportForm.ts`
**Objetivo**: Centralizar toda la lógica de estado del formulario

**Contenido**:
- Todos los `useState` del formulario (campos, firmas, estado)
- `reportState` useMemo
- `readOnly` computed
- `markUserInteracted` function
- Refs relacionados (`hasUserInteracted`, `hasInitialized`)

**Retorna**:
```typescript
{
  // Estados del formulario
  formState: { ... },
  // Setters
  setters: { ... },
  // Computed
  readOnly: boolean,
  reportState: ReportState,
  // Helpers
  markUserInteracted: () => void
}
```

**⚠️ Garantía**: Mismo comportamiento, misma estructura de datos

---

#### 1.2 `hooks/useOTManagement.ts`
**Objetivo**: Centralizar lógica de carga/creación/duplicación de OTs

**Contenido**:
- `confirmLoadOt` function
- `confirmCreateNewOt` function
- `newReport` function
- `duplicateOt` function
- Estado de modales relacionados (`showNewOtModal`, `pendingOt`)

**Retorna**:
```typescript
{
  loadOT: (otValue: string) => Promise<void>,
  createNewOT: (otValue: string) => void,
  newReport: () => void,
  duplicateOT: (options: DuplicateOptions) => void,
  modals: { showNewOtModal, setShowNewOtModal, pendingOt, setPendingOt }
}
```

**⚠️ Garantía**: Misma lógica de validación y flujo de datos

---

#### 1.3 `hooks/usePDFGeneration.ts`
**Objetivo**: Centralizar toda la lógica de generación de PDF

**Contenido**:
- `generatePDFBlob` function
- `handleFinalSubmit` function
- `confirmClientAndFinalize` function
- Estado relacionado (`isSending`, `isPreviewMode`, `generatedPdfBlob`)

**Retorna**:
```typescript
{
  generatePDFBlob: () => Promise<Blob>,
  handleFinalSubmit: () => Promise<void>,
  confirmClientAndFinalize: () => Promise<void>,
  isGenerating: boolean,
  isPreviewMode: boolean,
  pdfBlob: Blob | null
}
```

**⚠️ Garantía**: Mismas opciones de html2pdf, mismos márgenes, mismo resultado visual

---

#### 1.4 `hooks/useAutosave.ts`
**Objetivo**: Extraer lógica de autosave a hook separado

**Contenido**:
- useEffect de autosave con debounce 700ms
- Lógica de validación de OT
- Condiciones de guardado

**Retorna**:
```typescript
{
  // Hook interno, no retorna nada público
  // Solo maneja el efecto de autosave
}
```

**⚠️ Garantía**: Mismo timing de guardado, misma lógica de condiciones

---

### **FASE 2: Extracción de Funciones de Utilidad**

#### 2.1 `utils/reportValidation.ts`
**Objetivo**: Centralizar validaciones

**Contenido**:
- `validateBeforeClientConfirm` function
- Helpers de validación de formato OT
- Constantes de validación

**⚠️ Garantía**: Mismas validaciones, mismos mensajes de error

---

#### 2.2 `utils/pdfOptions.ts`
**Objetivo**: Centralizar configuración de PDF

**Contenido**:
- Función que retorna opciones de html2pdf
- Configuración de márgenes, escalas, etc.
- Constantes de configuración

**⚠️ Garantía**: Mismas opciones exactas de PDF

---

#### 2.3 `utils/otHelpers.ts`
**Objetivo**: Funciones helper para manejo de OTs

**Contenido**:
- `incrementSuffix` function
- Validación de formato OT (regex)
- Helpers de transformación de OT

**⚠️ Garantía**: Misma lógica de transformación

---

### **FASE 3: Extracción de Componentes**

#### 3.1 `components/CompanyLogo.tsx`
**Objetivo**: Extraer componente CompanyLogo a archivo separado

**Contenido**: 
- Componente CompanyLogo completo
- Constantes LOGO_SRC, ISO_LOGO_SRC

**⚠️ Garantía**: Mismo JSX, mismos estilos inline, mismo tamaño

---

#### 3.2 `components/CompanyHeader.tsx`
**Objetivo**: Extraer componente CompanyHeader a archivo separado

**Contenido**:
- Componente CompanyHeader completo
- Interface HeaderProps

**⚠️ Garantía**: Mismo JSX, mismas clases CSS, mismo layout

---

#### 3.3 `components/DuplicateOTModal.tsx`
**Objetivo**: Extraer modal de duplicación

**Contenido**:
- Componente DuplicateOTModal completo
- Props interface

**⚠️ Garantía**: Mismo diseño visual, mismos estilos

---

#### 3.4 `components/MobileSignatureView.tsx`
**Objetivo**: Ya existe, verificar que esté completo

**Contenido**:
- Componente MobileSignatureView completo

**⚠️ Garantía**: Mismo comportamiento visual

---

#### 3.5 `components/ReportForm.tsx`
**Objetivo**: Extraer el formulario principal a componente separado

**Contenido**:
- Todo el JSX del formulario (desde "Datos del Cliente" hasta el final)
- Props para todos los estados y handlers

**⚠️ Garantía**: Mismo JSX exacto, mismas clases, mismo layout

---

#### 3.6 `components/PDFPreview.tsx`
**Objetivo**: Extraer la vista de preview del PDF

**Contenido**:
- Todo el JSX del `pdf-container`
- Props necesarias

**⚠️ Garantía**: Mismo layout del PDF, mismos estilos

---

### **FASE 4: Reorganización del Componente Principal**

#### 4.1 `App.tsx` Simplificado
**Objetivo**: Reducir App.tsx a orquestación de hooks y componentes

**Estructura final**:
```typescript
const App: React.FC = () => {
  // Hooks personalizados
  const reportForm = useReportForm();
  const otManagement = useOTManagement();
  const pdfGeneration = usePDFGeneration();
  const autosave = useAutosave();
  
  // Lógica de modo firma móvil
  // Renderizado condicional
  // Orquestación de componentes
}
```

**⚠️ Garantía**: Mismo comportamiento, misma estructura de renderizado

---

## Estrategia de Implementación

### Principios de Refactorización

1. **Una fase a la vez**: Completar cada fase antes de pasar a la siguiente
2. **Testing continuo**: Verificar que no hay cambios visuales después de cada cambio
3. **Commits pequeños**: Un commit por cada extracción/refactorización
4. **Reversibilidad**: Cada cambio debe ser fácil de revertir si causa problemas

### Proceso por Fase

1. **Crear nuevo archivo/hook/componente**
2. **Copiar código exacto** (sin modificar)
3. **Ajustar imports y exports**
4. **Actualizar App.tsx** para usar el nuevo módulo
5. **Verificar visualmente** que todo se ve igual
6. **Commit** con mensaje descriptivo

### Verificación Visual

Después de cada cambio:
- ✅ Abrir aplicación en navegador
- ✅ Verificar formulario se ve igual
- ✅ Verificar header se ve igual
- ✅ Verificar footer se ve igual
- ✅ Generar PDF y verificar que se ve igual
- ✅ Probar funcionalidades principales

---

## Orden de Implementación Recomendado

### Prioridad Alta (Impacto en mantenibilidad)
1. ✅ Fase 1.1: `useReportForm` - Centraliza estados
2. ✅ Fase 1.2: `useOTManagement` - Separa lógica de OTs
3. ✅ Fase 1.3: `usePDFGeneration` - Separa lógica de PDF

### Prioridad Media
4. ✅ Fase 1.4: `useAutosave` - Separa autosave
5. ✅ Fase 2: Funciones de utilidad
6. ✅ Fase 3.1-3.4: Componentes pequeños

### Prioridad Baja (Requiere más cuidado)
7. ✅ Fase 3.5: `ReportForm` - Componente grande
8. ✅ Fase 3.6: `PDFPreview` - Componente crítico
9. ✅ Fase 4: Simplificación final de App.tsx

---

## Archivos a Crear

```
apps/reportes-ot/
├── hooks/
│   ├── useReportForm.ts
│   ├── useOTManagement.ts
│   ├── usePDFGeneration.ts
│   └── useAutosave.ts
├── utils/
│   ├── reportValidation.ts
│   ├── pdfOptions.ts
│   └── otHelpers.ts
├── components/
│   ├── CompanyLogo.tsx
│   ├── CompanyHeader.tsx
│   ├── DuplicateOTModal.tsx
│   ├── ReportForm.tsx
│   └── PDFPreview.tsx
└── App.tsx (simplificado)
```

---

## Checklist de Verificación por Cambio

Antes de hacer commit:
- [ ] Código compila sin errores
- [ ] No hay warnings de TypeScript
- [ ] Formulario se ve idéntico visualmente
- [ ] Header se ve idéntico visualmente
- [ ] Footer se ve idéntico visualmente
- [ ] PDF generado se ve idéntico
- [ ] Funcionalidades principales funcionan:
  - [ ] Cargar OT
  - [ ] Crear nueva OT
  - [ ] Duplicar OT
  - [ ] Autosave funciona
  - [ ] Generar PDF funciona
  - [ ] Firmas funcionan
  - [ ] Validaciones funcionan

---

## Notas Importantes

1. **NO usar refactorización automática** de IDE que pueda cambiar estilos
2. **Copiar y pegar código exacto** en lugar de reescribir
3. **Mantener comentarios** originales si son útiles
4. **Preservar console.log** de debugging si existen
5. **Mantener mismo orden** de estados y funciones si es posible

---

## Próximos Pasos

Una vez aprobado este plan:
1. Comenzar con Fase 1.1 (`useReportForm`)
2. Implementar una fase a la vez
3. Verificar visualmente después de cada fase
4. Continuar con siguiente fase solo si la anterior está estable
