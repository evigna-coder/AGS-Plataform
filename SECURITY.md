# Documentación de Seguridad Firebase

## Resumen

Este documento describe las reglas de seguridad implementadas para Firebase Firestore y Storage, la política MFA (app Reportes OT) y el plan de migración para el resto de colecciones.

## Estado Actual

- **Autenticación (Reportes OT)**: ✅ Google Sign-In + segundo factor WebAuthn (plataforma: Face/patrón/huella). Solo dominio @agsanalitica.com.
- **Reglas Firestore**: Validaciones básicas de estructura y campos; colección MFA accesible solo desde Cloud Functions.
- **Reglas Storage**: Bloqueo de lectura pública, validación de tipo/tamaño para escritura

## Reglas de Firestore

### Ubicación
Archivo: `firestore.rules`

### Características Implementadas

1. **Validación de formato de OT**
   - Formato: `\d{5}(?:\.\d{2})?` (5 dígitos + opcional .NN)
   - Ejemplos válidos: "25660", "25660.02"

2. **Validación de campos requeridos y tipos**
   - `otNumber` (string, requerido)
   - `status` (string, valores: 'BORRADOR' | 'FINALIZADO')
   - Validación de tipos para todos los campos según estructura definida

3. **Restricciones de actualización**
   - `status` solo puede cambiar de 'BORRADOR' → 'FINALIZADO'
   - Reportes con `status == 'FINALIZADO'` no pueden modificarse (excepto firma)

4. **Firma móvil anónima**
   - Permite `updateSignature` sin autenticación
   - Solo puede actualizar: `signatureClient`, `signedAt`, `signedFrom`
   - No puede modificar otros campos

5. **Validaciones de estructura**
   - Arrays (`budgets`, `articulos`) deben tener estructura válida
   - Límites de tamaño para strings (firmas, reporte técnico)

### Modo Temporal (Sin Autenticación)

Las reglas actuales funcionan sin autenticación, permitiendo:
- Lectura/escritura de reportes con validaciones de estructura
- Actualización de firmas desde móvil (anónimo)
- Autosave solo en reportes con `status == 'BORRADOR'`

## Reglas de Storage

### Ubicación
Archivo: `storage.rules`

### Características Implementadas

1. **Bloqueo de lectura pública**
   - `allow read: if false` - Bloquea acceso público a PDFs
   - En el futuro, se activará con autenticación

2. **Validación de escritura**
   - Solo permite archivos PDF (`application/pdf`)
   - Tamaño máximo: 10MB
   - Ruta válida: `reports/{ot}/{filename}`
   - Validación de formato OT en la ruta

3. **Estructura de rutas**
   - Formato: `reports/{ot}/{filename}`
   - Ejemplo: `reports/25660/reporte_25660.pdf`

## Plan de Migración Futura

### Fase 1: Implementar Firebase Authentication

1. Configurar Firebase Authentication en la consola
2. Elegir proveedores de autenticación (Email/Password, Google, etc.)
3. Implementar login en la aplicación

### Fase 2: Actualizar Reglas Firestore

1. Descomentar secciones marcadas con `// En el futuro, cuando se implemente autenticación`
2. Agregar validaciones basadas en `request.auth`
3. Implementar custom claims para roles:
   - `technician`: Puede crear/editar reportes
   - `admin`: Acceso completo
   - `client`: Solo lectura de sus reportes

**Ejemplo de reglas futuras**:
```javascript
// Permitir lectura si está autenticado
allow read: if request.auth != null;

// Permitir escritura solo a técnicos y admins
allow write: if request.auth != null 
             && (request.auth.token.role == 'technician' 
                 || request.auth.token.role == 'admin');
```

### Fase 3: Actualizar Reglas Storage

1. Descomentar secciones de autenticación en `storage.rules`
2. Permitir lectura solo a usuarios autenticados
3. Restringir escritura a roles específicos

**Ejemplo de reglas futuras**:
```javascript
allow read: if request.auth != null;
allow write: if request.auth != null 
             && (request.auth.token.role == 'technician' 
                 || request.auth.token.role == 'admin');
```

### Fase 4: Cloud Functions para Custom Claims

1. Crear Cloud Function que asigne roles automáticamente
2. Implementar lógica de asignación de roles según usuario
3. Actualizar custom claims cuando cambien los permisos

### Fase 5: Auditoría y Monitoreo

1. Implementar Cloud Function que escuche cambios en `reportes`
2. Registrar auditoría de cambios (quién, cuándo, qué cambió)
3. Configurar alertas para actividades sospechosas

### Fase 6: Campos Adicionales

1. Agregar campo `createdBy` a documentos de reportes
2. Agregar campo `updatedBy` para tracking
3. Agregar campo `createdAt` si no existe

## Despliegue de Reglas

