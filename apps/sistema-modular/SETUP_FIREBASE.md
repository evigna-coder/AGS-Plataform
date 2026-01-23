# 🔥 Setup Rápido de Firebase

## ⚡ Pasos Rápidos

### 1. Obtener Credenciales

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto (el mismo que usas para reportes-ot)
3. ⚙️ **Configuración del proyecto** → **Tus aplicaciones**
4. Si ya tienes una app web, haz clic en ella
5. Si no, crea una nueva app web (icono `</>`)
6. Copia las credenciales del objeto `firebaseConfig`

### 2. Crear Archivo .env.local

Crea el archivo `apps/sistema-modular/.env.local` con este contenido:

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu-proyecto-id
VITE_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

**Reemplaza los valores** con tus credenciales reales.

### 3. Actualizar Reglas de Firestore

Tienes dos opciones:

#### Opción A: Usar las mismas reglas (recomendado)

Las reglas en `apps/reportes-ot/firestore.rules` ya fueron actualizadas para incluir `leads`. Solo necesitas desplegarlas:

```bash
cd apps/reportes-ot
firebase deploy --only firestore:rules
```

#### Opción B: Reglas separadas

Si prefieres reglas separadas, usa `apps/sistema-modular/firestore.rules` y despliega:

```bash
cd apps/sistema-modular
firebase deploy --only firestore:rules
```

### 4. Reiniciar el Servidor

```bash
# Detén el servidor actual (Ctrl+C)
# Luego reinicia:
pnpm dev:modular
```

### 5. Verificar

1. Abre la aplicación
2. Ve a "Leads"
3. Haz clic en "Nuevo Lead"
4. Completa el formulario y guarda
5. Verifica en Firebase Console → Firestore que el lead se haya creado

## ✅ Checklist

- [ ] Archivo `.env.local` creado con todas las variables
- [ ] Reglas de Firestore actualizadas y desplegadas
- [ ] Servidor reiniciado
- [ ] Aplicación carga sin errores en consola
- [ ] Puedo crear un lead y verlo en Firebase Console

## 🐛 Si algo no funciona

1. **Revisa la consola** del navegador/Electron (F12)
2. **Verifica las variables** - asegúrate de que no haya espacios extra
3. **Revisa las reglas** - deben permitir lectura/escritura en `leads`
4. **Revisa Firebase Console** - que el proyecto esté activo

## 📚 Más Información

Ver `CONFIGURACION_FIREBASE.md` para detalles completos.
