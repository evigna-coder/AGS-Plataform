# Rule: Auto-selección de establecimiento único

## Invariant

En **todo flujo de creación** que pida cliente + establecimiento (OT, presupuesto,
equipo, ficha, loaner, reporte de campo, y cualquier otro que se agregue), cuando el
cliente seleccionado tiene **un único establecimiento**, ese establecimiento debe
quedar **precargado automáticamente** al elegir el cliente. El usuario no tiene que
abrir el selector para elegir lo único que hay.

## Why

- La mayoría de los clientes tienen un solo establecimiento. Obligar a abrir y elegir
  "lo único que hay" es fricción pura y una fuente de olvidos (OT/presupuesto creados
  sin establecimiento → equipos/sistemas que no aparecen, cierres que no encuentran
  la sucursal).
- `reportes-ot` (app de campo) ya lo hace desde siempre y es la UX esperada por los
  usuarios. El back-office debe comportarse igual.

## How to apply

Usar el helper compartido en [packages/shared/src/utils/index.ts](../../packages/shared/src/utils/index.ts):

```ts
import { establecimientoUnicoId } from '@ags/shared';

// `lista` = establecimientos YA filtrados por cliente (y por `activo` si el form
// solo muestra activos). Pasar la misma lista que se muestra, para que el conteo
// coincida con lo visible.
const unico = establecimientoUnicoId(lista);
if (unico && !form.establecimientoId) setForm(prev => ({ ...prev, establecimientoId: unico }));
```

### Reglas de integración

- **No pisar un prefill**: si el form ya trae un `establecimientoId` (creación desde
  otro contexto, derivación por sistema, etc.), respetarlo. Por eso el guard
  `!form.establecimientoId` / `prev.establecimientoId ? prev : ...`.
- **Al cambiar de cliente**: resetear el establecimiento y volver a evaluar — si el
  nuevo cliente tiene uno solo, autoseleccionarlo; si tiene varios, dejarlo vacío.
- **Patrón filtrar-de-todos** (la lista completa ya está en memoria): filtrá con
  `establecimientoPerteneceACliente` y pasá el resultado a `establecimientoUnicoId`.
- **Patrón `getByCliente`** (fetch por cliente): autoseleccioná dentro del `.then`,
  contando los `activo` si el selector solo muestra activos.

## Dónde ya está aplicado (referencia)

- `apps/reportes-ot/hooks/useEntitySelectors.ts` — `selectCliente` → auto-dispara
  `selectEstablecimiento` si `estabs.length === 1`. **Implementación canónica.**
- `apps/sistema-modular/src/hooks/useCreateOTForm.ts`
- `apps/sistema-modular/src/hooks/useCreatePresupuestoForm.ts`
- `apps/sistema-modular/src/components/equipos/CreateEquipoModal.tsx`
- `apps/sistema-modular/src/components/fichas/CreateFichaModal.tsx`
- `apps/sistema-modular/src/components/loaners/LoanerPrestamoModal.tsx`

## Al crear un flujo de creación nuevo

Si tu form tiene un selector cliente → establecimiento, **aplicá esta regla en el
mismo PR**. No la dejes "para después": es justo el momento en que el usuario nota
la fricción. Reusá `establecimientoUnicoId`, no reimplementes el conteo.
