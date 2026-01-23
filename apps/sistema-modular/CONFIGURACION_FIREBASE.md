# 🔥 Configuración de Firebase - Sistema Modular

## 📋 Pasos para Configurar

### 1. Obtener Credenciales de Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto (o crea uno nuevo)
3. Ve a **Configuración del proyecto** (⚙️)
4. En la sección "Tus aplicaciones", selecciona la app web o crea una nueva
5. Copia las credenciales que aparecen en el objeto `firebaseConfig`

### 2. Crear Archivo de Variables de Entorno

Crea un archivo `.env.local` en `apps/sistema-modular/` con el siguiente formato:

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu-proyecto-id
VITE_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

**Importante:**
- El archivo `.env.local` está en `.gitignore` (no se sube al repositorio)
- Usa el mismo proyecto de Firebase que reportes-ot para compartir datos
- O crea un proyecto nuevo si prefieres separar los datos

### 3. Configurar Reglas de Firestore

Agrega las siguientes reglas en Firebase Console → Firestore Database → Reglas:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Reglas para Leads
    match /leads/{leadId} {
      allow read, write: if request.auth != null;
      // O si no usas autenticación aún:
      // allow read, write: if true; // ⚠️ Solo para desarrollo
    }
    
    // Reglas para Presupuestos (futuro)
    match /quotes/{quoteId} {
      allow read, write: if request.auth != null;
    }
    
    // Reglas para Stock (futuro)
    match /inventory/{itemId} {
      allow read, write: if request.auth != null;
    }
    
    // Reglas para Agenda (futuro)
    match /appointments/{appointmentId} {
      allow read, write: if request.auth != null;
    }
    
    // Reglas para Facturación (futuro)
    match /invoices/{invoiceId} {
      allow read, write: if request.auth != null;
    }
    
    // Reglas existentes para reportes OT
    match /reports/{reportId} {
      allow read, write: if true; // Mantener como está
    }
  }
}
```

### 4. Crear Colección en Firestore

1. Ve a Firebase Console → Firestore Database
2. Haz clic en "Comenzar" si es la primera vez
3. Selecciona modo de producción (o prueba para desarrollo)
4. La colección `leads` se creará automáticamente cuando agregues el primer lead

### 5. Verificar Configuración

Después de crear `.env.local`:

1. Reinicia el servidor de desarrollo:
   ```bash
   # Detén el servidor actual (Ctrl+C)
   # Luego reinicia:
   pnpm dev:modular
   ```

2. Abre la consola del navegador/Electron
3. Deberías ver: `✅ Variables de entorno de Firebase cargadas correctamente`
4. Deberías ver: `✅ Firebase inicializado correctamente`

### 6. Probar la Conexión

1. Abre la aplicación
2. Ve a la sección "Leads"
3. Haz clic en "Nuevo Lead"
4. Completa el formulario y guarda
5. Verifica en Firebase Console que el lead se haya creado en la colección `leads`

## 🔒 Seguridad

### Desarrollo
- Puedes usar reglas permisivas temporalmente: `allow read, write: if true;`
- ⚠️ **NO uses esto en producción**

### Producción
- Implementa autenticación con Firebase Auth
- Usa reglas basadas en roles (admin, técnico, etc.)
- Limita acceso según el usuario autenticado

## 🐛 Troubleshooting

### Error: "Variables de entorno faltantes"
- Verifica que el archivo se llame exactamente `.env.local`
- Verifica que esté en `apps/sistema-modular/`
- Reinicia el servidor después de crear/editar el archivo

### Error: "Firebase not initialized"
- Revisa que todas las variables estén correctas
- Verifica que no haya espacios extra en los valores
- Revisa la consola por errores específicos

### Error: "Permission denied"
- Revisa las reglas de Firestore
- Verifica que la colección `leads` tenga permisos de lectura/escritura
- Si usas autenticación, asegúrate de estar logueado

### La app funciona pero no guarda datos
- Abre DevTools (F12) y revisa la consola
- Verifica que Firebase esté inicializado correctamente
- Revisa la pestaña Network para ver si hay errores de red

## 📚 Recursos

- [Firebase Console](https://console.firebase.google.com/)
- [Documentación Firestore](https://firebase.google.com/docs/firestore)
- [Reglas de Seguridad](https://firebase.google.com/docs/firestore/security/get-started)
