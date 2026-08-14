# Plan: `reportes-ot` en campo sin conexión

> Estado: **planificado 2026-08-13, build NO iniciado.** Origen: reclamos recurrentes de
> técnicos — "dependemos de la señal, no se lee la base o tarda mucho".
> Flota: **~2 iPhone, resto Android.**

## Diagnóstico (verificado en el código, no supuesto)

| Qué | Hoy | Consecuencia en campo |
|---|---|---|
| Firestore | `getFirestore(app)` pelado, **sin caché local** | Toda lectura sale a la red. Sin señal no se lee nada |
| Service worker / manifest | **No existe** | Sin señal la app ni siquiera abre |
| Certificados (PDFs en Storage) | Se bajan al FINALIZAR; caché **en memoria, por sesión** | Se pierden al cerrar la pestaña |
| Certificado que no baja | `catch` → `warn` en consola, **el informe se genera igual** | **Informes entregados sin certificados, en silencio** |
| PDF del informe | Se genera **local** (html2pdf + pdf-lib) | Esta parte ya funciona sin red |
| Subida de fotos/PDF | `uploadBytesResumable` directo | Falla sin señal; no hay cola |

**El write path es el problema más difícil.** La persistencia de Firestore encola documentos
sola, pero **Storage no**: los archivos no se encolan y, peor, el `pdfUrl` que se escribe en el
reporte DEPENDE del resultado de la subida. O sea que la cola automática de Firestore y la
subida de archivos no se pueden coordinar solas.

## Activo reusable: la cola del portal

`apps/portal-ingeniero/src/services/uploadQueueDB.ts` + `uploadQueueManager.ts` ya resolvieron
esto para las fotos de recepción, con 4 capas y validado en iPhone real:
- Cola en IndexedDB, drenado con reintentos.
- Compresión al drenar (no al encolar).
- Cola que no se tapona con un item fallado.
- **GOTCHA iOS**: los `Blob` guardados en IndexedDB se vacían en WebKit → se guarda
  `ArrayBuffer` (`data`), con `blob` como campo legacy. **No repetir este error.**

El plan reusa ese diseño; idealmente se extrae a `packages/shared` para que las dos apps
compartan una sola implementación.

## Fases

### Fase 1 — Que la app no mienta *(chica, independiente, arreglá algo que YA pasa)*
- Al finalizar: si falta un certificado y no está en caché, **cartel bloqueante** con cuál falta
  y dos salidas: *generar igual sin ese certificado* (queda registrado en el reporte) o *esperar
  señal*. Hoy decide el sistema, en silencio y siempre para el mismo lado.
- Registrar en el doc del reporte qué certificados se adjuntaron y cuáles faltaron.
- **No depende de nada offline.** Sirve desde el día 1 con señal intermitente.

### Fase 2 — Lectura offline
- `initializeFirestore` con `persistentLocalCache` + `persistentMultipleTabManager`.
- Revisar los `onSnapshot`/`getDocs` que hoy asumen datos frescos.
- Probar en celular real con modo avión, iOS y Android.
- **Riesgo**: cambia el comportamiento de TODA la app (lecturas potencialmente viejas).
  Tanda de pruebas propia antes de soltar.

### Fase 3 — Precarga ("Preparar salida")
- Al abrir con señal, precargar solo: OTs de los próximos 3 días del técnico, sus clientes /
  establecimientos / sistemas / módulos, tablas de protocolo y **certificados** (ver Fase 4).
- Botón explícito "Preparar salida" + indicador de estado:
  *"Listo para trabajar sin señal — 4 OTs y 6 certificados, hace 12 min"* / en rojo si no.
- **No hay sync en background**: iOS no lo soporta. El modelo operativo es *abrir la app con
  señal*, que el técnico ya hace para ver su día. La UI lo confirma; no se le pide un paso nuevo.

### Fase 3-bis — App instalable *(ADELANTADA desde el final, 2026-08-13)*
No es requisito técnico —todo lo offline funciona en una pestaña común— pero **Safari borra los
datos de un sitio que no se usa durante 7 días**, y las apps agregadas a la pantalla de inicio
quedan exentas. Construir la memoria local y dejar que iOS la vacíe al técnico que estuvo una
semana sin salir a campo es trabajo tirado. Por eso va junto con la precarga, no al final.
- `manifest.webmanifest` + íconos + `display: standalone`.
- `navigator.storage.persist()` para pedir almacenamiento durable (Chrome lo concede a apps
  instaladas / sitios con uso frecuente).
