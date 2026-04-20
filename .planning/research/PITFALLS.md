# Domain Pitfalls — Circuito Comercial Completo

**Domain:** B2B post-venta técnica — Ticket → Presupuesto → OC → OT → Facturación
**System:** Firestore + React 19 + OAuth Gmail (sistema-modular)
**Researched:** 2026-04-18
**Scope:** Adding commercial pipeline features to an existing live system

---

## 1. PRICING LOGIC PITFALLS

### Pitfall 1-A: Precios Snapshot vs. Precios "Vivos"

**What goes wrong:** El catálogo de servicios tiene un precio unitario. Cuando se actualiza la tarifa del catálogo, los ítems ya embebidos en presupuestos `aceptado` o `enviado` no cambian — pero si el usuario re-abre el editor y guarda sin tocar los precios, algunos re-renders o auto-calculaciones pueden pisar el precio original con el precio actual del catálogo.

**Why it happens:** Si `ConceptoServicio.precioUnitario` se lee en tiempo real al montar el editor, y el componente re-mapea los items al guardar usando el catálogo live, se reemplaza el precio snapshot del presupuesto.

**Warning sign:** Un presupuesto enviado al cliente con precio X muestra un total diferente cuando el vendedor lo re-abre semanas después.

**Prevention:**
- Guardar siempre `precioUnitarioSnapshot` junto al item en Firestore al momento de agregarlo (distinto del `conceptoId` que apunta al catálogo).
- El editor nunca sobreescribe `precioUnitarioSnapshot` a menos que el usuario haga un cambio explícito de precio (campo editable con indicador visual de "precio modificado").
- Regla de negocio: precio bloqueado si estado >= `enviado`.

**Phase:** Fase de Catálogo de Servicios / Editor de Presupuestos per-incident + partes.

---

### Pitfall 1-B: Round-off Errors en MIXTA ARS + USD

**What goes wrong:** `0.1 + 0.2 === 0.30000000000000004` en JS. Con ARS en cifras de millones, el error de coma flotante puede acumularse en cuotas y aparecer diferencia de centavos en el total.

**Why it happens:** Los totales MIXTA se calculan como sumas de items ARS + sumas de items USD en dos acumuladores `float`. Cuando se muestra el "Total ARS equivalente" usando tipo de cambio, se multiplica float × float, amplificando el error.

**Warning sign:** La suma de cuotas difiere del total del presupuesto en 0.01–0.05 unidades. El PDF muestra un monto y el resumen del presupuesto muestra otro.

**Prevention:**
- Almacenar todos los precios unitarios como enteros de centavos (ARS × 100, USD × 100) en Firestore. Convertir a display sólo en la capa de presentación.
- Alternativamente, usar `Math.round(valor * 100) / 100` en cada operación intermedia antes de sumar — nunca acumular fracciones.
- Nunca usar el "Total ARS equivalente" para cálculos; sólo para display. La comparación de presupuestos debe mantenerse en moneda original.
- En el PDF de contrato (`PresupuestoPDFContrato`), usar `Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })` en cada celda individualmente, no calcular subtotales en JS y luego formatear.

**Phase:** Fase de multi-moneda / PDF tipos de presupuesto.

---

### Pitfall 1-C: Contrato Vigente vs. Expirado en el Momento del Cálculo de Precio

**What goes wrong:** Un presupuesto de tipo `per_incident` se genera para un cliente que tiene un contrato vigente con descuento. Si el contrato vence mientras el presupuesto está en estado `borrador`, el precio con descuento ya fue calculado pero el contrato ya no aplica.

**Why it happens:** La regla de precios se evalúa al crear el presupuesto, no al enviarlo ni al aceptarlo.

**Warning sign:** Presupuesto muestra descuento de contrato pero el contrato aparece como expirado en el módulo de contratos.

**Prevention:**
- Re-validar la elegibilidad del contrato en el momento de `enviar` el presupuesto (no solo al crear).
- Mostrar un banner de advertencia si el contrato del cliente vence antes de `validUntil` del presupuesto.
- Al aceptar: si el contrato ya venció, bloquear la transición o requerir confirmación manual.

**Phase:** Fase de reglas de precio por contrato.

---

### Pitfall 1-D: Conflicto Usuario-Edita vs. Sistema-Recalcula

