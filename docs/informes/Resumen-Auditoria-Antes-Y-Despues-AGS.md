# Antes y después

## Resumen por módulo y por procedimiento — Auditoría ISO 9001:2015

**AGS Analítica · Septiembre de 2026**

Comparación entre el sistema administrativo anterior —.NET más un conjunto de planillas de
Excel— y la plataforma en uso. Compara herramientas, no personas: los controles existían y se
hacían; lo que cambió es que hoy quedan registrados y no dependen de que alguien se acuerde.
La segunda parte relaciona cada registro previsto por los procedimientos del Sistema de
Gestión de Calidad con el lugar donde se lleva hoy.

---

## 1. Qué cambió, módulo por módulo

| Módulo | Antes | Hoy |
|---|---|---|
| **Clientes** | Ficha sin relación con los equipos, sin historial de consumos ni de reparaciones. El establecimiento no existía como concepto. | Cada cliente con sus establecimientos, sus equipos y el historial de consumos y de órdenes de trabajo de cada uno. |
| **Ingreso a empresas** | Inexistente. | A desarrollar. Es el único punto de esta lista todavía no cubierto. |
| **Tickets** | Listado de *Acciones a Tomar* —518 registros— sin plazo ni responsable: el campo de prioridad decía "Sin Asignar" en todas las filas. | El pedido entra como ticket con área, prioridad y responsable, y deja una posta por cada derivación. El sistema abre además tickets solos ante una obligación pendiente y los cierra al cumplirse. |
| **Presupuestos** | El presupuesto se registraba; el seguimiento de los aceptados a la espera de la orden de compra del cliente vivía en una planilla aparte. | Ciclo completo en una pantalla: emisión, envío con fecha, validez calculada, aceptación que reserva el stock y genera los requerimientos, carga de la OC, revisiones con historial y aviso a facturación. |
| **Contratos** | No registrables en el sistema. | Contrato con su alcance, sus cupos por servicio, sus cuotas y las órdenes de trabajo que lo consumen. Aviso de vencimiento a 60 días. |
| **Facturación** | Una casilla *A Facturar: SÍ/NO* y un cuadro de texto libre al lado, con contenidos reales como "PEND REPARACION" o "garantia?". | Cierre técnico y cierre administrativo, separados y registrados. El aviso es un estado, admite avisos parciales y arrastra condición de pago y cuotas. |
| **Pendiente de documentación** | Inexistente en el sistema: se controlaba por Excel. | En el sistema, con la solicitud de certificación por lote al cliente, la carga de cada documento recibido y la facturación de lo certificado. |
| **Órdenes de trabajo** | Ficha con vínculos de texto: tres cupos fijos de presupuesto, un campo libre para el remito. Las horas de trabajo y las partes se anotaban en papel y no llegaban al sistema. | La orden es el centro del circuito y sus vínculos son relaciones: presupuestos sin tope, ticket, contrato, equipo, materiales, remitos, ficha, loaner e informe de servicio. |
| **Reportes digitales** | El técnico completaba a mano el formulario preimpreso y el protocolo impreso de un Word. La copia de AGS se escaneaba: imagen pura, 24,5 MB por servicio, sin un número que se pueda buscar. | El informe y su protocolo se completan en la tablet, en la planta, con la firma del cliente en pantalla y las fotos adentro del mismo documento. Funciona sin conexión. El PDF —709 kB— es una copia del registro, no el registro. |
| **Portal del ingeniero** | Inexistente. El trabajo le llegaba al ingeniero por teléfono o por correo y volvía en papel. | Cada ingeniero ve desde el celular sus órdenes, su agenda, su historial y los tickets de su área; carga viáticos, fotos de loaners y de mercadería, y consulta los documentos QF. |
| **Equipos** | Un código comodín —`99999999`— permitía trabajar sobre un equipo no dado de alta, describiéndolo a mano. Sin registro del equipo no hay historial del equipo. | El equipo es un registro con sus módulos, su historial de órdenes de trabajo y de consumos, y su documentación asociada. |
| **Agenda** | Un Excel *Agenda Anual*: 27 hojas, una por año, de 2006 a 2026. Texto libre en la celda y el significado codificado en el color del relleno. Un archivo: una persona por vez. | Parte del sistema. Cada celda referencia la orden real, el color se deriva del tipo y del estado, y queda registro de quién movió qué. |
| **Control semanal** | Un botón que no ejecutaba ningún control: fijaba filtros y exportaba a Excel. El archivo *Cierre Semanal Vigente* pesa 149 MB y tiene 235 pestañas desde 2021; 36 de ellas abarcan más de una semana. | El control recorre la semana y muestra, con su motivo y los días acumulados, cada orden agendada sin cerrar, cada cierre técnico sin el administrativo, cada presupuesto aceptado sin orden y cada aviso a facturación pendiente. |
| **Pendientes y avisos** | Registro a mano para todo el sistema. | Generación automática. El sistema avisa vencimientos de certificados de instrumentos y de patrones, contratos por vencer, stock bajo mínimo y tickets de alta prioridad sin movimiento. |
| **Stock** | Movimientos, reportes y mínimos ya existían y funcionaban. El técnico anotaba las partes en papel y alguien las cargaba después; lo que un ingeniero se llevaba en el auto no quedaba registrado. | Reserva por presupuesto, asignación por ingeniero y remitos internos y externos. Fichas de equipo del cliente, loaners con sus partes faltantes, patrones, compras e importaciones con su costeo. El consumo se produce al cierre administrativo. |
| **Documentos QF** | Documentos controlados en archivos Word y en papel. El vínculo entre el documento y el registro era el nombre del archivo escaneado. | Registro de los documentos QF con su numeración formal, su versión vigente, su estado y el historial de cada versión con autor y fecha. |
| **Biblioteca de tablas** | El protocolo se imprimía de un Word y se completaba a mano. Nada garantizaba que la revisión impresa fuera la vigente. | Las plantillas viven en una biblioteca central y solo está disponible la versión publicada: la obsoleta no existe para elegir. El valor se captura una sola vez, en la tablet. |

