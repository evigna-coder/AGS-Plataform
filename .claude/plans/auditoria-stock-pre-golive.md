# Auditoría técnica — Circuito de stock (pre go-live agosto 2026)

**Fecha:** 2026-07-20 · **Alcance:** solo lectura de código, `apps/sistema-modular` (+ tipos compartidos). No se ejecutó la app ni se tocó Firestore.

**Invariante auditado:** todo cambio de existencias (`unidades`: cantidad, estado, ubicación, activo) debe dejar un `MovimientoStock` en la colección `movimientosStock`, y a la inversa: ningún movimiento debería registrarse sin su cambio real de existencias.

---

## 1. Veredicto general

**El núcleo del circuito comercial de stock está sólido y listo:** compra (requerimiento → OC → importación → ingreso), carga manual, reserva por presupuesto, liberación al anular, deducción al cierre administrativo de OT, venta de loaners, consumo de componentes de patrón y conversión por equivalencias usan transacciones de Firestore, validan estados atómicamente y dejan su MovimientoStock. Los guards de doble descuento del cierre funcionan para el caso normal.

**Lo que NO está listo es el circuito de ingenieros (asignaciones) y el modal de movimientos manuales.** Ahí el invariante se rompe en las dos direcciones: hay cambios de existencias sin movimiento (consumo, devolución, transferencia entre ingenieros) y movimientos sin cambio de existencias (modal "Nuevo movimiento", reposición de minikit). Además hay un escenario realista donde una OT queda marcada "stock deducido" sin haber descontado nada, y ese descuento no se recupera nunca.

**Riesgo para el go-live:**
- Si en agosto se opera solo el circuito compra → ingreso → reserva → cierre de OT: **riesgo medio** (corregir los hallazgos B4 y B5 antes, o definir procedimiento operativo).
- Si además se usa el circuito de asignaciones a ingenieros con consumo en campo: **riesgo alto** — el stock consumido en campo hoy no se descuenta nunca (B1) y las existencias van a divergir de la realidad desde la primera semana.

Recomendación: corregir los 4 bloqueantes antes del go-live (son acotados: 2 funciones de asignaciones, 1 guard del cierre y una decisión sobre el modal manual), y correr la lista de pruebas de la sección 5 con datos de prueba antes de la migración masiva.

---

## 2. Hallazgos priorizados

### BLOQUEANTES

**B1 — El consumo en campo no descuenta stock ni deja movimiento.**
`services/asignacionesService.ts:152-175` (`consumirItems`), invocado desde `hooks/useInventarioIngeniero.ts:73-82`.
- Al "consumir" un item asignado, solo se actualiza el contador `cantidadConsumida` dentro del doc de la asignación. **No se crea MovimientoStock, no se toca el doc de `unidades`** (queda `estado: 'asignado'`, `activo: true`, ubicación = ingeniero, para siempre) **y no se persiste la fecha de consumo** (la vista de Consumos usa la fecha de asignación como aproximación — está admitido en el docstring de `hooks/useConsumos.ts:17-22`).
- Escenario: un IST consume un kit de mantenimiento en una OT. El sistema sigue mostrando esa unidad como existente ("asignado" al ingeniero), el ATP del helper sincrónico la cuenta como stock (`atpHelpers.ts:71` incluye `'asignado'`), y el kardex del artículo no registra la salida. En un mes de operación, el stock en sistema queda inflado por todo lo consumido en campo.
- Fix sugerido: en `consumirItems`, cuando el item tiene `unidadId`, transicionar la unidad (`estado: 'consumido'` o decrementar `cantidad`) y crear un MovimientoStock `tipo: 'consumo'` con `otNumber`; persistir `fechaConsumo` en el item.

