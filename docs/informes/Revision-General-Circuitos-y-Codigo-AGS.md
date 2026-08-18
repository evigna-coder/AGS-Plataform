# Revisión general — circuitos de negocio y salud del código

**AGS Plataform · 15 de agosto de 2026 · commit `f5a865a` (v1.61.0)**
Alcance: `sistema-modular`, `portal-ingeniero`, `reportes-ot` y `packages/shared`.
1.104 archivos, 187.545 líneas.

---

## Resumen ejecutivo

El sistema está sano en lo que se ve: los tres builds pasan, el `type-check` está
limpio y las once suites de test verdes. Nada de lo que sigue es una emergencia.

Lo que importa no está en el código sino en los **circuitos**. Hay cinco lugares
donde una regla de negocio está implementada en un módulo y no en el de al lado.
El más caro: **el ciclo comercial no se cierra solo** — un presupuesto solo llega
a *finalizado* si alguien vuelve al sistema a marcar la factura. Eso explica el
volumen acumulado en el control semanal.

Después, dos temas de segundo orden: un riesgo económico en importaciones que
arranca la semana próxima, y la biblioteca de tablas, que funciona pero es el
módulo con más lógica y menos red de contención.

**Recomendación:** atacar en este orden — (1) el aviso de 0 % de derechos en
importaciones, antes del primer embarque; (2) el cierre del ciclo comercial;
(3) las visitas de contrato, que ya acumulan desvío.

---

## 1. Circuitos de negocio

Se recorrió cada circuito de punta a punta con dos preguntas: quién escribe cada
estado, y qué ocurre cuando algo se cancela.

### 1.1 El ciclo comercial no se cierra solo — CRÍTICO

El presupuesto llega al estado `finalizado` por un único camino: que
Administración ingrese al módulo de facturación y marque la solicitud como
*facturada*. Recién ahí el sistema cierra el presupuesto y, en cascada, el ticket
de origen.

Si se factura en el sistema contable y nadie vuelve a registrarlo en la
plataforma, el presupuesto queda en `pendiente_facturacion` de forma indefinida.
No es una hipótesis: es la causa del volumen acumulado que se observa en el
control semanal, donde esos presupuestos reaparecen cada semana.

Hay un segundo agujero en el mismo punto: si el estado salta directo a *cobrada*
sin pasar por *facturada*, el ciclo tampoco cierra.

**Recomendación.** En el proceso: que registrar la factura sea parte del cierre
administrativo y no un paso opcional posterior. En el sistema: un tablero de
"facturado hace más de N días sin cerrar", y que *cobrada* también finalice.

### 1.2 El aviso a facturación nunca sale por correo — CRÍTICO

El cierre administrativo genera el documento de aviso y la interfaz lo confirma
en verde. El proceso que efectivamente envía ese correo **no está desplegado**;
figura en el código como diferido a una fase posterior. Administración se entera
de que hay algo para facturar únicamente si consulta el módulo.

**Recomendación.** Desplegar el consumidor de la cola de correo, o quitar la
confirmación de la interfaz. Lo que no puede sostenerse es que el sistema informe
"aviso enviado" cuando no se envió nada.

### 1.3 El estado "pendiente de OC" no mueve el ticket — ALTO

La regla del proyecto establece que un presupuesto *pendiente de OC* ya está
aceptado, y así se aplicó en presupuestos, stock y control semanal. El mapa que
sincroniza el estado del ticket nunca se actualizó.

Consecuencia: el cliente acepta pendiente de orden de compra, el presupuesto
avanza, y el ticket permanece en "presupuesto enviado". Quien revisa la bandeja
ve una oportunidad sin respuesta que en realidad ya se ganó. Falta también el
estado *pendiente de facturación*.

**Recomendación.** Dos líneas en el mapa de estados. Es el arreglo más económico
del informe.

### 1.4 Las visitas de contrato se consumen y no se devuelven — ALTO

Crear una orden de trabajo contra un contrato incrementa el contador de visitas.
**No existe la operación inversa.** Al cancelar la orden se libera la agenda y se
recalcula la OT padre, pero la visita queda consumida.

Sobre un contrato de doce visitas anuales, dos coordinaciones canceladas y
reprogramadas hacen que el contador informe catorce donde se realizaron doce. El
desvío ya existe en los contratos activos.

**Recomendación.** Revertir la visita al cancelar la orden, con la misma
protección de idempotencia que ya usa el stock. Y auditar los contratos vigentes.