---

## 2. Los registros previstos por los procedimientos: dónde se llevaban y dónde se llevan

Los procedimientos operativos —calificación, mantenimiento preventivo, reparación,
instalación y preservación del producto— definen qué se registra en cada etapa del servicio.
Eso no cambió. Lo que cambió es el soporte del registro: del formulario en papel y la
planilla al sistema. Esta es la correspondencia, registro por registro:

| Registro previsto | Así se llevaba | Así se lleva hoy |
|---|---|---|
| Agenda de actividades (QF7.0205) | Planilla anual, una celda por persona y día | Módulo Agenda: cada celda referencia la orden de trabajo, con registro de quién la programó y cuándo |
| Orden de trabajo (QF7.0203) | Ficha en el sistema anterior, con referencias a presupuestos y remitos en campos de texto | Módulo Órdenes de Trabajo, con estados y vínculos directos a presupuesto, ticket, contrato, equipo, materiales, remitos, ficha, loaner e informe |
| Reporte de servicio (QF7.0502), original y copia | Formulario preimpreso completado a mano en planta; copia para el cliente en el momento y copia de AGS escaneada y archivada | Informe de servicio digital completado en la tablet, firmado por el cliente en pantalla, con fotos incluidas; el cliente lo recibe al cerrar el servicio |
| Informe de calificación (QF7.0503) | Protocolo impreso desde el archivo controlado, completado a mano y escaneado junto con el informe | PDF emitido por el sistema con informe, protocolo y fotos en un solo documento consultable |
| Checklists por tipo de equipo (QF7.0601 a QF7.0609) | Impresos desde los archivos controlados | Biblioteca de Tablas: solo está disponible la versión publicada de cada plantilla; el valor se captura una sola vez |
| Remito (QF7.0501) | Emitido en el sistema anterior y referenciado en la orden | Módulo Remitos, vinculado a la orden, con líneas que distinguen lo que se entrega de lo que sale y vuelve |
| Control de stock | Movimientos en el sistema anterior, cargados desde lo anotado en el informe | Módulo Stock: artículos, unidades, posiciones y minikits; el consumo se registra al cierre administrativo de la orden |
| Presupuesto | Registrado en el sistema anterior, con seguimiento de los aceptados en planilla | Módulo Presupuestos, con todo el ciclo y el seguimiento en una pantalla |
| Evaluación de proveedores | Listado de proveedores y evaluación periódica | Módulo Calificación de Proveedores, con los eventos de cada recepción registrados |

Cuatro procesos que hoy forman parte de la operación tienen su circuito completo en el
sistema: el préstamo de equipos a clientes, los contratos de servicio, las importaciones con
su costeo y el resguardo de la información con control de accesos.

---

## 3. Lo que la auditoría puede verificar en pantalla

| Requisito de la norma | Antes | Hoy |
|---|---|---|
| Información documentada (7.5) | Formularios controlados en papel y Word; el vínculo entre documento y registro era el nombre del archivo escaneado | Registro digital único; las plantillas de protocolo solo en su versión publicada; los documentos QF con su versión vigente y su historial |
| Trazabilidad del registro | Usuario y fecha de alta y de última modificación | Historial completo de cambios de cada registro, no solo el último |
| Propiedad del cliente (8.5.3) | Ficha del equipo recibido, con la derivación a terceros anotada | Ficha del equipo con ciclo de estados, derivación y fecha de retorno; loaners con sus partes prestadas y faltantes |
| Control de proveedores externos (8.4) | Evaluación periódica manual | Módulo de calificación con eventos registrados por cada recepción o incidencia |
| Recursos de seguimiento y medición (7.1.5) | Estado del certificado visible en cada listado | Ídem, más el panel de vencimientos en la pantalla principal, que diferencia vencidos de próximos a vencer |
| Control operacional (8.5.1) | Control semanal ejecutado por las personas sobre un listado exportado | Control semanal calculado por el sistema, con motivo y días acumulados por cada pendiente, y registro de lo revisado |
| Competencia (7.2) | Matriz de competencias en planilla | Sin cambios: se mantiene en planilla, actualizada |

Una diferencia de fondo atraviesa la tabla: hoy el estado de cada registro lo fija el
circuito, no una casilla. Un presupuesto no queda aceptado sin que el sistema reserve el
stock, una orden no se factura sin su cierre administrativo, y un protocolo no se emite sobre
una plantilla que no sea la vigente.

---

**Cuatro apuntes**

- **El escaneo desapareció.** Informes, fichas, órdenes de trabajo y órdenes de compra se
  escaneaban y renombraban a mano: alrededor de tres horas semanales, unas 150 horas al año.
- **Observación de la auditoría anterior.** La ausencia de avisos de vencimiento de patrones e
  instrumentos quedó cubierta con el panel de vencimientos de la pantalla principal, que
  diferencia vencidos de próximos a vencer y lleva al listado correspondiente.
- **Dos aplicaciones, un registro.** El portal del ingeniero y el back-office escriben sobre
  los mismos datos: lo que la coordinadora agenda aparece en "Mis OTs", el cierre técnico
  deriva solo el ticket para el cierre administrativo, y el informe, las fotos y los viáticos
  cargados en la planta están en la oficina en el momento.
- **Trazabilidad del registro.** Además del usuario y la fecha de alta y de última
  modificación —que el sistema anterior ya guardaba—, cada registro conserva hoy el historial
  completo de sus cambios.
