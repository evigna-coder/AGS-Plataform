# Plan de Seguridad - Reportes OT

**Fecha de Análisis**: 2026-01-27  
**Estado Actual**: Desarrollo / Pre-producción

---

## 🔒 Resumen Ejecutivo

Este documento identifica vulnerabilidades de seguridad en el código actual y propone un plan de implementación de mejoras de seguridad priorizadas.

### Nivel de Riesgo Actual: **ALTO** ⚠️

**Razones principales**:
- ❌ Sin autenticación/autorización implementada
- ❌ Acceso público a Firestore y Storage
- ❌ Falta de validación y sanitización de inputs
- ❌ Exposición de información sensible en logs
- ❌ Sin protección contra ataques comunes (XSS, CSRF, etc.)

---

## 🔍 Vulnerabilidades Identificadas

### 🔴 CRÍTICAS (Implementar Inmediatamente)

#### 1. **Sin Autenticación/Autorización**

**Problema**:
- Las reglas de Firestore permiten acceso sin autenticación (`allow read: if true`)
- Cualquier usuario puede leer, crear y modificar reportes
- No hay control de acceso basado en roles

**Evidencia**:
```javascript
// firestore.rules línea 94
allow read: if isValidOTDocument() || true; // Temporal: permitir queries

// firestore.rules líneas 194-271
allow read, write: if true; // Temporal para desarrollo
```

**Impacto**: 
- **CRÍTICO**: Acceso no autorizado a datos sensibles
- Modificación/eliminación de reportes por cualquier usuario
- Violación de privacidad de datos de clientes

**Solución Propuesta**:
1. Implementar Firebase Authentication
2. Actualizar reglas de Firestore para requerir autenticación
3. Implementar roles (admin, técnico, cliente)
4. Restringir acceso según roles

**Prioridad**: 🔴 **ALTA** - Implementar antes de producción

---

#### 2. **Exposición de Información Sensible en Logs**

**Problema**:
- Se loguean datos completos de reportes en consola del navegador
- Información de clientes, firmas, emails visibles en DevTools
- Logs de errores exponen estructura de datos

**Evidencia**:
```javascript
// firebaseService.ts líneas 102-103
console.log('💾 Guardando reporte:', ot);
console.log('📋 Datos a guardar:', JSON.stringify(data, null, 2));

// firebaseService.ts línea 111
console.error('📋 Datos que fallaron:', JSON.stringify(data, null, 2));
```

**Impacto**:
- **ALTO**: Información sensible accesible en DevTools
- Violación de privacidad
- Facilita ingeniería inversa

**Solución Propuesta**:
1. Eliminar logs de datos sensibles en producción
2. Usar variables de entorno para controlar nivel de logging
3. Sanitizar datos antes de loguear (solo IDs, no contenido)
4. Implementar sistema de logging condicional

**Prioridad**: 🔴 **ALTA** - Implementar antes de producción

---

#### 3. **Falta de Validación y Sanitización de Inputs**

**Problema**:
- No hay validación de tipos de datos antes de guardar
- No hay sanitización de strings (XSS potencial)
- No hay validación de tamaño de campos
- Validación solo en Firestore rules (puede ser bypassed)

**Evidencia**:
```javascript
// App.tsx - Los inputs se guardan directamente sin sanitización
setRazonSocial(e.target.value); // Sin validar ni sanitizar
setReporteTecnico(e.target.value); // Sin sanitizar HTML/scripts
```

**Impacto**:
- **ALTO**: Vulnerable a XSS (Cross-Site Scripting)
- Inyección de datos maliciosos
- Corrupción de datos

**Solución Propuesta**:
1. Implementar validación de inputs en el cliente
2. Sanitizar strings antes de guardar (DOMPurify o similar)
3. Validar tipos de datos
4. Validar tamaños máximos
5. Validar formatos (emails, fechas, etc.)

**Prioridad**: 🔴 **ALTA** - Implementar antes de producción

---

#### 4. **Uso de innerHTML (XSS Potencial)**

**Problema**:
- Uso directo de `innerHTML` sin sanitización
- Permite inyección de código JavaScript malicioso

