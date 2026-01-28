# Solución: Error de Permisos de Firestore

## 🔴 Error

```
FirebaseError: Missing or insufficient permissions.
Código: permission-denied
```

Este error ocurre cuando intentas guardar un reporte con `status: 'FINALIZADO'` porque las reglas de Firestore no están desplegadas o no permiten la operación.

---

## ✅ Solución

### Opción 1: Desplegar Reglas desde la Consola de Firebase (MÁS RÁPIDO)

1. **Abre la Consola de Firebase**
   - Ve a: https://console.firebase.google.com/
   - Selecciona tu proyecto

2. **Navega a Firestore Database**
   - En el menú lateral, haz clic en **Firestore Database**
   - Haz clic en la pestaña **Reglas**

3. **Copia las reglas actualizadas**
   - Abre el archivo `apps/reportes-ot/firestore.rules` en tu editor
   - Copia TODO el contenido

4. **Pega en la consola**
   - Pega el contenido en el editor de reglas de Firebase
   - Haz clic en **Publicar**

5. **Verifica**
   - Deberías ver un mensaje de éxito
   - Las reglas deberían estar activas inmediatamente

---

### Opción 2: Desplegar Reglas con Firebase CLI

#### Paso 1: Instalar Firebase CLI (si no lo tienes)

```powershell
npm install -g firebase-tools
```

#### Paso 2: Login en Firebase

```powershell
firebase login
```

Esto abrirá tu navegador para autenticarte.

#### Paso 3: Navegar al directorio

```powershell
cd "apps\reportes-ot"
```

#### Paso 4: Desplegar reglas

```powershell
firebase deploy --only firestore:rules
```

O usa el script automatizado:

```powershell
.\deploy-rules.ps1
```

---

## 🔍 Verificar que las Reglas Están Activas

### Método 1: Consola de Firebase

1. Ve a **Firestore Database** → **Reglas**
2. Verifica que las reglas mostradas coinciden con `firestore.rules`
3. Deberías ver la regla para `reportes/{ot}` con `allow update`

### Método 2: Probar en la Aplicación

1. Recarga la aplicación en el navegador
2. Intenta guardar un reporte con `status: 'FINALIZADO'`
3. Si funciona, las reglas están correctas

---

## 📝 Cambios Realizados en las Reglas

He actualizado las reglas para permitir actualizar documentos cuando se cambia a `FINALIZADO`. El cambio principal es:

**Caso 5 agregado**: Permite actualizar todos los campos cuando se cambia a `FINALIZADO`, validando que los datos sean correctos.

```javascript
// Caso 5: Permitir actualización completa cuando se finaliza
(
  ('status' in request.resource.data && request.resource.data.status == 'FINALIZADO')
  && isValidReportData()
)
```

Esto permite que cuando se finaliza un reporte, se puedan actualizar todos los campos necesarios (firmas, datos, etc.) en una sola operación.

---

## ⚠️ Si el Error Persiste

### 1. Verifica que las reglas se desplegaron

- Revisa la consola de Firebase
- Verifica que no hay errores de sintaxis en las reglas

### 2. Verifica el formato de la OT

Las reglas requieren que la OT tenga formato válido: `\d{5}(?:\.\d{2})?`
- Ejemplo válido: `30000` o `30000.02`
- Ejemplo inválido: `3000` o `30000.2`

### 3. Verifica que el documento existe

Si el documento no existe, Firebase lo trata como `create`, no `update`. Asegúrate de que:
- El documento se creó previamente (con autosave)
- O que la regla de `create` permite crear con `FINALIZADO`

### 4. Revisa la consola del navegador

- Abre las herramientas de desarrollador (F12)
- Ve a la pestaña **Console**
- Busca errores adicionales de Firebase

### 5. Verifica las credenciales

- Asegúrate de que las variables de entorno están correctas
- Verifica que el proyecto Firebase está activo
- Revisa que las credenciales no hayan expirado

---

## 🧪 Probar la Solución

Después de desplegar las reglas:

1. **Recarga la aplicación** en el navegador
2. **Crea o carga una OT**
3. **Llena el formulario completo**
4. **Agrega ambas firmas** (especialista y cliente)
5. **Haz clic en "Finalizar y Descargar PDF"**
6. **Verifica que no hay errores** en la consola
7. **Confirma que el PDF se genera** correctamente

---

## 📚 Referencias

- [Documentación de Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Guía de Despliegue de Reglas](https://firebase.google.com/docs/firestore/security/deploy-rules)
- Archivo de reglas: `apps/reportes-ot/firestore.rules`
- Script de despliegue: `apps/reportes-ot/deploy-rules.ps1`

---

**Última actualización**: 2026-01-27