**What goes wrong:** El usuario edita manualmente el precio unitario de un ítem. Más tarde, otra acción (cambiar cantidad, cambiar unidad) dispara un recálculo que llama a `precioDesdeRegla()` y sobreescribe el precio manual con el precio de catálogo.

**Why it happens:** El hook de cálculo no distingue entre "precio editado por usuario" y "precio heredado del catálogo".

**Warning sign:** El usuario reporta que sus precios manuales "se borran solos" al tocar otros campos.

**Prevention:**
- Agregar un flag booleano `precioManual: true` al item cuando el usuario edita el precio.
- El recálculo de reglas respeta `precioManual: true` y no sobreescribe.
- UI: mostrar icono de "precio personalizado" con opción de "restaurar precio de catálogo".

**Phase:** Editor de presupuestos — reglas de precio.

---

## 2. EVENT-DRIVEN DERIVACIÓN PITFALLS

### Pitfall 2-A: Loop Infinito en Sync Lead ↔ Presupuesto

**What goes wrong:** `presupuestosService.update()` llama a `leadsService.syncFromPresupuesto()`. Si `syncFromPresupuesto` actualiza el lead y ese update dispara otra función que toca el presupuesto, se crea un loop.

**Why it happens:** Ya existe `syncFromPresupuesto` en el código (`leadsService.ts` línea 17+). Al agregar más lógica de derivación automática (OC → OT, OT → Facturación), cada nueva regla agrega un punto donde un update puede disparar el ciclo de vuelta.

**Warning sign:** La consola muestra el mismo `[presupuestosService]` o `[leadsService]` log 3+ veces seguidas para el mismo documento ID, sin acción del usuario.

**Prevention:**
- En cada función de sync/derivación, verificar si el estado destino ya está seteado antes de hacer el update: `if (lead.estado === targetEstado) return;` — ya implementado parcialmente en `PRESUPUESTO_TO_LEAD_ESTADO`.
- Agregar un campo `_derivacionProcessedAt: Timestamp` al documento cuando se completa una derivación automática. La próxima ejecución lo comprueba antes de actuar.
- Separar claramente las funciones de lectura-y-sync de las de escritura: nunca hacer `getById` seguido de `update` dentro de un listener de `onSnapshot`.

**Phase:** Flujo automático de derivación — cualquier fase que agregue auto-triggers.

---

### Pitfall 2-B: Evento Duplicado de Derivación

**What goes wrong:** El usuario hace clic en "Aceptar presupuesto" dos veces rápido (o la red es lenta y el primer click no dio feedback). Se crean dos tickets de seguimiento, dos reservas de stock, o dos requerimientos para el mismo presupuesto.

**Why it happens:** No hay idempotencia en `_generarRequerimientosAutomaticos`. Si se llama dos veces con el mismo `presupuestoId`, crea dos requerimientos — aunque hay un check de `existingReqs.length === 0`, existe una ventana de tiempo antes de que el primer req se persista.

**Warning sign:** La lista de requerimientos muestra entradas duplicadas con el mismo `presupuestoId` y `articuloId`.

**Prevention:**
- Usar Firestore Transaction con `runTransaction` en lugar de la secuencia read-then-write actual para el camino crítico de "aceptar presupuesto".
- En la UI: deshabilitar el botón de acción inmediatamente al primer click con un flag `isProcessing` local, antes de que la promesa resuelva.
- Para auto-tickets y auto-reqs: usar un campo de idempotencia en el documento destino, e.g., `presupuestosService.create()` agrega `autoTicketCreado: false` y la función de creación de ticket usa `runTransaction` para hacer set atómico.

**Phase:** Flujo automático — fase de auto-crear ticket desde presupuesto sin origen.

---

### Pitfall 2-C: Estado Inconsistente en la Cadena (Presupuesto Aceptado sin OT)

**What goes wrong:** Presupuesto se marca `aceptado`. El auto-paso debería derivar a coordinación y eventualmente crear una OT. Si la creación de OT falla (error de red, campo requerido faltante), el presupuesto queda `aceptado` pero sin OT vinculada. El ticket asociado ya cambió de estado, pero no hay OT.

**Why it happens:** La cadena de derivaciones `estado_A → acción_B → estado_C` no tiene compensación si `acción_B` falla. El código actual en `presupuestosService.update()` tiene `try/catch` que silencia errores de stock (`// Don't throw`).

**Warning sign:** Presupuestos en estado `aceptado` sin `otsVinculadasNumbers[]` después de 24h. El ticket está en `en_coordinacion` pero el coordinador no ve nada para crear OT.

