# Audit — Domain Logic Correctness

Scope: business-flow correctness across `presupuestos`, `ot`, `tickets/leads`, `stock`, `equipos`, `agenda`, `contratos`, `facturacion`. Findings only — no code changes.

---

## Presupuestos

### [P0] OTNew puts presupuesto **doc-ID** into `WorkOrder.budgets`, breaks every downstream lookup
**Flow:** Presupuesto → OT (legacy creator)
**File:** `apps/sistema-modular/src/pages/ordenes-trabajo/OTNew.tsx:203`
**What:** `budgets: presupuestoIdFromUrl ? [presupuestoIdFromUrl] : []` — `presupuestoIdFromUrl` is the Firestore document id (random uuid), not the `numero` (`PRE-XXXX.NN`). Every other code path treats `WorkOrder.budgets[]` as containing `numero` strings:
- `useCreateOTForm.ts:223` writes `[form.presupuestoNumero]`
- `presupuestosService.trySyncFinalizacion`:1240 → `(o.budgets || []).includes(pres.numero)`
- `otService.update`:381 → `where('numero', 'in', budgetsForQuery)` to fan out lead sync
- `cerrarAdministrativamente`:521 → `all.find(p => p.numero === num)` to compute `pptosNotificados`
**Why:** OTs created from this page never sync presupuesto state on FINALIZADO, never get included in cierre administrativo's `otsListasParaFacturar`, and `pptosNotificados` ends up empty so the contable's mail body says "(sin presupuesto vinculado)". Silent data divergence — hard to trace.
**Fix:** Resolve `pres.numero` from `presupuestosService.getById(presupuestoIdFromUrl)` before building `otData`, then write `budgets: [pres.numero]`. (`presupuestoOrigenId` field already keeps the id.)

### [P0] `aceptado` transition path makes auto-reservation + auto-requerimientos block dead code
**Flow:** Presupuesto aceptado → reserva stock + requerimientos
**File:** `apps/sistema-modular/src/services/presupuestosService.ts:331-359` vs `:412-478`
**What:** When `data.estado === 'aceptado'` and current is not aceptado, `update()` delegates to `aceptarConRequerimientos()` and **`return`s** at line 357. The block at 412-478 (auto-reserva of unidades + auto-create requerimientos based on `stockMinimo`) only runs in the *fallthrough* path, which by construction never sees `aceptado`. `aceptarConRequerimientos()` only creates requerimientos for items with `itemRequiereImportacion=true`; it never reserves units.
**Why:** Stock is never auto-reserved on accept, so a second presupuesto for the same article can promise the same physical units. Auto-requerimientos for items that simply fall below `stockMinimo` (without import flag) are never generated. Silent — no error path.
**Fix:** Move the reservation + low-stock requerimiento logic into `aceptarConRequerimientos` (post-tx side-effect block), or invoke it explicitly from there. Also fix `clienteNombre: null` at :465 — the `reservar()` parameter is typed `string`.

### [P1] `getNextPresupuestoNumber` / `getNextOCNumber` / `getNextRemitoNumber` / `getNextTicketNumero` / `asignacionesService.getNextNumero` are non-atomic
**Flow:** Document numbering across modules
**File:** `presupuestosService.ts:50`, `:1602`, `stockService.ts:754`, `leadsService.ts:182`, `asignacionesService.ts:6`
**What:** Each scans the whole collection and computes `max+1`. Two creates issued in parallel (e.g., two users hit "Crear" within the same second) get the same number. Only `otService.getNextOtNumber` and `contratosService.getNextContratoNumber` use the `_counters/<name>` runTransaction pattern.
**Why:** Number collisions in production-critical correlatives — recovery requires a manual renumber. `leadsService` already documents the gap ("NO es atómico…aceptable para el volumen actual") but the same pattern is silently accepted in 4 other services.
**Fix:** Migrate all six to the `_counters` doc + `runTransaction` pattern (template already in `otService.ts:43`). Initialize each counter from existing max on first call.