- Instalarla en los teléfonos de la flota es una **acción operativa**, no solo de desarrollo:
  hay que acompañar a los técnicos a agregarla a la pantalla de inicio.
- Beneficio extra: sin barra del navegador, no se pierde entre pestañas ni se cierra sin querer.

### Fase 4 — Caché persistente de archivos (certificados)
- Cache API / IndexedDB con la URL como clave; los certificados cambian ~1 vez al año.
- Reemplaza la caché en memoria de `getAssetBuffer` (queda como primer nivel).
- Precarga junto con la Fase 3.
- Purga por vencimiento del certificado, no por tiempo.

### Fase 5 — Cola de subida (fotos + PDF del informe) *(la más delicada)*
El circuito completo cuando el técnico finaliza sin señal:

1. El PDF se genera **local** (ya funciona) → blob.
2. Se encola en IndexedDB como **ArrayBuffer** (gotcha iOS), junto con las fotos pendientes.
3. El reporte se marca `FINALIZADO` en Firestore → **se encola solo** por la persistencia.
4. Al volver la señal, el drenador sube archivos en orden y **recién ahí** escribe `pdfUrl` /
   `fotoUrls` en el reporte.

**Decisiones que hay que tomar antes de codear:**
- **Orden y atomicidad**: el `pdfUrl` no puede escribirse antes de que la subida termine. La cola
  necesita pasos con estado (subir → escribir URL), no un solo intento.
- **Idempotencia**: reintentar no debe duplicar archivos ni fotos. Path determinístico por
  `reporteId + hash`.
- **Tamaño**: un informe con fotos son varios MB. Comprimir fotos al drenar (como el portal).
  Definir tope y qué hacer si el dispositivo se queda sin espacio.
- **Visibilidad**: el técnico tiene que ver *"3 informes pendientes de subir"* y que eso
  sobreviva al cierre de la app. Un informe finalizado que nadie ve en la base es el peor final.
- **Firma del cliente**: hoy dispara `onClientSignature` (Cloud Function). Revisar qué pasa si
  la firma se registra offline y llega horas después.

### Fase 5-bis — Sincronización oportunista *(pedido explícito de dirección, 2026-08-13)*
La señal en el cliente **va y viene**. Con la app ABIERTA hay que aprovechar cada ventana:
- Firestore reconecta y drena sus escrituras solo (con persistencia). No hay que programarlo.
- La cola de archivos se dispara por: evento `online` + `visibilitychange` (volver a la app) +
  timer mientras haya pendientes + encadenado tras cada subida OK. **El evento `online` miente**
  (avisa con el wifi asociado pero sin tráfico): la detección real es intentar con backoff.
- **Subir de a un archivo**, no en lote: cada uno completado queda firme. Una ventana corta que
  corta un lote grande al 80% no deja nada.
- Comprimir fuerte antes de subir (ya lo hace la cola del portal).
- **iOS**: al bloquear pantalla o cambiar de app, el JS se congela. En iPhone es "apenas vuelve
  la señal Y la app está en pantalla"; al retomar, drena. Decirlo así a los usuarios.

### Fase 6 — App shell offline (service worker)
- Que la app **abra** sin señal (el manifest de la Fase 3-bis la hace instalable; el service
  worker es lo que la hace abrir sin red).
- Va al final a propósito: sin las fases anteriores, abrir una app vacía no sirve de nada.

## Riesgos / notas

- **`reportes-ot` es superficie congelada** y corre sin supervisión en el campo: es el peor lugar
  para un cambio a medias. Cada fase con su release y prueba en terreno.
- **iOS es la plataforma que rompe** (2 equipos, pero rompen distinto): sin background sync,
  Blobs que se vacían en IndexedDB, cuotas de almacenamiento más agresivas. Probar en el iPhone
  real en cada fase, no al final.
- Empezar por Fase 1 y **medir**: parte de los reclamos pueden ser de informes incompletos, no
  de lentitud.
- La persistencia de Firestore (Fase 2) puede alcanzar para la mayoría de los reclamos de
  lectura. Medir antes de seguir invirtiendo.

## Fuera de alcance
- Sync en background sin la app abierta (no es confiable en iOS).
- Push que despierte la app para precargar: posible en Android instalado; evaluar recién
  después de la Fase 3.
- Trabajar offline sobre OTs nunca abiertas (si nunca se leyó, no está).