**B2 — La devolución de asignación vuelve la unidad a una posición inexistente y sin movimiento.**
`services/asignacionesService.ts:137`.
- Al devolver, la unidad pasa a `estado: 'disponible'` con `ubicacion: { tipo: 'posicion', referenciaId: '', referenciaNombre: 'Stock' }`. Se pierde la posición física real (queda colgada de una posición con id vacío, que no existe en `posicionesStock`) y **no se registra MovimientoStock** de reingreso.
- Escenario: se devuelven 10 partes; en la vista por posiciones aparecen agrupadas bajo una ubicación fantasma "Stock", nadie sabe en qué estante están y el historial del artículo no muestra el retorno.
- Fix sugerido: pedir posición de destino en la UI de devolución (o default configurable), y crear MovimientoStock `tipo: 'devolucion'` ingeniero → posición.

**B3 — La transferencia entre ingenieros deja la unidad en estado inconsistente y sin movimiento.**
`hooks/useInventarioIngeniero.ts:95-141` (`handleTransferir`).
- Paso 1 llama a `devolverItems` (que pone la unidad `'disponible'` en "Stock", ver B2); paso 3 solo actualiza `ubicacion` al ingeniero destino **sin volver el estado a `'asignado'`**. Resultado: unidad `estado: 'disponible'` con `ubicacion.tipo: 'ingeniero'` — cuenta como disponible en el stock amplio pero está físicamente en la camioneta de un IST. Tampoco se crea MovimientoStock de la transferencia.
- Escenario: se transfiere un repuesto de Juan a Pedro; Planificación lo ve "disponible" y promete entrega con él; además el cierre por selección manual (`entregarSeleccionCierre`) puede deducirlo estando en poder de un ingeniero.
- Fix sugerido: transferencia atómica propia (unidad: mantener `'asignado'`, cambiar referencia; MovimientoStock `transferencia` ingeniero → ingeniero) sin pasar por `devolverItems`.

**B4 — El modal "Nuevo movimiento" registra asientos que no mueven stock (y viceversa).**
`hooks/useCreateMovimientoForm.ts:280-322` (usado por `CreateMovimientoModal` en la página Movimientos).
- Con unidades seleccionadas: solo actualiza `ubicacion` si el destino es interno; **nunca cambia `estado` ni `cantidad`**. Un "egreso" o "consumo" manual (destino texto libre) crea el movimiento pero la unidad sigue `'disponible'` en su posición: el kardex dice que salió y las existencias dicen que está.
- Sin unidades seleccionadas: crea un movimiento "suelto" (`unidadId: ''`) por N cantidad que no toca ninguna existencia. Un "ingreso" manual por acá **no crea unidades**.
- Nota: además permite mover una unidad a ubicación `proveedor` quedando `'disponible'` (sigue contando en ATP).
- Escenario: un operador registra por Movimientos un egreso de 5 unidades a un cliente; el stock no baja; la diferencia aparece recién en el próximo inventario físico y el log —que era la herramienta de auditoría— es el que miente.
- Fix sugerido: o bien el modal aplica el cambio real (deducir/crear/transferir unidades según tipo, reusando `deducirUnidadDisponible` y los servicios existentes), o bien se restringe a tipos que sí implementa (transferencia con unidades) y se saca egreso/ingreso/consumo/ajuste de las opciones. Para ajustes ya existe `AjusteStockModal`, que sí hace las dos cosas.

**B5 — El flag `stockDeducido` puede quedar prendido sin que se haya descontado nada (y bloquea el retry para siempre).**
`services/otService.ts:1206-1266`.
- `huboDeduccion = true` se setea por el solo hecho de que la OT tenga presupuestos vinculados (línea 1234-1235) o selections, **aunque `entregadas`/`deducidas` sea 0**. Casos reales: (a) la OT se cierra antes de que ingrese la mercadería → todavía no hay unidades reservadas → `entregarPorPresupuesto` devuelve 0 → flag en true; cuando la mercadería después ingresa, la auto-reserva ya no corre (el ppto avanzó a `pendiente_facturacion`, y `reservarPendientesParaPresupuesto` en `stockService.ts:1307` solo actúa sobre `aceptado`/`en_ejecucion`) → **ese stock no se descuenta nunca y el retry del cierre está bloqueado por el flag**; (b) fallas best-effort por unidad (se loguean en consola y nada más).
- Fix sugerido: marcar `stockDeducido: true` solo si `entregadas + deducidas > 0` **o** si se verificó que no había nada que deducir (ppto sin items de stock); dejar rastro visible (ticket a Materiales) cuando la deducción dé 0 con items de stock pendientes.

