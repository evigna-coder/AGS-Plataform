# Guía de Pruebas - Reportes OT

## 📋 Pre-requisitos

Antes de comenzar, verifica que tengas:

- ✅ Node.js instalado (versión 18 o superior)
- ✅ npm o pnpm instalado
- ✅ Acceso a las credenciales de Firebase
- ✅ API Key de Google Gemini (opcional, solo para optimización de reportes)

---

## 🔧 Paso 1: Verificar Dependencias

### 1.1 Navegar al directorio del proyecto

```powershell
cd "apps\reportes-ot"
```

### 1.2 Verificar si node_modules existe

```powershell
Test-Path node_modules
```

**Si retorna `False`**, necesitas instalar dependencias (ver paso 2).

**Si retorna `True`**, puedes continuar al paso 3.

---

## 📦 Paso 2: Instalar Dependencias (si es necesario)

### 2.1 Instalar con npm

```powershell
npm install
```

### 2.2 Verificar instalación

```powershell
Test-Path node_modules
```

Debería retornar `True`.

---

## 🔐 Paso 3: Configurar Variables de Entorno

### 3.1 Verificar si existe .env.local

```powershell
Test-Path .env.local
```

### 3.2 Variables de entorno requeridas

El archivo `.env.local` debe contener las siguientes variables de Firebase:

```env
VITE_FIREBASE_API_KEY=tu_api_key_aqui
VITE_FIREBASE_AUTH_DOMAIN=tu_auth_domain_aqui
VITE_FIREBASE_PROJECT_ID=tu_project_id_aqui
VITE_FIREBASE_STORAGE_BUCKET=tu_storage_bucket_aqui
VITE_FIREBASE_MESSAGING_SENDER_ID=tu_messaging_sender_id_aqui
VITE_FIREBASE_APP_ID=tu_app_id_aqui
VITE_FIREBASE_MEASUREMENT_ID=tu_measurement_id_aqui (opcional)
```

**Variables opcionales** (para funcionalidad de IA):
```env
GEMINI_API_KEY=tu_gemini_api_key_aqui (opcional)
```

### 3.3 Crear o editar .env.local

Si no existe, créalo en la raíz de `apps/reportes-ot/`:

```powershell
# Crear archivo .env.local
New-Item -Path .env.local -ItemType File -Force
```

Luego edítalo con tus credenciales de Firebase.

**⚠️ IMPORTANTE**: El archivo `.env.local` está en `.gitignore` y no debe subirse al repositorio.

---

## 🚀 Paso 4: Iniciar el Servidor de Desarrollo

### 4.1 Ejecutar el servidor

```powershell
npm run dev
```

### 4.2 Verificar que el servidor inició correctamente

Deberías ver en la consola:
```
✅ Variables de entorno de Firebase cargadas correctamente
📋 Project ID: [tu_project_id]
✅ Firebase inicializado correctamente
```

Y el servidor debería estar corriendo en:
```
http://localhost:3000
```

### 4.3 Abrir en el navegador

Abre tu navegador y ve a: **http://localhost:3000**

---

## ✅ Paso 5: Checklist de Funcionalidades a Probar

### 5.1 Verificación Inicial

- [ ] **La página carga sin errores** en la consola del navegador
- [ ] **El header se muestra correctamente** con logo y datos de la empresa
- [ ] **No hay errores de Firebase** en la consola
- [ ] **El formulario está visible** y accesible

### 5.2 Crear Nueva OT

- [ ] **Campo OT**: Ingresar un número de OT válido (5 dígitos, ej: `25660`)
- [ ] **Al salir del campo (onBlur)**: Debe mostrar modal de confirmación si la OT no existe
- [ ] **Crear nueva OT**: Confirmar creación y verificar que el formulario se habilita
- [ ] **Autosave**: Esperar 700ms después de editar un campo y verificar en consola que se guarda

### 5.3 Cargar OT Existente

- [ ] **Campo OT**: Ingresar una OT que ya existe en Firebase (ej: `25660`)
- [ ] **Al salir del campo**: Debe cargar los datos automáticamente
- [ ] **Verificar datos cargados**: Todos los campos deben poblarse con los datos guardados

### 5.4 Llenar Formulario

#### Datos del Cliente
- [ ] **Razón Social**: Ingresar texto
- [ ] **Contacto**: Ingresar nombre
- [ ] **Email**: Ingresar email válido
- [ ] **Dirección**: Ingresar calle y número
- [ ] **Localidad**: Ingresar localidad
- [ ] **Provincia**: Ingresar provincia

#### Sistema / Equipo
- [ ] **Sistema**: Ingresar nombre del sistema
- [ ] **Código Interno**: Ingresar código
- [ ] **Modelo**: Ingresar modelo
- [ ] **Descripción**: Ingresar descripción
- [ ] **S/N o Serie**: Ingresar número de serie

#### Servicio
- [ ] **Tipo de Servicio**: Seleccionar de la lista
- [ ] **Presupuestos**: Agregar presupuesto (máximo 15 caracteres)
- [ ] **Checkboxes**: Marcar/desmarcar (Facturable, Contrato, Garantía)

#### Fechas y Tiempos
- [ ] **Fecha Inicio**: Seleccionar fecha
- [ ] **Fecha Fin**: Seleccionar fecha
- [ ] **Horas Trabajadas**: Ingresar número
- [ ] **Tiempo Viaje**: Ingresar número
- [ ] **Total Hs**: Debe calcularse automáticamente

