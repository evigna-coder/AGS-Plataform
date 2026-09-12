# Estrategia de tiempos de respuesta (2026-09-11)

Estado: **Fases 0, 1 y primera tanda de la 2 IMPLEMENTADAS (2026-09-11, en working tree, sin release).**
- Fase 0: `utils/perfReads.ts` + shim `services/firestoreInstrumented.ts` enchufado por el plugin
  `ags-firestore-instrumentado` de vite.config (todo `import 'firebase/firestore'` de la app y de
  packages/shared pasa por el shim; cuenta getDoc/getDocs/onSnapshot por colección, por sesión y por
  pantalla — `TabRouterBridge` marca la pantalla activa). Consola: `__agsPerf.tabla()`,
  `__agsPerf.pantallas()`, `__agsPerf.resumen()`. Sentry tracing 20 % en main y renderer.
- Fase 1: caché persistente de Firestore (`persistentLocalCache` + multi-tab, fallback a memoria);
  páginas a demanda (`TabContentManager` con `lazy` por módulo + Suspense); react-pdf fuera del
  arranque (import dinámico del anexo en `useEnviarPresupuesto`, `EditPresupuestoModal` lazy en la
  burbuja global, y `react` asignado a `vendor-react` en manualChunks — estaba cayendo dentro del
  chunk de react-pdf y lo arrastraba).
- **JS que se carga al arranque: 7,6 MB → 1,3 MB** (main 4.632 → 416 KB; react-pdf 2.140 KB ya no
  se precarga). 150 chunks. Caché persistente de Firestore quedó **opt-in** (`VITE_FIRESTORE_CACHE=persistente`):
  en dev con HMR dos instancias del SDK compartían IndexedDB y la app moría en "Cargando…"
  (`Target ID already exists`). Medirla en el `.exe`, no en Vite.
- **Fase 2, primera tanda (2026-09-11, working tree):** línea base tomada con `__agsPerf.pantallas()`
  en dev:modular:electron (tabla del user) y atacados los cuatro peores:

  | Pantalla | Antes (docs / consultas) | Causa | Fix |
  |---|---|---|---|
  | `/agenda` | **801.003 / 495** | `getItemsByOtPadre` bajaba `reportes` ENTERA (~4.300) por cada padre candidato en cada refresco de 60 s; `getPending` traía ~1.500 borradores legado por `status` | rango por `documentId()` (`padre.` … `padre.:`); padres con hijas recordados por sesión; `getPending` recorta por ID ≥ 29779 (go-live) con fallback sin rango |
  | `/stock/planificacion` | 12.723 / 3.998 | un `subscribeById` por fila (~4.000 listeners) + `computeStockAmplio` por fila sin mirror (3 consultas c/u, la mayoría vacías → las ~5.800 "(consulta sin resultados)" que aparecían en Requerimientos) | `usePlanificacionStock`: UNA suscripción a `articulos` + `fetchStockAmplioBulk()` (3 consultas) → `computeStockAmplioBulk`; filas reciben el stock por props |
  | `/ordenes-trabajo` | 16.612 / 16 | `useModuloSearchTerms` cargaba ~9.300 módulos (collectionGroup) al abrir, solo para buscar | se cargan al escribir en el buscador o enfocar el selector de sistema |
  | `/stock/requerimientos` | 1.077–1.169 / 1.097–6.895 | `unidades:1077` es el sweep de stock mínimo (legítimo); las consultas vacías eran de Planificación (ver arriba) | sin cambios propios |

  Además: el refresco de 60 s de la cola de la agenda solo corre mientras esa pestaña es la activa
  (`useTabOverlay().isTabActive`); al volver a la pestaña recarga en el acto.

  **Segunda medición del user (tras reinicio, pestañas restauradas):** `/stock/remitos` 14.139 docs /
  145 consultas y `/stock/asignaciones` 14.612 (unidades ×3 = 10.189). Hallazgos y fixes:
  - **Todas las pestañas restauradas se montaban al arrancar** y cargaban sus colecciones a la vez
    (lo que se atribuyó a "remitos" era el arranque entero: artículos 3.989, unidades 3.396,
    sistemas 1.850). `TabContentManager` monta cada pestaña la PRIMERA vez que se activa.
  - **Lecturas simultáneas del mismo catálogo** (dos pantallas pidiendo `sistemas` en el mismo
    instante, caché vacía) bajaban la colección dos veces: `serviceCache.conCache(key, loader)`
    comparte la promesa en vuelo. Aplicado a artículos, sistemas, clientes y establecimientos.
  - **Asignar material** bajaba las ~3.400 unidades activas al abrir y al confirmar:
    `unidadesService.getEnPosicionAsignables()` (disponibles + reservadas, en posición).

  Pendientes de esta fase (medidos, NO tocados a propósito): `/control-semanal` (`getAll()` de OTs 4.338)
  y `/presupuestos` (suscripción a TODAS las OTs 2.169). Ambos recorren todas las OTs buscando
  `budgets.includes(ppto.numero)` — el vínculo lo manda la OT, así que acotar por rango de ID (≥ 29779)
  solo es correcto si ninguna OT legado tiene `budgets`; hay que verificarlo en datos antes de tocar.
  Como son listeners / una carga por apertura, la caché persistente del `.exe` los abarata sola.
  Pedido del user: "cada vez son menos cositas; planear algo para mejorar los tiempos de respuesta".