**Evidencia**:
```javascript
// App.tsx línea 500
qrRef.current.innerHTML = '';
```

**Impacto**:
- **MEDIO**: Vulnerable a XSS si el contenido proviene de usuario
- En este caso específico es seguro (QRCode genera contenido), pero es mala práctica

**Solución Propuesta**:
1. Reemplazar `innerHTML` por métodos seguros cuando sea posible
2. Si es necesario usar `innerHTML`, sanitizar contenido
3. Usar `textContent` cuando sea posible

**Prioridad**: 🟡 **MEDIA** - Mejorar prácticas

---

#### 5. **Storage Público sin Autenticación**

**Problema**:
- Los PDFs en Firebase Storage pueden ser accesibles públicamente
- No hay autenticación requerida para leer PDFs
- URLs de PDFs pueden ser compartidas/descubiertas

**Evidencia**:
```javascript
// storage.rules línea 8
allow read: if false; // Bloqueado actualmente, pero sin auth

// firebaseService.ts línea 221
const url = await getDownloadURL(storageRef); // URL pública
```

**Impacto**:
- **ALTO**: Acceso no autorizado a PDFs si las URLs se descubren
- Violación de privacidad

**Solución Propuesta**:
1. Implementar autenticación en Storage rules
2. Usar signed URLs con expiración
3. Implementar tokens de acceso temporales
4. Restringir acceso por roles

**Prioridad**: 🔴 **ALTA** - Implementar antes de producción

---

### 🟡 MEDIAS (Implementar Próximamente)

#### 6. **API Keys Expuestas en Cliente**

**Problema**:
- Las API keys de Firebase están en el código del cliente
- Aunque es normal para Firebase, deberían tener restricciones de dominio/IP
- Gemini API key puede estar expuesta

**Evidencia**:
```javascript
// firebaseService.ts líneas 6-12
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY, // Expuesta en cliente
  // ...
};

// geminiService.ts línea 8
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY }); // Puede no estar disponible
```

**Impacto**:
- **MEDIO**: Abuso de API keys si no hay restricciones
- Costos inesperados en servicios externos

**Solución Propuesta**:
1. Configurar restricciones de dominio/IP en Firebase Console
2. Configurar cuotas y límites de uso
3. Mover llamadas a Gemini a un backend (si es crítico)
4. Usar Firebase Functions como proxy para APIs externas

**Prioridad**: 🟡 **MEDIA** - Configurar restricciones

---

#### 7. **Sin Rate Limiting**

**Problema**:
- No hay protección contra abuso de APIs
- Un atacante puede hacer múltiples requests para:
  - Sobrecargar Firestore
  - Generar costos excesivos
  - Realizar ataques de fuerza bruta

**Evidencia**:
- No hay límites en número de requests
- Autosave puede ejecutarse múltiples veces sin control
- No hay throttling en operaciones críticas

**Impacto**:
- **MEDIO**: Abuso de recursos
- Costos elevados
- Denegación de servicio

**Solución Propuesta**:
1. Implementar rate limiting en Firebase Functions (si se usa)
2. Agregar debounce/throttle más agresivo en autosave
3. Limitar número de operaciones por usuario
4. Implementar captcha para operaciones críticas

**Prioridad**: 🟡 **MEDIA** - Implementar después de autenticación

---

#### 8. **Sin Validación de Tamaño de Archivos**

**Problema**:
- Aunque hay límites en Storage rules (10MB), no hay validación en cliente
- Usuario puede intentar subir archivos grandes, causando errores
- No hay validación de tamaño de datos antes de guardar en Firestore

**Evidencia**:
```javascript
// storage.rules línea 11
allow write: if request.resource.size < 10 * 1024 * 1024  // Solo en reglas

// No hay validación en cliente antes de generar PDF
```

**Impacto**:
- **BAJO**: UX pobre (errores después de generar PDF)
- Posible abuso de recursos

**Solución Propuesta**:
1. Validar tamaño de PDF antes de generar
2. Mostrar advertencia si el PDF será muy grande
3. Validar tamaño de datos antes de guardar en Firestore