### 1.5 Las guardas de calendario están solo de un lado — MEDIO

Arrastrar una orden de trabajo a un sábado, a un feriado o a un día no laborable
del ingeniero se bloquea con un aviso. Cargar esa misma fecha desde el formulario
de la orden solo valida el fin de semana: feriado y día no laborable pasan sin
advertencia.

Son dos puertas a la misma decisión y solo una tiene el control completo.

**Recomendación.** Los verificadores ya existen; solo hay que invocarlos también
desde la creación y edición de órdenes.

### 1.6 Cancelar la última OT deja el presupuesto en ejecución — MEDIO

La cancelación hace bien su trabajo local: valida la transición, libera la
agenda, recalcula la OT padre y deja registro con motivo y responsable. Lo que no
hace es mirar hacia arriba: si era la única orden del presupuesto, el presupuesto
permanece "en ejecución" sin ninguna orden vigente.

Hoy el control semanal lo vuelve a mostrar como "sin OT agendada" —la acción
correcta— pero por casualidad, no por diseño. El estado del presupuesto es
incorrecto, y todo lo que lo lea sin pasar por el control hereda el error.

**Recomendación.** Al cancelar, si no queda ninguna orden vigente, devolver el
presupuesto al estado *aceptado*.

### 1.7 Lo que sí está bien resuelto

**Anular un presupuesto** es el circuito mejor cerrado del sistema: cancela los
requerimientos condicionales, libera las reservas de stock evitando existencias
fantasma y, si hay órdenes activas, no las cancela automáticamente — deja una
acción pendiente para que el coordinador decida. Esa última decisión es la
correcta y está documentada.

**La deducción de stock en el cierre administrativo** también está bien
construida: dos caminos —selección manual e ítems del presupuesto— y una marca
que se activa solo si se procesó al menos una unidad, lo que permite reintentar
un cierre ejecutado antes de que llegara la mercadería.

### 1.8 Punto abierto

Queda una pregunta sin responder, que requiere verificación específica: **si un
material salió por remito y además figura como ítem de stock del presupuesto,
¿el cierre administrativo lo descuenta una segunda vez?** El remito ya mueve
existencias al emitirse. Hay indicios de que el caso está contemplado, pero no se
verificó. Es la clase de error que no se detecta hasta un inventario.

---

## 2. Riesgo económico inmediato: importaciones

**678 de los 694 artículos** con posición arancelaria no tienen los gravámenes
cargados. El motor de costeo lee únicamente la copia guardada en el artículo y,
si falta, aplica valores por defecto — y el valor por defecto de derechos de
importación es **cero**. Devuelve un factor que aparenta ser válido.

Con órdenes de compra ya emitidas y pendientes de embarque, este es el hallazgo
de mayor impacto económico del informe.

La concentración juega a favor: una sola posición cubre 288 artículos (41 %), y
las diez primeras cubren el 68 %.

**Además**, el artículo guarda una copia congelada del arancel: actualizar una
posición no alcanza a ningún artículo, y cada cambio obliga a una migración
manual. La copia congelada corresponde al ítem de importación —para que una
nacionalización cerrada no cambie de significado—, no al catálogo.

**Recomendación.** Antes del primer embarque, un aviso en el costeo del tipo
"3 de 12 ítems se costean con 0 % de derechos". No bloquea la operación, pero
hace visible lo que hoy es silencioso.

---

## 3. Salud del código

| Métrica | sistema-modular | portal-ingeniero | reportes-ot |
|---|---|---|---|
| Archivos | 852 | 131 | 121 |
| Líneas | 143.274 | 16.600 | 27.671 |
| Componentes sobre 250 líneas | **84** | 8 | 18 |
| Archivo más grande | 1.327 | 552 | **2.617** |
| Registros de consola en producción | 184 | 0 | 90 |
| Tipos sin declarar (`any`) | 498 | 10 | 78 |
| Archivos de prueba | 11 | **0** | 9 |

El portal es la aplicación más ordenada por amplio margen, y la única sin una
sola prueba automatizada. Su verificación previa arrastra errores, de modo que el
único control real es que la compilación pase — y una compilación exitosa no dice
nada sobre si la lógica es correcta.

`reportes-ot` tiene cobertura razonable en autenticación y utilidades, pero su
núcleo —el render de tablas, de 2.617 líneas— no está cubierto. Al ser
superficie congelada, la estrategia correcta no es refactorizar sino blindar con
pruebas de caracterización antes de cualquier modificación futura.

