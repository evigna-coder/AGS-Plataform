# AGS Analítica: Documentación Técnica de Reglas y Desarrollo

Este documento establece las normativas arquitecturales, el stack, la manipulación de estados y los límites estrictos de "Skills" que la IA y los desarrolladores deben seguir en el ecosistema **AGS Plataform** al realizar implementaciones. Debe leerse como precondición.

---

## 🛠️ 1. Arquitectura Macro: Stack & Entorno
El proyecto está erigido como un **Monorepo distribuido** manejado mediante **`pnpm workspaces`**. 

Contiene los siguientes nodos:
1. `apps/sistema-modular`: El nuevo Back-Office general de escritorio y web.
   - **Stack**: `React 19`, `Vite`, `React Router v7`, `Tailwind CSS 3.4`, `Electron` (para empaquetado Desktop de Windows).
2. `apps/reportes-ot`: Solución de tablet corporativa *legacy* con responsabilidades de reportes de campo (OTs).
   - **Stack**: `React 19`, `Vite`, `html2pdf.js` para manipulación de PDFs legalmente vinculantes en dispositivos móviles, Base de Hooks.
3. `packages/shared`: Interfaces de Typescript de dominio `(@ags/shared)` exportados a ambas Apps. Centraliza la "Fuente de Verdad" de todo el tipado DB.

**Integración y Bases**:
- Todo está acoplado con el BaaS de **Firebase**.
- Base de datos en **Firestore**, Autenticación y Storage. (Uso de subcolecciones fuertemente tipadas en lugar de documentos kilométricos; ejemplo: `sistemas` aloja una subcolección `modulos`).

---

## 🛑 2. Skills Obligatorios (Reglas Irrompibles al Programar)

Se establece un framework estricto que modela la forma válida y recomendada de escribir código en este proyecto. Todo Asistente (IA) deber referirse aquí:

### SKILL A: "Respeto Absoluto a la UI en `reportes-ot`"
En el módulo antiguo de Generación de Reportes OT (`apps/reportes-ot`), **es un pecado mortal tocar visualmente cualquier cosa**. 
- ❌ NO cambiar ni modernizar estilos, ni refactorizar las clases Tailwind, márgenes, paddings o posiciones porque **se destruyen las dimensiones estáticas de `html2pdf.js`**. 
- ❌ NO migrar ni cambiar lógica pura del Layout del Header y el Footer.
- ✅ SÍ puedes refactorizar extrayendo lógica pura hacia Hooks o Archivos Utils (ej: separaste con éxito la validación del Autosave a un custom-hook), siempre y cuando toda alteración en el árbol JSX permanezca literal y byte-por-byte idéntica a la UI originaria.

### SKILL B: "Manejo Seguro y Limpio con Firebase Firestore"
El SDK de Javascript de Firestore **crasea y rechaza un payload con valores `undefined`**.
- ❌ Nunca construyas objetos para `.setDoc` o `.updateDoc` o `addDoc` que dejen libremente valores de input optativos como `formData.campo || undefined`. Te devolverá error subrepticiamente.
- ✅ Emplea **el helper `cleanFirestoreData`** expuesto en `firebaseService.ts` en todo ingreso del monolítico.
- ✅ Exclusiones/Borrados: En el proyecto, las interfaces admiten `| null`. Todo campo vacío no opcional, al intentar vaciarse en un formulario (ej. limpiar un Código Postal), debe compilar internamente como `null` en lugar de una string vacía y someterse a Firebase así; garantizando la ausencia en consultas pero impidiendo errores.
  
### SKILL C: "Modularidad del Back-Office y Electron"
El `sistema-modular` correrá empaquetado dentro de Electron (`--dev`). 
- ❌ No rompas el ruteo asumiendo una barra diagonal inicial `//` para links duros e imágenes sin considerar configuraciones.
- ✅ Asegurar siempre que todo archivo inicie asumiendo `base: './'` en el build de Vite.
- ✅ En lugar de embutir todo el formulario o la pantalla entera en un archivo .tsx gigantesco de 2000 líneas (lo cual fue y es el gran y temido problema histórico de `reportes-ot/App.tsx`), en `sistema-modular` **cada pantalla nueva, listado y detalle deben abstraerse rigurosamente por módulo** (ej: `/clientes`, `/equipos`, `/leads`, `/presupuestos`).
- Utiliza Custom Hooks para separar dependencias de red de la UI siempre que el componente empiece a pesar más de 250 líneas.

### SKILL D: "Integración de Scripts Externa"
Al inyectar librerías que requieran manipulaciones de DOM pesado u objetos asíncronos del objeto subyacente de `window` (ej: SDKs o *Google Places Autocomplete* recién implementado en React):
- Controla el scope en componentes. Usa `useRef` para aislar instancias subyacentes destructibles en un `useEffect` (ej. `google.maps.event.clearInstanceListeners` en el desmontaje).
- Evita usar componentes de terceros pesados que contaminen el IPC de Electron; prefiere programar tú mismo un conector asíncrono e integrado al `Input.tsx` nativo con `forwardRef` para mantener el ecosistema ligero y nativo de Tailwind del proyecto.

