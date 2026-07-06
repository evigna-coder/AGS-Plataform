# Evaluación de seguridad de accesos — AGS Plataforma

**Fecha:** 2026-06-29
**Motivo:** Inquietud de dirección sobre la seguridad de ingreso al sistema. Escenarios planteados: (1) olvidar el mail / sesión abierta en una PC, (2) pérdida o robo de un celular. Hoy el control principal es la cuenta de Google.

---

## 1. Resumen para dirección

El acceso **no depende solo de "el mail de Google"** en el sentido débil. Hoy hay dos capas reales que ya funcionan:

1. **Solo cuentas del dominio `@agsanalitica.com`** pueden leer o escribir datos, y esto está validado **del lado del servidor** (no solo en el navegador). Una cuenta de Google ajena no accede a los datos aunque se intente forzar la app.
2. **Todo está cerrado por defecto** y los clientes externos solo ven lo suyo. Lo que no está explícitamente habilitado, queda bloqueado.

**El punto débil que detecta correctamente la dirección es otro:** la sesión, una vez abierta, **es persistente, indefinida y no se puede cortar a distancia**. Los dos escenarios (PC abierta / celular perdido) son la misma falla vista de dos formas. Hay un plan concreto y económico para cerrarla, dividido en lo que se configura hoy mismo y lo que requiere desarrollo.

---

## 2. Lo que ya está sólido

| Control | Estado |
|---|---|
| Restricción a dominio `@agsanalitica.com` validada en el servidor | ✅ Activo (reglas de Firestore) |
| Acceso "denegado por defecto" — colecciones no listadas quedan cerradas | ✅ Activo |
| Aislamiento por cliente (un cliente externo no ve datos de otro) | ✅ Activo |
| Login con cuenta corporativa de Google (no contraseñas propias que mantener) | ✅ Activo |

---

## 3. Brechas detectadas (lo que preocupa a dirección)

Los escenarios "PC con mail abierto" y "celular perdido" apuntan al mismo problema: **la sesión vive en el dispositivo de forma indefinida y no hay forma de revocarla remotamente.**

| # | Brecha | Impacto en los escenarios planteados |
|---|---|---|
| 1 | **No hay cierre por inactividad** | La sesión queda viva hasta que alguien cierre manualmente. PC olvidada = cualquiera entra. |
| 2 | **No existe "cerrar sesión en todos los dispositivos"** | Si se pierde el celular, no hay forma de echar esa sesión a distancia. |
| 3 | **Deshabilitar un usuario NO lo expulsa** | Hoy, marcar a alguien como deshabilitado en el sistema **no corta su sesión actual** hasta el próximo re-login. Para un robo de equipo, es justo lo que no se quiere. |
| 4 | **Segundo factor (biometría/huella) está construido pero apagado** | Hay infraestructura WebAuthn en la app de campo, marcada "deshabilitado por ahora". |
| 5 | **No hay 2FA obligatorio en las cuentas de Google** | La única barrera de login nuevo es la contraseña de Google + el dominio. |

**Aclaración técnica importante (para no vender humo):** configurar 2FA o duración de sesión en **Google Workspace** protege el *login nuevo* (contraseña robada, phishing), pero **no corta una sesión ya abierta de la app** — esa la administra Firebase y vive en el dispositivo. Por eso los controles que de verdad resuelven los escenarios del director son **los de la aplicación** (puntos 1, 2 y 3), no solo la consola de Google.

---

## 4. Plan de acción recomendado

### Nivel 0 — Configuración de Google Workspace (hoy, sin desarrollo)
- **Forzar verificación en 2 pasos (2FA)** a todas las cuentas `@agsanalitica.com`. Es el cambio de mayor impacto y menor costo contra contraseñas robadas.
- Conocer y tener a mano el botón **"Cerrar sesión del usuario"** de la consola de Workspace: es el primer recurso ante un dispositivo perdido (revoca el acceso de Google de esa persona).

### Nivel 1 — Desarrollo de alto impacto (primera fase recomendada)
1. **Auto-logout por inactividad** (ej. 30–60 min sin uso → cierra sesión). Resuelve directo el "mail abierto en la PC". Se aplica en las tres apps.
2. **Expulsión inmediata al deshabilitar un usuario.** Que deshabilitar (o cambiar de rol) corte la sesión en minutos en todos los dispositivos de esa persona, sin esperar al re-login. Es el **botón de pánico** para "perdí el celular": se deshabilita a la persona y queda afuera.

### Nivel 2 — Segundo factor real (segunda fase)
3. **Reactivar WebAuthn** (huella / PIN / llave de seguridad) como segundo factor, al menos en el back-office de escritorio. Ya existe base construida; falta terminarla y conectarla.

### Higiene (rápido, en paralelo)
- Limpiar un archivo de reglas de almacenamiento de la app de campo que quedó en modo desarrollo (`allow read, write: if true`). **No está desplegado hoy**, así que no hay exposición actual, pero conviene removerlo para que nadie lo despliegue por error.

---

## 5. Recomendación de arranque

Cubre ~80% de la preocupación con esfuerzo acotado:

1. **2FA en Google Workspace** → lo configura dirección/IT, hoy.
2. **Auto-logout por inactividad** → desarrollo, primera fase.
3. **Expulsión al deshabilitar usuario** → desarrollo, primera fase.

WebAuthn (segundo factor biométrico) queda como segunda fase una vez validado lo anterior.

---

*Documento de evaluación. La implementación no se inició aún — pendiente de decisión de dirección sobre el alcance.*