**Código muerto confirmado:** 18 archivos en `sistema-modular` sin ninguna
referencia, entre ellos un componente de 269 líneas. El riesgo no es el peso: es
que alguien los lea creyendo que describen cómo funciona el módulo.

---

## 4. Biblioteca de tablas

Es el módulo con más lógica de negocio y menos herramientas de control.
Funciona: se crean tablas, se publican, el técnico las usa en campo. Todo lo que
rodea a ese camino está crudo.

### Diagnóstico

- **Se denomina de cuatro maneras distintas** entre ruta, carpeta, componentes y
  colección de datos. Menor, hasta que alguien busca y no encuentra.
- **Un solo formulario para siete tipos de tabla**: 657 líneas donde conviven
  metadatos, columnas, filas, reglas, ítems de checklist, texto y carátula,
  apareciendo según el tipo. Editando un checklist se ve andamiaje de carátula.
- **Los filtros no sobreviven** a la navegación. Es la única pantalla de listado
  del sistema que no persiste su estado en la URL.
- **No hay versionado.** Publicar sobrescribe. No queda registro de qué cambió,
  cuándo ni quién — en un módulo que alimenta protocolos que después se firman.
- **No se sabe dónde se usa una tabla** antes de editarla o archivarla.
- **Cero pruebas**, sobre reglas de aprobación/rechazo, condiciones de
  visibilidad por fila e importación de archivos.
- **La validación al publicar es mínima**: no verifica que las filas plantilla
  cubran las columnas declaradas ni que las condiciones apunten a columnas
  existentes. Un error de ese tipo se descubre en planta.

### Plan de mejora, por relación impacto/esfuerzo

| # | Mejora | Esfuerzo |
|---|---|---|
| 1 | Unificar el nombre en ruta, carpeta y componentes | Bajo · mecánico |
| 2 | Filtros y orden persistidos en la URL | Bajo · patrón ya existente |
| 3 | Elegir el tipo primero y editar con un formulario específico | Medio · es el cambio que más se nota |
| 4 | Indicador de "dónde se usa esta tabla" | Medio |
| 5 | Validación de coherencia al publicar | Medio · junto con las primeras pruebas |
| 6 | Historial de versiones | Alto · cambia el modelo de datos |

---

## 5. Mejoras transversales

**Lógica duplicada.** Los utilitarios de fecha de agenda están reimplementados
tres veces en el portal y una cuarta en sistema-modular. El vínculo entre orden
de trabajo y presupuesto, cuatro veces en cuatro archivos: hoy son coherentes
porque se alinearon esta semana, pero volverán a divergir. Corresponden al
paquete compartido.

**La tasa de estadística en cero.** La posición arancelaria que cubre el 43 % del
padrón tiene esa tasa en 0 cuando el resto tiene 3. Puede ser correcto, pero se
heredó de una ficha que estaba por descartarse. Conviene confirmarlo con el
despachante antes del primer costeo.

**Presupuestos que nunca se cierran.** Consecuencia directa del punto 1.1: es
higiene de datos que ninguna pantalla empuja hoy.

**Ausencia de trazabilidad de cambios.** Ni las tablas ni los presupuestos
registran qué cambió al publicar o revisar. En un negocio donde el cliente firma
protocolos, esa trazabilidad va a hacer falta antes de lo previsto.

---

## 6. Lo que está funcionando bien

- **Las reglas del proyecto se cumplen.** Los controles automáticos sobre
  escritura en base de datos y sobre la aplicación de campo interceptan
  problemas reales. La única regla que se ignora con frecuencia es la de tamaño
  de componentes.
- **El flujo de publicación de versiones es sólido**: once versiones en dos
  semanas sin interrumpir a los usuarios.
- **Los comentarios del código explican el porqué**, con fecha y caso concreto.
  Es lo que permitió diagnosticar en minutos varios de los hallazgos de este
  informe.
- **El modelo de presentaciones de compra y venta está bien resuelto.**
- **El portal es la aplicación mejor construida** de las tres.

---

*Informe elaborado sobre el árbol de trabajo en `f5a865a`. Las métricas provienen
de conteos automáticos sobre el código fuente, excluyendo dependencias y archivos
de prueba. Los hallazgos de circuitos se verificaron leyendo la implementación;
el punto 1.8 se declara explícitamente como no verificado.*