### [P1] `update()` has 3 disjoint side-effect blocks reading the same presupuesto
**Flow:** Presupuesto.update post-commit
**File:** `apps/sistema-modular/src/services/presupuestosService.ts:378-481`
**What:** After committing, the method fires several conditional follow-ups, each calling `getById(id)` again: `_transicionarTicketOCRecibida` (378), `_cancelarRequerimientosCondicionales` (392), and the `Auto-sync lead when presupuesto estado changes` block (405). Multiple reads, no shared state, partial-failure undefined.
**Why:** If the first sync (`syncFromPresupuesto`) succeeds but the auto-reserva loop throws, the catch swallows it and the rest of the side-effects (now dead anyway, see P0 above) are abandoned mid-iteration. No `pendingAction` is recorded for these failures (only `markEnviado` and `aceptarConRequerimientos` use `_appendPendingAction`).
**Fix:** Centralize estado-driven side-effects in dedicated methods (`markAceptado`, `markAnulado`, `markFinalizado`) that each have their own `pendingAction` envelope. Make `update()` reject explicit `estado` writes and force the caller to use the named methods.

### [P1] Anulación de un presupuesto deja huérfanas las OTs vinculadas
**Flow:** Presupuesto anulado
**File:** `apps/sistema-modular/src/services/presupuestosService.ts:392-403`
**What:** Cuando `data.estado === 'anulado'` solo se cancelan los `requerimientos_compra` condicionales. Las OTs ya creadas (`otsVinculadasNumbers`) y las solicitudesFacturacion vinculadas no se tocan. Si el ppto fue aceptado y se generó OC + OT, anular el ppto no avisa al técnico ni cancela la OT.
**Why:** El equipo va a ejecutar trabajo "fantasma" cargado a un ppto anulado; el cobro queda en el aire. Fácil pasarlo por alto cuando alguien anula desde la UI.
**Fix:** Diseño: añadir aviso (modal de confirmación si hay OTs en estado no-FINALIZADO o solicitudes no-facturada) y registrar `pendingAction` para que el coordinador decida cancelar o convertir. Alternativamente bloquear la anulación una vez que existe al menos una OT no-FINALIZADA.

### [P2] `delete()` (soft) es código muerto y rompe estado
**File:** `presupuestosService.ts:1547-1556`
**What:** `delete()` sobrescribe `estado: 'borrador'` y nada más; nadie la llama (sólo se usa `hardDelete`). Si alguien la usa por error pierde la traza del estado anterior.
**Fix:** Eliminar el método o renombrarlo `_legacySoftDelete` con throw.

### [P2] Cap de revisiones de presupuesto en 99
**File:** `presupuestosService.ts:1463`
**What:** `String(nextRev).padStart(2, '0')` y `localeCompare` → revisiones ≥100 (`PRE-0001.100`) rompen orden y rompen `_extractRevision` (`/\.(\d+)/` lo capta pero pad de 2 ya no es estable). En la práctica improbable.
**Fix:** Documentar el cap o ampliar a 3 dígitos.

---

## OT (Órdenes de Trabajo)

### [P0] `ordenesTrabajoService.create` no chequea colisión de `otNumber`
**Flow:** Crear OT
**File:** `apps/sistema-modular/src/services/otService.ts:268-323`
**What:** `setDoc(otDocRef, ...)` se ejecuta sin chequear si el doc existe. `OTNew.tsx:312-321` permite al usuario sobreescribir el número generado y no valida duplicado antes de submit.
**Why:** Un usuario que escriba un número existente sobreescribe la OT real, perdiendo todo el contenido (artículos cargados, fechas, ingeniero, posta histórica). Sin alerta. Disaster recovery = restore desde backup.
**Fix:** En el `create`, leer con `getDoc` antes del `setDoc` y rechazar si existe; o usar `setDoc(..., { merge: false })` con un security rule que rechace overwrite. En la UI, después de `getNextOtNumber` deshabilitar la edición salvo a admin.