### Comandos de Despliegue

```bash
# Desplegar solo reglas de Firestore
firebase deploy --only firestore:rules

# Desplegar solo reglas de Storage
firebase deploy --only storage:rules

# Desplegar ambas reglas
firebase deploy --only firestore:rules,storage:rules
```

### Verificación Post-Despliegue

1. Verificar en Firebase Console que las reglas se actualizaron
2. Probar lectura/escritura desde la aplicación
3. Verificar que la firma móvil sigue funcionando
4. Monitorear logs de Firebase para errores de permisos

## Testing Local

### Usar Firebase Emulator

```bash
# Instalar Firebase CLI si no está instalado
npm install -g firebase-tools

# Inicializar emuladores
firebase init emulators

# Ejecutar emuladores
firebase emulators:start
```

### Probar Reglas

1. Usar Firebase Emulator Suite para probar reglas localmente
2. Crear tests unitarios para validar reglas
3. Probar casos edge (OTs inválidos, campos faltantes, etc.)

## MFA — Reportes OT (Google + WebAuthn)

La aplicación **Reportes OT** exige:

1. **Factor primario**: inicio de sesión exclusivo con **Google** (Firebase Authentication).
2. **Dominio**: solo se permite acceso con cuentas de correo **@agsanalitica.com**. Cualquier otro dominio recibe 403 y enlace a soporte.
3. **Segundo factor**: si el usuario tiene al menos un dispositivo registrado, debe completar **WebAuthn** (autenticador de plataforma: Face ID, huella dactilar o patrón) en cada inicio de sesión. No se usan SMS, TOTP ni otros factores.

### Enrolamiento (registro de dispositivo)

- El usuario, ya autenticado con Google, entra en **Seguridad** (enlace en la app) y elige **Activar desbloqueo con dispositivo**.
- Opcionalmente indica un nombre para el dispositivo y confirma en el dispositivo (Face/patrón/huella).
- Las credenciales públicas se guardan en Firestore (`mfa/webauthn/users/<uid>/devices`) solo en el backend; el cliente nunca escribe en MFA.

### Pérdida o robo de dispositivo

Si un usuario pierde el dispositivo o sospecha robo, un **administrador** debe revocar las credenciales WebAuthn de ese usuario y cerrar sus sesiones. Pasos detallados en:

- **Runbook**: `apps/reportes-ot/docs/RUNBOOK_MFA.md`

Resumen: el admin llama al endpoint `POST .../webauthn/revoke` con su token (custom claim `role: 'admin'`) y el `targetUid` del usuario; el backend borra los dispositivos MFA y ejecuta `revokeRefreshTokens(uid)`.

### Recomendaciones para Google Workspace (solo documentación)

- Restringir creación de cuentas al dominio corporativo en Google Admin, si aplica.
- No se implementan políticas de Google Admin en este proyecto; solo se documenta la recomendación.

---

## Consideraciones de Seguridad

### Actual (Modo Temporal)

- ⚠️ **Sin autenticación**: Cualquiera con la URL puede acceder
- ✅ **Validaciones de estructura**: Previene datos malformados
- ✅ **Bloqueo de lectura Storage**: PDFs no son accesibles públicamente
- ⚠️ **Firma anónima**: Funcional pero sin control de acceso

### Futuro (Con Autenticación)

- ✅ **Control de acceso**: Solo usuarios autenticados
- ✅ **Roles y permisos**: Control granular por rol
- ✅ **Auditoría**: Tracking de cambios
- ✅ **Storage protegido**: PDFs solo para usuarios autorizados

## Estructura de Datos

### Colección `reportes`

**ID del documento**: Número de OT (string, formato: `\d{5}(?:\.\d{2})?`)

**Campos principales**:
- `otNumber` (string, requerido)
- `status` (string, valores: 'BORRADOR' | 'FINALIZADO')
- `signatureClient` (string | null, base64)
- `signatureEngineer` (string | null, base64)
- `signedAt` (number, timestamp, opcional)
- `signedFrom` (string, opcional)
- Y otros campos según estructura completa del plan

### Storage

**Ruta**: `reports/{ot}/{filename}`
- Solo PDFs
- Tamaño máximo: 10MB
- Tipo MIME: `application/pdf`

## Contacto y Soporte

Para preguntas sobre seguridad o reportar vulnerabilidades, contactar al equipo de desarrollo.

## Changelog

- **2024-XX-XX**: Implementación inicial de reglas de seguridad
- **2024-XX-XX**: Bloqueo de lectura pública en Storage
- **2026-01-27**: MFA Reportes OT (Google Sign-In + WebAuthn plataforma), dominio @agsanalitica.com, runbook pérdida/robo dispositivo
- **Futuro**: Migración a autenticación y roles en resto de colecciones