## 1. Qué encontré (evidencia, no hipótesis)

| Hallazgo | Dónde | Efecto |
|---|---|---|
| Firestore **sin caché persistente** en sistema-modular (`memoryLocalCache`) | `services/firebase.ts:72-96` | Cada arranque del `.exe` baja TODO de nuevo. Se eligió así porque el puerto del static server de Electron era aleatorio y IndexedDB veía un origen nuevo por arranque. **Ese bloqueo ya no existe**: `electron/main.cjs:135-141` usa puertos determinísticos (43217…) desde que se arregló la sesión. El portal ya usa `persistentLocalCache` con multi-tab. |
| **Bundle único de 4,6 MB** (`main-*.js`) + react-pdf 2,1 MB | `TabContentManager.tsx` importa las 33 páginas estáticamente; 0 `lazy()` | Parse/eval de ~7 MB de JS al abrir, antes del primer render. En PCs lentas son segundos. |
| **54 llamadas `getAll()` sin filtro** sobre colecciones grandes (presupuestos, unidades, movimientos, asignaciones, OTs, tickets) en páginas y hooks | top: `useConsumos` (4), `useEditOTForm` (3), `useControlSemanal`, `useAnaliticaPresupuestos`, `useStockIntake`, `useRemitoForm`, `useGenerarRemito`, `useEntregas`… | Abrir una pantalla = bajar colecciones enteras; crece con el uso. `presupuestosService.getAll()` sin `limit` ni `orderBy` (ordena en memoria). |
| **N+1** de `getByOtNumber` en loops | 21 sitios en hooks/pages (`useConsumos`, `useOTVinculos`, agenda…) | Una lectura por OT referenciada, en serie. |
| Cadenas **best-effort secuenciales** en escrituras críticas | `cerrarAdministrativamente` (lee `presupuestosService.getAll()` entero, luego tickets, fichas, loaners, esquema, sync…), `reabrir`, explosión de kits | El usuario espera a que termine toda la cadena aunque el commit ya se hizo. La CF `onOTCerrada` escucha una colección equivocada (`ot/`) y nunca corre. |
| `serviceCache` TTL 2 min solo en catálogos (10 services) | `serviceCache.ts` | Lo transaccional no se cachea a propósito (bien), pero tampoco usa listeners con delta. |
| Sentry con `tracesSampleRate: 0` | `electron/main.cjs:27` | No hay medición real de tiempos en producción. |

## 2. Principio

**Medir antes de tocar, y atacar en este orden: lo que paga en todas las pantallas → lo que
paga por pantalla → lo estructural.** Cada fase cierra con números comparables contra la
línea base.

## 3. Fases

### Fase 0 — Línea base (1 día)
- Contador de lecturas Firestore por colección y por sesión en el wrapper de `firebase.ts`
  (ya envuelve al SDK): en dev se imprime al cerrar; en prod se manda a Sentry como
  `measurement`. Métrica: docs leídos por sesión y por pantalla.
- `performance.mark/measure` en: login → primer render con datos, y apertura de las 6
  pantallas más usadas (OTs, Presupuestos, Unidades de stock, Agenda, Tickets, Facturación).
- Sentry `tracesSampleRate: 0.2` en renderer para tener p50/p95 reales por pantalla.
- Preguntarle al equipo cuáles son las 3 pantallas que "se sienten lentas". Se priorizan esas.