### IMPORTANTES

**I1 — El cierre de la primera OT entrega TODAS las reservas del presupuesto.**
`services/otService.ts:1234-1252` → `stockService.ts:1591-1621` (`entregarPorPresupuesto`): la query es por `reservadoParaPresupuestoId`, sin discriminar qué items corresponden a la OT que cierra. Un ppto con 3 OTs entrega todo el stock reservado al cerrar la primera. No hay doble descuento (el estado `reservado→entregado` es atómico), pero la foto de existencias se adelanta a la realidad física. Fix: vincular reservas a OT/item, o entregar solo al cierre de la última OT (ya existe el cálculo "todas cerradas" para el avance del ppto, línea 965-1014).

**I2 — Posible doble descuento: selección manual + reservas del mismo artículo en el mismo cierre.**
`otService.ts:1212-1252`: camino A (selección manual, deduce de `disponible`) y camino B (reservas del ppto, entrega `reservado`) corren ambos. Si el admin selecciona a mano en el cierre un artículo no serializado que además está reservado por el ppto, se descuenta dos veces (una unidad disponible + la reservada). La UI lo advierte en texto (`CierreMaterialesBlock.tsx:113-118`) pero no hay guard por artículo. Fix: al armar selections, excluir cantidades ya cubiertas por reservas del ppto.

**I3 — Ingreso parcial de un embarque: no hay segunda recepción.**
`hooks/useIngresarStock.ts:187-196` marca `stockIngresado: true` con el primer ingreso aunque `cantidadReal < cantidadPedida`, y la UI bloquea reingresar (`ImportacionDetail.tsx:60`, `ImportacionModal.tsx:61`). Si el embarque trae MENOS, el remanente que llegue después solo puede ingresarse por "Cargar stock" manual (sin costeo CIF ni factor, y la reconciliación de OC es por match de artículo). Si trae MÁS, las unidades se crean por `cantidadReal` (bien) y la OC se capa a lo pedido (bien, `useIngresarStock.ts:216-218`). Fix: permitir recepciones múltiples por importación (acumular `cantidadRecibida` por item y marcar `stockIngresado` recién al completar, o botón "reabrir recepción").

**I4 — Los remitos manuales no mueven stock.**
`pages/stock/RemitoEditor.tsx:88-123` (crear remito salida a campo / entrega a cliente sobre unidades disponibles) y `pages/stock/RemitoDetail.tsx:66` (marcar item devuelto): solo escriben el doc del remito; ninguna unidad cambia de estado/ubicación ni se crea movimiento. El único flujo donde remito + stock van juntos es Asignación Rápida. Los remitos de devolución/derivación de fichas (`stockService.createForItems`) mueven items de ficha, no unidades — eso es correcto (son equipos del cliente). Fix: al pasar un remito de salida a `en_transito`, mover las unidades referenciadas (o dejar de ofrecer unidades de stock en ese editor).

**I5 — Reposición de minikit: movimiento sin cambio de existencias.**
`hooks/useInventarioIngeniero.ts:144-178` (`handleReponer`) crea un MovimientoStock `transferencia` depósito → minikit sin actualizar ninguna unidad. El kardex registra un traslado que las existencias no reflejan.

**I6 — Asignación rápida: movimiento con datos pobres y lotes mal contados.**
`hooks/useAsignacionRapida.ts:218-231`: el egreso se registra con `origenId: ''` / `origenNombre: 'Stock'` (no la posición real de la unidad) y `cantidad` = la del carrito (default 1), mientras que la unidad entera pasa a `'asignado'` — si el doc era un lote de N, se asigna todo el lote pero el movimiento dice 1. Además no es transaccional (loop de awaits: un fallo a mitad deja asignación sin todos los movimientos).

