# Feature Landscape: Circuito Comercial Completo (v2.0)

**Domain:** B2B post-venta técnica — servicio de equipos analíticos de laboratorio
**Researched:** 2026-04-18
**Confidence overall:** MEDIUM-HIGH (patrones de industria verificados via Dynamics 365 Field Service, Salesforce FSL, principios Q2C estándar; pricing por distancia y detalles LATAM con menor fuente)

---

## Contexto de dominio

AGS Analítica vende, instala y da soporte a equipos analíticos de laboratorio (HPLC, cromatógrafos, etc.). El ciclo de servicio es:

```
Lead/Ticket → Presupuesto → Aceptación cliente → OC del cliente →
Verificación stock → [si falta: Importación] → OT → Servicio en campo → Cierre → Aviso facturación
```

Los modelos de contrato son:
- **Contrato anual**: precio fijo por equipo/periodo, visitas incluidas, respuesta garantizada
- **Per-incident**: precio por llamada/visita, partes a costo
- **Mixto**: contrato base + partes por fuera
- **Venta de partes**: sin servicio, solo materiales
- **Presupuesto de venta**: equipos nuevos

---

## Table Stakes — Must Have v2.0

Features que los usuarios de AGS esperan que funcionen. Si faltan, el circuito no cierra.

### 1. Catálogo de Servicios con Reglas de Precio por Tipo de Cliente

**Por qué es table stakes:** Sin esto, el vendedor calcula precios manualmente en cada presupuesto. Un cliente contrato y uno per-incident no pueden recibir el mismo precio de lista sin lógica de aplicación.

**Comportamiento esperado:**
- Cada servicio/categoría tiene un precio base (lista).
- Un cliente con contrato activo recibe precio contractual (puede ser 0 si está incluido en el abono mensual, o precio reducido para partes adicionales).
- Un cliente per-incident recibe precio de lista o precio especial negociado (override por cliente).
- La jerarquía de precios es: `override_por_cliente > precio_contrato > precio_lista`.

**Reglas de distancia (mano de obra):**
- El viático/traslado varía por zona geográfica. La práctica estándar en field service es definir rangos de km o zonas (zona 1: 0-50 km, zona 2: 50-200 km, zona 3: 200+ km) con un cargo fijo o por hora de viaje adicional.
- En LATAM, es común expresar zonas como "GBA", "Interior Buenos Aires", "Interior país", "Exterior" con tarifas fijas o porcentaje del total.
- El cargo de distancia aplica a per-incident y mixto; en contrato anual queda pre-acordado (fijo o con límite de zona).

**Complejidad:** Media — la estructura de datos requiere cuidado (precio por servicio + regla de cliente + regla de distancia + vigencia), pero el UI es un CRUD con validaciones.

**Dependencias:** Ninguna de las otras features — este catálogo es fundacional.

---

### 2. Presupuestos para Per-Incident, Partes y Mixto

**Por qué es table stakes:** El módulo contrato ya cierra. Per-incident y partes son los otros dos tipos de presupuesto más comunes en el negocio. Sin ellos, el vendedor trabaja en Word/Excel.

**Comportamiento esperado:**

*Per-incident:*
- Items: servicios (mano de obra) + partes (materiales) + viáticos (distancia).
- Precio unitario tomado del catálogo según jerarquía de precios.
- El cliente puede aceptar o pedir modificaciones.
- Al aceptar, genera ticket de seguimiento si no había uno.

*Partes (venta materiales):*
- Solo líneas de producto/repuesto.
- Sin mano de obra.
- Precio de catálogo o precio especial.
- Al aprobar, dispara verificación de stock antes de confirmar fecha de entrega.

*Mixto (contrato base + partes extra):*
- Un presupuesto que referencia un contrato existente del cliente.
- Las partes o servicios fuera del alcance del contrato se cobran aparte.
- El presupuesto mixto sólo cubre el delta sobre el contrato.

**Complejidad:** Media-Alta — reutiliza la infraestructura del contrato (editor de items, PDF, mail), pero cada tipo tiene lógica de cálculo y display diferente.