### [P0] `useCreateOTForm` hace doble create del child .01
**Flow:** Crear OT desde modal nueva
**File:** `apps/sistema-modular/src/hooks/useCreateOTForm.ts:261-267`
**What:** El hook llama:
```
await ordenesTrabajoService.create(otData);          // parent → auto-crea .01 internamente
await ordenesTrabajoService.create({ ...otData, otNumber: `${otNum}.01`, ... });  // pisa .01
```
La creación del parent ya invoca `getNextItemNumber` que avanza el counter `_counters/otItem_<padre>` y crea `.01`. La segunda llamada hace `setDoc` del mismo id (overwrite). Después el counter queda en `1` cuando solo existe `.01` — el próximo "+ Item" devolverá `.02` saltando un número.
**Why:** Counter desincronizado, agenda entry potencialmente duplicada (la segunda autoCreateFromOT no vuelve a crear porque getByOtNumber encuentra la primera, pero data del entry queda con info inconsistente). Además los datos guardados son los del segundo `create` (fechaInicio=hoy), pisando los del autocreate.
**Fix:** Eliminar la segunda llamada manual; confiar en el auto-create del service. Si se necesita un override de `fechaInicio/fechaFin` para el child, pasarlo a `create()` como parámetro o llamar a `update()` después del auto-create.

### [P1] OT puede saltar estados sin pasar por validación
**Flow:** OT.estadoAdmin transitions
**File:** `apps/sistema-modular/src/services/otService.ts:326-440`
**What:** `update()` solo intercepta la transición `→ CIERRE_ADMINISTRATIVO` (línea 331). Cualquier otra transición — incluyendo retroceder de `FINALIZADO` a `CREADA`, o saltar de `CREADA` directo a `FINALIZADO` — es aceptada sin validación. No existe un mapa `OT_TRANSICIONES_VALIDAS`.
**Why:** Un dropdown mal usado en EditOTModal puede dejar la OT en un estado inconsistente con el agenda entry, con el ticket vinculado y con el cierre administrativo. P.ej., bajar manualmente de `FINALIZADO` a `CREADA` no rehidrata `otsListasParaFacturar` ni notifica al ticket.
**Fix:** Definir matriz de transiciones válidas en `@ags/shared`, y validar en `update()` antes del commit. Bloquear transiciones que requieren side-effects (CIERRE_ADMINISTRATIVO, FINALIZADO) salvo desde el método dedicado.

### [P1] `delete()` no limpia agenda, ticket, ni `otsVinculadasNumbers` del presupuesto
**Flow:** Eliminar OT
**File:** `apps/sistema-modular/src/services/otService.ts:462-467`
**What:** `delete()` hace `batch.delete(docRef('reportes', otNumber))` y nada más. No borra `agendaEntries.where(otNumber)`, no quita `otNumber` de `lead.otIds[]` ni de `presupuesto.otsVinculadasNumbers[]`, no decrementa `contrato.visitasUsadas`, no quita `otNumber` de `presupuesto.otsListasParaFacturar[]` si la OT estaba en cierre admin.
**Why:** Referencias muertas en agenda (entries con otNumber inexistente bloquean al ingeniero), en tickets (otIds apunta a vacío), en presupuestos (otsListasParaFacturar muestra una OT inexistente — el aviso de facturación se rompe). El contador de visitas del contrato sobreestima.
**Fix:** Implementar `delete()` como un método compuesto que ejecute la limpieza referencial. Considerar reemplazar por baja lógica (`activo: false` o `estadoAdmin: 'ANULADA'`) para preservar trazabilidad.

### [P1] Reverso de agenda no decrementa `contrato.visitasUsadas`
**Flow:** Cancelar entry de agenda
**File:** `apps/sistema-modular/src/hooks/useAgenda.ts:140-162`
**What:** Al borrar un entry de agenda, si la OT estaba en `ASIGNADA/COORDINADA`, se baja a `CREADA` y se limpian ingeniero+fecha. Pero la OT pudo haber incrementado `contrato.visitasUsadas` al crearse (`useCreateOTForm.ts:271`). Cancelar el agenda no desincrementa.
**Why:** Contrato con `tipoLimite='visitas'` cuenta visitas que nunca se ejecutaron. `validateOTCreation` rechaza nuevas OTs por "visitas agotadas" cuando el saldo real es mayor.
**Fix:** Tracking en `contratos`: agregar campo `visitasReservadas` separado de `visitasUsadas`. Solo incrementar `visitasUsadas` en CIERRE_TECNICO o FINALIZADO. Decrementar `visitasReservadas` al revertir.