**I7 — Dos fórmulas de ATP inconsistentes.**
`stockAmplioService.ts:142-148` suma `cantidad` por unidad y no cuenta `'asignado'`; `atpHelpers.ts:68-77` (`itemRequiresImportacionFromUnidades`, variante sincrónica usada al agregar items al ppto) cuenta **docs** (no cantidades) e **incluye `'asignado'`**. Un artículo cuyo único stock está asignado a ingenieros figura "con ATP" por un camino y "sin stock" por el otro; un lote de 100 cuenta como 1. Fix: unificar en la fórmula de `computeStockAmplio`.

**I8 — `movimientosStock` no es inmutable a nivel reglas.**
`firestore.rules:155`: `allow read, write: if esStaff()` — cualquier staff puede editar o borrar movimientos desde consola/cliente. El "log inmutable de auditoría" es una convención de código, no una garantía. Fix: `allow create: if esStaff(); allow update, delete: if false;` (coordinar con el plan de hardening pendiente de deploy).

**I9 — `presupuestosService.delete()` (baja lógica) no libera reservas.**
`services/presupuestosService.ts:2376-2384`: pasa el ppto a `'borrador'` sin liberar reservas ni cancelar requerimientos (a diferencia de `update({estado:'anulado'})` y `hardDelete`, que sí lo hacen — líneas 463-506 y 2421-2440). Si algún camino de UI usa este `delete()` sobre un ppto aceptado, las unidades quedan `reservado` para siempre. Verificar callers y, en su defecto, replicar la cascada de liberación.

### MENORES

- **M1** `AjusteStockModal.tsx:41-68`: ajuste correcto pero en dos escrituras no atómicas; si falla la segunda queda ajuste sin movimiento (la UI avisa). Aceptable, documentado.
- **M2** `useStockIntake.ts:240-253` y `useBulkAddStock.ts:159-183`: los movimientos de ingreso son best-effort post-creación de unidades; una falla deja unidades sin asiento (solo warn en consola).
- **M3** `equivalenciasService.ts:396-476` (`desagregarUnidades`): modelo "1 doc = 1 unidad" — cuenta documentos, no cantidades. Si el artículo origen se cargó como lote (doc con `cantidad > 1`), la conversión consume el doc entero contándolo como 1. Restringe el modelo de datos de la migración (ver sección 4). Además escribe `createdAt`/`updatedAt` como string ISO (los lectores esperan Timestamp y al leer lo reemplazan por "ahora").
- **M4** `stockService.ts` (reservar/liberar/entregar/deducir): `updatedAt` se escribe como string ISO dentro de las tx (inconsistente con el resto, que usa Timestamp). Los lectores lo toleran pero muestran fecha falsa.
- **M5** Unidades entregadas por reserva quedan con `ubicacion` = posición RESERVAS (cosmético; el estado `entregado` las saca de todos los cómputos).
- **M6** Los requerimientos generados al **crear** el ppto (`_generarRequerimientosAutomaticos`, `presupuestosService.ts:264-318`) no llevan `condicional: true`, por lo que no cuentan en el bucket `comprometido` del stock amplio (solo los de la aceptación). El comprometido queda subestimado entre creación y aceptación.
- **M7** Numeradores `REQ-`/`IMP-` siguen siendo scan-and-max no transaccional (`importacionesService.ts:192-201, 314-323`); OC/remito/asignación ya migraron a counter atómico. Riesgo de números duplicados con dos usuarios simultáneos.
- **M8** `useIngresarStock.ts:154`: el requerimiento pasa a `'comprado'` solo si `cantidadReal >= cantidadPedida`; en ingresos parciales queda `'en_compra'` indefinidamente (no distorsiona el ATP porque `'en_compra'` está excluido de comprometido y la OC abierta aporta el pendiente a enTransito, pero el req nunca se cierra).
- **M9** El guard anti doble-ingreso de importación es solo de UI (`puedeIngresarStock`); el servicio no valida `stockIngresado` — dos pestañas abiertas pueden ingresar dos veces el mismo embarque.