**Prevention:**
- Agregar un campo `pendingActions: string[]` al presupuesto que lista las derivaciones que deben completarse (e.g., `['crear_ot', 'notificar_coordinacion']`). Al completarse cada acción, se remueve del array.
- Un dashboard de "Presupuestos aceptados sin OT" (query: `estado=aceptado AND otsVinculadasNumbers=[]`) permite intervención manual.
- No silenciar errores de acciones críticas. Si crear el ticket falla, relanzar el error al usuario. Solo silenciar las acciones "best-effort" (reserva de stock, requerimientos).

**Phase:** Flujo automático — OC → OT derivación.

---

### Pitfall 2-D: Race Condition Multi-Usuario al Aceptar Presupuesto

**What goes wrong:** Dos usuarios (vendedor + admin) abren el mismo presupuesto enviado y hacen click en "Aceptar" al mismo tiempo. Se ejecutan dos `presupuestosService.update(id, { estado: 'aceptado' })` en paralelo. Ambos pasan el check de estado porque ambos leen `enviado` antes de que el primero escriba.

**Why it happens:** El `update()` actual no usa `runTransaction`. Es un `batch.update()` directo sin leer-y-verificar el estado actual antes de escribir.

**Warning sign (específico del sistema):** El audit log (`batchAudit`) muestra dos entradas de `update` para el mismo `presupuestoId` con `after.estado = 'aceptado'` con timestamps < 2 segundos de diferencia. Se generan dos tickets de seguimiento.

**Prevention:**
- Para transiciones de estado críticas (cualquier → `aceptado`, `aceptado` → `anulado`), usar `runTransaction` con verificación del estado actual:
  ```typescript
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(docRef('presupuestos', id));
    const current = snap.data()?.estado;
    if (current !== 'enviado') throw new Error(`Estado inválido: ${current}`);
    tx.update(docRef('presupuestos', id), { estado: 'aceptado', ...trace });
  });
  ```
- El error de transacción fallida debe mostrarse al segundo usuario como "Este presupuesto ya fue procesado por otro usuario."

**Phase:** Flujo automático — transiciones de estado del presupuesto.

---

### Pitfall 2-E: Auto-Ticket Falla pero Presupuesto ya Cambió de Estado

**What goes wrong:** El presupuesto se crea correctamente. El auto-ticket (para presupuestos sin `origenTipo === 'lead'`) falla porque `clienteId` es null (dato legado). El presupuesto ya existe en Firestore, el usuario no recibe error, y no hay ticket de seguimiento.

**Why it happens:** El código actual silencia errores de operaciones post-creación (el patrón `.catch(err => console.error(...))`). El auto-ticket fallaría silenciosamente en presupuestos de clientes legados con `clienteId null`.

**Warning sign:** Presupuesto existe en la colección sin un ticket correspondiente, y `origenTipo` no es `'lead'`. La búsqueda `leadsService.getAll({ presupuestoId })` devuelve vacío.

**Prevention:**
- Antes de intentar crear el auto-ticket, validar que `clienteId` es no-null y el cliente existe. Si no, crear el presupuesto pero mostrar un warning en UI: "No se pudo crear ticket automático: cliente sin ID. Crear manualmente."
- Agregar `autoTicketId: string | null | 'ERROR'` al presupuesto. `'ERROR'` indica que falló y necesita intervención.

**Phase:** Flujo automático — presupuesto sin ticket de origen.

---

## 3. STOCK PLANNING PITFALLS

### Pitfall 3-A: Doble Conteo en Stock Proyectado

**What goes wrong:** El cálculo de stock proyectado en `_generarRequerimientosAutomaticos` es `disponible - reservado + enTransito`. El problema: las unidades en estado `reservado` ya fueron contadas como parte del total (`disponible` era el estado antes de reservar). Si la lógica de estado es `disponible → reservado` (mismo doc, campo cambia), entonces `qtyDisponible` ya no las incluye — pero si hay un bug donde la unidad tiene `estado='reservado'` pero aún figura en `filter(u => u.estado === 'disponible')`, se cuenta dos veces.

**Why it happens:** La fórmula actual (líneas 252-258 de `presupuestosService.ts`) consulta `unidadesService.getAll()` sin estado filter y luego filtra en memoria. Si hay datos corruptos (unidad con dos estados), el conteo es incorrecto.