#### Reporte Técnico
- [ ] **Reporte Técnico**: Ingresar texto largo
- [ ] **Optimizar con IA**: Probar botón (requiere GEMINI_API_KEY)
- [ ] **Acciones a Tomar**: Ingresar texto

#### Artículos
- [ ] **Agregar artículo**: Click en "Agregar Artículo"
- [ ] **Llenar campos**: Código, Descripción, Cantidad, Origen
- [ ] **Eliminar artículo**: Click en botón eliminar

### 5.5 Firmas

#### Firma del Especialista
- [ ] **Dibujar firma**: Usar mouse o touch en el canvas
- [ ] **Limpiar firma**: Click en botón "Limpiar"
- [ ] **Aclaración**: Ingresar texto

#### Firma del Cliente
- [ ] **Dibujar firma**: Usar mouse o touch en el canvas
- [ ] **Limpiar firma**: Click en botón "Limpiar"
- [ ] **Aclaración**: Ingresar texto

### 5.6 Validaciones

- [ ] **Intentar finalizar sin completar campos**: Debe mostrar alerta
- [ ] **Intentar finalizar sin firma del especialista**: Debe mostrar alerta
- [ ] **Intentar finalizar sin firma del cliente**: Debe mostrar alerta
- [ ] **Formato de OT inválido**: Debe mostrar error

### 5.7 Preview y PDF

- [ ] **Botón "Revisar"**: Debe activar modo preview
- [ ] **Vista preview**: Debe mostrar el PDF renderizado
- [ ] **Botón "Finalizar y Descargar PDF"**: 
  - Debe validar todos los campos
  - Debe guardar en Firebase con status 'FINALIZADO'
  - Debe generar y descargar PDF
- [ ] **PDF generado**: Verificar que se ve correctamente
- [ ] **En móvil**: Debe intentar compartir con Web Share API

### 5.8 Funcionalidades Adicionales

- [ ] **Duplicar OT**: 
  - Click en botón "Duplicar OT"
  - Seleccionar opciones de copia
  - Verificar que se crea nueva OT con datos copiados
- [ ] **Nuevo Reporte**: 
  - Click en "Nuevo Reporte"
  - Debe limpiar formulario
- [ ] **Compartir PDF**: 
  - Generar PDF primero
  - Click en compartir
  - Verificar que funciona (móvil: Web Share, desktop: descarga)

### 5.9 Modo Firma Móvil

- [ ] **Generar QR**: Click en botón para generar QR
- [ ] **Abrir URL con modo=firma**: 
  - URL: `http://localhost:3000?modo=firma&reportId=25660&data=...`
  - Debe mostrar vista móvil de firma
- [ ] **Firmar en móvil**: Dibujar firma
- [ ] **Confirmar firma**: Debe guardar y redirigir

### 5.10 Autosave

- [ ] **Editar campo**: Cambiar cualquier campo del formulario
- [ ] **Esperar 700ms**: Verificar en consola que aparece "📝 Autosave BORRADOR"
- [ ] **Verificar en Firebase**: Los datos deben guardarse automáticamente
- [ ] **Recargar página**: Los datos deben persistir

---

## 🐛 Problemas Comunes y Soluciones

### Error: "Variables de entorno faltantes"

**Solución**: 
1. Verifica que el archivo `.env.local` existe
2. Verifica que todas las variables comienzan con `VITE_`
3. Reinicia el servidor después de crear/editar `.env.local`

### Error: "Firebase no inicializado"

**Solución**:
1. Verifica las credenciales de Firebase en `.env.local`
2. Verifica que el proyecto Firebase esté activo
3. Revisa la consola del navegador para más detalles

### Error: "No se puede generar PDF"

**Solución**:
1. Verifica que html2pdf.js se cargó correctamente (revisar Network tab)
2. Verifica que el elemento `pdf-container` existe en el DOM
3. Revisa la consola para errores específicos

### El servidor no inicia en el puerto 3000

**Solución**:
1. Verifica que el puerto 3000 no esté en uso
2. Puedes cambiar el puerto en `vite.config.ts` o `package.json`

### Autosave no funciona

**Solución**:
1. Verifica que la OT tiene formato válido (5 dígitos)
2. Verifica que `hasUserInteracted` y `hasInitialized` están en `true`
3. Revisa la consola para errores de Firebase

---

## 📝 Notas de Prueba

### Datos de Prueba Sugeridos

**OT de Prueba**: `25660` o `25660.02`

**Cliente de Prueba**:
- Razón Social: "Cliente de Prueba S.A."
- Contacto: "Juan Pérez"
- Email: "test@example.com"
- Dirección: "Av. Test 123"
- Localidad: "Buenos Aires"
- Provincia: "CABA"

**Equipo de Prueba**:
- Sistema: "Sistema de Prueba"
- Modelo: "Modelo XYZ"
- Descripción: "Equipo de laboratorio"
- Serie: "SN123456"

---

## ✅ Resultado Esperado

Después de completar todas las pruebas:

- ✅ La aplicación carga sin errores
- ✅ Todas las funcionalidades principales funcionan
- ✅ El autosave guarda correctamente
- ✅ El PDF se genera correctamente
- ✅ Las firmas se guardan y muestran correctamente
- ✅ No hay errores en la consola (excepto warnings menores)

---

**Última actualización**: 2026-01-27
