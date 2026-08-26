# El sistema en marcha

## Guía para la reunión de dirección

**AGS Analítica · Lunes 31 de agosto de 2026**

---

## 1. Resumen ejecutivo

Entre mayo y agosto la operación de AGS pasó del sistema anterior —.NET más un conjunto de
planillas de Excel— a una plataforma propia que hoy cubre el circuito completo: el pedido del
cliente, el presupuesto, la orden de trabajo, el informe firmado en la planta, el stock, la
facturación y la cobranza. Desde el 7 de mayo se publicaron **170 actualizaciones**; la
plataforma va por la versión **1.77** y se actualiza sola en cada puesto de trabajo.

El mensaje central para esta reunión no es la cantidad de pantallas: es que **los controles
que antes dependían de la memoria de las personas hoy los ejecuta el sistema**, quedan
registrados, y cuando algo falta el sistema avisa solo. Los controles existían y se hacían
—esto compara herramientas, no personas—; lo que cambió es que ya no se pueden olvidar.

**La frase para llevarse:** el papel y el Excel registraban lo que alguien se acordaba de
anotar. El sistema registra lo que pasó.

---

## 2. Agenda propuesta (45 minutos)

| Tiempo | Bloque | Contenido |
|---|---|---|
| 5' | Apertura | El número gordo: qué se construyó y desde cuándo (sección 1). |
| 25' | Recorrido por módulos | Módulo por módulo, con paradas largas en los fuertes (sección 3). |
| 8' | Los controles | La lámina de la sección 4 — el cierre de tranquilidad. |
| 4' | Antes y después | Repartir impresa la comparativa por módulo (documento aparte, ya emitido). |
| 3' | Lo que viene | Portales externos y pendientes declarados (sección 6). |

---

## 3. El recorrido módulo por módulo

El orden sigue el circuito real del negocio: del pedido al cobro. Los módulos de paso se
muestran en una frase; en los **fuertes** conviene detenerse — abajo, qué mostrar y qué
señalar en cada uno. Preparar antes un cliente de prueba con datos cargados.

### Módulos de paso (una frase y seguir)

- **Clientes y establecimientos** — cada cliente con sus plantas, equipos e historial.
- **Tickets** — el pedido entra con área, prioridad y responsable; cada derivación deja posta.
- **Órdenes de trabajo** — el centro del circuito: todos los vínculos son relaciones, no texto.
- **Agenda** — la celda referencia la orden real; el ingeniero la ve en su portal al instante.
- **Control semanal y pendientes** — lo que falta, con su motivo, todos los lunes.
- **Facturación, contratos, instrumentos, documentos QF, biblioteca de tablas** — mencionar
  y ofrecer detalle a demanda.

### ⭐ Presupuestos — detenerse

*Mostrar:* emitir uno, aceptarlo, y abrir las ventanas de historial.

- **Un click dispara toda la logística**: al aceptar, el sistema reserva el stock a nombre
  del cliente, genera los requerimientos de compra por lo que falta y abre solo el ticket
  de reserva física para Materiales.
- **La inteligencia comercial a la vista**: mientras se cotiza, el historial de factores
  usados con ese cliente y las notas de precio del equipo flotan al costado — la experiencia
  de ventas dejó de vivir en la memoria de cada uno.
- **Revisiones con historial**: cada versión del presupuesto queda; se sabe qué se le
  ofreció al cliente y cuándo.
- **Empalme directo con facturación**: aceptado con orden de compra cargada avisa solo;
  aceptado sin OC queda visible como tal — no se factura de memoria.

### ⭐ Stock — detenerse

*Mostrar:* un artículo con unidades, el kardex de una unidad, y una reserva.

- **Cada pieza física es un registro**: serie o lote, ubicación, costo y su recorrido
  completo desde el ingreso hasta el consumo. Preguntar "¿dónde está?" tiene respuesta.