### [P2] `cerrarAdministrativamente` busca presupuestos haciendo `getAll()`
**File:** `otService.ts:520`
**What:** Para mapear `OT.budgets` (numeros) a IDs, llama `presupuestosService.getAll()` (toda la colección). En el long run con muchos pptos, esto es lento — debería usar `where('numero', 'in', budgets)` con chunks de 30.
**Fix:** Usar el mismo patrón del query en `update()` línea 381.

### [P2] `getNextOtNumber` y `getNextItemNumber` no validan que el counter no haya sido manualmente editado
**File:** `otService.ts:43-114`
**What:** Si alguien crea manualmente una OT con `otNumber: '99999'` (lejos del counter), el counter queda atrás y la próxima auto-generación da `30001` que no colisiona pero parece un salto. La inicialización solo corre la primera vez.
**Fix:** Si el counter doc no existe O el max-existing > counter, recomputar.

---

## Tickets / Leads

### [P0] `parseLeadDoc` ignora estados nuevos del lifecycle al cargar tickets viejos
**Flow:** Lectura de tickets
**File:** `apps/sistema-modular/src/services/leadsService.ts:42-55, 105-148`
**What:** `migrateLeadEstado` mapea legacy → nuevo, pero el mapping `pendiente_info → en_seguimiento` y `presupuestado → presupuesto_pendiente` no contempla los estados intermedios introducidos en Phase 8/10 (`esperando_oc`, `oc_recibida`, `pendiente_aviso_facturacion`, `pendiente_facturacion`). Un ticket creado con `estado='presupuestado'` viejo se transforma en `presupuesto_pendiente` aunque ya exista un PDF enviado — pierde la trazabilidad real.
**Why:** Tickets pre-refactor aparecen en el bucket equivocado. Filtros por estado nuevo nunca los muestran.
**Fix:** Documentar el contrato de migración o eliminar el mapeo legacy y obligar a un backfill (`backfillTicketNumeros` ya existe — agregar `backfillEstados`).

### [P1] `presupuestosService.update` y `markEnviado` invocan `syncFromPresupuesto` con estado pero `syncFromPresupuesto` no propaga estados de OC/coordinación
**Flow:** Presupuesto → Ticket sync
**File:** `apps/sistema-modular/src/services/leadsService.ts:435-473`, `PRESUPUESTO_TO_LEAD_ESTADO`:17-21
**What:** El mapping solo cubre `enviado → presupuesto_enviado`, `aceptado → en_coordinacion`, `finalizado → finalizado`. No cubre `en_ejecucion` ni `anulado`. Para `anulado`, el lead queda con su estado actual y la posta dice "Presupuesto X → Anulado" pero el `estado` no cambia. Para `en_ejecucion` igual.
**Why:** Tickets quedan en `presupuesto_enviado` o `en_coordinacion` mientras el ppto avanza. Al anular un ppto, el ticket sigue como `en_coordinacion` esperando a alguien que ya no va a actuar.
**Fix:** Agregar `anulado → no_concretado` (o un estado terminal específico), `en_ejecucion → ot_creada`. Considerar que `en_coordinacion` ya está manejado por `aceptarConRequerimientos` (Phase 10).

### [P1] `derivar()` reescribe `descripcion` con el `comentario` del posta
**Flow:** Derivar ticket
**File:** `apps/sistema-modular/src/services/leadsService.ts:315-338`
**What:** `if (posta.comentario) data.descripcion = posta.comentario;` — pisa la `descripcion` original del ticket cada vez que se deriva. La grilla muestra "observaciones = última derivación", perdiendo la descripción original.
**Why:** El usuario que abre el ticket ve la última derivación y pierde el contexto de creación. Documentado como "feature" en el memory de tickets refactor pero conceptualmente confunde "descripción" (qué pidió el cliente) con "última observación".
**Fix:** Crear campo `ultimaObservacion` separado y usarlo en la grilla. Mantener `descripcion` inmutable salvo edición explícita.