### Fase 1 — Gana en todas las pantallas (2-3 días)
1. **Caché persistente en Electron** (`persistentLocalCache` + `persistentMultipleTabManager`)
   con fallback a memoria si IndexedDB falla, y espera explícita de `onAuthStateChanged`
   antes de la primera lectura (la race que motivó el retroceso). Efecto: segundo arranque y
   siguientes leen local y sincronizan deltas; los listeners `onSnapshot` dejan de re-bajar la
   colección. Riesgo conocido: probar en el `.exe`, no solo en Vite.
2. **Code splitting por módulo**: `React.lazy` + `Suspense` por página en `TabContentManager`,
   y `react-pdf`/`xlsx`/`html2canvas` cargados solo al usarlos (ya están en chunks propios,
   pero se importan estáticamente). Objetivo: main < 1,5 MB, primer render antes.
3. Índices compuestos para las 3-4 queries acotadas que hoy se ordenan en memoria.

### Fase 2 — Por pantalla, empezando por las 3 que duelen (1-2 semanas, incremental)
Para cada `getAll` masivo, una de tres salidas:
- **Acotar**: filtro por estado/fecha/cliente + `limit` + `orderBy` con índice (ej.
  presupuestos activos, unidades activas del artículo, movimientos de los últimos N meses).
- **Listener en vez de getAll**: con la caché persistente, `onSnapshot` sincroniza deltas;
  las listas que ya usan `subscribe` se benefician solas.
- **Agregado precalculado**: lo que necesita "todo" de verdad (Consumos por equipo, control
  semanal, analítica de presupuestos, faltantes de minikits) pasa a leer una colección
  agregada mantenida al escribir (o por CF programada), no a recalcular sobre miles de docs.
  `useConsumos` es el caso más claro: hoy baja consumos + egresos + devoluciones + todas las
  asignaciones y después hace N `getByOtNumber`.
- Los N+1 se reemplazan por `where(documentId(), 'in', chunk)`.

### Fase 3 — Escrituras que se sienten (1 semana)
**Hecho 2026-09-12 (working tree):** `cerrarAdministrativamente` — pre-reads en paralelo (config,
presupuestos por número con `getByNumero` en vez de `getAll()` de ~500 docs, requisito del cliente,
revisor), check "todas las OTs del ppto cerradas" en paralelo por ppto y por OT, y los efectos
post-commit (tickets, fichas, loaners, esquema de cuotas, reclamo de OC, padre, remitos de servicio)
lanzados juntos y solapados con la deducción de stock; se espera a todos con `allSettled` antes de
devolver. `reabrir`: mismos efectos en paralelo (el resguardo del PDF en Storage era el lento).
La CF `onOTCerrada` sigue apuntando a la colección equivocada — pendiente, requiere deploy de functions.
- `cerrarAdministrativamente` y `reabrir`: paralelizar con `Promise.all` lo independiente,
  reemplazar `presupuestosService.getAll()` por `where('numero','in',…)`, y mover la cadena
  best-effort (tickets, fichas, loaners, esquema, sync de leads) a una **Cloud Function
  disparada por el cambio de estado** (arreglando `onOTCerrada` para que escuche `reportes/`).
  La UI responde al commit; el resto corre en el servidor.
- Mismo criterio para explosión de kits, generación de OC desde requerimientos y cierre de
  remitos.

### Fase 4 — Datos (cuando la línea base lo justifique)
- Archivo histórico: OTs finalizadas y movimientos de más de 12 meses a colecciones
  `*_historico`; las pantallas operativas consultan lo vivo y el histórico se abre a pedido.
- Contadores y resúmenes materializados para dashboards (evita `getAll` para contar).

## 4. Qué NO hacer
- No cachear con TTL lo transaccional (decisión 2026-07-24, sigue vigente): datos viejos
  sin beneficio. La caché persistente de Firestore no tiene ese problema porque sincroniza.
- No virtualizar tablas ni "optimizar renders" antes de medir: la evidencia apunta a red y
  bundle, no a React.
- No tocar reportes-ot en esta estrategia salvo medición: es superficie congelada y su
  caché ya es persistente.

## 5. Cómo se mide el éxito
- Tiempo login → pantalla con datos, y apertura de las 6 pantallas: p50 y p95 antes/después.
- Docs leídos por sesión (también es costo de Firestore).
- Tamaño del `main-*.js`.
Se reporta al final de cada fase con los mismos números.
