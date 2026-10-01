# Planificación de insumos críticos (reemplaza `/stock/planificacion`)

Estado: **etapa 1 IMPLEMENTADA en working tree (2026-09-28), sin commitear ni releasear.** Falta deployar `firestore.rules` (regla `perfiles_consumo`) y que el usuario cargue planificables + perfiles. Reusa ruta `/stock/planificacion`,
permiso `stock-planificacion` y la entrada Compras → Planificación. La pantalla actual
(ATP por artículo, ~4.000 filas) queda obsoleta desde que los requerimientos son automáticos:
el botón "Crear req." sobre ATP negativo duplica requerimientos condicionales que ya existen.

## Qué hace hoy el usuario, a mano

Para ~50 artículos que "tienen que estar sí o sí" evalúa, por mes y por tipo de equipo:
servicios realizados el mismo período del año anterior vs. servicios agendados para el período
actual → **se toma el mayor** → se multiplica por el consumo por servicio → se descuenta el stock
y las compras ya hechas → sale qué comprar, cuánto y cuándo. Horizonte a definir por ellos.

## Decisiones tomadas (2026-09-27)

| Tema | Decisión |
|---|---|
| Tipo de servicio | **Único**: mantenimiento preventivo con consumibles. No se separa por tipo. |
| Plazo de entrega | **No se modela acá.** Eso vive en Importaciones. |
| Horizonte | Selector en pantalla; **default 60 días** (2 meses calendario), opciones 2 / 3 / 6 / 12 meses. |
| Servicios de contrato futuros | **Sí se proyectan** aunque no estén agendados todavía. |
| Consumo por servicio | Depende de la **configuración del equipo**, no de la categoría. HPLC: solo **inyector y bomba** consumen críticos. GC: depende de la configuración (detector, JAS, etc.), **todavía no bien cargada**. El usuario puede dictar los consumos. |
| Subcategorías | **HPLC**: por módulo (bomba, inyector) y lámparas (solo **Agilent**: los clientes exigen esa marca aunque haya equivalentes). **GC**: primero la **marca** (define la familia de consumibles), después detector, muestreador, inyector automático y **puertos de inyección** (la cantidad de puertos determina los liners). |
| Cronograma de contratos | Lo fija la **coordinadora en el contrato**: cantidad de mantenimientos por año. De ahí se proyectan los servicios no agendados. |
| Perfiles de consumo | Formato acordado: módulo/subcategoría → artículos × cantidad por servicio. El usuario los carga desde la pantalla (etapa 1 trae el ABM). |

## Listas de críticos (dictadas por el usuario, 2026-09-27)

**GC (15):** 5188-5367, 19251-60540, 5183-4647, 5181-3316, 5062-3587, 5190-2295, 5181-8818,
5080-8773, 5080-8853, 5188-5365, 5183-4757, 6040-0809, 5191-5851, 5062-3508, 5183-2037

**HPLC (8):** 5063-6589, 01018-22707, 5067-4728, 0905-1175, 5062-2484, 0100-1853, G1329-87017, G1313-87201

**Especiales (61, varios pasan a HPLC / subcategorías):** 21317, 0101-0623, 0101-1416, 0905-1294,
0905-1420, 0905-1503, 0905-1718, 0905-1717, 1.28.009, 1.28.042, 18740-80200, 5067-5716, 5068-0007,
5068-0123, 5068-0209, 5190-6144, 8004-0170, A1514, EAU.FIL.005, FIL.SVK.DRY.010, G1313-87202,
G1367-87012, G1367-87201, G4226-87012, G4226-87201, G4267-87012, G4267-87201, G6600-60037,
G6600-67003, G6600-67004, G6600-80043, G6600-85000, G6600-85001, G7129-87017, G7129-87200,
JAS-7920-122ST-5, JAS-7920-103SN-5, JAS-7920-124-5, JAS-7920-125-5, JAS-7920-150-5,
JAS-7920-401-10, JAS-7920-502-10, FIL.DB.004, FIL.WFILTER.007, OT3-2, PM_KIT_CENT, PM_KIT_EV,
PMKIT2, PMKIT3, 0905-1731, G5611-21503, G5668-87200, G5668-87002, IDP3TS, G1367-87202,
G1367-87017, 0101-1417, G1367-87101, G1367-87300, 20782-209.5, A0716