**Warning sign:** Los requerimientos auto-generados piden más stock del necesario. La lista de unidades muestra inconsistencias entre la posición "Disponible" y la posición "Reservas".

**Prevention:**
- La fórmula correcta es `qty_neta = qty_estado_disponible` (únicamente unidades con `estado === 'disponible'`). No restar `reservado` porque ya no están en `disponible`.
- Agregar una función de auditoría `verificarConsistenciaStock(articuloId)` que comprueba que `sum(unidades por estado)` coincide con el total de unidades del artículo.
- Correr esta verificación en un test de integración post-commit.

**Phase:** Planificación de stock extendida — primer fase.

---

### Pitfall 3-B: Stock Negativo por Reservas > Disponible

**What goes wrong:** Se intenta reservar 5 unidades de un artículo del que hay 3 disponibles. La lógica actual en `reservasService.reservar()` no tiene un check atómico — consulta el conteo y reserva, pero entre la consulta y la reserva otro usuario pudo haber reservado las mismas unidades.

**Why it happens:** El loop `for (const unidad of unidadesAReservar)` en `presupuestosService.update()` no usa transacción. Cada `reservasService.reservar()` es independiente.

**Warning sign:** En la posición "Reservas" de un artículo aparecen más unidades que el total registrado en inventario. La lista de unidades de un artículo muestra todas como `reservado` aunque solo había 2 disponibles cuando se aceptó el presupuesto.

**Prevention:**
- Envolver el loop de reserva en una transacción Firestore que:
  1. Lee todas las unidades `disponible` del artículo.
  2. Verifica que hay suficientes.
  3. Marca las primeras N como `reservado`.
  Todo en un solo `runTransaction`.
- Si no hay stock suficiente, no bloquear la aceptación del presupuesto, sino registrar `reserva_parcial: true` y crear un requerimiento por la diferencia.

**Phase:** Planificación de stock extendida — reservas.

---

### Pitfall 3-C: Planificación con Datos del Cache de 2 Minutos (serviceCache.ts)

**What goes wrong:** `serviceCache.ts` tiene TTL de 2 minutos. Si la planificación de stock (consulta de disponible + tránsito + reservas + otras OCs) usa datos cacheados, puede mostrar stock disponible que ya fue reservado por otra acción en los últimos 2 minutos.

**Why it happens:** El cache es global en memoria por instancia del browser. Si dos usuarios trabajan simultáneamente, cada uno ve su propio cache. El cache de usuario A no refleja las reservas creadas por usuario B.

**Warning sign:** El panel de planificación muestra "5 disponibles" pero al intentar generar el requerimiento, se detecta que solo quedan 2.

**Prevention:**
- Las vistas de planificación de stock NO deben usar el cache de `serviceCache.ts`. Siempre hacer `getDocs()` directo.
- El cache solo es apropiado para datos de referencia que cambian raramente (catálogos, tipos de equipo, artículos sin movimiento).
- Documentar explícitamente en `serviceCache.ts` qué colecciones NO deben cachearse: `unidadesStock`, `reservas`, `requerimientos`.

**Phase:** Planificación de stock extendida — primera implementación.

---

### Pitfall 3-D: Importación Sumada como Disponible Antes de Ingresar al Stock

**What goes wrong:** El panel de planificación extendida muestra "en tránsito: 10 unidades" de una importación. Si la importación se cancela o el despacho tarda 6 meses más de lo previsto, esas 10 unidades siguen sumando al stock proyectado.

**Why it happens:** El cálculo de `enTransito` cuenta OCs activas sin discriminar si están en tránsito real (con fecha ETA confiable) o si son OCs especulativas.

**Warning sign:** El stock proyectado es positivo pero cuando llega el momento de entregar al cliente, la importación aún no llegó.

**Prevention:**
- Distinguir en el panel de planificación entre:
  - `en_transito_confirmado`: OC con DUA abierta y ETA < 30 días.
  - `en_transito_especulativo`: OC enviada al proveedor pero sin confirmación de embarque.
- Mostrar ambas columnas separadas en lugar de sumarlas ciegamente.
- Flag `contarEnPlanificacion: boolean` en la OC, default `true`, que el equipo de comex puede desmarcar si la OC está en riesgo.

**Phase:** Planificación de stock extendida — columnas de tránsito.

---