---

## 3. Mapa de flujos — ¿qué deja MovimientoStock?

| Flujo | Archivo (entrada) | ¿Muta `unidades`? | ¿Crea MovimientoStock? | Atómico |
|---|---|---|---|---|
| Ingreso por importación | `hooks/useIngresarStock.ts` | Crea (serie/lote/granel) | Sí, `ingreso` por unidad | Sí (batch único) |
| Ingreso manual wizard | `hooks/useStockIntake.ts` | Crea | Sí, `ingreso` (best-effort) | Parcial |
| Carga en lote | `hooks/useBulkAddStock.ts` | Crea | Sí, `ingreso` (best-effort) | Parcial |
| Reserva por ppto (aceptar / auto post-ingreso / manual) | `stockService.reservar` | Sí (estado+ubicación, split de lote) | Sí, `transferencia` | Sí (tx) |
| Liberar reserva (anular/eliminar ppto, manual) | `stockService.liberar` | Sí | Sí, `transferencia` | Sí (tx) |
| Entrega al cierre (reservadas) | `stockService.entregar` | Sí (`entregado`) | Sí, `egreso` | Sí (tx) |
| Deducción al cierre (selección manual) | `stockService.deducirUnidadDisponible` | Sí | Sí, `egreso` | Sí (tx) |
| Ajuste | `components/stock/AjusteStockModal.tsx` | Sí | Sí, `ajuste` | No (2 pasos) |
| Venta loaner | `services/loanersVentaHelpers.ts` | Crea espejo `vendido` | Sí, `egreso`/`venta_loaner` | Sí (tx) |
| Consumo componentes patrón | `services/patronesConsumirHelpers.ts` | (muta `patrones.lotes`) | Sí, `consumo` + idempotente | Sí (tx) |
| Conversión equivalencias | `services/equivalenciasService.ts` | Sí (consume + crea) | Sí, `transferencia`/`conversion` | Sí (tx) |
| Asignación rápida a IST | `hooks/useAsignacionRapida.ts` | Sí (`asignado`) | Sí, `egreso` (origen pobre, lotes mal) | No |
| **Consumo en campo (asignación)** | `asignacionesService.consumirItems` | **NO** (unidad queda `asignado`) | **NO** | — |
| **Devolución de asignación** | `asignacionesService.devolverItems` | Sí (a posición fantasma '') | **NO** | No |
| **Transferencia entre ISTs** | `useInventarioIngeniero.handleTransferir` | Sí (estado inconsistente) | **NO** | No |
| **Reposición minikit** | `useInventarioIngeniero.handleReponer` | **NO** | Sí (asiento sin existencias) | — |
| **Movimiento manual (página Movimientos)** | `hooks/useCreateMovimientoForm.ts` | Solo ubicación, a veces | Sí (a menudo sin efecto real) | No |
| **Remitos manuales / devolución de remito** | `pages/stock/RemitoEditor.tsx`, `RemitoDetail.tsx` | **NO** | **NO** | — |
| Remito devolución/derivación de fichas | `stockService.createForItems` | No (mueve items de ficha, correcto) | No aplica | Sí (batch) |

**Encadenamiento compras (pregunta del dueño):** el happy path está bien cableado: item sin stock → requerimiento (`pendiente`) → `useGenerarOC` agrupa por proveedor → OC `borrador` + req `en_compra` → importación desde la OC (OC → `embarcada`) → ingreso: unidades + movimientos + req `comprado` + OC `recibida` (o parcial) + auto-reserva para pptos en espera + avance del ticket a Coordinación. La compra local sin importación funciona por el wizard de ingreso con N° de OC (reconcilia por artículo y cierra reqs). Eliminar una OC revierte sus reqs a `aprobado` y está bloqueado si tiene importaciones (`presupuestosService.ts:2647-2669`). Anular un ppto cancela reqs sin compromiso y libera reservas. Los flujos "a medias" problemáticos son I3 (embarque corto) y B5 (cierre de OT antes del ingreso).