### [P1] portal-ingeniero `firebaseService.ts` duplica `leadsService.create` sin auditoría ni cleanup nested
**Flow:** Crear ticket desde portal-ingeniero
**File:** `apps/portal-ingeniero/src/services/firebaseService.ts:323-345`
**What:** Re-implementa `leadsService.create` usando `cleanFirestoreData` (top-level only) en vez de `deepCleanForFirestore`, sin `batchAudit`, sin `syncFlatFromContactos`, sin `ventasInsumosStamp`. Si el portal envía un payload con `contactos[]` el flat se queda obsoleto.
**Why:** Tickets creados desde portal-ingeniero pueden tener `contacto/email/telefono` vacíos (no syncFlat), pueden contener `undefined` anidado (cleanFirestoreData no recurse), no aparecen en `audit_log`.
**Fix:** Extraer la lógica de `sistema-modular/leadsService` a `@ags/shared/services` o exportar el módulo via paquete compartido. Eliminar la versión duplicada del portal.

### [P2] `_extractTicketNumber("TKT-99999")` y luego "TKT-100000" — pad fijo en 5 = formato roto en el doc 99,999+1
**File:** `leadsService.ts:189`
**Fix:** ampliar a 6 dígitos o documentar el cap.

---

## Stock

### [P0] `liberar()` no es transaccional — race con un `reservar()` concurrente
**Flow:** Liberar reserva
**File:** `apps/sistema-modular/src/services/stockService.ts:993-1045`
**What:** El `TODO(STKP-03)` documenta que `liberar` usa `createBatch` (no `runTransaction`). Si un admin libera la unidad al mismo tiempo que `presupuestosService.update(aceptado)` la reserva (Phase 10 dead-code aside, este path puede correr desde la UI manual), la unidad puede quedar `disponible` con la reserva del segundo proceso perdida, o `reservado` para un ppto que ya no la quería.
**Why:** Pérdida silenciosa de la reserva — la UI muestra "disponible" pero un PDF de presupuesto enviado dice que está apartada para el cliente X. Defensivo: la documentación admite el riesgo pero no lo cierra.
**Fix:** Migrar a `runTransaction` con read-then-write: leer `unidad`, validar `estado === 'reservado' && reservadoParaPresupuestoId === expected`, escribir.

### [P1] `getOrCreateReservasPosition` carrera al inicializar
**Flow:** Reservar primera unidad
**File:** `stockService.ts:132-148`
**What:** Si dos `reservar()` corren en paralelo y la posición `RESERVAS` no existe, ambos pueden intentar crearla. `posicionesStockService.create` no chequea unicidad por código.
**Why:** Dos posiciones con `codigo: 'RESERVAS'`, lookups posteriores devuelven solo una; la otra queda huérfana con unidades dentro.
**Fix:** Usar `setDoc(doc(db, 'posicionesStock', 'RESERVAS'), ..., { merge: true })` con id determinístico, o transacción.

### [P1] `presupuestosService._generarRequerimientosAutomaticos` se dispara en `create` pero no en `update`
**Flow:** Editar items de un presupuesto borrador
**File:** `presupuestosService.ts:228-291`
**What:** Solo se invoca al crear (`create`). Si después agregás un item con `stockArticuloId` editando el ppto, no se genera el requerimiento — solo lo hace `aceptarConRequerimientos` para los `itemRequiereImportacion=true`.
**Why:** Un ppto borrador con stock insuficiente no avisa al área de compras hasta el accept; la ventana de planificación se acorta.
**Fix:** Hookear `update()` cuando `data.items` cambia y los nuevos items tienen `stockArticuloId`.

### [P1] `unidadesService.delete` rompe el log immutable de movimientos
**Flow:** Borrar unidad
**File:** `stockService.ts:397-402`
**What:** Hard delete sobre `unidades` deja `movimientosStock` con `unidadId` apuntando a la nada. El histórico ya no se puede reconstruir — los movimientos parecen huérfanos.
**Fix:** Baja lógica (`activo: false`) — ya se exporta `EstadoUnidad` con valor `inactivo`. Bloquear hard delete por security rule.

