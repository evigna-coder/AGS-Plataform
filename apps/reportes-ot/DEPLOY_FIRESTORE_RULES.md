# Desplegar Reglas de Firestore

Las reglas de Firestore están en `apps/reportes-ot/firestore.rules` pero necesitan ser desplegadas a Firebase para que funcionen.

## Opción 1: Desde la Consola de Firebase (Más Rápido)

1. Abre la [Consola de Firebase](https://console.firebase.google.com/)
2. Selecciona tu proyecto
3. Ve a **Firestore Database** → **Reglas**
4. Copia el contenido de `apps/reportes-ot/firestore.rules`
5. Pega en el editor de reglas
6. Haz clic en **Publicar**

## Opción 2: Usando Firebase CLI

Si tienes Firebase CLI instalado:

```bash
# Desde la raíz del proyecto
cd apps/reportes-ot
firebase deploy --only firestore:rules
```

Si no tienes Firebase CLI instalado:

```bash
# Instalar Firebase CLI globalmente
npm install -g firebase-tools

# Login
firebase login

# Inicializar (si no está inicializado)
cd apps/reportes-ot
firebase init firestore

# Desplegar reglas
firebase deploy --only firestore:rules
```

## Verificar que las reglas están activas

Después de desplegar, verifica en la consola de Firebase que las reglas se actualizaron correctamente. Deberías ver las reglas para:
- `reportes/{ot}`
- `clientes/{clienteId}` y `clientes/{clienteId}/contactos/{contactoId}`
- `categorias_equipo/{categoriaId}`
- `categorias_modulo/{categoriaId}`
- `sistemas/{sistemaId}` y `sistemas/{sistemaId}/modulos/{moduloId}`
- `leads/{leadId}`
- `presupuestos/{presupuestoId}` (nuevo)
- `ordenes_compra/{ocId}` (nuevo)
- `categorias_presupuesto/{categoriaId}` (nuevo)
- `condiciones_pago/{condicionId}` (nuevo)
- `tipos_servicio/{tipoId}`

## Nota

Las reglas actuales permiten acceso completo (`allow read, write: if true`) para desarrollo. En producción, deberás implementar autenticación y restricciones apropiadas.
