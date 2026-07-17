# Tanda UAT sesión Fanely (2026-07-17) — 12 pedidos

Fuente: mensaje de Esteban post-sesión con Fanely (jefa de soporte). Estado por item.

## Rápidos / claros (implementar ya)

**3. OT tipo entrega → tipo de servicio "Entrega de insumos" por defecto.** En el form de creación (useCreateOTForm/CreateOTModal), cuando tipoOT==='entrega' precargar el tipo de servicio (buscar si existe en tipos_servicio; si no, texto fijo). → AGENTE B

**6. Agenda: en las OTs pendientes del costado, mostrar tipo de servicio + ID equipo (agsVisibleId).** AgendaPendingSidebar. → AGENTE B

**12. OT list: columna + filtro "fecha de asignación"; verificar que el filtro de estado ofrezca Asignada.** SUPUESTO a validar con Esteban: "fecha de asignación" = cuándo se asignó (estadoHistorial → entrada ASIGNADA), no la fecha agendada del servicio (esa ya existe como fechaServicioAprox). → AGENTE B

**2. Carga de items de presupuesto: eliminar la carga antigua, dejar solo el wizard, renombrarlo "Agregar artículo", y al confirmar con Enter el foco vuelve al botón para encadenar altas.** UI mediana (AddItemModal/PresupuestoAddItemWizard/editor de items). → tanda siguiente (yo).

## Medianos (diseño corto + implementar en esta ronda)

**1. Diferenciar "Pend. OC" simple vs "Pend. OC con trabajo realizado".** Un ppto sin OC del cliente pero con OT cerrada = urgencia distinta (ya se hizo el trabajo, la aprobación es de facto). Mostrar badge propio en el visor de presupuestos ("Pend. OC — trabajo realizado"), filtro/KPI, y reflejarlo en el ticket (accionPendiente/motivo). Join ppto↔OTs cerradas = el mismo de la analítica (reusar).

**4. Ticket "pendiente de facturación" a la encargada de administración al generar el aviso.** Investigar qué existe hoy: cerrarAdministrativamente crea un admin-ticket; generarAvisoFacturacion solo transiciona el ticket comercial. Falta: ticket/derivación al área administración (responsablePorArea) cuando se genera la solicitud.

**10. Multi-OT: el aviso a facturación recién cuando cierra la ÚLTIMA OT del ppto** (salvo esquema con anticipo). Hoy cerrarAdministrativamente marca pendiente_facturacion con la primera. Gate: comparar otsVinculadas vs cerradas; anticipos vía esquemaFacturacion siguen habilitados.

**5. Nuevo estado de presupuesto "pendiente de cobro"**: cuando la(s) factura(s) están emitidas → pendiente_cobro; cuando se cobra todo → finalizado. OJO: cambio de enum PresupuestoEstado = tocar PRESUPUESTO_ESTADO_MIGRATION, KPIs, filtros, e2e (lección del bug de migración v1.14.1). Diseñar junto con 10.

## Grandes (diseño primero)

**9. Portal ingeniero — "Mis OT" rediseño completo + botón "Solicitar presupuesto".**
- Card por OT del día → detalle con TODO: cliente/establecimiento/contacto/sector, N° OT, equipo/sistema/módulo/serie/software/versión/observaciones; bloque "Configuración" (todos los módulos + observaciones de c/u); presupuestos + OCs vinculados; tareas pendientes del equipo; materiales del servicio; materiales asignados al ingeniero (minikit, flujímetro, termómetro… con ID y link al certificado para instrumentos/patrones).
- Estética tipo el PDF de OC (secciones con tarjetas/globos). Esteban ofrece sesión de mockups (4-5 variantes Pencil) — coordinar. Gotcha Pencil: layout engine se corrompió la última vez; si pasa, cerrar/reabrir el .pen.
- Botón nuevo "Solicitar presupuesto": (a) toma número de ppto atómico y lo devuelve en pantalla ("Se generó el presupuesto XXX"), asignándolo a la OT; (b) crea el ppto precargado (cliente, establecimiento, contacto, equipo, origen OT); (c) ticket al encargado de presupuestos para completar y enviar. Encargado = Miguel Barrios HOY → hacerlo configurable (config-flujos / responsablePorArea), no hardcodear persona.

**11. Condición de pago anticipada → OT solo tentativa hasta el cobro.** Se puede crear (reservar agenda) pero no confirmar/realizar; genera ticket a coordinación "pendiente de cobro". PREGUNTA ABIERTA: ¿cómo se marca que una condición de pago es anticipada? (flag nuevo `esAnticipada` en CondicionPago vs derivar del esquema de facturación con cuota hito ppto_aceptado). Definir con Esteban antes de implementar.

## En curso paralelo

- **Analítica de presupuestos etapa 1** → AGENTE A (plan `.claude/plans/presupuestos-analitica.md`, decisiones ya respondidas; incluye fechaAnulacion en anulaciones).

## Preguntas pendientes para Esteban

1. (item 12) ¿"Fecha de asignación" = cuándo se asignó la OT, o la fecha para la que se agendó? Asumimos lo primero.
2. (item 11) ¿Cómo marcamos una condición de pago como anticipada? ¿Flag en el catálogo de condiciones de pago?
3. (item 5) Confirmar: pendiente_cobro = todas las solicitudes facturadas; finalizado = todas cobradas.
4. (item 9) Coordinar sesión de mockups para Mis OT.