---

## 4. Qué debe llenar la migración de stock (Excel → Firestore)

Existe un hook de migración (`hooks/useStockUnidadesMigration.ts`, con wipe por tag y posición `SIN_ASIGNAR`) pero está incompleto respecto de lo que el sistema asume. Checklist:

### Antes de las unidades
1. **`articulos`** completos y con: `codigo` único (los cierres y el wizard de ingreso matchean por código), `descripcion`, **`requiereNumeroSerie` / `requiereNumeroLote` correctos ANTES de migrar unidades** (definen la forma de cada unidad y qué exige el cierre de OT), `stockMinimo` (dispara auto-requerimientos), `unidadMedida`, `activo: true`, `proveedorIds` (sugerencia al generar OC), y `tipo`/`categoriaEquipo`/`marcaId` si van a usar los filtros.
2. **`posicionesStock`**: árbol completo con `codigo`, `nombre`, `tipo`, `activo: true`, `parentId`. El matching de la migración es por código de depósito. No usar id vacío jamás.

### Cada doc de `unidades` migrado
- `articuloId` (id real del doc de artículo) + **denormalizados** `articuloCodigo`, `articuloDescripcion` (se muestran en todas las listas y se copian a los movimientos).
- `estado: 'disponible'`, `activo: true`, `condicion` (`'nuevo'` / `'usado'` según corresponda).
- `cantidad`: explícita. Serializados: siempre 1. Granel: ver "modelo de datos" abajo.
- `ubicacion: { tipo: 'posicion', referenciaId: <id real>, referenciaNombre }` — la liberación de reservas y los agrupados por posición dependen de que el id sea real.
- `nroSerie` si el artículo `requiereNumeroSerie` (validar duplicados por artículo, como hace `useBulkAddStock.ts:133-137`); `cantidad` debe ser 1.
- `nroLote` si `requiereNumeroLote` — **el hook actual no lo soporta** (siempre escribe `null`): hay que extenderlo o esos artículos quedarán con unidades inválidas para el cierre con trazabilidad.
- `costoUnitario` + `monedaCosto` (USD recomendado, es el costo canónico) o ambos `null` — no omitir uno solo.
- `createdAt` / `updatedAt` como **Timestamp** (no string ISO — los lectores hacen `toDate?.()` y un string se lee como "hoy").
- No setear `reservadoPara*` ni `ubicacionAnterior` (o explícitamente `null`).

### Modelo de datos: doc-por-unidad vs doc-lote
El hook actual crea **1 doc por unidad física** (una fila con cantidad 500 = 500 docs). Recomendación:
- Serializados: 1 doc por unidad (obligatorio).
- Granel/consumibles: **1 doc por (artículo, posición, lote) con `cantidad: N`** — las reservas (con split), la deducción del cierre y el stock amplio lo manejan bien y reduce órdenes de magnitud el volumen. **Excepción:** artículos que van a pasar por conversión de equivalencias (`desagregarUnidades` cuenta docs, no cantidades — M3): esos cargarlos doc-por-unidad, o corregir M3 primero.

### MovimientoStock inicial
Generar **1 movimiento `tipo: 'ingreso'` por doc de unidad migrado** (origen `proveedor` con nombre "Migración sistema anterior", destino la posición, `motivo: 'Carga inicial — migración'`, `cantidad` = la del doc). No es requisito funcional (nada se rompe sin él: los historiales y el stock amplio se calculan desde `unidades`), pero:
- el kardex por unidad/artículo arranca "de la nada" y cualquier control cantidad-vs-movimientos dará diferencia estructural permanente;
- las sugerencias de "ubicaciones históricas" de los buscadores de ingreso se alimentan de movimientos;
- la vista Movimientos es la herramienta de auditoría que el dueño pidió como invariante.
Ojo: no usar `movimientosService.create` en loop para miles de filas (hace una lectura de artículo + evento de negocio por movimiento) — escribirlos en batch como hace `useIngresarStock.ts:123-148`.

