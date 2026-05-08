# Release checklist — sistema-modular

Pasada de validación antes de cortar `pnpm release:patch/minor/major` y pushear tag.
Tiempo estimado: **5-10 min**. La idea es interceptar los issues comunes que ya nos mordieron en producción, no agotar todos los caminos.

> **Cuándo correrlo:** después de hacer cambios runtime y antes del push del tag. Si cualquier ítem falla, fix antes de cortar release — los users no pueden rollbackear fácil.

## Setup del test

- [ ] Build local: `cd apps/sistema-modular && pnpm build`
- [ ] Reinstalar el `.exe` de `release/` overwriteando la versión actual
- [ ] Cerrar la app si quedó abierta y reabrirla desde el shortcut

## 1. Auth & arranque (regresiones de v1.1.x)

- [ ] La app abre sin cerrarse sola post-instalación
- [ ] Login con Google funciona end-to-end (OAuth popup → cierra solo → entra al sistema)
- [ ] No aparece el flash de *"Cuenta pendiente de aprobación"* después del login
- [ ] No aparece error de *"client is offline"* en console al cargar el perfil

## 2. Sidebar y RBAC

- [ ] Como **admin**, ves el grupo **Admin** completo + todos los módulos
- [ ] Como **admin_soporte / ingeniero / ventas / etc.**, NO ves el grupo **Admin** en el sidebar
- [ ] Si destildaste un módulo en `/usuarios/{id}` para un user, ese user al re-loguear no lo ve

## 3. CRUD principales (sin errores Firestore)

Para cada uno: crear, editar, guardar.

- [ ] **Cliente** — crear, editar (debería NO romper aunque tenga campos vacíos como `convenioMultilateral`)
- [ ] **OT** — crear, cambio de estado (audit emite `ot.estado_cambiado`)
- [ ] **Presupuesto** — crear, enviar (audit emite `presupuesto.enviado`)
- [ ] **Ticket** — crear, derivar (audit emite `ticket.derivado`)
- [ ] **Stock — Movimiento** — crear (audit emite `stock.movimiento_creado` con código artículo)

## 4. Sort en columnas (regresión TDZ)

Los siguientes no deben tirar `Cannot access 'X' before initialization`:

- [ ] Tickets — click en cada header (Cliente, Contacto, Motivo, Prioridad, Estado, Área, **Usuario**, Fecha)
- [ ] QF Documentos — click en cada header (Número, Nombre, Estado, Última revisión, Actualizado, Usuario)
- [ ] Biblioteca de Tablas — click en cada header

## 5. Generación de PDFs (regresión CSP wasm)

- [ ] PDF de listado de **Instrumentos** descarga con nombre `Listado de instrumentos - dd-mm-yyyy.pdf`
- [ ] PDF de **OT** se genera si aplica (testear si la versión toca el flujo)
- [ ] PDF de **Presupuesto** se genera (cualquier tipo: ventas, contrato)
- [ ] **Remito** abre en pestaña nueva para imprimir (flujo distinto, no descarga)

## 6. Auditoría

- [ ] Página `/admin/auditoria` carga sin error
- [ ] Filtros funcionan (acción, usuario, módulo, fecha)
- [ ] Click en fila expande con JSON detallado
- [ ] Sentencias se leen humanas (ej: "Esteban modificó cliente Pepito SA (razón social, teléfono)")

## 7. Documentos QF — flow completo

- [ ] Crear QF nuevo (con y sin checkbox de fecha de alta personalizada)
- [ ] Editar QF existente: cambiar fecha de alta funciona
- [ ] Nueva versión de QF funciona y aparece en historial
- [ ] Columna "Última revisión" en lista muestra el último cambio

## 8. Build y CI (antes de pushear el tag)

- [ ] `npx tsc --noEmit` desde `apps/sistema-modular/` → no hay errores nuevos respecto al baseline
- [ ] `pnpm build` salió OK localmente (no rompe vite ni electron-builder)
- [ ] Si tocaste `electron/main.cjs`: la app abre, no hay errores rojos en console del main process

## Después de pushear el tag

- [ ] GH Action verde en https://github.com/evigna-coder/AGS-Plataform/actions
- [ ] Release publicado en https://github.com/evigna-coder/AGS-Plataform/releases con `.exe` + `latest.yml`
- [ ] (Idealmente) descargar el `.exe` del release y probar instalación en una PC limpia — login + un par de operaciones

## Si algo falla post-release

1. **No** dropear el tag de inmediato — los users que ya recibieron el update se confunden si desaparece
2. Cortar `release:patch` con el fix → eso supera al release roto
3. Si fue grave (data corruption, no se puede usar la app), avisar a los users por WhatsApp/mail antes que reciban el auto-update

## Pitfalls que ya nos mordieron

Solo para referencia rápida — no repetir si seguís las reglas:

- ❌ Sort callbacks que referencian funciones declaradas más abajo en la misma función → **TDZ**. Subir las funciones helper arriba del primer `useMemo` que las use.
- ❌ Audit log que escribe campos `undefined` → Firestore rechaza. Usar `auditUpdate` (ya tiene `nullifyUndefined` interno) o limpiar antes.
- ❌ Bundle CI sin API keys → "client is offline" / "auth/invalid-api-key". El workflow ya escribe `.env.local` desde secrets — no romper eso.
- ❌ CSP estricta bloquea wasm/eval → PDF/charts fallan. La CSP ahora es laxa unificada dev=prod, mantenerla así.
- ❌ Editar `permisos` en `usuariosService.upsertOnLogin` no se reflejaba → ahora se incluye `permisos` en el return. Si cambia el shape de UsuarioAGS, asegurate que upsertOnLogin lo siga incluyendo.
