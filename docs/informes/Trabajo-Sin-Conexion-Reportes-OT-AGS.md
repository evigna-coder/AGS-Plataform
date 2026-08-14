# Trabajo sin conexión y sincronización — App de informes de campo

**AGS Analítica · 13 de agosto de 2026**

## Resumen ejecutivo

**Conclusión.** Los reclamos de los técnicos tienen una causa concreta y verificada: la
aplicación de campo **no guarda nada en el teléfono**. Cada dato que necesita lo pide al
servidor en el momento, de modo que sin señal no puede leerse la orden de trabajo y con señal
débil todo se demora. No es un problema de rendimiento ni de los equipos: es una capacidad que
la aplicación nunca tuvo.

**Hallazgo adicional, y más grave.** Hoy, cuando un certificado de calibración no se puede
descargar por falta de señal, **el informe se genera igual, sin ese certificado y sin avisar
al técnico**. Es decir que pueden estar entregándose informes incompletos sin que nadie lo
note. Esto ocurre ya, incluso con conexión intermitente, y es independiente del resto del
proyecto.

**Recomendación.** Encarar el trabajo en seis etapas, empezando por la que corrige los informes
incompletos —es breve y no depende de las demás— y siguiendo por la que guarda los datos en el
teléfono, que por sí sola debería resolver la mayor parte de los reclamos. Medir el resultado
después de esa segunda etapa antes de continuar invirtiendo.

**Sobre la sincronización automática.** El pedido de que la aplicación sincronice apenas
detecte señal **es viable** mientras la aplicación esté abierta, que es la situación real
descripta: el técnico trabajando en planta con señal intermitente. Lo que no es posible en
iPhone es sincronizar con la aplicación cerrada; esa limitación es de la plataforma, no del
desarrollo.

---

## Situación actual

Se revisó el código de la aplicación de campo. El estado verificado es el siguiente.

**Lectura de datos.** La aplicación consulta el servidor en cada operación, sin memoria local.
Sin señal no hay lectura posible; con señal débil, la espera.

**Apertura de la aplicación.** Sin conexión la aplicación ni siquiera abre, porque también sus
archivos se descargan en el momento.

**Certificados de calibración.** Son archivos que se adjuntan automáticamente al informe. Se
descargan al finalizar y se conservan solo mientras la aplicación permanece abierta: al
cerrarla se pierden. Si la descarga falla, el informe se emite sin el certificado y sin aviso.

**Generación del informe en PDF.** Esta parte ya funciona sin conexión: el documento se arma
íntegramente en el teléfono.

**Envío de fotos e informes.** No existe una cola de envío. Si no hay señal en el momento de
finalizar, el envío falla.

---

## Cómo llegan los datos al sistema

Es la pregunta central del trabajo sin conexión, y merece detalle.

Cuando el técnico finaliza un informe sin señal, el documento se arma en el teléfono y queda
guardado allí junto con las fotografías. El cierre del informe queda registrado localmente. Al
recuperar la conexión, la aplicación envía primero los archivos y **recién cuando cada envío se
confirma** actualiza el informe en el sistema central.

Ese orden es imprescindible: si el sistema registrara el informe antes de que el archivo llegue,
quedaría una referencia a un documento inexistente. Por eso el envío se maneja como una cola con
etapas, y cada reintento es seguro: reintentar no duplica fotografías ni informes.

**Aprovechamiento de las ventanas de señal.** Como la conexión aparece y desaparece, los envíos
se hacen de a un archivo por vez. Cada archivo enviado queda firme, de modo que una interrupción
no obliga a rehacer el trabajo anterior. Las fotografías se comprimen antes de enviarse.

**Visibilidad para el técnico.** La aplicación debe indicar en todo momento cuántos informes
quedan pendientes de envío, y esa información debe sobrevivir al cierre de la aplicación. Un
informe finalizado que no llegó al sistema, y que nadie advierte, es el peor resultado posible.

---

## Sincronización automática al recuperar señal

Con la aplicación abierta, la sincronización es automática. Los datos del sistema central se
reconectan y se ponen al día por sí solos. Para los archivos, el envío se reactiva por varias
vías combinadas, porque el aviso de "hay conexión" del teléfono no siempre significa que la red
funcione: la detección efectiva es intentar el envío y reintentar con esperas crecientes.

