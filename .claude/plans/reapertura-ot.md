# Reapertura de OT — análisis y diseño (2026-09-10)

Estado: **Fases 1, 2 y 3 IMPLEMENTADAS (2026-09-10, en working tree, sin release).** Fase 2: `utils/cierreStockLineas.ts` (pendientes/marcado/flag derivado, legacy), `entregarSeleccionesCierre` devuelve `porSeleccion` (asientos por diferencia antes/después), `cerrarAdministrativamente` descuenta solo pendientes y estampa `deducidoAt`/`movimientoIds`, `services/reversionCierreService.ts` (contra-asiento `reversion_cierre` + restitución unidad/patrón + destrabe remito/asignación, quita la línea del cierre), botón Revertir por línea en `CierreStockSelectorRow`, `useConsumos` netea. Fuera: BOM de patrones (tiene su propia idempotencia, no se revierte por línea); líneas legacy sin asientos se revierten a mano. Test `test:cierre-stock-lineas`. Decisiones tomadas por el user
(D1 se borra la firma del cliente; D2 admin/admin_soporte en sistema-modular + el propio ingeniero desde
el portal con filtro "Finalizadas" y buscador; D3 sí se reabre facturada sin tocar la solicitud; D4 tickets
solo posta; D5 stock por línea a demanda — hecho; D6 remitos de servicio quedan). Fase 3
(reportes-ot: ticket de acciones idempotente vía `ticketAccionesId`) hecha junto con la 1.
Implementación: `packages/shared/src/services/reaperturaOT.ts` (tx compartida + helpers),
`ordenesTrabajoService.reabrir`, `ReabrirOTModal`/`ReabrirOTButton` (modular), `misOTService.reabrirReporte`
+ `ReabrirReporteModal` + Finalizadas/buscador en Mis OT (portal), re-cierre sin duplicados en
`cerrarAdministrativamente`, padre con retroceso. Test `test:reapertura-ot`.

## 1. El problema

Hay que poder reabrir una OT ya cerrada (técnica y/o administrativamente, incluso facturada) para
corregir el reporte, adjuntar algo que faltó o cargar un consumo olvidado, **sin** que al volver a
cerrarla se duplique el consumo de stock, el aviso de facturación, los tickets o que el presupuesto
"vuelva a aparecer" en el pipeline.

## 2. Qué hay hoy (relevamiento del 2026-09-10)

### 2.1 Reabrir existente
- Único botón: "Reabrir OT (volver a Cierre Administrativo)", solo desde `FINALIZADO`
  (`OTCierreAdminSection.tsx:240`). Dos implementaciones paralelas que no hacen lo mismo:
  `useEditOTForm.handleReabrirOT` (persiste directo, no toca `cierreAdmin`) y
  `useOTFieldHandlers.handleReabrirOT` (estado local + autosave, limpia `avisoAdminEnviado` y
  `fechaCierreAdmin`).
- Ambas bajan `status` a `BORRADOR` como efecto colateral: el reporte técnico queda editable en
  reportes-ot, pero el guard `pdfGeneratedAt` de `reportes-ot/services/firebaseService.ts:254-275`
  rechaza el autosave en BORRADOR de un doc que ya tiene PDF. En la práctica la reapertura técnica
  hoy no funciona.
- Matriz de transiciones (`shared/types/index.ts:86-104`): no existe vuelta atrás desde
  `CIERRE_ADMINISTRATIVO` (ni a técnico ni a en curso). `FINALIZADO → CIERRE_ADMINISTRATIVO` es la
  única reversa.
- Nada de lo que dejó el cierre se revierte (ver 2.2 a 2.4). El comentario de la matriz asume que
  re-finalizar es idempotente por `stockDeducido`, pero eso significa "no descuenta de nuevo",
  no "no descuenta lo que se agregó".

### 2.2 Efectos del cierre ADMINISTRATIVO (`otService.cerrarAdministrativamente`, 1574-2091)
En transacción: OT (`estadoAdmin`, `fechaCierre`, `retenidaFacturacion`), ticket "Revisar cierre de
OT", `mailQueue` (consumer nunca desplegado), presupuestos (`otsListasParaFacturar += ot`,
`estado → pendiente_facturacion` si todas las OTs cerradas). Post-commit: `syncFromOT` de tickets
(deriva a Materiales, postas `arrayUnion`), fichas (historial), loaners (liberar tras
recalificación), esquema de cuotas, reclamo de OC, `sincronizarPadreConHijas` (solo avanza),
remitos de servicio → `completado`. Después, fuera de la tx: **deducción de stock** con guard global
`cierreAdmin.stockDeducido`.