### [P2] `articulosService.delete` igualmente hard
**File:** `stockService.ts:258-263` (`deactivate` existe pero no se usa por defecto)
**Fix:** Usar `deactivate` desde la UI; documentar que `delete` es solo para limpieza admin.

---

## Equipos / Sistemas / Módulos

### [P1] `sistemasService.delete` borra módulos sin cleanup de OTs/contratos
**Flow:** Eliminar sistema
**File:** `apps/sistema-modular/src/services/equiposService.ts:335-355`
**What:** Borra el sistema y todos sus módulos (subcollection). No verifica si hay OTs activas (`reportes.where('sistemaId', '==', id)`), presupuestos (`presupuestos.where('sistemaId', '==', id)`), contratos (`serviciosIncluidos[].sistemaId`). Las OTs quedan con `sistemaId` rota.
**Why:** Reportes técnicos rotos para OTs que aún tienen que ejecutarse, contratos con sistemas que ya no existen.
**Fix:** Pre-validar referencias activas, bloquear o forzar baja lógica (`activo: false`).

### [P1] `modulosService.move` no es atómico
**File:** `equiposService.ts:446-458`
**What:** Hace create-en-target → delete-en-source. Si delete falla, queda duplicado en ambos sistemas.
**Fix:** `runTransaction` (subcollection es ok dentro de tx).

### [P2] `generateNextAgsVisibleId` usa `where('agsVisibleId', '!=', null)` no atómico
**File:** `equiposService.ts:322-332`
**What:** Mismo patrón scan-and-increment. Race posible si dos sistemas se crean en paralelo.
**Fix:** Counter doc + transacción.

---

## Agenda

### [P1] `subscribeToRange` tiene buffer asimétrico
**Flow:** Lectura de calendario
**File:** `apps/sistema-modular/src/services/agendaService.ts:51-69`
**What:** El comentario dice "We query from (rangeStart - 14 days buffer) to rangeEnd to catch multi-day entries", pero el query es `where('fechaInicio', '<=', rangeEnd)` sin lower bound. Agarra TODOS los entries históricos cuya `fechaInicio <= rangeEnd`. El filter client-side `e.fechaFin >= rangeStart` luego descarta. Ineficiente para una colección de varios años.
**Fix:** Agregar lower bound `where('fechaInicio', '>=', rangeStart - 30d)` con índice compuesto. Sigue siendo correcto porque entries multi-día rara vez exceden 30 días.

### [P1] Agenda entry no se borra cuando OT se cancela
**Flow:** OT borrada / anulada
**File:** Falta — no se invoca `agendaService.getByOtNumber → delete` desde `otService.delete`
**Why:** Ya cubierto en P1 OT delete; reiterado aquí porque es la perspectiva de agenda. El sidebar del coordinador muestra entries sin OT subyacente.
**Fix:** Componer cleanup en `otService.delete`.

### [P2] `_agsIdCache` es global de proceso
**File:** `agendaService.ts:6-16`
**What:** Cache module-level sin TTL. Si se actualiza `agsVisibleId` de un sistema, la agenda muestra el viejo hasta reload. Bajo riesgo (campo casi inmutable).
**Fix:** TTL corto o invalidate explícito en `sistemasService.update`.

---

## Contratos

### [P1] `incrementVisitas` no chequea si contrato está activo
**Flow:** Crear OT con contrato
**File:** `contratosService.ts:110-124` invocado desde `useCreateOTForm.ts:271`
**What:** El hook valida con `validateOTCreation` antes de crear la OT, pero después llama `incrementVisitas` sin pasar el contrato por la validación de nuevo. Si entre las dos llamadas el contrato vence (validateOTCreation usa `today` ISO y `incrementVisitas` no), incrementa una visita sobre contrato vencido.
**Why:** Cargo de visita inválido. Bajo riesgo (timing). Pero la transacción `incrementVisitas` debería incluir la validación de estado/fechaFin.
**Fix:** Mover la validación dentro del `runTransaction` de `incrementVisitas`.