**Lámparas (36):** 5182-1530, 11-4110, IUJM-302, BK82220820, G1314-60100, CTS-10494, IUJM-301,
BK82010100, 2140-0820, 11-3984, IUJM-303, BK82220820C, G1314-60101, 11-4111, BK82010101,
2140-0605, CTS-10594, 2140-0813, CTS-A11218, IULC-2140-0813, BK82220813, 2140-0590, CTS-10473,
5190-0917, CTS-12013, 1010002058, 2010000686, AZL01, AZL02, A5193, A4071, A59210, 85023,
CARY60 (?), Libra (?), 2140-0600

> Pendiente validar que los 120 códigos existan en `articulos` (la sesión de Firebase venció
> antes de poder consultarlo). Los Agilent con prefijo Gxxxx-… nombran el módulo al que sirven
> (G1367 = inyector, G1311/G1312 = bomba, G1314 = detector VWD): sirve para armar los perfiles.

## Modelo propuesto

### Datos nuevos
- `Articulo.planificable: boolean` y `Articulo.grupoPlanificacion: 'GC' | 'HPLC' | 'ESPECIALES' | 'LAMPARAS'`
  (o subcategoría más fina cuando se defina). Se tilda desde Artículos. La pantalla solo muestra planificables.
- Colección `perfilesConsumo`: `{ id, nombre, criterio, items: [{ articuloId, cantidadPorServicio }] }`.
  `criterio` matchea contra el equipo a servir: por **modelo de módulo** (prefijo `G1367`, `G1311`…),
  por **subcategoría** (detector SCD, GC JAS, generador marca X) o, como último recurso, por
  **categoría de equipo**. Un servicio suma los items de todos los perfiles que matchean con los
  módulos de su sistema. Equipo sin módulos cargados → perfil por categoría (fallback explícito, marcado en pantalla).
- Nada de plazo de entrega. Nada de tipo de servicio.

### Demanda por mes (motor)
1. **Servicios previstos por mes**, uno por sistema:
   - agenda + OTs pendientes con fecha en el mes (`agendaEntries`, `reportes` con `fechaServicioAprox`);
   - servicios de **contrato** proyectados por su cronograma aunque no estén agendados;
   - año anterior: OTs realizadas el mismo mes (por sistema o, si no hay sistema, por categoría).
   - Por categoría/subcategoría se toma **el mayor** entre (agendado + contrato) y (año anterior).
2. Cada servicio previsto aporta los items de sus perfiles → demanda artículo × mes.

### Oferta por mes
- Disponible hoy (`unidades` activas `disponible`).
- Ingresos previstos: OCs abiertas por `fechaEntregaEstimada`, importaciones por `fechaEstimadaArribo`
  (mes de arribo; sin fecha → columna "sin fecha").

### Pantalla
- Selector de horizonte, filtro por grupo/subcategoría y texto.
- Tabla **artículo × mes**: demanda, ingreso previsto, stock proyectado fin de mes (rojo si < 0,
  ámbar si < `stockMinimo`), y a la derecha **"comprar N"** = faltante acumulado del horizonte.
- Drawer por celda: qué servicios (cliente / equipo / fecha) explican la demanda de ese mes y de dónde salió la cifra (agenda, contrato o año anterior).
- Export Excel con las mismas columnas.

## Etapas
1. **Datos + motor + pantalla** con perfiles por módulo para HPLC (bomba + inyector) y perfiles
   por categoría/subcategoría para GC, especiales y lámparas hasta que la configuración GC esté cargada.