**Prioridad**: 🟢 **BAJA** - Mejora de UX

---

#### 9. **Sin Protección CSRF**

**Problema**:
- No hay tokens CSRF para proteger contra Cross-Site Request Forgery
- Aunque Firebase tiene protección incorporada, debería verificarse

**Impacto**:
- **BAJO**: Firebase tiene protección incorporada, pero debería documentarse

**Solución Propuesta**:
1. Verificar que Firebase SDK maneja CSRF correctamente
2. Documentar medidas de seguridad implementadas
3. Considerar tokens adicionales si es necesario

**Prioridad**: 🟢 **BAJA** - Verificación y documentación

---

#### 10. **Manejo de Errores Expone Información**

**Problema**:
- Los mensajes de error pueden exponer información del sistema
- Stack traces visibles en consola
- Mensajes de error muy detallados

**Evidencia**:
```javascript
// firebaseService.ts líneas 108-111
console.error('❌ Error al guardar reporte:', error);
console.error('Código de error:', error.code);
console.error('Mensaje:', error.message);
console.error('📋 Datos que fallaron:', JSON.stringify(data, null, 2));
```

**Impacto**:
- **MEDIO**: Información útil para atacantes
- Facilita ingeniería inversa

**Solución Propuesta**:
1. Sanitizar mensajes de error para usuarios
2. Logs detallados solo en desarrollo
3. No exponer stack traces en producción
4. Usar códigos de error genéricos para usuarios

**Prioridad**: 🟡 **MEDIA** - Mejorar manejo de errores

---

## 📋 Plan de Implementación

### Fase 1: Seguridad Crítica (Antes de Producción)

#### 1.1 Implementar Autenticación Firebase
**Tiempo estimado**: 2-3 días

**Tareas**:
- [ ] Configurar Firebase Authentication (Email/Password o Google OAuth)
- [ ] Crear componentes de login/registro
- [ ] Implementar gestión de sesión
- [ ] Actualizar reglas de Firestore para requerir `request.auth != null`
- [ ] Implementar roles básicos (admin, técnico)
- [ ] Actualizar UI para mostrar estado de autenticación

**Archivos a modificar**:
- `firestore.rules` - Agregar validación de auth
- `storage.rules` - Agregar validación de auth
- `App.tsx` - Agregar componentes de auth
- Crear `components/Auth.tsx`
- Crear `hooks/useAuth.ts`

**Ejemplo de reglas actualizadas**:
```javascript
// firestore.rules
allow read: if request.auth != null && isValidOTDocument();
allow create: if request.auth != null 
              && isValidOTDocument()
              && isValidReportData()
              && request.resource.data.status == 'BORRADOR';
```

---

#### 1.2 Eliminar Logs Sensibles
**Tiempo estimado**: 1 día

**Tareas**:
- [ ] Crear sistema de logging condicional basado en `NODE_ENV`
- [ ] Eliminar logs de datos completos en producción
- [ ] Sanitizar logs (solo IDs, no contenido)
- [ ] Revisar todos los `console.log/error/warn`

**Archivos a modificar**:
- `services/firebaseService.ts` - Eliminar logs de datos
- `hooks/useOTManagement.ts` - Sanitizar logs
- `hooks/usePDFGeneration.ts` - Sanitizar logs
- Crear `utils/logger.ts` - Sistema de logging seguro

**Ejemplo**:
```typescript
// utils/logger.ts
const isDev = import.meta.env.DEV;

export const logger = {
  log: (...args: any[]) => {
    if (isDev) console.log(...args);
  },
  error: (message: string, error?: any) => {
    if (isDev) {
      console.error(message, error);
    } else {
      // En producción, solo loguear mensajes genéricos
      console.error(message);
    }
  }
};
```

---

#### 1.3 Implementar Validación y Sanitización
**Tiempo estimado**: 2-3 días

**Tareas**:
- [ ] Instalar DOMPurify para sanitización
- [ ] Crear funciones de validación para cada campo
- [ ] Sanitizar todos los inputs antes de guardar
- [ ] Validar tipos de datos
- [ ] Validar tamaños máximos
- [ ] Validar formatos (email, fecha, OT)