### [P2] `getActiveForCliente` filtra `fechaFin >= today` en cliente
**File:** `contratosService.ts:71-78`
**Fix:** Usar `where('fechaFin', '>=', today)` con `where('estado', '==', 'activo')` (índice compuesto). Mejor performance.

---

## Facturación

### [P1] `marcarFacturada` no es idempotente — re-facturar pisa datos
**File:** `facturacionService.ts:141-165`
**What:** Acepta llamada repetida; cada vez sobreescribe `numeroFactura/fechaFactura/facturadoPor`. No hay check `if estado === 'facturada' return`.
**Why:** Si dos contables hacen click simultáneo, el segundo pisa la metadata del primero. Trace de auditoría hace falta `audit_log` para reconstruir.
**Fix:** Lectura previa, idempotency check.

### [P1] `generarAvisoFacturacion` no verifica que las OTs sigan en CIERRE_ADMINISTRATIVO
**Flow:** Crear solicitudFacturacion
**File:** `presupuestosService.ts:1293-1395`
**What:** Solo valida que las OTs estén en `presupuesto.otsListasParaFacturar`. Si entre el cierre admin y el aviso, alguien revierte la OT a `EN_CURSO` (P1 OT estado más arriba), el aviso se genera incluyendo OTs no cerradas.
**Fix:** Dentro de la transacción, leer cada OT y validar `estadoAdmin === 'CIERRE_ADMINISTRATIVO'`.

### [P2] `condicionesPagoService.update` no `cleanFirestoreData` payload
**File:** `presupuestosService.ts:1822-1828`
**What:** `const payload = { ...data, ...getUpdateTrace() };` sin `cleanFirestoreData`. Si `data` contiene `undefined`, write falla.
**Fix:** Wrap with `cleanFirestoreData`.

---

## Cross-cutting

### [P1] `ventasInsumosReport` mezcla ISO timestamps con date strings
**Flow:** Filtrado por rango de fechas
**File:** `leadsService.ts:265-281`
**What:** `lead.createdAt` es ISO con tiempo (`2026-04-25T15:34:21.456Z`); `rango.desde/hasta` viene de `<input type="date">` (`'2026-04-25'`). Comparación `>=` funciona porque ISO ordena lexicográficamente, pero `lead.createdAt <= '2026-04-25'` deja afuera todo el día 25 (`...T15:...` > `'2026-04-25'`).
**Why:** Tickets del último día del rango se excluyen del reporte; el contable cuenta de menos.
**Fix:** Normalizar `hasta` a `'2026-04-25T23:59:59.999Z'` o usar `endOfDay(rango.hasta)`.

### [P2] `toISO` permisivo
**File:** `presupuestosService.ts:22-28` (también copy-pasted en `contratosService.ts`, `facturacionService.ts`)
**What:** Maneja Timestamp / `{seconds, nanoseconds}` / string. Pero acepta string sin validación — un payload corrupto con `createdAt: 'asdf'` lo devuelve tal cual.
**Fix:** Validar formato ISO o devolver `null` si no es parseable.

---

## TOP 5 to fix first

1. **[P0] OTNew `budgets` contiene doc-ID en vez de `numero`** (`OTNew.tsx:203`) — rompe sync de finalización, rompe cierre administrativo, rompe aviso de facturación. Single-line fix con alto impacto.
2. **[P0] `aceptarConRequerimientos` short-circuit deja muerta la auto-reserva de stock** (`presupuestosService.ts:331-478`) — dos clientes pueden reservar las mismas unidades; promesas sobre stock que no existe.
3. **[P0] `ordenesTrabajoService.create` permite overwrite silencioso** (`otService.ts:282`) — un dedazo en el numero de OT borra la OT real con todo su contenido.
4. **[P0] `useCreateOTForm` doble create del child .01** (`useCreateOTForm.ts:261-267`) — counter desincronizado, datos inconsistentes; ya está produciendo entries de agenda confusas.
5. **[P1] Numeradores no atómicos** (`presupuestos`, `OC`, `remito`, `ticket`, `asignaciones`) — colisión de correlativos en uso concurrente; el patrón `_counters/runTransaction` ya existe en `otService` y `contratosService`, replicar es bajo costo.
