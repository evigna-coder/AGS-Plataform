# PR: Hora inicio/fin y cálculo automático de horas trabajadas (zona AR 24h)

## Commit message
```
feat(time): agregar hora inicio/fin y cálculo automático horas trabajadas (zona AR 24h)
```

## Resumen
- Se añaden **Hora de inicio** y **Hora de finalización** en el formulario (inputs tipo `time` HTML5, 24h).
- Las fechas y horas se muestran en el PDF en formato **DD/MM/YYYY HH:mm** (ej. `20/01/2026 08:30`).
- **Cálculo automático** de horas trabajadas cuando el usuario completa las cuatro fechas/horas; opción "Calcular automáticamente" (checkbox, por defecto activado).
- Si el usuario edita manualmente "Hs Lab", se activa el modo manual (`manualHoras`) y el auto-cálculo no sobrescribe.
- Validación: si fin < inicio se muestra advertencia y se bloquea la finalización hasta corregir o marcar horas manuales.
- Persistencia: `horaInicio` y `horaFin` se incluyen en `reportState` y se guardan en Firestore con el autosave existente.

## Archivos modificados
- `App.tsx`: estados `manualHoras`, inputs time, `useEffect` auto-calc, validación end < start, bloque PDF con fecha+hora.
- `hooks/useReportForm.ts`: estados y tipos `horaInicio`, `horaFin`; incluidos en `formState`, `reportState` y setters.
- `hooks/useOTManagement.ts`: carga y reseteo de `horaInicio`/`horaFin` en `loadOT`, `newReport` y `duplicateOT`.
- `services/time.ts`: **nuevo** – `calcHours`, `formatDateTimeAR`, `isValidTimeHHMM`.
- `services/time.test.ts`: **nuevo** – tests unitarios para `calcHours`, `formatDateTimeAR`, `isValidTimeHHMM`.

## Tests unitarios
- `pnpm test -- --run services/time.test.ts` (12 tests).
- Casos: mismo día, decimal, cruce de medianoche, end < start (0 + warn), entradas vacías/inválidas, redondeo 1 decimal, formato y validación de hora.

## QA manual – Checklist
1. **Auto-cálculo**: Ingresar fecha inicio, hora inicio, fecha fin, hora fin → "Hs. Lab" se actualiza con 1 decimal. Guardar y recargar OT → valores persisten.
2. **Manual**: Desmarcar "Calcular automáticamente", editar "Hs. Lab" → el valor no se sobrescribe al cambiar fechas/horas.
3. **PDF**: Generar PDF final → en "Datos de la Orden de trabajo" aparecen "Inicio: DD/MM/YYYY HH:mm" y "Fin: DD/MM/YYYY HH:mm" (24h).
4. **End < start**: Poner hora fin anterior a hora inicio (o fecha fin anterior) → aparece mensaje en rojo "La hora fin debe ser posterior a la hora inicio"; al intentar confirmar firma/finalizar, alert y bloqueo hasta corregir o marcar manual.
5. **Avisos**: Con auto-cálculo activado y sin completar horas → mensaje "Complete horas para calcular automáticamente."

## Ejemplos de entrada/salida
| Fecha inicio | Hora inicio | Fecha fin | Hora fin | Hs. Lab (auto) |
|--------------|-------------|-----------|----------|-----------------|
| 20/01/2026   | 08:00       | 20/01/2026 | 17:00   | 9.0             |
| 20/01/2026   | 08:00       | 20/01/2026 | 17:30   | 9.5             |
| 20/01/2026   | 22:00       | 21/01/2026 | 06:00   | 8.0             |

PDF: `Inicio: 20/01/2026 08:00` · `Fin: 20/01/2026 17:00`

## Restricciones respetadas
- Sin cambios en layout global ni header/footer del PDF; solo valores nuevos en el bloque de fechas.
- Sin claves JSON ni service accounts; se usa el FirebaseService existente.
- La edición manual de "Hs. Lab" se mantiene mediante el checkbox "Calcular automáticamente".