**Archivos a crear**:
- `utils/validation.ts` - Funciones de validación
- `utils/sanitization.ts` - Funciones de sanitización

**Archivos a modificar**:
- `App.tsx` - Agregar validación en onChange
- `hooks/useOTManagement.ts` - Validar antes de guardar
- `services/firebaseService.ts` - Validar antes de guardar

**Ejemplo**:
```typescript
// utils/sanitization.ts
import DOMPurify from 'dompurify';

export const sanitizeString = (input: string): string => {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
};

export const sanitizeReportData = (data: any): any => {
  return {
    ...data,
    razonSocial: sanitizeString(data.razonSocial || ''),
    contacto: sanitizeString(data.contacto || ''),
    reporteTecnico: sanitizeString(data.reporteTecnico || ''),
    // ... otros campos de texto
  };
};
```

---

#### 1.4 Proteger Storage con Autenticación
**Tiempo estimado**: 1 día

**Tareas**:
- [ ] Actualizar `storage.rules` para requerir autenticación
- [ ] Implementar signed URLs con expiración
- [ ] Restringir acceso por roles
- [ ] Validar formato OT en paths

**Archivos a modificar**:
- `storage.rules` - Agregar `request.auth != null`
- `services/firebaseService.ts` - Usar signed URLs si es necesario

**Ejemplo**:
```javascript
// storage.rules
match /reports/{ot}/{filename} {
  allow read: if request.auth != null 
              && ot.matches('\\d{5}(?:\\.\\d{2})?');
  allow write: if request.auth != null 
               && request.resource.size < 10 * 1024 * 1024
               && request.resource.contentType == 'application/pdf'
               && filename.matches('.*\\.pdf$')
               && ot.matches('\\d{5}(?:\\.\\d{2})?');
}
```

---

### Fase 2: Seguridad Media (Después de Fase 1)

#### 2.1 Configurar Restricciones de API Keys
**Tiempo estimado**: 1 día

**Tareas**:
- [ ] Configurar restricciones de dominio en Firebase Console
- [ ] Configurar restricciones de IP si es necesario
- [ ] Configurar cuotas y límites de uso
- [ ] Documentar configuración

---

#### 2.2 Implementar Rate Limiting
**Tiempo estimado**: 2 días

**Tareas**:
- [ ] Implementar throttling más agresivo en autosave
- [ ] Limitar número de operaciones por usuario
- [ ] Implementar rate limiting en Firebase Functions (si se usa)
- [ ] Agregar indicadores visuales de límites

---

#### 2.3 Mejorar Manejo de Errores
**Tiempo estimado**: 1 día

**Tareas**:
- [ ] Crear sistema de códigos de error genéricos
- [ ] Sanitizar mensajes de error para usuarios
- [ ] Ocultar stack traces en producción
- [ ] Implementar logging seguro

---

### Fase 3: Mejoras Adicionales (Opcional)

#### 3.1 Validación de Tamaño de Archivos
**Tiempo estimado**: 0.5 días

**Tareas**:
- [ ] Validar tamaño antes de generar PDF
- [ ] Mostrar advertencias si el PDF será grande
- [ ] Optimizar generación de PDF para archivos grandes

---

#### 3.2 Reemplazar innerHTML
**Tiempo estimado**: 0.5 días

**Tareas**:
- [ ] Revisar uso de `innerHTML`
- [ ] Reemplazar por métodos seguros cuando sea posible
- [ ] Sanitizar contenido si es necesario usar `innerHTML`

---

## 🛠️ Herramientas y Librerías Recomendadas

### Validación y Sanitización
- **DOMPurify**: Sanitización de HTML/strings
- **Zod**: Validación de esquemas TypeScript
- **validator.js**: Validación de formatos (email, URL, etc.)

### Autenticación
- **Firebase Authentication**: Ya disponible, solo necesita configuración
- **Firebase Admin SDK**: Para validación de tokens en backend (si se necesita)

