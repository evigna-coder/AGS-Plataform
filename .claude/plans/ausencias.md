# Ausencias (reemplazo de Who's Off)

Estado: **diseño, decisiones parciales (2026-09-18)**. Nada implementado.

## Decisiones lockeadas (Coco, 2026-09-18)

- Alcance: **toda la oficina**, no solo ingenieros. Reemplaza la app Who's Off.
- Tipos: `enfermedad`, `licencia_medica`, `permiso_especial` (con detalle obligatorio;
  duración en horas 1–6 o día/s entero/s), `vacaciones`, `vacaciones_sin_goce`,
  `dia_ags`, `cumpleanos`.
- Aprueba **el director (Gabriel Failenbogen)**. Una sola instancia de aprobación.
- Saldo de vacaciones en **días hábiles por período**; una persona puede tener
  saldo del período anterior y del nuevo a la vez (se consumen primero los viejos).
- Días AGS: cupo anual según faltas acumuladas hasta octubre (regla a confirmar,
  ver abajo). Cumpleaños: día libre; si cae fin de semana → primer día hábil
  posterior (feriados también corren, se calcula con `feriados`).
- Visibilidad de las ausencias de terceros: **solo el rol administrativo** (Coco
  dijo "IST_ADM" — a mapear a un permiso de pantalla del RBAC, no existe ese rol
  hoy). Cada persona ve las suyas; el director ve todo para aprobar.

## A confirmar

1. Regla exacta de días AGS: leí "faltas hasta octubre ≤ 2 → 2 días; ≤ 5 → 1 día;
   más → 0". ¿Qué cuenta como falta: enfermedad sin certificado? ¿licencia médica
   también? ¿permisos?
2. Permiso especial por horas: ¿1 a 6 horas descuenta algo, o es solo registro?
3. Período de vacaciones: ¿año calendario, o vence una fecha fija (ej. 30/04 del
   año siguiente como marca la ley)? ¿Quién carga el cupo de cada persona (director
   o administración)?
4. "IST_ADM": ¿es el rol `administracion` del sistema (Fanely) o un permiso nuevo
   "Ausencias: ver todas" asignable a quien sea?
5. ¿Los compañeros pueden ver quién está ausente hoy (sin motivo) o nada?

## Modelo propuesto

- `ausencias/{id}`: `personaId` (uid), `personaNombre`, `tipo`, `desde`, `hasta`,
  `horas?` (permiso), `detalle`, `adjuntos[]` (Storage `ausencias/{uid}/…`),
  `estado` (`pendiente`|`aprobada`|`rechazada`|`cancelada`), `aprobadoPor`,
  `aprobadoAt`, `comentarioAprobador`, `diasHabiles` (calculado con feriados),
  trazas.
- `cuposVacaciones/{uid}_{periodo}`: `dias`, `usados` (derivado), `vence`.
- `agendaDiasAgs` → migrar a `ausencias` tipo `dia_ags` aprobadas; la agenda pasa a
  leer `ausencias` aprobadas de ingenieros.

## Pantallas

- Portal: "Mis ausencias" (pedir, foto del certificado con cámara, estado, saldos).
- Modular: bandeja de aprobación (director), calendario mensual por persona con
  colores por tipo, listado filtrable + Excel, cupos por persona.
- Avisos: ticket autogenerado al director al pedir; notificación al solicitante
  al resolver. Sin mail (mailQueue consumer no desplegado).

## Seguridad

- Firestore: crear/editar solo las propias mientras `pendiente`; aprobar solo
  director; leer todas solo permiso "ausencias_todas".
- Storage: `ausencias/{uid}/**` solo dueño + permiso "ausencias_todas". Deployar
  reglas el mismo día que el release (gotcha direccionesEntrega).

## Esfuerzo estimado

3–4 sesiones: (1) tipos + reglas + cupos + migración días AGS, (2) portal,
(3–4) modular calendario + bandeja + Excel. Release minor del modular + deploy
portal + deploy de reglas.