## 4. MULTI-CURRENCY PITFALLS (MIXTA USD + ARS)

### Pitfall 4-A: Tipo de Cambio del Día vs. del Presupuesto vs. de la Factura

**What goes wrong:** El presupuesto MIXTA se crea con TC = 1,200 ARS/USD. El cliente acepta 3 semanas después cuando TC = 1,350. La OT se realiza 2 semanas más tarde. El aviso de facturación llega al mes. ¿Con qué TC se factura?

**Why it happens:** El TC no se almacena como snapshot en el presupuesto, o se almacena pero no se propaga al aviso de facturación.

**Warning sign:** El equipo de administración pregunta "¿a qué tipo de cambio facturo esto?" y no hay una respuesta en el sistema.

**Prevention:**
- Agregar `tipoCambioSnapshot: number` al `Presupuesto` que se captura en el momento de `estado = 'enviado'` (cuando el precio fue presentado al cliente).
- Agregar `tipoCambioFecha: string` (ISO) para saber de qué día es el TC.
- El aviso de facturación debe incluir ambos valores explícitamente.
- Política de negocio a decidir pre-implementación: ¿TC del día de envío, de aceptación, o de OT finalizada? Documentar en el tipo `Presupuesto`.

**Phase:** Multi-moneda — primera implementación.

---

### Pitfall 4-B: Display de Cuotas en Distintas Monedas

**What goes wrong:** Un contrato MIXTA tiene 3 cuotas ARS + 2 cuotas USD. El PDF muestra las cuotas entremezcladas sin un separador visual claro. El cliente interpreta las cuotas USD como si fueran ARS.

**Warning sign:** El cliente objeta montos tras recibir el presupuesto.

**Prevention:**
- En el PDF de contrato: agrupar cuotas por moneda, con encabezado de sección por moneda.
- En la vista de resumen: mostrar "Total ARS: X | Total USD: Y" como dos líneas separadas, nunca como un único "Total MIXTA".
- Nunca convertir USD a ARS para sumar un "total único" en la UI de creación — solo en el campo informativo "Equivalente aproximado".

**Phase:** PDF de contratos MIXTA / Fase de multi-moneda.

---

### Pitfall 4-C: Comparación de Presupuestos en Monedas Distintas

**What goes wrong:** El módulo de comparación de presupuestos (o el historial de presupuestos de un cliente) muestra montos en ARS y USD mezclados. El usuario no puede comparar dos presupuestos de distinto tipo.

**Prevention:**
- Agregar campo `montoTotalEquivalenteARS: number | null` calculado en el momento de crear/enviar el presupuesto, usando el TC del día. Este campo es solo para ordenamiento y comparación — nunca para facturación.
- Documentar en el tipo que este campo es "orientativo, no normativo".

**Phase:** Lista de presupuestos — columnas de monto.

---

## 5. MAIL / OAUTH PITFALLS

### Pitfall 5-A: OAuth Access Token Expirado en Medio de un Envío

**What goes wrong:** El usuario inicia el envío de un presupuesto con adjunto pesado (PDF + anexo consumibles). El token OAuth expiró hace 20 minutos (los tokens de Google duran 1 hora). El `sendGmail()` retorna HTTP 401. El presupuesto ya cambió de estado a `enviado` en Firestore antes de que fallara el mail.

**Why it happens:** El flujo actual (basado en `gmailService.ts`) hace el cambio de estado en Firestore y luego llama a Gmail. Si Gmail falla, el estado en Firestore ya cambió pero el cliente nunca recibió el mail.

**Warning sign:** El presupuesto está en estado `enviado` y tiene `fechaEnvio` seteada, pero el cliente dice no haber recibido nada. La consola muestra `Gmail API error: 401`.

**Prevention:**
- Verificar/refrescar el token ANTES de cambiar el estado en Firestore. El orden debe ser: (1) validar token → (2) enviar mail → (3) actualizar estado.
- En `EnviarPresupuestoModal`: agregar una llamada previa a `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=TOKEN` para verificar que el token tiene vida útil > 5 minutos. Si no, disparar el flujo de re-autenticación antes de continuar.
- Mostrar error al usuario con botón "Reintentar envío" que no cambia el estado en Firestore — solo reenvía el mail.
- Los tokens de Google OAuth en modo Testing expiran a los 7 días (refresh token); en producción, verificar que la app no esté en modo Testing.

