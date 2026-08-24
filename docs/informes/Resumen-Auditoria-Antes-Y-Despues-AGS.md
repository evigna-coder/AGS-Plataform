# Antes y después

## Resumen por módulo — Auditoría ISO 9001:2015

**AGS Analítica · Agosto de 2026**

Comparación entre el sistema administrativo anterior —.NET más un conjunto de planillas de
Excel— y la plataforma en uso. Compara herramientas, no personas: los controles existían y se
hacían; lo que cambió es que hoy quedan registrados y no dependen de que alguien se acuerde.

| Módulo | Antes | Hoy |
|---|---|---|
| **Clientes** | Ficha sin relación con los equipos, sin historial de consumos ni de reparaciones. El establecimiento no existía como concepto. | Cada cliente con sus establecimientos, sus equipos y el historial de consumos y de órdenes de trabajo de cada uno. |
| **Ingreso a empresas** | Inexistente. | A desarrollar. Es el único punto de esta lista todavía no cubierto. |
| **Tickets** | Listado de *Acciones a Tomar* —518 registros— sin plazo ni responsable: el campo de prioridad decía "Sin Asignar" en todas las filas. | El pedido entra como ticket con área, prioridad y responsable, y deja una posta por cada derivación. El sistema abre además tickets solos ante una obligación pendiente y los cierra al cumplirse. |
| **Presupuestos** | El presupuesto se registraba; el seguimiento de los aceptados a la espera de la orden de compra del cliente vivía en una planilla aparte. | Ciclo completo en una pantalla: emisión, envío con fecha, validez calculada, aceptación que reserva el stock y genera los requerimientos, carga de la OC, revisiones con historial y aviso a facturación. |
| **Contratos** | No registrables en el sistema. | Contrato con su alcance, sus cupos por servicio, sus cuotas y las órdenes de trabajo que lo consumen. Aviso de vencimiento a 60 días. |
| **Facturación** | Una casilla *A Facturar: SÍ/NO* y un cuadro de texto libre al lado, con contenidos reales como "PEND REPARACION" o "garantia?". | Cierre técnico y cierre administrativo, separados y registrados. El aviso es un estado, admite avisos parciales y arrastra condición de pago y cuotas. Soporte lo ve en tiempo real y abre desde ahí el presupuesto, la OC y el informe. |
| **Pendiente de documentación** | Inexistente en el sistema: se controlaba por Excel. | En el sistema, con la confección de las solicitudes de certificación y los remitos por servicio. |
| **Cuotas** | Inexistentes. Vivían en la memoria del facturador. | Definidas sobre el presupuesto o el contrato; el sistema avisa según lo que cada cuota especifica. |
| **Órdenes de trabajo** | Ficha con vínculos de texto: tres cupos fijos de presupuesto, un campo libre para el remito. Las horas de trabajo y las partes se anotaban en papel y no llegaban al sistema. | La orden es el centro del circuito y sus vínculos son relaciones: presupuestos sin tope, ticket, contrato, equipo, materiales, remitos, ficha, loaner e informe de servicio. |
| **Reportes digitales** | El técnico completaba a mano el formulario preimpreso y el protocolo impreso de un Word. La copia de AGS se escaneaba: imagen pura, 24,5 MB por servicio, sin un número que se pueda buscar. Las horas y las partes anotadas no llegaban al sistema. | El informe y su protocolo se completan en la tablet, en la planta, con la firma del cliente en pantalla y las fotos adentro del mismo documento. Funciona sin conexión. El PDF se emite al cerrar el servicio —709 kB— y es consultable: el PDF es una copia del registro, no el registro. |
| **Portal del ingeniero** | Inexistente. El ingeniero no tenía una vista propia: su trabajo le llegaba por teléfono o por correo y volvía en papel. | Cada ingeniero entra desde el celular o la tablet y ve sus órdenes, su agenda, su historial y los tickets de su área. Desde ahí carga sus viáticos, las fotos de los loaners y de los equipos que recibe, y consulta los documentos QF. |
| **Equipos** | Un código comodín —`99999999`— permitía trabajar sobre un equipo no dado de alta, describiéndolo a mano. Sin registro del equipo no hay historial del equipo. | El equipo es un registro con sus módulos, su historial de órdenes de trabajo y de consumos, y su documentación asociada. |
| **Agenda** | Un Excel *Agenda Anual*: 27 hojas, una por año, de 2006 a 2026. Texto libre en la celda y el significado codificado en el color del relleno. Un archivo: una persona por vez. | Parte del sistema. Cada celda referencia la orden real, el color se deriva del tipo y del estado, y queda registro de quién movió qué. |
| **Control semanal** | Un botón que no ejecutaba ningún control: fijaba filtros y exportaba a Excel. El archivo *Cierre Semanal Vigente* pesa 149 MB y tiene 235 pestañas desde 2021; 36 de ellas abarcan más de una semana. | El control recorre la semana y muestra, con su motivo, cada orden agendada sin cerrar, cada cierre técnico sin el administrativo, cada presupuesto aceptado sin orden y cada aviso a facturación pendiente. |
| **Pendientes y avisos** | Registro a mano para todo el sistema. | Generación automática, explorable por equipo y por cliente. El sistema avisa vencimientos de certificados de instrumentos y de patrones, contratos por vencer, stock bajo mínimo y tickets de alta prioridad sin movimiento. |
| **Stock** | Movimientos, reportes y mínimos ya existían y funcionaban. El técnico anotaba las partes en papel y alguien las cargaba después; lo que un ingeniero se llevaba en el auto no quedaba registrado. | Reserva por presupuesto, asignación por ingeniero y remitos internos y externos, con líneas que distinguen lo que se entrega de lo que sale y vuelve. Fichas de equipo del cliente, loaners con sus partes faltantes, patrones, compras e importaciones con su costeo. El consumo se produce al cierre administrativo. |
| **Documentos QF** | Documentos controlados en archivos Word y en papel. El vínculo entre el documento y el registro era el nombre del archivo escaneado. | Registro de los documentos QF con su numeración formal, su versión vigente, su estado y el historial de cada versión con autor y fecha. |
| **Biblioteca de tablas** | El protocolo se imprimía de un Word y se completaba a mano. Nada garantizaba que la revisión impresa fuera la vigente. | Las plantillas viven en una biblioteca central y solo está disponible la versión publicada: la obsoleta no existe para elegir. El valor se captura una sola vez, en la tablet. |

---

**Cinco apuntes**

- **El escaneo desapareció.** Informes, fichas, órdenes de trabajo y órdenes de compra se
  escaneaban y renombraban a mano: alrededor de tres horas semanales, unas 150 horas al año.
- **Trazabilidad del registro.** Además del usuario y la fecha de alta y de última
  modificación —que el sistema anterior ya guardaba—, cada registro conserva hoy el historial
  completo de sus cambios.
- **Observación de la auditoría anterior.** La ausencia de avisos de vencimiento de patrones e
  instrumentos quedó cubierta con el panel de vencimientos de la pantalla principal, que
  diferencia vencidos de próximos a vencer y lleva al listado correspondiente.
- **Dos aplicaciones, un registro.** El portal del ingeniero y el back-office escriben sobre
  los mismos datos: lo que la coordinadora agenda aparece en "Mis OTs", el cierre técnico
  deriva solo el ticket para el cierre administrativo, y el informe, las fotos y los viáticos
  cargados en la planta están en la oficina en el momento.
- **Pendiente declarado.** La matriz de competencias se mantiene en planilla, actualizada. Su
  digitalización está prevista y no es prioritaria.