---

## 🏗️ 3. Directrices sobre refactorizaciones propuestas
Las interfaces de TypeScript viven centralizadas en `@ags/shared`.
En escenarios futuros, al crear refactorizaciones:
1. Revisa primero `packages/shared/src/types` para validar la integridad de una entidad y ver si es necesario inyectar un cambio. Jamás inyectes una sobrescritura tipada localmente para saltarse pasos. Corre `pnpm run build` en `@ags/shared`.
2. Edita en el gran `apps/sistema-modular/src/services/firebaseService.ts` los helpers de servicio con el patrón de inyección estándar `...Service = { getAll(), getById(), create(), update(), delete() }`
3. Prohombres: Se prohíbe reescribir de urgencia o desglosar todo el archivo `firebaseService.ts` sin autorización humana. Aunque sea monolítico y gigantesco, su unicidad provee estabilidad de tipado para toda la app. (Cambios aquí requieren mucha pre-planificación que debes comunicar enfáticamente). 

---

## 🔬 4. Plan Táctico - Transición a Protocolos Dinámicos
Sobre la inminente migración de PDFs fijos a esquemas tabulares generados al vuelo (Calificaciones OQ/PQ e Insumos Dinámicos):
- **Estructura de Base de Datos**: Deberás usar arrays dentro de colecciones intermedias y mapear fuertemente las entidades en `packages/shared/src/types`. (Ej. `ProtocolTable { id, name, columns[], rows[] }`).
- **Renderizado Dinámico en `reportes-ot`**: Este requerimiento empuja el límite de **SKILL A**. La arquitectura permitida para inyectar este nuevo "Builder de Tablas" consiste en renderizar un nuevo fragmento *completamente autónomo*, **acoplándolo de forma contigua debajo del reporte legacy o debajo de su metadata**, inyectándolo al array dinámico de nodos que captura `html2pdf.js`, sin alterar el wrapper primario histórico. 
- La edición del protocolo tabular debe manejarse con nuevos Hooks limpios (ej. `useDynamicTables`) expuestos hacia Modales flotantes o pantallas secundarias para no obstruir el componente primario `App.tsx` con dependencias visuales superabundantes.

---

## 🗄️ 5. Plan Táctico - Migración Masiva de Datos (CSV a Firestore)
Se encuentra planificada una futura migración masiva desde archivos estructurados (Excel/CSV) hacia el modelo de datos de Firestore en el monorepositorio.

**Contexto y Estructura Esperada:**
* **Ubicación del Script Principal**: `scripts/migracion/migrar-desde-excel.ts` (Implementado idealmente en Node.js usando TypeScript).
* **Autenticación**: Hará uso de la clave de servicio de Firebase Admin SDK almacenada localmente en `scripts/migracion/service-account.json`. *(Nota vital: Este archivo `.json` de credenciales jamás debe commitearse).*
* **Archivos Input**: Serán ingeridos en formato CSV desde un subdirectorio `scripts/migracion/input/`.
  
**Mapeo de Ingesta Requerido:**
1. **`clientes.csv`**: Transformación al modelo base. La primary key (`id` del documento en Firestore) debe forzarse para que sea el **CUIT normalizado**.
2. **`establecimientos.csv`**: Ingesta como top-level collection. Debe contener la clave foránea `clienteCuit` para enlazar con el documento maestro en la app de back-office.
3. **`sistemas.csv`**: Asignar los sistemas no sólo atados al `clienteCuit`, sino específicamente a la ID del establecimiento (`establecimientoId`).
4. **`modulos.csv`**: Estos **dejarán de ser *top-level* en la inserción**. Su ingesta obligará a escribirse dinámicamente como subcolección de su sistema padre (`sistemas/{sistemaId}/modulos`). También se introduce el nuevo campo "marca" en el CSV de origen, el cual deberá ser validado en los Types compartidos previamente.

**Metodología de Ejecución Bifásica:**
El script deberá obligatoriamente concebirse soportando CLI flags para proteger la integridad de Producción:
- Modo `--dry-run`: Lee los CSV, cruza relaciones, aplica sanidad/validaciones de TypeScript, y expide reportes por terminal simulando el seteo. **Acuña bloqueos de escritura física reales.**
- Modo `--run`: Ejecuta masivamente en la base de datos dividiendo lógicamente los payloads a través de operaciones `batch()` admitidas por Firebase Admin SDK.

*Mantener esta documentación presente como Directriz en cada nuevo prompt del ecosistema AGS Plataform.*
