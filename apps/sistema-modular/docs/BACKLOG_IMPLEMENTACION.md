# Backlog de Implementación – Clientes, Equipos, Leads, Postas

**Orden sugerido:** Fase 1 → Fase 2 → Fase 3 → Fase 4.

---

## Fase 1: Base maestra (Clientes + Sistemas + Módulos)

| # | Tarea | Descripción | Prioridad |
|---|--------|-------------|-----------|
| 1.1 | **Clientes – CRUD** | Alta, edición, baja lógica, listado. Campos: razón social, CUIT, país, dirección, localidad, provincia, sector, rubro, teléfono, email; condición IVA, ingresos brutos, convenio multilateral; info pagos, paga en tiempo, suele demorarse, condición de pago; notas, activo. | P0 |
| 1.2 | **Clientes – Contactos** | Subcolección `clientes/{id}/contactos`. Gestión por cliente: nombre, cargo, teléfono, email, es principal. | P0 |
| 1.3 | **Clientes – Búsqueda y vistas** | Búsqueda por razón social, CUIT, nombres de contacto. Vistas tabla y tarjetas. | P0 |
| 1.4 | **Categorías equipo** | Catálogo `categorias_equipo` (Osmómetros, Cromatógrafos, etc.). CRUD básico. | P0 |
| 1.5 | **Sistemas – CRUD** | Colección `sistemas`. Por cliente y categoría. Nombre, descripción, código interno cliente (provisorio editable), observaciones. Ubicaciones (array) e historial; estructura definida (loaner en fases posteriores). | P0 |
| 1.6 | **Sistemas – Vista por cliente** | Desde ficha de cliente: listar sistemas del cliente (tab o sección). | P0 |
| 1.7 | **Módulos por sistema** | Subcolección `sistemas/{id}/modulos`. CRUD: nombre (Bomba, Inyector, etc.), serie, descripción, firmware, observaciones. Ubicaciones + historial por módulo. | P0 |
| 1.8 | **Módulo Equipos en menú** | Módulo separado “Equipos”: listado global de sistemas con filtros (cliente, categoría). Navegación a detalle sistema → módulos. | P0 |
| 1.9 | **Firestore** | Colecciones `clientes`, `clientes/{id}/contactos`, `categorias_equipo`, `sistemas`, `sistemas/{id}/modulos`; reglas e índices. | P0 |

---

## Fase 2: Leads refinado

| # | Tarea | Descripción | Prioridad |
|---|--------|-------------|-----------|
| 2.1 | **Cliente existente** | Selector de cliente; al elegir, selector de contacto y precarga de datos (mail, teléfono, etc.). | P0 |
| 2.2 | **Cliente nuevo** | Opción “Cliente no cargado”: ingresar razón social y datos manualmente; botón “Agregar cliente” que abre formulario Clientes y al guardar vuelve al lead asignando ese cliente. | P0 |
| 2.3 | **Motivo del llamado** | Campo obligatorio: catálogo (ventas, soporte, insumos, administración, otros). | P0 |
| 2.4 | **Motivo del contacto** | Campo texto (descripción) obligatorio. | P0 |
| 2.5 | **Sistema seleccionable** | Si aplica (ej. problema en equipo): selector de sistema del cliente; solo visible cuando hay cliente y tiene sistemas. | P0 |
| 2.6 | **Migrar Leads actuales** | Ajustar modelo y UI de leads existentes al nuevo diseño; migración de datos si hay producción. | P1 |

---

## Fase 3: Postas y grilla de seguimiento

| # | Tarea | Descripción | Prioridad |
|---|--------|-------------|-----------|
| 3.1 | **Catálogo de usuarios** | Lista de usuarios que pueden recibir postas (ej. Esteban Vigna, Fanely Blain, Aldana Di Marco). Por ahora lista fija o colección `usuarios` mínima. | P0 |
| 3.2 | **Modelo de postas** | Estructura `postas[]` en lead; campos: deUsuario, aUsuario, comentario, estados, fecha. | P0 |
| 3.3 | **Acción “Derivar”** | Desde detalle del lead: elegir usuario destino, comentario opcional, guardar posta y actualizar asignadoA/derivadoPor/estado. | P0 |
| 3.4 | **Historial de postas** | En detalle del lead: timeline o lista de derivaciones (quién → a quién, cuándo, comentario). | P0 |
| 3.5 | **Grilla de seguimiento** | Tabla con: fecha, cliente, contacto, motivo llamado, motivo contacto (resumen), sistema, estado, usuario asignado, última posta. Filtros por estado, usuario, motivo, fechas. | P0 |
| 3.6 | **Acción “Finalizar”** | Marcar lead como finalizado; opcional: motivo de cierre. | P1 |

---

## Fase 4: Integración Presupuestos y OT

| # | Tarea | Descripción | Prioridad |
|---|--------|-------------|-----------|
| 4.1 | **Presupuestos – Crear desde lead** | Desde un lead, botón “Crear presupuesto”; heredar cliente, contacto, sistema. Guardar `leadId` en presupuesto. | P0 |
| 4.2 | **Presupuestos – CRUD** | Alta, edición, ítems, total, estados (borrador, enviado, aceptado, etc.). | P0 |
| 4.3 | **OT – Crear desde presupuesto aceptado** | Al aceptar presupuesto: crear OT (formato 5 dígitos + .NN), precargar desde Clientes/Sistemas/Módulos. Vincular `presupuestoId` y opcionalmente `leadId`. | P0 |
| 4.4 | **OT – Precarga desde maestros** | En reporte de servicio (formulario OT): si existe OT vinculada a presupuesto/lead, precargar cliente, contacto, sistema/módulos, dirección, etc. desde BD. | P1 |
| 4.5 | **Reglas de seguridad** | Actualizar Firestore para `presupuestos`, `leads`, `clientes`, `sistemas`, `modulos` según roles. | P1 |

---

## Resumen de dependencias

```
Fase 1 (Clientes + Categorías + Sistemas + Módulos + Equipos en menú)
    ↓
Fase 2 (Leads refinado: cliente/contacto/sistema, motivo llamado/contacto)
    ↓
Fase 3 (Postas + grilla)
    ↓
Fase 4 (Presupuestos + OT + integración reporte)
```

---

## Documento de diseño

Ver **`DISENO_MODULOS_CLIENTES_EQUIPOS_LEADS.md`** para modelo de datos, enums, flujos y grilla.
