# AGS Analítica: Documentación Comercial y de Negocio

Esta documentación sirve como la **verdad absolua sobre las reglas de negocio, ciclo operativo y propósitos** detrás de AGS Plataform. Está dirigida a gerentes y, primordialmente, a Asistentes de Inteligencia Artificial para asegurar que toda sugerencia, código o modificación propuesta por la IA respete las decisiones y flujos comerciales previamente establecidos, evitando proponer cambios en lógicas "extrañas" que, si bien podrían parecer antipatrones a nivel de software estándar, tienen su razón comercial innegociable.

---

## 🏢 1. Contexto de la Empresa
**AGS Analítica** es una organización proveedora de servicios de soporte técnico especializado, cualificación y mantenimiento de equipos instrumentales y analíticos de laboratorio (Chromatografía HPLC/GC, Espectrometría, Osmómetros, Disolución, entre otros). 

Sus ingenieros prestan servicio *in-situ* (en los laboratorios o plantas de los clientes, predominantemente la industria farmacéutica y ciencia), por ende, interactúan con gerentes de calidad, compradores y técnicos; emiten dictámenes oficiales (órdenes de trabajo) e interactúan diariamente con burocracia comercial B2B.

---

## 🔄 2. Ciclo de Vida Comercial
El flujo de valor central que rige la construcción de las aplicaciones se enmarca en la siguiente cadena inmutable:
`Lead/Contacto -> Presupuesto -> Orden de Trabajo (OT) -> Facturación (Próximamente)`

### Fase 1: Leads y Abordaje
* El usuario de la app reporta un Lead o "Llamado", típicamente "Tengo una bomba trabada o una fuga en sistema X".
* Existe un sistema de jerarquización/estado (Nuevo, Derivado, Finalizado). Un administrador deriva a soporte técnico o ventas para abordar el caso y realizar una cotización.

### Fase 2: Presupuestos
* Las interacciones B2B requieren cotizaciones de repuestos u horas laborables, muchas veces impactadas por la burocracia impositiva argentina. 
* Los presupuestos interactúan con un entorno **comercialmente rígido**: Condicionan su cálculo según la categoría de impuestos del cliente, sus condiciones de pago asignadas (ej. a 30 días, 90 días).
* El sistema modular B2B soporta vincular "Órdenes de Compra (OCs)" a los presupuestos como prueba innegable de aceptación.

### Fase 3: Órdenes de Trabajo (OT) / Intervención
* Un ingeniero (especialista) viaja a la planta para resolver.
* Se utiliza imperativamente la aplicación subsidiaria **reportes-ot**. 
* El ingeniero carga las horas viajadas, las refacciones instaladas "artículos", las acciones técnicas, y presenta una Tablet para que el cliente firme el "Reporte de O.T" validando el trabajo in situ (requiere un **PDF con un renderizado y aspecto legal exacto** y estructurado al milímetro que se le envía al cliente).

---

## 📦 3. Entidades y Vocabulario (Reglas del Dominio)
Cualquier interacción de código futuro debe respetar este diseño semántico y su cardinalidad lógica:

* **Cliente**: Entidad facturable, poseedor de una Razón Social y CUIT. Tiene múltiples "Contactos". (Nunca se eliminan físicamente de la BD, sufren *Baja Lógica* con activo: false para conservar auditoría).
* **Establecimiento**: Sede/Laboratorio físico donde está emplazado el equipamiento técnico de un Cliente (Una corporación farmacéutica unificada tributariamente puede tener una Planta en Fátima y Laboratorios en CABA). Controlan las direcciones, geolocalización, código postal, y se estandarizan como una entidad separada en el sistema. Tienen un `id` propio y los sistemas se vinculan a estos establecimientos y NO directamente al cliente general.
* **Sistema (Equipos)**: Esencial. Un sistema representa todo el equipo cromatográfico global. Se les apoda "Familia/Modelo" (ej. Sistema HPLC Agilent 1200).
* **Módulos**: **Dependen siempre de un Sistema**. Son los "órganos" individuales del equipo. Una Bomba, un Detector, Inyector Automático. Cada módulo posee un firmware y número de serie único y rastreable. La falla usualmente es en un módulo, pero se cotiza al sistema como parentela.

---

## � 4. Plan de Transición: Protocolos de Calidad y Tablas Dinámicas
Actualmente, los anexos de protocolos de Mantenimiento Preventivo (PM) y Cualificación (OQ/PQ) que acompaña a un Reporte-OT son estructurados como "bloques de texto fijos" u hojas estáticas anexas difíciles de escalar.  
La Directriz Comercial dictamina que **se migrará de hojas preconfiguradas rígidas a un Esquema Dinámico de Tablas Seleccionables**. 
1. El Administrador (en Sistema Modular) predefinirá "Tablas" maestras con métricas esperadas en Firestore.
2. Cada familia de "Sistema" (Ej. GC vs Inyector) tendrá asignados conjuntos de tablas preaprobadas por QA.
3. El Ingeniero en el campo (en Reportes-OT) podrá interactuar con una interfaz inyectada donde simplemente tildará o completará las mediciones, de tal manera que el layout renderizado en el PDF en caliente construirá las métricas de Calificación de equipos "on the fly".

Esta migración exige respetar el **SKILL A** (intocabilidad visual principal del reporte), debiendo orquestar las tablas estrictamente *debajo* o como apéndices limpios de cada módulo de equipamiento reportado para prevenir disrupciones entre el nuevo modelo dinámico y el viejo reporte legacy.

---

## �🛑 5. Decisiones "Peculiares" pero Intocables (Do Not Touch)
Existen diseños estructurales que responden 100% a las operaciones diarias del recurso humano, por ello, la IA o el programador deberá **Acatar y no rebatir ni "optimizar"** estas decisiones en contra de la indicación:

1. **Subdivisiones Geográficas y Fiscales**: La inserción de direcciones prefiere *Google Places Autocomplete* con fallback a tipeo puro (Nunca forzar geolocalización o bloquear guardado sin un Match perfecto de Places, porque hay plantas químicas sin mapeo correcto).
2. **Formato Numérico ID's OTs**: La Orden de Trabajo tiene una sintaxis histórica fija de 5 dígitos (Ej. `30255`) con posibles sufijos decimales en las sub-etapas (Ej. `30255.01`). Jamás migrar este sistema a un UID o formato alfanumérico.
3. **El Formato "Reportes-OT" es Sagrado**: Esta herramienta nació para reemplazar planillas de firmas Excel. El personal y las farmacéuticas están acostumbrados al PDF que escupe el generador actual. Los estilos, tamaños de fuente y forma son Intocables visualmente.
4. **Relación Contrato y Per Incident (Facturable vs. No facturable)**:
   - "Contrato": Indica que el sistema B2B no demandará la confirmación exhaustiva de una Orden de Compra (Presupuesto) antes de habilitar enviar a un especialista porque existe un abono macro.
   - "Per Incident": Exige una aprobación unitaria por presupuesto en el ciclo de caja. 

---

**Resumen:** _Esta plataforma no es un SAAS genérico, sino un ERP hecho hiper-a-medida. La robustez del tipado, la trazabilidad estricta de variables en facturación, la inmutabilidad aparente de Firebase (con borrados lógicos) y el estricto uso de modales nativos reflejan nuestra logística física real y reglas ISO corporativas._
