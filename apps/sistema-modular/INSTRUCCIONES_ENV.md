# 📝 Instrucciones para Completar .env.local

## ✅ Archivo Creado

He creado el archivo `.env.local` en `apps/sistema-modular/`. 

## 🔧 Pasos para Completarlo

### 1. Obtener Credenciales de Firebase

1. Abre tu navegador y ve a: **https://console.firebase.google.com/**
2. Selecciona tu proyecto (el mismo que usas para reportes-ot)
3. Haz clic en el icono de **configuración (⚙️)** → **Configuración del proyecto**
4. Baja hasta la sección **"Tus aplicaciones"**
5. Si ya tienes una app web, haz clic en ella
6. Si no, crea una nueva app web (icono `</>`)
7. Verás un objeto `firebaseConfig` con las credenciales

### 2. Completar el Archivo

Abre el archivo `apps/sistema-modular/.env.local` y completa cada línea con los valores correspondientes:

```env
VITE_FIREBASE_API_KEY=AIzaSy...          # apiKey
VITE_FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com  # authDomain
VITE_FIREBASE_PROJECT_ID=tu-proyecto-id  # projectId
VITE_FIREBASE_STORAGE_BUCKET=xxx.appspot.com   # storageBucket
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789    # messagingSenderId
VITE_FIREBASE_APP_ID=1:123:web:abc123    # appId
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXX     # measurementId (opcional)
```

### 3. Ejemplo Real

```env
VITE_FIREBASE_API_KEY=AIzaSyC1234567890abcdefghijklmnopqrstuvwxyz
VITE_FIREBASE_AUTH_DOMAIN=ags-analitica.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=ags-analitica
VITE_FIREBASE_STORAGE_BUCKET=ags-analitica.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
VITE_FIREBASE_MEASUREMENT_ID=G-ABCDEFGHIJ
```

### 4. Verificar

Después de completar el archivo:

1. **Guarda el archivo** (Ctrl+S)
2. **Reinicia el servidor**:
   ```bash
   # Detén el servidor actual (Ctrl+C)
   pnpm dev:modular
   ```
3. **Abre la consola** del navegador/Electron (F12)
4. Deberías ver:
   - ✅ `Variables de entorno de Firebase cargadas correctamente`
   - ✅ `Firebase inicializado correctamente`

### 5. Probar

1. Abre la aplicación
2. Ve a la sección "Leads"
3. Haz clic en "Nuevo Lead"
4. Completa el formulario y guarda
5. Verifica en Firebase Console → Firestore que el lead se haya creado

## ⚠️ Importante

- **NO subas el archivo `.env.local` al repositorio** (ya está en `.gitignore`)
- **No compartas tus credenciales** públicamente
- **Usa el mismo proyecto de Firebase** que reportes-ot para compartir datos

## 🐛 Si hay problemas

1. Verifica que no haya espacios extra en los valores
2. Verifica que todas las líneas tengan el formato correcto
3. Reinicia el servidor después de editar el archivo
4. Revisa la consola por errores específicos