**Phase:** Mail — envío de presupuestos / OAuth prod verify (pendiente de STATE.md).

---

### Pitfall 5-B: Bounces No Capturados

**What goes wrong:** El email de presupuesto se envía a `gerencia@empresa.com.ar` que tiene un typo. Gmail acepta el envío (HTTP 200), pero el mail rebota. El sistema no tiene forma de saber que el destinatario nunca lo recibió.

**Why it happens:** La API de Gmail no notifica bounces sincrónicamente. El bounce llega como un mail de vuelta a la casilla del remitente, fuera del sistema.

**Warning sign:** El cliente dice no haber recibido el presupuesto, pero el sistema muestra `enviado`.

**Prevention:**
- Mostrar en la UI de envío la lista de destinatarios con validación de formato de email (regex + dominio no vacío) antes de enviar.
- Agregar un campo `emailEnviadoA: string[]` en el presupuesto para trazabilidad.
- Instrucción operativa (no técnica): el vendedor debe confirmar por teléfono que el cliente recibió el presupuesto antes de marcar "seguimiento".

**Phase:** Mail — primera implementación.

---

### Pitfall 5-C: Adjuntos Demasiado Grandes (>25 MB)

**What goes wrong:** Un presupuesto de contrato para un sistema grande tiene: PDF principal (3 MB) + Anexo consumibles (2 MB) + OC del cliente escaneada (15 MB imagen) + Protocolo de calibración (8 MB). Total: 28 MB > límite de Gmail (25 MB por mensaje).

**Warning sign:** `Gmail API error: 400 - Message too large` en la consola.

**Prevention:**
- Calcular el tamaño total de los adjuntos antes de enviar. Si supera 20 MB (margen de seguridad), mostrar un warning al usuario: "Los adjuntos superan el límite recomendado. Considera compartir el PDF vía Firebase Storage link."
- Implementar una opción de "Enviar link" en lugar de adjunto: subir el PDF a Firebase Storage con URL pública temporal (7 días) e incluir el link en el cuerpo del mail.

**Phase:** Mail — adjuntos / PDF generation.

---

## 6. TESTING PLAYWRIGHT PITFALLS

### Pitfall 6-A: Tests Flaky por Timing en Writes de Firestore

**What goes wrong:** El test hace click en "Aceptar presupuesto", luego inmediatamente hace `expect(page.getByText('Estado: Aceptado')).toBeVisible()`. La UI aún no refleja el cambio porque el onSnapshot no disparó todavía.

**Why it happens:** Firestore en modo real (emulator o prod) tiene latencia real en el ciclo write → onSnapshot → re-render. `await page.click()` resuelve cuando el click ocurrió, no cuando la UI reflojó el cambio de Firestore.

**Warning sign:** El test pasa en máquinas rápidas y falla en CI (GitHub Actions) intermitentemente.

**Prevention:**
- Usar `page.waitForSelector('[data-testid="estado-aceptado"]')` con timeout explícito (5000ms) en lugar de `toBeVisible()` inmediato.
- Usar el emulador de Firestore en los tests E2E. Configurar `FIRESTORE_EMULATOR_HOST=localhost:8080` en el entorno de test.
- Para flujos asíncronos multi-paso (aceptar → auto-crear ticket → auto-req), usar `page.waitForResponse()` interceptando la llamada al endpoint de Firestore correspondiente.
- Nunca usar `page.waitForTimeout()` con un número fijo de milisegundos — es la causa #1 de tests frágiles.

**Phase:** Suite E2E Playwright — setup inicial.

---

### Pitfall 6-B: Contaminación de Datos Entre Tests

**What goes wrong:** El Test A crea un presupuesto PRE-0001 y verifica su número. El Test B también intenta crear el primer presupuesto y espera PRE-0001, pero el Test A ya lo creó. El Test B falla.

**Why it happens:** Los tests comparten el mismo Firestore emulator sin cleanup entre runs. La función `getNextPresupuestoNumber()` hace una query de todos los presupuestos — si Test A no limpia, Test B ve datos sucios.

**Warning sign:** Los tests pasan si se corren en orden específico pero fallan en orden aleatorio o en paralelo.

**Prevention:**
- Usar Firestore emulator con `clearFirestoreData()` (REST API del emulator: `DELETE http://localhost:8080/emulator/v1/projects/{projectId}/databases/(default)/documents`) en `beforeEach` de cada test suite.
- Cada test debe crear sus propios datos (fixtures), no depender de datos creados por tests anteriores.
- Para los datos de referencia (catálogo de servicios, tipos de equipo, etc.), cargarlos con un `beforeAll` de la suite, no entre tests individuales.