**Diferencia entre plataformas.** En los equipos Android la sincronización es más permisiva. En
los dos iPhone de la flota, cuando se bloquea la pantalla o se cambia de aplicación, el sistema
operativo congela la aplicación: si la señal vuelve en ese momento, la sincronización ocurre
apenas el técnico retoma la pantalla. Conviene comunicarlo así a los usuarios para no prometer
un comportamiento que la plataforma no cumple.

---

## Preparación antes de salir

La memoria local solo conserva lo que ya se consultó alguna vez. Para que el técnico tenga en
el teléfono lo que va a necesitar, la aplicación descargará automáticamente, al abrirse con
señal, las órdenes de trabajo de los próximos tres días, los datos de esos clientes y equipos,
las tablas de protocolo y los certificados correspondientes.

No implica un paso nuevo: el técnico ya abre la aplicación para ver su jornada, y esa apertura
es la preparación. Se agregará un indicador visible del estado —por ejemplo, *"Listo para
trabajar sin señal: 4 órdenes y 6 certificados, actualizado hace 12 minutos"*— y un botón para
forzar la descarga antes de salir.

---

## Instalación de la aplicación en los teléfonos

Ninguna de las capacidades descriptas exige instalar la aplicación: todas funcionan en el
navegador común. Sin embargo, **se recomienda instalarla en los teléfonos de la flota**, y en los
dos iPhone se considera necesario.

El motivo es concreto. Safari **borra los datos guardados de un sitio que no se usa durante siete
días**. Para un técnico que la abre a diario no representa un problema, pero quien vuelve de
licencia o pasa una semana sin salir a campo encontraría la memoria local vacía justo el día que
la necesita. Las aplicaciones agregadas a la pantalla de inicio quedan exentas de esa regla.

Instalarla aporta además ventajas operativas: ícono propio, pantalla completa, y que la
aplicación no se pierda entre pestañas ni se cierre por accidente. En Android también mejora el
espacio de almacenamiento asignado.

Se trata de una **acción operativa además de técnica**: hay que acompañar a los técnicos a
agregar la aplicación a la pantalla de inicio de cada equipo. Por esta razón se adelantó en el
plan y pasó a realizarse junto con la descarga preventiva, en lugar de al final: no tiene sentido
construir la memoria local y permitir que el sistema operativo la elimine.

## Plan por etapas

| Etapa | Qué resuelve | Observaciones |
|---|---|---|
| 1 | Aviso de certificado faltante al finalizar | Breve e independiente. Corrige un problema que ya ocurre |
| 2 | Memoria local de datos | Resuelve la mayor parte de los reclamos de lectura |
| 3 | Descarga preventiva e indicador de estado | Cubre la jornada completa sin señal |
| 3 bis | Aplicación instalable en el teléfono | Evita que Safari borre los datos a los siete días |
| 4 | Conservación de certificados en el teléfono | Los certificados cambian una vez al año |
| 5 | Cola de envío de fotos e informes, con sincronización oportunista | La etapa más delicada |
| 6 | Apertura de la aplicación sin conexión | Al final: abrir una aplicación sin datos no aporta |

---

## Riesgos y recaudos

La aplicación de campo funciona **sin supervisión** y es el peor lugar posible para un cambio
incompleto: un error visual o un dato mal guardado dejan una inspección trunca en terreno. Por
eso cada etapa se libera por separado y se prueba en el equipo real antes de distribuirla.

Los dos iPhone deben probarse en **cada** etapa, no al final. Aunque sean minoría, su
comportamiento difiere del de Android en aspectos que ya nos afectaron anteriormente en el
portal, y los problemas aparecen únicamente en el equipo real.

Se recomienda **medir después de la segunda etapa**. Es posible que la memoria local resuelva
prácticamente todos los reclamos actuales y que el resto del trabajo pueda planificarse con más
calma y mejor información.

---

## Lo que queda fuera del alcance

Sincronizar con la aplicación completamente cerrada no es posible en iPhone, y en Android
depende de decisiones del propio navegador; no puede sostenerse una operación sobre esa base.

Tampoco es posible trabajar sin señal sobre órdenes de trabajo que nunca se abrieron: si el dato
nunca se consultó, no está en el teléfono. Eso es lo que resuelve la descarga preventiva de la
etapa 3.
