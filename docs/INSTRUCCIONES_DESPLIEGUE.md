# Instrucciones para Desplegar Reglas de Firebase

## Pasos para Desplegar

### 1. Autenticarse en Firebase

Abre PowerShell en el directorio del proyecto y ejecuta:

```powershell
firebase login
```

Esto abrirá tu navegador para que inicies sesión con tu cuenta de Google asociada a Firebase.

### 2. Configurar el Proyecto

Una vez autenticado, configura el proyecto de Firebase:

```powershell
firebase use --add
```

Cuando se solicite:
- Selecciona tu proyecto de la lista, o
- Ingresa tu **Project ID** manualmente

**Nota**: Puedes encontrar tu Project ID en el archivo `.env.local` como `VITE_FIREBASE_PROJECT_ID`

### 3. Desplegar las Reglas

Una vez configurado el proyecto, despliega las reglas:

```powershell
firebase deploy --only firestore:rules,storage:rules
```

O si prefieres desplegar por separado:

```powershell
# Solo Firestore
firebase deploy --only firestore:rules

# Solo Storage
firebase deploy --only storage:rules
```

### 4. Verificar el Despliegue

Después del despliegue, verifica en la consola de Firebase:
- Ve a [Firebase Console](https://console.firebase.google.com/)
- Selecciona tu proyecto
- Ve a **Firestore Database** → **Reglas** para verificar las reglas de Firestore
- Ve a **Storage** → **Reglas** para verificar las reglas de Storage

## Alternativa: Usar el Script Automatizado

También puedes usar el script `deploy-rules.ps1`:

```powershell
.\deploy-rules.ps1
```

El script verificará automáticamente:
- ✅ Si Firebase CLI está instalado
- ✅ Si estás autenticado
- ✅ Si el proyecto está configurado
- ✅ Si los archivos de reglas existen
- ✅ Desplegará las reglas

## Solución de Problemas

### Error: "Failed to authenticate"
- Ejecuta `firebase login` nuevamente
- Asegúrate de usar la cuenta correcta de Google

### Error: "No currently active project"
- Ejecuta `firebase use --add` para configurar el proyecto
- O especifica el proyecto: `firebase deploy --project TU_PROJECT_ID --only firestore:rules,storage:rules`

### Error: "firestore.rules not found"
- Asegúrate de estar en el directorio raíz del proyecto
- Verifica que los archivos `firestore.rules` y `storage.rules` existan

### Error de sintaxis en las reglas
- Firebase validará la sintaxis antes de desplegar
- Revisa los mensajes de error para identificar el problema
- Puedes probar las reglas localmente con Firebase Emulator

## Archivos Creados

Los siguientes archivos han sido creados y están listos para desplegar:

- ✅ `firestore.rules` - Reglas de seguridad para Firestore
- ✅ `storage.rules` - Reglas de seguridad para Storage
- ✅ `firebase.json` - Configuración de Firebase
- ✅ `SECURITY.md` - Documentación de seguridad

## Próximos Pasos

Después de desplegar las reglas:

1. **Probar la aplicación** - Verifica que todo funcione correctamente
2. **Probar la firma móvil** - Asegúrate de que la firma anónima siga funcionando
3. **Monitorear logs** - Revisa los logs de Firebase para detectar errores de permisos
4. **Planificar migración** - Cuando implementes autenticación, actualiza las reglas según `SECURITY.md`