**Dependencias:** Catálogo de servicios (#1).

---

### 3. Estado del Presupuesto con Tracking de OC del Cliente

**Por qué es table stakes:** En B2B de servicios, la aceptación verbal de un presupuesto no es una orden. El hito real es la recepción de la OC (orden de compra) del cliente. Sin ese tracking, el área comercial no sabe en qué presupuestos esperar la OC y el pipeline queda ciego.

**Estados estándar del ciclo de vida de un presupuesto en field service B2B:**

```
borrador → enviado → [aceptado_verbal | rechazado | vencido] →
oc_recibida → [en_preparacion | derivado_importacion] →
ot_creada → ot_completada → facturado
```

**Comportamiento esperado:**
- `borrador`: creación interna, no visible al cliente.
- `enviado`: se mandó al cliente por mail (con fecha de envío y vencimiento).
- `aceptado_verbal`: cliente confirmó por mail/teléfono pero no mandó OC todavía. Genera alerta de seguimiento automático a los N días (configurable, estándar: 5 días hábiles).
- `oc_recibida`: se cargó el número de OC del cliente y se adjuntó el PDF. Es el hito que habilita los siguientes pasos.
- `derivado_importacion`: el sistema detectó que hay items sin stock suficiente y requieren importación. El presupuesto queda en espera hasta que Comex confirme ETA.
- `ot_creada`: coordinador creó la OT asociada. El presupuesto pasa a seguimiento de ejecución.
- `facturado`: administración cargó en Bejerman y marcó el presupuesto como facturado.

**Alerta de OC no recibida:** Si un presupuesto pasa a `aceptado_verbal` y no llega a `oc_recibida` en N días, se genera un ticket de seguimiento comercial asignado al vendedor responsable. Esto es tabla stakes — sin él, los presupuestos caen en el olvido.

**Complejidad:** Media — principalmente estado + lógica de transición + alerta automática.

**Dependencias:** Presupuestos (#2), Tickets (#ya implementado).

---

### 4. Verificación de Stock Ampliada Antes de Crear OT

**Por qué es table stakes:** El error más costoso en field service es enviar un técnico a una visita para descubrir que no tiene las partes. La verificación debe hacerse ANTES de crear la OT.

**Fórmula estándar (ATP — Available-to-Promise):**

```
ATP = (Stock disponible + En tránsito/importación + En OC internas abiertas) 
      - (Reservado para otras OTs + Reservado para otras OCs confirmadas)
```

Fuente: Microsoft Dynamics 365 Supply Chain, Infor M3, estándar de industria.

**Comportamiento esperado al recibir OC:**
1. Sistema evalúa cada item del presupuesto contra ATP.
2. Si ATP >= cantidad requerida para todos los items: habilita creación de OT (botón activo).
3. Si ATP < cantidad para algún item: muestra alerta con detalle por item (disponible: X, requerido: Y, déficit: Z).
4. La alerta da dos opciones: (a) derivar a Importaciones con los items faltantes, (b) crear OT parcial con los items disponibles y marcar el resto como pendiente.

**Lo que NO se hace automáticamente:** La OT no se crea sola. Un coordinador humano decide crear la OT después de ver el estado de stock. El sistema facilita la decisión, no la toma.

**Complejidad:** Media — el cálculo ATP requiere consultar múltiples colecciones (stock, reservas, movimientos, OCs internas, DUAs de Comex). Implementar sin reescribir el módulo de stock.

**Dependencias:** Stock existente (#ya implementado), Comex existente (#ya implementado), Presupuestos (#2).

---

### 5. Derivación Automática a Importaciones

**Por qué es table stakes:** Si un presupuesto requiere partes que no están en stock local ni en tránsito, alguien en Importaciones necesita saberlo para iniciar la gestión. Sin este aviso, la cadena de suministro opera en silos.

**Comportamiento esperado:**
- Cuando stock ATP < cantidad requerida y la diferencia no puede cubrirse con OCs internas abiertas, el sistema genera un "requerimiento de importación" asociado al presupuesto.
- El requerimiento incluye: artículo, cantidad necesaria, presupuesto origen, cliente, fecha límite estimada (basada en la fecha de OT deseada).
- Aparece en la lista de requerimientos del módulo Comex.
- El equipo de Importaciones confirma ETA y el presupuesto actualiza su estado a `derivado_importacion`.

**Lo que NO hace:** No crea automáticamente un DUA ni inicia trámites aduaneros. El equipo de Comex toma la acción manual desde el requerimiento.

**Complejidad:** Baja-Media — es básicamente crear un documento de requerimiento vinculado al presupuesto y mostrar el ETA en la vista de estado del presupuesto.

**Dependencias:** Verificación de stock ampliada (#4), Comex (#ya implementado).

---

### 6. Aviso a Facturación al Completar OT con Presupuesto Asociado

**Por qué es table stakes:** Sin este aviso, el área de Administración no sabe cuándo emitir la factura en Bejerman. El ciclo comercial queda abierto.

**Comportamiento estándar de la industria (Dynamics 365 Field Service "Posted" status):**
Cuando una OT cambia a estado `completada` y tiene un presupuesto asociado, se dispara automáticamente:
1. Notificación in-app al rol `administracion_facturacion`.
2. Mail automático a la casilla del área de Facturación con resumen: cliente, OT número, presupuesto número, monto a facturar, método de pago (contrato/per-incident/mixto).
3. El presupuesto cambia su estado a `pendiente_facturacion`.

**Lo que NO hace:** No emite la factura en Bejerman (out of scope explícito del milestone). El aviso es el límite del sistema.

**La OT queda en estado `completada` hasta que Administración confirma la carga en Bejerman**, momento en que un usuario con rol `administracion` marca el presupuesto como `facturado`.

**Complejidad:** Baja — un Firestore trigger (o función Cloud Run) que escucha cambios de estado en OTs y ejecuta la notificación.

**Dependencias:** OTs (#ya implementado), OAuth Gmail (#ya implementado para contratos).

---

### 7. PDF para Todos los Tipos de Presupuesto

**Por qué es table stakes:** El vendedor necesita enviar un documento formateado al cliente. Sin PDF no hay presupuesto real.

**Comportamiento esperado:**
- Per-incident: PDF con header AGS, datos del cliente, tabla de items (servicio, partes, viático), totales, condiciones de pago, vigencia, firma digital o espacio.
- Partes: PDF simplificado (lista de materiales + precios + condiciones de entrega).
- Mixto: PDF que referencia el contrato base + detalle de items extra.
- Todos siguen el design system Editorial Teal (igual que el PDF de contrato ya implementado).

**Complejidad:** Media — reutilizar el engine de PDF del módulo contrato. El mayor trabajo es definir el layout específico de cada tipo y los datos que cada uno expone.

**Dependencias:** Presupuestos per-incident/partes/mixto (#2).

---

### 8. Alerta de Presupuesto Vencido

**Por qué es table stakes:** Los presupuestos tienen fecha de vencimiento. Si el cliente no responde, el vendedor necesita saberlo para renovar o cerrar.

**Comportamiento esperado:**
- Cada presupuesto tiene campo `fechaVencimiento` (default: 30 días desde `enviado`).
- Un job diario (Cloud Scheduler o equivalente) evalúa presupuestos en estado `enviado` o `aceptado_verbal` cuya `fechaVencimiento` < hoy.
- Genera alerta in-app para el vendedor responsable.
- El presupuesto cambia a estado `vencido` automáticamente.
- El vendedor puede renovar el presupuesto (crea nueva versión con nuevos precios y nueva fecha).

**Complejidad:** Baja — scheduled function + cambio de estado.

**Dependencias:** Estados del presupuesto (#3).

---

## Differentiators — Diferenciales AGS

Features que van más allá del estándar. No esperadas por el cliente, pero de alto valor diferencial para el equipo AGS.

### D1. Auto-Creación de Ticket de Seguimiento desde Presupuesto sin Ticket Origen

**Valor diferencial:** La mayoría de los sistemas requieren que exista un ticket/caso antes de crear el presupuesto. AGS puede recibir consultas directas de presupuesto (por teléfono, mail, referido) sin ticket previo. Auto-crear el ticket de seguimiento al aprobar el presupuesto asegura que ningún presupuesto aceptado quede sin trazabilidad en el pipeline de soporte.

**Comportamiento:**
- Si un presupuesto fue creado sin `ticketId` asociado y pasa a estado `oc_recibida`, el sistema crea automáticamente un ticket de tipo "Seguimiento Comercial" vinculado al presupuesto.
- El ticket se asigna al vendedor responsable del presupuesto.
- El ticket se cierra automáticamente cuando el presupuesto llega a `facturado`.

**Complejidad:** Baja-Media.

---

### D2. Prefill de OT desde Presupuesto Aceptado

**Valor diferencial:** En la práctica, cuando se recibe la OC el coordinador debe crear la OT manualmente ingresando de nuevo todos los datos. Con prefill, la OT se pre-completa con cliente, establecimiento, equipo, servicios y partes del presupuesto. El coordinador solo confirma y ajusta.

**Nota:** Este diseño está documentado en `.claude/plans/presupuestos-item-a-ot-design.md` pero marcado fuera de scope para v2.0. Se incluye aquí como diferencial para priorización.

**Complejidad:** Alta — requiere mapeo entre items de presupuesto y campos de OT (servicios → tareas, partes → materiales reservados).

**Recomendación:** Diferir a v2.1 tal como está planificado.

---

### D3. Vista de Stock ATP por Presupuesto (Panel de Disponibilidad)

**Valor diferencial:** En vez de solo un semáforo de "stock ok/no ok", mostrar al coordinador un panel detallado por item del presupuesto: disponible hoy / en tránsito (ETA) / reservado para otras OTs / déficit neto. Permite tomar decisiones informadas sin tener que navegar al módulo de stock manualmente.

**Comportamiento:** Vista embebida en la pantalla de detalle del presupuesto (tab o sección colapsable) que consulta ATP en tiempo real.

**Complejidad:** Media — el cálculo ya existe para la verificación (#4); es mainly presentación.

---

### D4. Historial de Versiones de Presupuesto

**Valor diferencial:** En negociaciones B2B es común que un presupuesto tenga 2-4 revisiones antes de ser aceptado. Sin historial, se pierde visibilidad de qué se negoció y cómo evolucionó el precio.

**Comportamiento:** Cada vez que se modifica un presupuesto en estado `enviado` o `aceptado_verbal`, se guarda una versión inmutable anterior y se crea una nueva versión activa con número incremental (v1, v2, v3…). El cliente recibe la versión más reciente; la historia queda visible para el vendedor.

**Complejidad:** Media — modelo de datos inmutable por versión.

---

### D5. Notificación FCM a Coordinador cuando OC es Recibida

**Valor diferencial:** En vez de que el coordinador tenga que revisar la lista de presupuestos, recibe una push notification en el momento en que Comercial registra la OC. Reduce el tiempo de reacción de días a minutos.

**Complejidad:** Baja — Firebase Cloud Messaging ya está en el stack.

---

### D6. Planificación de Stock Extendida: Dashboard de Disponibilidad Futura

**Valor diferencial:** Vista agregada de disponibilidad de stock en el tiempo: eje X = próximas 8 semanas, eje Y = artículos críticos. Muestra entradas proyectadas (importaciones con ETA) vs salidas comprometidas (OTs planificadas). Permite al equipo de Comex anticipar importaciones antes de recibir el requerimiento de un presupuesto.

**Complejidad:** Alta — requiere proyección temporal de stock. Fuera de scope v2.0.

**Recomendación:** Diferir a una fase de "Inteligencia de Supply Chain" posterior.

---

## Anti-Features — Expresamente NO construir

### AF1. Emisión Fiscal Directa (Facturación en Bejerman)

**Por qué no:** Integración con sistema externo de emisión fiscal. Requiere API de Bejerman, mapeo de cuentas, certificados AFIP, manejo de errores de AFIP. Scope infinito.
**Límite claro:** El sistema de AGS cierra con "aviso a Facturación". Bejerman es el sistema de registro.
**En cambio:** Ticket de aviso + mail con resumen. Administración carga en Bejerman manualmente.

---

### AF2. Parsing Automático de OC del Cliente por Mail

**Por qué no:** Los mails de OC tienen formatos radicalmente distintos (PDF adjunto, texto plano, número inline). El parsing confiable requiere ML/NLP + validación humana de igual forma.
**En cambio:** Carga manual del número de OC + adjunto PDF. Simple, confiable, auditable.

---

### AF3. Actualización Retroactiva de Precios al Renovar Contrato

**Por qué no:** Un presupuesto `aceptado` es un compromiso de precio. Modificar retroactivamente el precio de presupuestos ya aceptados (o en ejecución) por una renovación de contrato rompe la confianza con el cliente y la trazabilidad contable.
**Regla clara:** Los precios en un presupuesto se congelan en el momento de `enviado`. La renovación de contrato aplica a presupuestos nuevos creados después de la renovación.
**En cambio:** Al crear un presupuesto nuevo para un cliente con contrato renovado, el sistema toma automáticamente las tarifas del contrato activo vigente.

---

### AF4. Aprobación Multinivel de Presupuestos (Workflow de Aprobación Interna)

**Por qué no:** El equipo de AGS es pequeño. Un proceso de aprobación jerárquico (vendedor → gerente → director) agrega fricción sin valor real. El vendedor tiene autonomía sobre los presupuestos que crea.
**En cambio:** RBAC controla quién puede crear/modificar presupuestos. El gerente puede revisar cualquier presupuesto en cualquier momento desde la lista.

---

### AF5. Cosecha Automática Items→OT (sin revisión humana)

**Por qué no:** Crear una OT automáticamente desde un presupuesto sin que un coordinador la revise puede generar OTs con datos incorrectos (equipo equivocado, fecha imposible, técnico indisponible).
**En cambio:** Prefill de OT con datos del presupuesto + confirmación manual del coordinador. El humano valida antes de confirmar.

---

### AF6. Portal del Cliente para Ver Estado del Presupuesto

**Por qué no:** Requiere auth separada para clientes externos, UI diferente, soporte de seguridad de acceso externo. Scope de un producto diferente.
**En cambio:** El vendedor comunica el estado al cliente por mail o por teléfono. Los PDFs de presupuesto se envían directamente.

---

### AF7. Multi-moneda en Presupuestos per-Incident / Partes

**Por qué no:** El módulo de contrato ya tiene soporte MIXTA (ARS + USD). Extender eso a per-incident agrega complejidad de tipo de cambio, cotizaciones y reglas impositivas diferenciales.
**En cambio:** Per-incident y partes son monomoneda por presupuesto (ARS o USD, al crear). El vendedor elige la moneda del presupuesto una vez.
**Excepción:** Mixto puede heredar la MIXTA del contrato base al que referencia.

---

## Feature Dependencies

```
Catálogo servicios/precios (#1)
  └── Presupuestos per-incident/partes/mixto (#2)
        └── Estados presupuesto + tracking OC (#3)
              ├── Alerta presupuesto vencido (#8) [independiente]
              ├── Auto-ticket seguimiento (D1)
              └── Verificación stock ATP (#4)
                    ├── Panel ATP por presupuesto (D3)
                    └── Derivación a Importaciones (#5)
                          └── Aviso a Facturación (#6)
                                └── Prefill OT (D2) [diferido v2.1]

PDF todos los tipos (#7) ─ depende de (#2), paralelo al resto
Historial versiones (D4) ─ depende de (#2)
Notif FCM coordinador (D5) ─ depende de (#3)
```

---

## Edge Cases: Comportamiento Esperado

### EC1. Presupuesto aceptado pero cliente no manda OC

**Patrón estándar de la industria:** "Closed-Won" real = OC en mano, no aceptación verbal.

**Comportamiento AGS:**
- Presupuesto queda en `aceptado_verbal`.
- A los N días (configurable, sugerido 5 días hábiles), el sistema crea un ticket de seguimiento asignado al vendedor con asunto "OC pendiente: Presupuesto #X — Cliente Y".
- El ticket se repite si no hay acción en otros N días (máx. 2 recordatorios automáticos, luego el vendedor decide cerrar o renovar).
- No bloquea al vendedor. El vendedor puede marcar manualmente "cliente desistió" → presupuesto pasa a `rechazado` con nota de motivo.

**Complejidad de implementación:** Baja — scheduled function diaria.

---

### EC2. OC recibida pero falta stock (requiere importación)

**Comportamiento AGS:**
- Al registrar la OC, el sistema corre automáticamente la verificación ATP.
- Si hay déficit en uno o más items:
  - El presupuesto cambia a `derivado_importacion`.
  - Se genera automáticamente un requerimiento de importación en Comex con los items deficitarios, vinculado al presupuesto y con la OC como respaldo.
  - El coordinador de OT recibe notificación: "Presupuesto #X en espera por stock. Requerimiento de importación generado."
  - La OT NO se puede crear hasta que Comex confirme ETA y el coordinador decida proceder (crear OT con fecha posterior al ETA, o esperar).

**Variante:** Si solo algunos items faltan y los disponibles permiten una OT parcial (ej. servicio de mano de obra + partes disponibles), el coordinador puede optar por crear la OT parcial y dejar un requerimiento de importación para la segunda visita.

---

### EC3. OT parcialmente completada (algunas partes llegaron, otras no)

**Patrón Dynamics 365:** Estado `Partially Completed` → trabajo regresa a `Unscheduled` para re-programar la segunda visita.

**Comportamiento AGS:**
- La OT puede registrar items completados y items pendientes.
- Si el técnico completa la visita con items parciales, el estado de la OT pasa a `parcialmente_completada` con nota de items pendientes.
- El presupuesto NO avanza a `pendiente_facturacion` hasta que la OT esté completada al 100%.
- Se genera automáticamente una segunda OT de continuación (pre-completada con los items pendientes) asignada al mismo técnico.
- La segunda OT dispara el aviso de facturación al completarse.

**Excepción:** Si el cliente autoriza facturación parcial (acordado previamente), el vendedor puede dividir el presupuesto manualmente y marcar la primera parte como `facturada`.

**Complejidad:** Alta — requiere modelo de items de OT con estado por item, y lógica de "OT continuación". Probablemente diferir a v2.1.

**Recomendación para v2.0:** Implementar como "OT completada con nota de pendientes" sin OT de continuación automática. El coordinador crea la segunda OT manualmente. Diferir la OT-continuación automática.

---

### EC4. Cliente con contrato renueva — presupuestos viejos deben reflejar tarifa nueva?

**Respuesta de la industria:** NO. Los presupuestos ya `enviados` o `aceptados` son compromisos de precio. La práctica estándar en contratos enterprise es congelar el precio al momento de generación del presupuesto.

**Comportamiento AGS:**
- Los presupuestos en estados `borrador` o `rechazado` sí deben actualizarse al recalcular (el vendedor puede regenerarlos).
- Los presupuestos en `enviado`, `aceptado_verbal`, `oc_recibida` o más avanzados mantienen los precios del contrato anterior hasta su ciclo de vida.
- Al vencer el contrato anterior y renovarse, los presupuestos NUEVOS creados a partir de la fecha de renovación toman las tarifas del contrato nuevo.
- El sistema muestra un badge "Tarifa: Contrato 2024-2025" en presupuestos con tarifas de contrato vencido para visibilidad.

**Complejidad de implementación:** Baja — snapshot de precios al generar el presupuesto (ya es la práctica correcta; no leer precios en tiempo real desde el catálogo en documentos ya enviados).

---

## MVP Recommendation para v2.0 (2 semanas)

### Priorizar en este orden:

**Semana 1 — Fundaciones:**
1. Catálogo servicios con jerarquía de precios (contrato > lista > override cliente) + reglas de distancia por zona
2. Presupuesto per-incident (editor + PDF + envío mail)
3. Estados del presupuesto con tracking de OC (incluyendo alerta de OC no recibida)
4. Alerta de presupuesto vencido (scheduled job)

**Semana 2 — Circuito completo:**
5. Verificación stock ATP al registrar OC
6. Derivación automática a Importaciones (requerimiento)
7. Aviso a Facturación al completar OT (notificación + mail + estado)
8. Presupuesto partes (más simple que per-incident, reutiliza componentes)
9. Auto-ticket seguimiento desde presupuesto sin ticket origen (D1)
10. Notificación FCM a coordinador por OC recibida (D5, bajo esfuerzo)

### Diferir a v2.1:
- Presupuesto mixto (requiere contrato base como referencia — mayor complejidad)
- Prefill OT desde presupuesto (documentado, no implementado)
- OT-continuación automática para OT parcial
- Historial de versiones de presupuesto
- Panel ATP embebido en presupuesto (D3)
- Dashboard de stock futuro (D6)

---

## Sources

- [Dynamics 365 Field Service — Work Order Lifecycle & Statuses](https://learn.microsoft.com/en-us/dynamics365/field-service/work-order-status-booking-status) — HIGH confidence
- [Microsoft Dynamics 365 — Inventory Visibility ATP](https://learn.microsoft.com/en-us/dynamics365/supply-chain/inventory/inventory-visibility-available-to-promise) — HIGH confidence
- [Stripe — Quote to Cash Guide](https://stripe.com/resources/more/what-is-quote-to-cash-q2c-a-guide-for-businesses) — MEDIUM confidence
- [ServicePower — Work Order Management Best Practices](https://www.servicepower.com/blog/work-order-management-best-practices-for-field-service) — MEDIUM confidence
- [RedStagFulfillment — ATP Formula](https://redstagfulfillment.com/available-to-promise/) — HIGH confidence (concuerda con Microsoft)
- [Nextian — Opportunity to Order Validation](https://nextian.com/quote-to-cash/opportunity-to-order-validation-in-crm-when-is-a-deal-really-closed-won/) — MEDIUM confidence (403 en fetch, pero resumen de búsqueda consistente)
- [GenTech Scientific — Service Contracts for Lab Equipment](https://gentechscientific.com/service-contracts-for-lab-equipment/) — MEDIUM confidence (dominio específico laboratorio)
- Principios de pricing por distancia para field service en LATAM — LOW confidence (no encontrado en fuentes primarias; basado en práctica documentada en conversaciones con el equipo AGS y analogía con industry standards de zonas geográficas)