- **La reserva por presupuesto**: lo aceptado queda apartado a nombre del cliente y del
  presupuesto — nadie se lo lleva por error para otro trabajo.
- **Envases y presentaciones**: se compra y se vende por el número de parte del envase
  (el que el cliente reconoce) y el stock se mueve en unidades base — el papel y el
  depósito dejan de hablar idiomas distintos.
- **Kits de compra**: el kit ingresa entero con su costo y se desarma en sus componentes
  con una acción, todo trazado.
- **El libro de movimientos es inmutable**: como en contabilidad, se corrige con
  contra-asiento, nunca borrando.

### ⭐ Asignaciones — detenerse

*Mostrar:* el panel "qué tiene cada ingeniero" y el inventario de uno de ellos.

- **La mochila dejó de ser una caja negra**: todo lo que salió al campo está a la vista,
  con serie, lote y — en los patrones — el vencimiento (los vencidos en campo se marcan
  en rojo).
- **Cada salida con su remito interno**; la devolución o el consumo resuelven ese remito
  solos — no quedan papeles abiertos eternamente.
- **El consumo se imputa a la orden desde el cierre**: lo que el ingeniero usó queda
  cargado al trabajo que corresponde, con el movimiento asentado, en un solo paso.

### ⭐ Requerimientos, compras e importaciones — detenerse

*Mostrar:* la consolidación de requerimientos, una OC y una importación con su costeo.

- **Del faltante a la orden de compra sin recopiar**: los requerimientos —manuales, por
  mínimo de stock o generados por un presupuesto aceptado— se consolidan y se convierten
  en OC.
- **Importaciones con costeo real por embarque**: valor en aduana, derechos, gastos y tipo
  de cambio; cada unidad ingresada sabe cuánto costó, por lote. El costo estimado del
  ingreso se recalcula si faltó un gasto y el definitivo se confirma cuando llegan las
  facturas — sin pisar el registro de con qué número se trabajó.
- **La calificación de proveedores se alimenta sola**: cada recepción y cada retorno de
  reparación abren su evento de calificación, asignado al responsable.

### ⭐ Fichas — el equipo del cliente en nuestro laboratorio — detenerse

*Mostrar:* una ficha con items, su historial y una derivación a proveedor.

- **Nada entra al laboratorio sin ficha**: número propio, items con serie, fotos del
  ingreso, y estado visible — se acabó el "¿de quién era esto que está en el bench?".
- **Derivación a proveedor externo con remito**; cuando el módulo vuelve, el retorno
  resuelve el remito y dispara la calificación del proveedor.
- **Vínculo vivo con el trabajo**: la ficha se ata a la orden y sigue la cadena de items
  (.01 → .02 → …) hasta la entrega, con cada cierre asentado en su historial.

### ⭐ Loaners — los equipos de préstamo — detenerse

*Mostrar:* el listado, el detalle de uno prestado y sus vínculos.

- **Cada equipo propio con su historia completa**: préstamos con remito y fotos, dónde
  está hoy, qué le falta (un loaner desarmado se ve INCOMPLETO, no "en base").
- **El triángulo completo**: el préstamo se vincula con la orden de la visita y con la
  ficha del equipo del cliente que vino a cambio — los tres navegables entre sí.
- **El retorno dispara la recalificación**: al volver de un cliente, el sistema abre solo
  la orden de recalificación; el equipo no vuelve al estante sin pasar por el laboratorio.
- **Las partes extraídas quedan trazadas**: un repuesto canibalizado dice de qué loaner
  salió, hasta en la orden cerrada.

> Sugerencia práctica: dejar las pantallas ya abiertas en pestañas, en este orden. Con los
> módulos de paso en una frase, las seis paradas largas entran cómodas en 25 minutos.

---

## 4. Los controles — la lámina central

### El sistema no deja (bloqueos)

- **Numeración única y correlativa** de órdenes, tickets y remitos. Un ítem no se borra:
  se cancela con motivo y el número queda.
