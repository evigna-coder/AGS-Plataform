# Persistencia de protocolTemplateId y protocolData en Firestore

## 1. Dónde se persiste

| Concepto | Valor |
|----------|--------|
| **Colección** | `reportes` |
| **ID del documento** | Número de OT (ej. `"25660"`, `"25660.02"`) |
| **Path completo** | `reportes/{otNumber}` |
| **Escritura** | `setDoc(doc(db, "reportes", ot), data, { merge: true })` |

No hay subcolecciones: el reporte (incluido protocolo) es un único documento por OT.

---

## 2. Objeto exacto que se escribe a Firestore

En **autosave** (`hooks/useAutosave.ts`):

```ts
const dataToSave = {
  ...reportState,
  status: 'BORRADOR',
  updatedAt: new Date().toISOString()
};
await firebase.saveReport(otNumber, dataToSave);
```

`reportState` viene de `useReportForm` y contiene (entre otros):

- `otNumber`, `budgets`, `tipoServicio`, `razonSocial`, `contacto`, `direccion`, …
- `signatureEngineer`, `signatureClient`, `aclaracionEspecialista`, `aclaracionCliente`
- **`protocolTemplateId`** (string | null)
- **`protocolData`** (ProtocolData | null)

En **finalizar** (`hooks/usePDFGeneration.ts`):

```ts
const finalizedData = {
  ...reportState,
  signatureClient: clientSig,
  signatureEngineer: engineerSig,
  status: 'FINALIZADO',
  updatedAt: new Date().toISOString()
};
await firebase.saveReport(otNumber, finalizedData);
```

Mismo contenido: se escribe todo `reportState` (incluye `protocolTemplateId` y `protocolData`) más firmas, status y `updatedAt`.

En **duplicar OT** (`hooks/useOTManagement.ts`): se arma un objeto que incluye `protocolTemplateId` y `protocolData` y se guarda con `firebase.saveReport(newOt, dataToSave)`.

**Conclusión:** El payload que llega a Firestore incluye siempre `protocolTemplateId` y `protocolData` cuando se usa `reportState` o el objeto de duplicado. No hay `pick` ni sanitización que los excluya.

---

## 3. Flujo completo

### A) useReportForm.ts

- **formState / ReportState:** Incluyen `protocolTemplateId` y `protocolData` (líneas 52-54, 87-89).
- **reportState (useMemo):** Objeto con todos los campos del formulario, incluidos `protocolTemplateId` y `protocolData` (líneas 202-217).
- Los setters `setProtocolTemplateId` y `setProtocolData` actualizan el estado; al cambiar, `reportState` se recalcula y el autosave guarda ese nuevo objeto.

### B) useAutosave.ts

- Recibe `reportState` (y `otNumber`, `firebase`, etc.).
- Construye `dataToSave = { ...reportState, status: 'BORRADOR', updatedAt }`.
- Llama a `firebase.saveReport(otNumber, dataToSave)`.
- **protocolData se guarda:** Forma parte de `reportState`, por tanto de `dataToSave`.

### C) firebaseService.ts

- **saveReporte(ot, data):**  
  - `docRef = doc(db, "reportes", ot)`  
  - `setDoc(docRef, data, { merge: true })`  
- No se filtra ni se hace `pick` de campos: el objeto `data` se escribe tal cual (merge con el doc existente).
- **FirebaseService.saveReport(reportId, data)** solo delega a `saveReporte(reportId, data)`.

### D) useOTManagement.ts – loadOT

- Lee con `firebase.getReport(v)` → `getDoc(doc(db, "reportes", reportId))` → `docSnap.data()`.
- Rehidrata todos los campos del reporte, incluido protocolo:
  - Si no hay plantilla para el tipo de servicio: `setProtocolTemplateId(null)`, `setProtocolData(null)`.
  - Si hay plantilla y el doc tiene `data.protocolTemplateId === expectedTemplate.id` y `data.protocolData != null`:  
    `setProtocolTemplateId(expectedTemplate.id)`, `setProtocolData(data.protocolData)`.
  - Si hay plantilla pero no se cumple lo anterior (doc sin protocolo o template distinto):  
    `setProtocolTemplateId(expectedTemplate.id)`, `setProtocolData(createEmptyProtocolDataForTemplate(expectedTemplate))`.

Documentos antiguos sin `protocolData` o sin `protocolTemplateId` entran en el tercer caso y quedan con plantilla actual y datos vacíos; no se pierden ni rompen la carga.

---

## 4. Confirmación: ¿protocolData se guarda hoy?

**Sí.**  
- Está en `ReportState` y en `reportState` de `useReportForm`.  
- El autosave guarda `{ ...reportState, status, updatedAt }`.  
- La finalización guarda `{ ...reportState, firmas, status: 'FINALIZADO', updatedAt }`.  
- `saveReporte` escribe el objeto completo con `setDoc(..., data, { merge: true })` sin excluir campos.  
- En carga, `loadOT` rehidrata `protocolTemplateId` y `protocolData` desde `data` o inicializa datos vacíos si faltan.

No hace falta añadir `protocolData` al payload: ya está incluido. La compatibilidad con documentos existentes sin estos campos se mantiene en `loadOT` usando `createEmptyProtocolDataForTemplate` cuando no hay `protocolData` válido.

---

## 5. Resumen de archivos y líneas relevantes

| Archivo | Qué hace |
|---------|-----------|
| `hooks/useReportForm.ts` | Define `ReportState` con `protocolTemplateId` y `protocolData`; construye `reportState` con useMemo incluyendo ambos. |
| `hooks/useAutosave.ts` | Arma `dataToSave = { ...reportState, status, updatedAt }` y llama `firebase.saveReport(otNumber, dataToSave)`. |
| `hooks/usePDFGeneration.ts` | Al finalizar, arma `finalizedData = { ...reportState, firmas, status, updatedAt }` y llama `firebase.saveReport(otNumber, finalizedData)`. |
| `services/firebaseService.ts` | `saveReporte(ot, data)` → `setDoc(doc(db, "reportes", ot), data, { merge: true })`. `FirebaseService.saveReport` delega ahí. |
| `hooks/useOTManagement.ts` | `loadOT`: lee con `firebase.getReport(v)` y rehidrata `protocolTemplateId` y `protocolData` (o vacío si no existen). `duplicateOT`: copia ambos al nuevo doc y guarda con `saveReport`. |

Colección y documento: **`reportes/{otNumber}`**. Objeto escrito: el mismo que se construye en cada punto (reportState + status/updatedAt o reportState + firmas + status/updatedAt), sin quitar `protocolData` ni `protocolTemplateId`.