**Phase:** Suite E2E — setup de emuladores y fixtures.

---

### Pitfall 6-C: Mocks de Firebase que Divergen de Producción

**What goes wrong:** Los tests unitarios mockan `leadsService.syncFromPresupuesto()` devolviendo siempre `true`. En producción, la función lanza si `clienteId` es null. El test pasa, el bug en prod persiste.

**Why it happens:** Los mocks de unit tests tienden a simplificar la implementación real. Con el tiempo, la implementación real evoluciona pero el mock no se actualiza.

**Prevention:**
- Para el circuito comercial completo, preferir tests de integración con el emulador de Firestore sobre tests unitarios con mocks de servicios. Los servicios de Firestore son lo suficientemente deterministas como para no necesitar mocks.
- Si se usan mocks, mantenerlos en un archivo central `__mocks__/firebaseService.ts` y revisarlos cuando cambia la interfaz del servicio.
- Agregar un test de "smoke" que verifica que el servicio real (en emulator) acepta el contrato de tipos del mock.

**Phase:** Suite E2E — estrategia de testing.

---

### Pitfall 6-D: Tests Dependientes del Orden de Ejecución

**What goes wrong:** El test de "OC → derivar a OT" depende de que el test de "Presupuesto → Aceptar" haya corrido antes y creado el presupuesto. Si se corre solo el segundo test, falla porque no hay presupuesto.

**Prevention:**
- Cada test o test suite debe ser completamente autónomo. Usar factories de datos: `const { presupuestoId } = await crearPresupuestoTest(page, { cliente, items })` al inicio de cada test que lo necesite.
- Los factories deben usar el emulator directamente vía SDK Admin (en el helper de setup), no vía UI — la UI puede cambiar y romper los setups.

**Phase:** Suite E2E — diseño de fixtures.

---

## 7. MIGRATION PITFALLS (Datos Legados)

### Pitfall 7-A: clienteId null en Tickets Antiguos (Problema Conocido)

**What goes wrong:** Tickets creados antes del refactor tienen `clienteId: null`. El circuito comercial (vincular ticket → presupuesto, auto-derivar) necesita `clienteId` para crear el presupuesto con cliente correcto y derivar a facturación.

**Why it happens:** El campo era opcional en la UI antigua. El `parseLeadDoc` actual ya maneja `clienteId ?? null` (línea 109 de `leadsService.ts`), pero las reglas de negocio que requieren `clienteId` fallarán silenciosamente.

**Warning sign:** Al intentar crear un presupuesto desde un ticket con `clienteId: null`, el selector de cliente aparece vacío y el vendedor no sabe qué cliente asociar.

**Prevention:**
- Migración batch pre-lanzamiento: query de todos los tickets con `clienteId: null`, presentar al admin una UI de "Completar datos de tickets legados" que permite buscar el cliente por `razonSocial` y asignar el `clienteId`.
- En el editor de tickets: mostrar un banner "Este ticket no tiene cliente vinculado" con CTA para completarlo.
- En la lógica de auto-derivación: verificar `clienteId` antes de actuar y registrar el error en un campo `derivacionError: string | null`.

**Phase:** Migración — primera fase del circuito comercial, antes de habilitar derivaciones automáticas.

---

### Pitfall 7-B: Presupuestos Legados sin contactos[] Estructurado

**What goes wrong:** Los presupuestos creados antes del refactor de contactos tienen los campos planos `email`, `telefono` en lugar de `contactos: ContactoTicket[]`. Si el flujo de envío de mail lee `presupuesto.contactos[0].email` y el array está vacío (porque `hydrateContactos` no fue aplicado), el mail no tiene destinatario.

**Why it happens:** `hydrateContactos` existe en `leadsService.ts` pero no en `presupuestosService.ts`. Los presupuestos legados no tienen la misma lógica de hidratación.

**Warning sign:** Al intentar enviar un presupuesto legado, el modal de envío muestra "Sin destinatarios" aunque el presupuesto tiene email en el campo plano.