- **No se factura sin la documentación que el cliente exige**: la orden queda retenida hasta
  el remito firmado o la certificación, y la cola de retenidas se gestiona por planta.
- **Un informe no se finaliza incompleto**: fechas, horas, firmas y —si el servicio lo
  exige— el protocolo. Cada faltante se señala en pantalla antes de permitir cerrar.
- **Un informe finalizado no puede ser pisado** por un guardado accidental, la firma del
  especialista solo se precarga a su propio autor, y un protocolo con datos no puede quedar
  vacío por error de otra sesión.
- **El stock no se consume "a mano"**: el consumo sale del cierre administrativo de la orden,
  que imputa la orden, descuenta la unidad y asienta el movimiento en el mismo acto.
- **El libro de movimientos de stock es inmutable**: no se edita ni se borra; una corrección
  se hace con un contra-asiento que deja rastro, como en contabilidad.
- **Una pieza no puede salir dos veces**: la unidad que ya viajó en un remito no se ofrece
  de nuevo, y completar un remito con ítems sin resolver pide confirmación explícita.
- **Accesos por rol**: cada usuario ve los módulos de su función, con excepciones por
  persona cuando la dirección lo decide.

### El sistema se acuerda (avisos automáticos)

- Vencimientos de certificados de patrones e instrumentos, diferenciando vencido de próximo.
- Contratos por vencer, con 60 días de anticipación.
- Stock bajo mínimo: genera el requerimiento de compra solo.
- Cuotas de facturación según lo que cada cuota especifica.
- Obligaciones operativas: la reserva física de materiales, el aviso a facturación y la
  calificación de proveedores abren su propio ticket, asignado al responsable que
  corresponde, sin intervención de nadie.

### El sistema recuerda (trazabilidad)

- Cada registro guarda quién lo creó, quién lo modificó y el historial completo de cambios.
- Cada ticket conserva sus postas; cada orden, su historial de estados; cada unidad de
  stock, su recorrido desde el ingreso hasta el consumo, con serie y lote.
- El informe de servicio es un registro consultable: el PDF es una copia del registro, no
  el registro.

### El sistema se resguarda (continuidad)

- **Copia de seguridad externa diaria** de la base completa, en disco físico fuera de la
  nube, con verificación automática de que la copia del día se hizo — y alerta visible
  cuando no.
- Dos aplicaciones (oficina y campo) sobre **un único registro**: no hay planillas paralelas
  que sincronizar ni versiones que comparar.

---

## 5. Cifras del período

| Indicador | Valor |
|---|---|
| Primera versión en producción | 7 de mayo de 2026 |
| Versión actual | 1.77 |
| Actualizaciones publicadas | 170 (automáticas en cada puesto) |
| Cambios registrados desde junio | más de 600 |
| Módulos en operación | 18 (ver comparativa adjunta) |
| Aplicaciones | Back-office, portal del ingeniero, informes en tablet |

---

## 6. Lo que viene

- **Portales externos**: el portal del cliente (seguimiento de sus equipos y servicios) y el
  de proveedores, hoy en vista previa. Salen a producción cuando se cierre el modelo de
  acceso multi-empresa.
- **Pendientes declarados**: el módulo de ingreso a empresas y la digitalización de la matriz
  de competencias — previstos, no prioritarios.
- **Mejora continua con registro**: cada pedido del equipo de soporte entra como cambio
  versionado; esta misma semana se publicaron tres versiones con mejoras pedidas por el
  sector.

---

## 7. Material de apoyo para la mesa

| Documento | Uso en la reunión |
|---|---|
| *Resumen Auditoría — Antes y Después* | Repartir impreso en el bloque 4 (una carilla). |
| *Del Papel al Sistema* | Referencia completa, para quien quiera profundizar después. |
| *Portales Externos — Vista Previa* | Mostrar solo si la conversación llega ahí. |
| *Trabajo Sin Conexión — Reportes OT* | Respaldo por si preguntan por la operación en planta. |