### Después de migrar
- Verificación de conteos: por artículo, suma de `cantidad` de unidades `disponible` == stock del sistema viejo.
- Verificar que ningún doc quedó con `ubicacion.referenciaId` vacío ni en `SIN_ASIGNAR` sin plan de reubicación.
- No migrar nada a estado `reservado`/`asignado`: las reservas vivas del sistema viejo conviene recrearlas aceptando/re-reservando desde los presupuestos reales (el flujo `reservar` deja el movimiento y el vínculo al ppto).

---

## 5. Qué probaría en vivo antes del go-live (en orden)

Con datos de prueba (cliente/artículos/posiciones de test), verificando después de cada paso la unidad, el movimiento en la página Movimientos y el stock amplio del artículo:

1. **Alta manual** por wizard "Cargar stock": un artículo con serie, uno con lote, uno granel → unidades correctas + movimiento `ingreso` por cada una + ubicación elegida.
2. **Reserva por aceptación**: ppto con item de stock disponible → aceptar → unidades a posición RESERVAS, `reservado`, movimiento `transferencia`, ticket a Materiales.
3. **Anulación**: anular ese ppto → unidades vuelven a su posición original (`ubicacionAnterior`), movimiento de liberación.
4. **Circuito compra completo**: ppto con item sin stock → aceptar (req creado) → generar OC → crear importación → recibir/despachar → "Ingresar stock" con series → req `comprado`, OC `recibida`, unidades creadas con costo USD y factor, auto-reserva del ppto, ticket avanza a Coordinación.
5. **Embarque corto**: repetir 4 ingresando MENOS que lo pedido → constatar I3 (la importación queda `stockIngresado` y no admite segunda recepción) y decidir el procedimiento para el remanente.
6. **Cierre administrativo con reserva**: crear OT del ppto, cerrarla → unidades `entregado`, movimiento `egreso` con `otNumber`, `cierreAdmin.stockDeducido: true`. Reintentar el cierre / tocar el estado desde el EditOTModal → verificar que NO duplica el descuento.
7. **Cierre antes del ingreso** (escenario B5): ppto aceptado sin stock → cerrar la OT ANTES de ingresar mercadería → mirar `stockDeducido` y qué pasa al ingresar después. Documentar el resultado como procedimiento.
8. **Cierre con selección manual**: OT sin ppto, cargar partes desde stock (una con serie, una granel por posición) → deducción y movimientos correctos; probar seleccionar un artículo que además esté reservado (escenario I2).
9. **OT de entrega** (`tipoOT: 'entrega'`): circuito completo hasta cierre y visor de Entregas.
10. **Asignaciones**: asignación rápida a un IST (egreso), consumo en campo (constatar B1: hoy NO descuenta), devolución (constatar B2: ubicación "Stock" vacía), transferencia entre ISTs (constatar B3). Con esto se decide si el módulo de asignaciones entra o no al go-live.
11. **Ajuste de inventario** por `AjusteStockModal` (positivo, negativo, a cero → baja) + verificación en Movimientos.
12. **Movimiento manual** por la página Movimientos: registrar un egreso → constatar B4 (el stock no baja) y decidir si se deshabilita el modal para la operación diaria.
13. **Venta de loaner** → loaner `vendido` + unidad espejo + movimiento `venta_loaner`.
14. **Consumo de componentes de patrón** en un cierre + re-cierre (debe rechazar el doble descuento) y **conversión por equivalencias** (stock origen consumido, destino creado, 1 movimiento `conversion`).
15. **Concurrencia mínima**: dos pestañas reservando la misma unidad a la vez (una debe fallar limpio), y dos ingresos del mismo embarque (constatar M9).