2. **Tasa real** de consumo desde `movimientosStock` subtipo `cierre_ot` (historial desde 2026-07): se muestra al lado del valor del perfil para corregirlo.
3. **Generar requerimientos** desde "comprar N", agrupados por proveedor (no condicionales).

## Abierto
- Contenido de los perfiles (los carga el usuario en la pantalla).
- Dónde viven marca/detector/puertos de un GC hoy (revisar `sistemas`/`modulos`); mientras no estén cargados, fallback por categoría marcado en pantalla.
- Mes "año anterior" con OT sin `sistemaId` (históricas): contar por categoría del texto `sistema`.

## Implementación etapa 1 (2026-09-28)

| Pieza | Archivo |
|---|---|
| Tipos | `packages/shared/src/types/index.ts`: `Articulo.planificable/grupoPlanificacion`, `PerfilConsumo`, `CriterioPerfilConsumo`, `PerfilConsumoItem`, `GRUPOS_PLANIFICACION` |
| Motor puro + test | `utils/planificacionInsumos.ts` (`planificarInsumos`, `consumoPorServicio`, `ingresosPrevistos`) · `test:planificacion-insumos` |
| Servicio | `services/perfilesConsumoService.ts` (colección `perfiles_consumo`) · `articulosService.getPlanificables()` |
| Hook | `hooks/usePlanificacionInsumos.ts` — lee planificables, perfiles (+ `consumibles_por_modulo` como perfiles de módulo de solo lectura), sistemas, módulos, categorías, OTs, agenda (por año), contratos activos, OCs, importaciones, unidades disponibles |
| UI | `pages/stock/PlanificacionInsumosPage.tsx` + `components/planificacion/{PlanificacionTabla,PlanificacionDetalleDrawer,PerfilesConsumoPanel,PerfilConsumoModal,PlanificablesModal}.tsx` · export `utils/exports/exportPlanificacionInsumos.ts` |
| Artículo | checkbox Planificación + grupo en `EditArticuloModal` y `CreateArticuloModal` |
| Rules | `firestore.rules`: `match /perfiles_consumo/{perfilId}` staff — **DEPLOYAR** |
| Borrado | `PlanificacionStockPage.tsx`, `PlanificacionRow.tsx`, `usePlanificacionStock.ts`, `exportPlanificacionStock.ts` (pantalla ATP vieja) |

Decisiones de implementación:
- "El mayor" se aplica **por categoría de equipo y mes** (no por equipo): los servicios extra del año anterior consumen el **perfil promedio** de la categoría.
- Contratos: cupo anual restante (anual − realizadas/concretas en el año de contrato vigente) repartido en partes iguales en los meses que quedan de ese año; el siguiente año arranca con el cupo completo.
- Compras sin fecha estimada o ya vencidas entran en el primer mes y se marcan (`ingresosSinFecha`).
- Importación en curso resta del pendiente de su OC (no se cuenta dos veces).
- Preventivo = `/preventiv/i` sobre `tipoServicio` (OT, agenda) y `tipoServicioNombre` (contrato).
- `comprar` = faltante máximo del horizonte (ceil); `mesQuiebre` = primer mes en negativo.

## Kits (2026-09-30, working tree)
El motor conoce los kits de compra (`kitComponentes`): los kits disponibles sin explotar suman a sus componentes (`stockEnKits`), las líneas de OC/importación de un kit se traducen a componentes (`IngresoPrevisto.viaKit`) y la compra sugerida se expresa también en kits (`FilaPlan.kits[].comprarKits`, redondeo arriba; varios kits = opciones). `articulosService.getKits()` (query `kitComponentes != []`, 6 docs) + `kitsPlanDesdeArticulos`. Caso real cubierto en test: G1313-87201 dentro de G1313-68709. Límite conocido: un kit consumido entero sin explotar queda en el historial como consumo del kit, no del componente.