**Prevention:**
- Aplicar la misma lógica de hidratación de `hydrateContactos` al leer presupuestos en `presupuestosService.getById()` y `getAll()` — o mejor, agregar una función `hydratePresupuestoContactos(data)` en `presupuestosService.ts` que haga el mismo fallback.
- Agregar al seed de migración: para todos los presupuestos con `email != ''` y `contactos = []`, escribir `contactos: [{ id: 'legacy', nombre: data.contacto, email: data.email, esPrincipal: true }]`.

**Phase:** Migración — junto con la fase de envío de mails para todos los tipos.

---

### Pitfall 7-C: OTs sin Vinculación a Presupuesto

**What goes wrong:** OTs creadas en v1.0 no tienen `presupuestoId`. El flujo de "OT finalizada → aviso de facturación" necesita navegar de OT → Presupuesto → Cliente → Contacto de facturación. Si la OT no tiene `presupuestoId`, la cadena se rompe.

**Why it happens:** En v1.0, las OTs se podían crear directamente sin origen en presupuesto.

**Warning sign:** El módulo de facturación no puede encontrar el presupuesto correspondiente para generar el aviso.

**Prevention:**
- El aviso de facturación no debe requerir `presupuestoId` como obligatorio. Debe poder funcionar con solo el `clienteId` de la OT.
- Para OTs legadas: UI de "Vincular a presupuesto" en la página de detalle de OT, con SearchableSelect de presupuestos del mismo cliente.
- En el nuevo flujo v2.0: hacer `presupuestoId` obligatorio al crear una OT desde el circuito comercial. Solo las OTs de soporte directo pueden no tenerlo.

**Phase:** Migración + Flujo OT → Facturación.

---

## Phase-Specific Warnings Summary

| Fase | Pitfall Prioritario | Mitigación Clave |
|------|--------------------|--------------------|
| Catálogo de servicios + reglas de precio | 1-A, 1-D (precio snapshot vs vivo, usuario vs sistema) | `precioUnitarioSnapshot` + flag `precioManual` desde el día 1 |
| Editor presupuestos per-incident + partes | 1-B (rounding ARS/USD) | Operar en centavos enteros desde el primer tipo implementado |
| Multi-moneda MIXTA | 1-C, 4-A, 4-B (contrato expirado, TC, display cuotas) | `tipoCambioSnapshot` al enviar; grupos separados en PDF |
| Flujo automático de derivación | 2-A, 2-B, 2-C, 2-D, 2-E (loops, dupes, estado inconsistente, race, fallo silencioso) | Transacciones Firestore en transiciones de estado; idempotencia desde el inicio |
| Planificación stock extendida | 3-A, 3-B, 3-C, 3-D (doble conteo, negativo, cache, tránsito especulativo) | No cachear unidadesStock; transacción en reserva |
| Envío de mails + adjuntos | 5-A, 5-C (token expirado, adjuntos grandes) | Verificar token antes de cambiar estado; calcular tamaño antes de enviar |
| Suite E2E Playwright | 6-A, 6-B, 6-D (flaky timing, contaminación, orden) | Emulator con clearFirestoreData + waitForSelector + factories autónomos |
| Migración datos v1.0 | 7-A, 7-B, 7-C (clienteId null, contactos planos, OTs sin presupuesto) | Batch de migración + UI de completado antes de habilitar derivaciones auto |

---

## Sources

- Firestore transaction semantics: https://firebase.google.com/docs/firestore/transaction-data-contention
- Race conditions in Firestore (QuintoAndar post-mortem): https://medium.com/quintoandar-tech-blog/race-conditions-in-firestore-how-to-solve-it-5d6ff9e69ba7
- Firestore infinite loop in triggers: https://saikirann.medium.com/prevent-infinity-loop-in-firebase-cloud-functions-ea8083afbd35
- Currency JS floating point: https://www.honeybadger.io/blog/currency-money-calculations-in-javascript/
- Gmail OAuth token lifetimes (1h access, 7d testing refresh): https://developers.google.com/identity/protocols/oauth2
- Playwright flaky test strategies 2026: https://medium.com/@antongulin/how-to-fix-flaky-tests-in-playwright-10-battle-tested-strategies-c1713b90bd79
- Playwright test isolation: https://betterstack.com/community/guides/testing/avoid-flaky-playwright-tests/
- Codebase analysis: `apps/sistema-modular/src/services/presupuestosService.ts`, `leadsService.ts`, `gmailService.ts`, `serviceCache.ts`, `stockService.ts` (verificado 2026-04-18)