### Logging
- **winston** o **pino**: Logging estructurado (si se necesita backend)
- Sistema de logging condicional propio (más simple para frontend)

### Rate Limiting
- **Firebase Functions**: Para rate limiting en backend
- Throttling/debounce en cliente

---

## 📊 Priorización de Implementación

### 🔴 Crítico (Antes de Producción)
1. ✅ Autenticación Firebase
2. ✅ Eliminar logs sensibles
3. ✅ Validación y sanitización
4. ✅ Proteger Storage

### 🟡 Importante (Primer Mes)
5. ⚠️ Restricciones de API Keys
6. ⚠️ Rate Limiting
7. ⚠️ Mejorar manejo de errores

### 🟢 Mejoras (Opcional)
8. ⚠️ Validación de tamaño de archivos
9. ⚠️ Reemplazar innerHTML

---

## 🔐 Mejores Prácticas Recomendadas

### 1. **Principio de Menor Privilegio**
- Usuarios solo deben tener acceso a lo que necesitan
- Roles específicos para cada tipo de usuario
- Restricciones granulares en Firestore rules

### 2. **Defensa en Profundidad**
- Validación en cliente (UX)
- Validación en servidor (seguridad)
- Validación en reglas de Firestore (última línea de defensa)

### 3. **No Confiar en el Cliente**
- Toda validación crítica debe estar en Firestore rules
- El cliente puede ser manipulado
- Las reglas de seguridad son la única verdad

### 4. **Minimizar Exposición de Información**
- No loguear datos sensibles
- Mensajes de error genéricos para usuarios
- No exponer estructura interna del sistema

### 5. **Monitoreo y Auditoría**
- Logs de acceso (quién accedió a qué)
- Alertas de actividad sospechosa
- Revisión periódica de logs

---

## 📝 Checklist de Seguridad Pre-Producción

### Autenticación y Autorización
- [ ] Firebase Authentication implementado
- [ ] Roles de usuario definidos e implementados
- [ ] Reglas de Firestore requieren autenticación
- [ ] Reglas de Storage requieren autenticación
- [ ] Control de acceso basado en roles funcionando

### Validación y Sanitización
- [ ] Todos los inputs validados en cliente
- [ ] Todos los inputs sanitizados antes de guardar
- [ ] Validación de tipos de datos
- [ ] Validación de tamaños máximos
- [ ] Validación de formatos (email, fecha, OT)

### Protección de Datos
- [ ] Logs sensibles eliminados en producción
- [ ] Mensajes de error sanitizados
- [ ] Stack traces ocultos en producción
- [ ] Variables de entorno protegidas

### Configuración
- [ ] API keys con restricciones de dominio/IP
- [ ] Cuotas y límites configurados
- [ ] Rate limiting implementado
- [ ] Storage protegido con autenticación

### Testing
- [ ] Tests de seguridad realizados
- [ ] Penetration testing básico
- [ ] Revisión de código de seguridad
- [ ] Verificación de reglas de Firestore

---

## 🚨 Consideraciones Especiales

### Desarrollo vs Producción
- **Desarrollo**: Puede tener reglas más permisivas para facilitar desarrollo
- **Producción**: Debe tener todas las medidas de seguridad implementadas
- Usar variables de entorno para controlar comportamiento

### Migración de Datos Existentes
- Si hay datos existentes sin autenticación, planificar migración
- Asignar ownership de documentos existentes
- Crear usuarios para datos existentes si es necesario

### Compatibilidad con Sistema Modular
- El sistema modular comparte la misma base de datos
- Coordinar cambios de seguridad con el equipo del sistema modular
- Asegurar que las reglas de seguridad no rompan funcionalidad existente

---

## 📚 Referencias y Recursos

### Documentación Firebase
- [Firebase Security Rules](https://firebase.google.com/docs/rules)
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Firebase Storage Security](https://firebase.google.com/docs/storage/security)

### Mejores Prácticas
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Firebase Security Best Practices](https://firebase.google.com/docs/database/security)

---

**Última actualización**: 2026-01-27  
**Próxima revisión**: Después de implementar Fase 1