---

## Estado de remediación (2026-07-20, misma jornada)

| Hallazgo | Estado | Cómo quedó |
|---|---|---|
| B1 consumo en campo sin efecto | **CORREGIDO** | Tx unidad consumida/decrementada + mov 'consumo' + fechaConsumo en el item |
| B2 devolución a posición fantasma | **CORREGIDO** | Posición real DEVOLUCIONES (getOrCreate) + mov 'devolucion' atómico |
| B3 transferencia inconsistente | **CORREGIDO** | Salto único A→B, estado 'asignado' forzado, mov 'transferencia' |
| B4 movimientos manuales sin efecto | **CORREGIDO** | movimientosAplicar.ts: cada tipo aplica sobre unidades o se bloquea con mensaje |
| B5 stockDeducido con 0 entregadas | **CORREGIDO** | Flag solo con ≥1 procesada o nada-que-deducir verificado; rastro en notasCierre; reserva post-ingreso también en pendiente_facturacion; retry re-entrega |
| I1 reservas entregadas con la 1ª OT | **CORREGIDO** | Reservas se entregan con la ÚLTIMA OT (mismo check que el aviso); salidas parciales por selección manual |
| I2 doble descuento manual+reserva | **CORREGIDO** | La selección manual consume la reserva (unidad exacta o neteo por artículo); aviso en CierreMaterialesBlock |
| I8 movimientosStock editable | **CORREGIDO (SIN DEPLOYAR)** | Rules create-only + test 20/20. DEPLOY DESPUÉS de la purga final (la regla bloquea los deletes de purga por consola) |
| I9 delete de ppto no libera reservas | **CORREGIDO** | delete() → _liberarReservasDePresupuesto |
| I3 recepción parcial de embarque | PENDIENTE | |
| I4 remitos sin stock | PENDIENTE | |
| I5 reponer minikit | PARCIAL | El camino via modal de movimiento ahora mueve de verdad (B4); revisar handleReponer directo |
| I6 asignación rápida origen vacío / lotes como 1 | PENDIENTE | |
| I7 dos fórmulas ATP | PENDIENTE | |

Verificación integral post-fixes: type-check, lint:ast, build:modular, test:rules 20/20, test:entregas 6/6, test:stock-amplio 5/5 — todo verde. Nada commiteado aún.

### Actualización 2026-07-20 (tarde) — remediación COMPLETA

- I3 **CORREGIDO**: recepciones parciales acumulativas (cantidadRecibida acumula; stockIngresado solo al completar o al "Cerrar incompleta" con nota permanente); modal ofrece solo faltantes; requerimiento pasa a comprado por acumulado.
- I4 **CORREGIDO**: confirmar remito de stock propio aplica salida real en una tx (entrega=egreso, sale_y_vuelve=transferencia; retorno=devolucion), con remitoId en los asientos; remitos documentales explícitos en UI.
- I5 **CORREGIDO**: reponer minikit unificado en el detalle del minikit (movimientosAplicar); handleReponer eliminado.
- I6 **CORREGIDO**: egreso de asignación con ubicación real de origen y cantidad real del lote (item/remito/movimiento alineados).
- I7 **CORREGIDO**: ATP unificado (UNIDAD_ATP_ESTADOS + atpUnidades en stockAmplioService; cantidades no docs; asignado NO cuenta); tests stock-amplio 7/7.
- Bonus: regresión del hint de disponibilidad en PresupuestoAddItemWizard (leía stock.atp inexistente → siempre a_importar) corregida con atpFromStockAmplio.

Verificación integral post-todo: type-check ✓, lint:ast ✓, test:stock-amplio 7/7 ✓, test:entregas 6/6 ✓, test:rules 20/20 ✓, build:modular ✓. **Los 14 hallazgos de la auditoría quedaron remediados.** Pendiente operativo: purga final → deploy de rules (movimientosStock create-only) → go-live.