Guard de re-cierre `yaCerrada` (1587): si `estadoAdmin ∈ {CIERRE_ADMINISTRATIVO, FINALIZADO}` no
repite ticket/mail/presupuesto y solo reintenta stock. **Al reabrir, `estadoAdmin` baja y ese guard
deja de proteger: un re-cierre crearía otro ticket "Revisar cierre", otro mailQueue y volvería a
sumar la OT a `otsListasParaFacturar`.**

### 2.3 Stock
- `movimientosStock` es **create-only** por reglas (`firestore.rules:200`). Toda reversión es un
  contra-asiento nuevo; `unidades`, `remitos`, `asignaciones`, `patrones` sí se reescriben.
- Un solo flag global `stockDeducido`. No hay registro por selección de qué se descontó
  (`stockSelections` guarda lo pedido, no lo hecho). Los movimientos de asignación y remito manual
  no llevan `subtipo:'cierre_ot'`; la única traza común es `otNumber`.
- Orígenes y efectos: unidad depósito (unidad → consumido + mov), reserva puntual (idem, conserva
  `reservadoPara*`), remito (unidad + mov + `remito.items[]` consumido/cantidadConsumida + estado),
  asignación (5 colecciones: asignación, remito de salida, OTROS remitos del ingeniero con la misma
  pieza, unidad, mov), patrón por lote, BOM de patrones (idempotente por "existe algún mov
  `entidadTipo:'patron'` de la OT" → un contra-asiento rompería ese chequeo si no se netea),
  presentación base×factor (idéntico a unidad, en unidades base).
- No existe ninguna función de reversión de consumo. `ajustarUnidad` exige `disponible`.
- La vista de Consumos (`useConsumos.ts`) suma `consumo` + `egreso` por `otNumber`; un contra-asiento
  `devolucion` no la afecta → el consumo revertido seguiría figurando salvo que se netee.

### 2.4 Facturación, presupuestos, tickets
- El cierre NO crea la solicitud de facturación; solo deja la OT "lista" en el presupuesto. El aviso
  lo genera un humano (`generarAvisoFacturacion`), que **quita** la OT de `otsListasParaFacturar` y
  la estampa en `solicitud.otNumbers[]`.
- Único undo del circuito: anular la solicitud (`facturacionService.ts:171-198`) restaura las OTs
  en el presupuesto y lo devuelve a `pendiente_facturacion`. Precedente de reversa parcial: quitar un
  presupuesto de una OT cerrada (`useEditOTForm.ts:463-486`) lo saca de `otsListasParaFacturar`.
- Tickets creados o movidos: "Revisar cierre de OT" (nuevo), ticket de origen (`ot_realizada` →
  `pendiente_aviso_facturacion` → `finalizado` con `finalizadoAt`), "Cargar factura del aviso",
  "Factura cargada". `syncFromOT` ignora tickets `finalizado`.
- Presupuesto: sale de "En ejecución" al pasar a `pendiente_facturacion`; con solicitud viva se
  oculta de la lista básica.
- Agenda: el cierre no la toca. Control semanal: usa la **última** ocurrencia en `estadoHistorial`
  (una OT reabierta cuenta desde la reapertura — ya previsto). Cierre semanal: snapshot inmutable.
- Padre: `sincronizarPadreConHijas` solo avanza; reabrir una hija no baja al padre.

### 2.5 Cierre TÉCNICO (reportes-ot, superficie congelada)
- Finalizar escribe `status:'FINALIZADO'` + `estadoAdmin:'CIERRE_TECNICO'` en `reportes/{ot}`, sube
  PDF(s) a `reports/{ot}/…` y guarda `pdfUrl`, `pdfGeneratedAt`, `protocolPdfUrl`. Mail opcional vía
  Gmail del técnico (`enviadoPorEmail` como traza). Si `accionesTomar` no está vacío crea ticket,
  con guard `wasAlreadyFinalized = formState.status === 'FINALIZADO'` (`usePDFGeneration.ts:840`):
  **si la OT vuelve a BORRADOR, re-finalizar crea un ticket duplicado.**
- Re-finalizar sobre FINALIZADO ya existe (regenera y pisa el PDF en el mismo path, sin backup).
- Guards de edición son todos de cliente (`readOnly = status === 'FINALIZADO'`, autosave apagado,
  guard `pdfGeneratedAt`). Las rules no protegen `status`.
- `pdfUrl` se sirve tal cual (sistema-modular no regenera). Anexar documento ya hace backup en
  `reports/{ot}/backups/`.

## 3. Principios del diseño

1. **Reabrir es una operación explícita y única** (`ordenesTrabajoService.reabrir`), con motivo
   obligatorio, actor, y un registro `ot.reaperturas[]` que dice desde qué estado, hasta cuál, y qué
   se revirtió. Se elimina la doble implementación actual.
2. **Nada se borra.** Stock por contra-asiento, tickets por posta, PDF con backup, historial de
   estados append.
3. **Modelo de delta, no de rollback masivo.** Reabrir NO deshace automáticamente el stock ni la
   facturación. Lo hecho queda hecho y marcado; al re-cerrar solo se aplica lo NUEVO. Lo que haya que
   deshacer se deshace **por línea y a demanda** (botón "Revertir" por consumo). Esto es lo que
   evita el doble consumo por construcción y se ajusta a los casos reales (consumo olvidado =
   agregar; adjunto olvidado = nada en stock; parte mal detallada = revertir una línea).
4. **Idempotencia por identidad, no por flag global.** Cada efecto del cierre debe poder reconocerse
   como "ya hecho para esta OT": selección de stock con `deducidoAt` + `movimientoIds`, ticket
   "Revisar cierre" buscado por `otIds`, mailQueue por `otNumber`, OT en solicitud viva por
   `otNumbers array-contains`.
5. **Dos niveles de reapertura**, elegidos en el modal:
   - **Administrativa**: `FINALIZADO | CIERRE_ADMINISTRATIVO → CIERRE_TECNICO`. El reporte técnico
     no se toca. Sirve para corregir horas, consumos, materiales, anexar documentos.
   - **Técnica**: `… → EN_CURSO` con `status:'BORRADOR'`. El técnico vuelve a editar en reportes-ot
     y re-finaliza (que vuelve a dejar `CIERRE_TECNICO`), y después administración re-cierra.
6. **La facturación manda.** Si la OT ya está en una solicitud de facturación viva (pendiente,
   enviada, facturada o cobrada), reabrir no la toca y re-cerrar no la vuelve a ofrecer. Si hay que
   refacturar, se anula la solicitud (undo que ya existe) y el circuito repone la OT solo.

## 4. Diseño

### 4.1 Modelo (shared)
- `WorkOrder.reaperturas?: ReaperturaOT[]` — `{ id, fecha, actor, actorNombre, motivo,
  nivel: 'administrativa'|'tecnica', estadoDesde, estadoHasta, avisos: string[] }`.
- `StockSelection` gana `deducidoAt?`, `cantidadDeducida?`, `movimientoIds?: string[]`,
  `revertidoAt?`, `reversionMovimientoIds?`. `cierreAdmin.stockDeducido` pasa a ser derivado
  (todas las selecciones con `deducidoAt`) pero se mantiene escrito por compatibilidad.
- `MovimientoStock` gana `subtipo:'reversion_cierre'` y `revierteMovimientoId?`.
- Transiciones nuevas en la matriz, **solo alcanzables vía `reabrir`** (el `update` genérico las
  rechaza salvo flag interno): `CIERRE_ADMINISTRATIVO → CIERRE_TECNICO | EN_CURSO`,
  `FINALIZADO → CIERRE_TECNICO | EN_CURSO`. Se retira `FINALIZADO → CIERRE_ADMINISTRATIVO` del uso
  directo (queda cubierto por la reapertura administrativa + re-cierre).
- `WorkOrder.pdfAnterior?: { pdfUrl, protocolPdfUrl, pdfGeneratedAt, backupPath }` para la
  reapertura técnica.

### 4.2 `ordenesTrabajoService.reabrir(otNumber, { nivel, motivo }, actor)`
Transacción sobre `reportes/{ot}` + presupuestos vinculados:
1. Validar estado de origen (`CIERRE_TECNICO | CIERRE_ADMINISTRATIVO | FINALIZADO`), rol
   (admin / admin_soporte), motivo no vacío.
2. Facturación: para cada presupuesto vinculado, buscar solicitudes vivas con la OT
   (`solicitudesFacturacion where otNumbers array-contains ot and estado != 'anulada'`).
   - Sin solicitud viva: quitar `ot` de `otsListasParaFacturar`; si el presupuesto está en
     `pendiente_facturacion` y no le quedan OTs listas ni solicitudes vivas → volver a `en_ejecucion`
     (misma lógica que quitar un presupuesto de una OT cerrada). Recomputar esquema de cuotas.
   - Con solicitud viva: no tocar nada; agregar aviso "ya incluida en SF-xxxx (estado)" al registro
     de reapertura y mostrarlo en el modal. Estampar `ot.facturacionBloqueada = { solicitudId, estado }`
     para que el re-cierre lo respete sin volver a consultar.
3. OT: `estadoAdmin` al destino, `estadoAdminFecha`, `estadoHistorial += { estado, nota: 'Reabierta:
   <motivo>' }`, `fechaCierre: null`, `cierreAdmin.avisoAdminEnviado:false`,
   `cierreAdmin.fechaCierreAdmin:null`, `retenidaFacturacion`/`requisitoFacturacionPendiente` se
   conservan. `reaperturas += registro`.
4. Nivel técnica, además: `status:'BORRADOR'`; `pdfAnterior ← { pdfUrl, protocolPdfUrl,
   pdfGeneratedAt }`; `pdfGeneratedAt: FieldValue.delete()` (desbloquea el guard de reportes-ot sin
   tocar esa app); copiar los PDFs a `reports/{ot}/backups/reapertura_{ts}_*.pdf` (best-effort,
   fuera de la tx, reutilizando el helper de `reportePdfService`). Firmas: ver decisión D1.
5. Post-commit best-effort: posta en el ticket "Revisar cierre de OT" abierto (buscado por
   `otIds` + `accionPendiente`) y en el ticket de origen: "OT reabierta por <actor>: <motivo>". Los
   tickets NO cambian de estado (decisión D4). Padre: `sincronizarPadreConHijas` con permiso de
   retroceso cuando la causa es una reapertura. Evento `ot.reabierta`.

### 4.3 Re-cierre sin duplicados (`cerrarAdministrativamente`)
- Reemplazar el guard `yaCerrada` por chequeos de identidad:
  - ticket "Revisar cierre": si existe uno no finalizado con `otIds contains ot` → posta "Cierre
    administrativo repetido tras reapertura", no crear otro.
  - mailQueue: si existe doc `cierre_admin_ot` para la OT → no crear otro.
  - presupuesto: si `ot.facturacionBloqueada` (solicitud viva) → no sumar a `otsListasParaFacturar`
    ni avanzar estado. Si no, comportamiento actual (sumar + `pendiente_facturacion` si corresponde).
    Al re-cerrar se limpia `facturacionBloqueada` solo si la solicitud ya no está viva.
  - fichas/loaners/remitos de servicio: ya son idempotentes o no aplican en re-cierre.
- Deducción de stock por selección: `entregarSeleccionesCierre` devuelve resultado por selección
  (`{ selectionId, procesadas, movimientoIds }`) y `cerrarAdministrativamente` estampa `deducidoAt`
  + `movimientoIds` en cada una. Se saltean las que ya tienen `deducidoAt`. `stockDeducido` se
  escribe como "todas deducidas". Las OTs viejas (flag global true, sin detalle por línea) se
  tratan como "todas las selecciones existentes deducidas" al migrar en lectura.

### 4.4 Reversión de consumo por línea (`reservasService.revertirSeleccionCierre`)
Botón "Revertir" en cada línea deducida del bloque de materiales, disponible solo con la OT
reabierta (`CIERRE_TECNICO`/`EN_CURSO`) o en `CIERRE_ADMINISTRATIVO`. Por cada `movimientoId`:
- Leer el movimiento original; crear contra-asiento `tipo:'devolucion'`,
  `subtipo:'reversion_cierre'`, `revierteMovimientoId`, mismo `otNumber`, origen/destino invertidos.
- Unidad: si `estado:'consumido'` → `reservado` si `reservadoParaPresupuestoId` sigue apuntando a un
  presupuesto activo, si no `disponible`; parcial → `cantidad += n`. Guard transaccional: el
  movimiento original no puede tener ya una reversión (query por `revierteMovimientoId`).
- Remito: `cantidadConsumida -= n`, `consumido:false`, `estado` recalculado. Asignación:
  `cantidadConsumida -= n`, `estado:'asignado'` / doc `activa`, `otNumber` del item se conserva
  como traza. Patrón por lote: `lotes[].cantidad += n`. BOM: contra-asientos con `entidadTipo:
  'patron'` y `subtipo:'reversion_cierre'`; el guard de idempotencia del BOM pasa a **netear**
  (consumos − reversiones) en vez de "existe alguno".
- La selección queda con `revertidoAt` + `reversionMovimientoIds` y vuelve a ser editable/deducible.
- `useConsumos`: excluir movimientos referenciados por una reversión y las reversiones mismas
  (netear). Kardex (`MovimientosPage`) los muestra ambos: es el libro.
- Efecto no reversible y aceptado: `resolverLineasEnOtrosRemitos` (otros remitos del ingeniero
  marcados consumidos) — se revierte solo el remito del origen; el resto se corrige a mano y el
  modal lo avisa.

### 4.5 UI
- Modal "Reabrir OT" (reemplaza el botón actual): nivel (administrativa / técnica), motivo
  obligatorio, y un resumen calculado ANTES de confirmar: estado actual, "stock ya descontado: N
  líneas (se mantienen; podés revertirlas una por una)", "aviso de facturación: SF-xxxx facturada /
  sin aviso", "tickets que se anotan", "PDF: se conserva y se resguarda (técnica)".
- Bloque de materiales del cierre: por línea, badge "Descontado el dd/mm" + "Revertir"; líneas
  nuevas sin badge se descuentan al re-cerrar.
- `OTCierreAdminSection`: quitar el texto "Esta acción es terminal"; historial de reaperturas
  visible (fecha, quién, motivo, nivel).
- Botón visible desde `CIERRE_TECNICO`, `CIERRE_ADMINISTRATIVO` y `FINALIZADO`, con rol.
- Portal ingeniero: nada nuevo; una OT reabierta técnica vuelve a aparecer como pendiente (ya filtra
  por `status`).

### 4.6 reportes-ot (requiere autorización explícita, superficie congelada)
Cambio mínimo y único: el ticket de "acciones a tomar" debe ser idempotente por OT (guardar
`ticketAccionesId` en el doc y no crear otro si existe), porque el guard actual mira el status
cargado y una OT reabierta a BORRADOR lo pasa. Sin este cambio, la reapertura técnica de una OT con
acciones a tomar duplica el ticket. Todo lo demás de la reapertura técnica se resuelve desde
sistema-modular (`pdfGeneratedAt`, `status`).

## 5. Qué NO se revierte (y se avisa en el modal)
- Remitos de servicio pasados a `completado`, historial de fichas, liberación de loaner tras
  recalificación, `contrato.visitasUsadas`, tickets ya finalizados, mail ya enviado al cliente,
  snapshot del cierre semanal, requerimientos de compra creados por el BOM.
- Solicitud de facturación viva: se maneja anulándola desde Facturación, no desde la OT.

## 6. Fases
1. **Base (sistema-modular + shared)**: `reabrir` unificado con niveles y registro, transiciones,
   reglas de facturación, re-cierre sin duplicados (ticket/mail/presupuesto), padre con retroceso,
   `pdfGeneratedAt`/backup, modal con resumen. Tests: `test:reapertura-ot` (puro: reglas de
   facturación y de re-cierre).
2. **Stock por línea**: resultado por selección en `entregarSeleccionesCierre`, `deducidoAt`,
   reversión por línea con contra-asientos, neteo en `useConsumos` y en el guard del BOM. Tests:
   `test:reversion-cierre`.
3. **reportes-ot**: idempotencia del ticket de acciones (un cambio, con `CLAUDE_ALLOW_REPORTES_OT`).
4. Limpieza: eliminar `handleReabrirOT` duplicado, `FINALIZADO → CIERRE_ADMINISTRATIVO` directo,
   texto "acción terminal".

## 7. Decisiones abiertas
- **D1 Firmas al reabrir técnica**: ¿se conservan las firmas (cliente y especialista) o se limpia la
  del cliente para obligar a re-firmar? Propuesta: conservar, con aviso; si el cambio es de fondo el
  técnico la borra a mano en la app.
- **D2 Roles**: ¿quién reabre? Propuesta: `admin` y `admin_soporte`. ¿La técnica también la puede
  pedir el ingeniero desde el portal? Propuesta: no en esta fase.
- **D3 OT facturada/cobrada**: ¿permitir reabrir? Propuesta: sí, solo administrativa o técnica sin
  tocar la solicitud; el modal lo avisa en rojo.
- **D4 Tickets**: ¿reabrir el ticket de origen finalizado? Propuesta: no; posta informativa.
- **D5 Reversión de stock**: ¿por línea a demanda (propuesta) o todo automático al reabrir?
- **D6 Remitos de servicio completados por el cierre**: dejar como está (propuesta) o reabrirlos.
