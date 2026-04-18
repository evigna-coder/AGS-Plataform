# Rule: Firestore write conventions

## Invariant

Never write `undefined` to Firestore. Never let a field reach `setDoc`/`updateDoc`/`addDoc` with a value that is `undefined` — use `null`, omit the field, or strip it first.

## Why

Firestore rejects `undefined` with a runtime error. In a nested payload the error message does not identify the offending field, so debugging takes minutes. This has bitten this codebase enough times that helpers exist specifically to strip it.

## How to apply

### Helpers (already implemented)

Both live in [apps/sistema-modular/src/services/firebase.ts](apps/sistema-modular/src/services/firebase.ts):

- `cleanFirestoreData(obj)` — strips top-level `undefined` keys. Use when the payload is flat.
- `deepCleanForFirestore(obj)` — JSON round-trip (stringify → parse) that removes nested `undefined` recursively. Use for any payload that contains nested objects, arrays of objects, or optional sub-documents.

### Choosing between them

```ts
// Flat payload: cleanFirestoreData is enough
await updateDoc(ref, cleanFirestoreData({
  nombre: form.nombre,
  telefono: form.telefono,  // may be undefined
}));

// Nested payload: use deepCleanForFirestore
await setDoc(ref, deepCleanForFirestore({
  cliente: { nombre, contactos: [...] },
  items: form.items.map(toItem),  // items may contain optional fields
}));
```

### Timestamps

- Writes: `Timestamp.now()` (imported from `firebase/firestore`).
- Reads into UI: `.toDate().toISOString()` to keep strings in the component layer.
- Never mix JS `new Date()` with `Timestamp.now()` in the same field across reads/writes.

### Deleting a field

Use `FieldValue.delete()` (from `firebase/firestore`), not `null`. `null` is a stored value; the document keeps the key. Only use `null` when the intent is "known-empty" vs "not set".

### Services pattern

All Firestore access goes through service modules in [apps/sistema-modular/src/services/](apps/sistema-modular/src/services/). Do not call Firestore from components. One service per collection (`leadsService`, `clientesService`, …); exports an object with CRUD methods. If you add a new service, follow the existing shape.

## Enforcement

- Hook `check-firestore-undefined` gives a soft warning when an edit touches a service file and introduces `: undefined` adjacent to a `setDoc|updateDoc|addDoc` call.
- AST rule `no-firestore-undefined` (run via `pnpm lint:ast`) does a structural scan of the whole codebase.
