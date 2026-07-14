import { collection, getDocs, doc, getDoc, query, where, documentId, Timestamp } from 'firebase/firestore';
import { updateDoc, runTransaction } from './firebase';
import type { WorkOrder, CierreAdministrativo, OTEstadoAdmin, Lead, TicketArea, TicketEstado, Presupuesto, PatronSeleccionado, DocumentoAdicionalReporte } from '@ags/shared';
import { isOTTransicionValida, OT_TRANSICIONES_VALIDAS } from '@ags/shared';
import { db, createBatch, docRef, batchAudit, logBusinessEvent, getCreateTrace, getUpdateTrace, getCurrentUserTrace, deepCleanForFirestore, onSnapshot, newDocRef } from './firebase';
import { leadsService } from './leadsService';
import { presupuestosService } from './presupuestosService';
import { getAdminSoporteAssignee } from './personalService';
import { agendaService } from './agendaService';
import { adminConfigService } from './adminConfigService';
import { reservasService } from './stockService';

/**
 * FLOW-04: build a minimal plaintext body for the cierre_admin_ot mailQueue doc.
 * The real HTML/PDF rendering + attachments resolution live in the Cloud Function
 * consumer of `mailQueue` (deferred to Phase 9+). This body is enough for a human
 * reader if the mail is sent as-is, and keeps the `mailQueue` doc self-describing.
 */
function buildAvisoFacturacionBody(
  ot: WorkOrder,
  presupuestos: Array<Presupuesto | null>,
): string {
  const presValid = presupuestos.filter((p): p is Presupuesto => !!p);
  const lines: string[] = [
    `OT ${ot.otNumber} cerrada administrativamente.`,
    ``,
    `Cliente: ${ot.razonSocial || ot.clienteId || '—'}`,
    `Fecha de cierre: ${new Date().toLocaleDateString('es-AR')}`,
    ``,
    `Presupuestos vinculados:`,
  ];
  if (presValid.length === 0) {
    lines.push('  (sin presupuesto vinculado — revisar manualmente)');
  } else {
    for (const p of presValid) {
      lines.push(`  - ${p.numero} (${p.moneda}) — total ${p.total}`);
    }
  }
  lines.push(``);
  lines.push(`Adjuntos: PDF de presupuesto(s) + adjuntos de OC (resueltos por el consumer)`);
  return lines.join('\n');
}

// Servicio para Órdenes de Trabajo (OTs) - usa la colección 'reportes' existente
export const ordenesTrabajoService = {
  // Generar siguiente número de OT con transacción atómica (counter doc pattern)
  async getNextOtNumber(): Promise<string> {
    console.log('🔢 Generando siguiente número de OT (transacción)...');
    const counterRef = doc(db, '_counters', 'otNumber');

    const nextOt = await runTransaction(db, async (transaction) => {
      const counterSnap = await transaction.get(counterRef);

      let current: number;
      if (counterSnap.exists()) {
        current = counterSnap.data().value as number;
      } else {
        // Primera vez: escanear colección para inicializar el counter
        const querySnapshot = await getDocs(collection(db, 'reportes'));
        let maxNumber = 29999;
        querySnapshot.docs.forEach(d => {
          const id = d.id;
          if (!id.includes('.')) {
            const m = id.match(/^(\d{5})$/);
            if (m) {
              const n = parseInt(m[1]);
              if (n > maxNumber) maxNumber = n;
            }
          }
        });
        current = maxNumber;
      }

      const next = current + 1;
      transaction.set(counterRef, { value: next, updatedAt: Timestamp.now() });
      return String(next).padStart(5, '0');
    });

    console.log(`✅ Siguiente OT: ${nextOt}`);
    return nextOt;
  },

  // Generar siguiente número de item con transacción atómica
  async getNextItemNumber(otPadre: string): Promise<string> {
    console.log(`🔢 Generando siguiente item para OT ${otPadre} (transacción)...`);
    const counterRef = doc(db, '_counters', `otItem_${otPadre}`);

    const nextItemNumber = await runTransaction(db, async (transaction) => {
      const counterSnap = await transaction.get(counterRef);

      let currentMax: number;
      if (counterSnap.exists()) {
        currentMax = counterSnap.data().value as number;
      } else {
        // Primera vez: escanear items existentes para inicializar
        const querySnapshot = await getDocs(collection(db, 'reportes'));
        const prefix = otPadre + '.';
        let maxItem = 0;
        querySnapshot.docs.forEach(d => {
          if (d.id.startsWith(prefix)) {
            const m = d.id.match(/\.(\d{2})$/);
            if (m) {
              const n = parseInt(m[1]);
              if (n > maxItem) maxItem = n;
            }
          }
        });
        currentMax = maxItem;
      }

      const next = currentMax + 1;
      transaction.set(counterRef, { value: next, updatedAt: Timestamp.now() });
      return `${otPadre}.${String(next).padStart(2, '0')}`;
    });

    console.log(`✅ Siguiente item: ${nextItemNumber}`);
    return nextItemNumber;
  },

  /** Obtener solo OTs activas/pendientes (para agenda sidebar). Mucho más rápido que getAll(). */
  async getPending(): Promise<WorkOrder[]> {
    const PENDING_ESTADOS = ['CREADA', 'ASIGNADA', 'COORDINADA', 'EN_CURSO'];
    const [byEstado, byBorrador] = await Promise.all([
      getDocs(query(collection(db, 'reportes'), where('estadoAdmin', 'in', PENDING_ESTADOS))),
      getDocs(query(collection(db, 'reportes'), where('status', '==', 'BORRADOR'))),
    ]);
    const seen = new Set<string>();
    const results: WorkOrder[] = [];
    for (const snap of [byEstado, byBorrador]) {
      for (const d of snap.docs) {
        if (!seen.has(d.id)) {
          seen.add(d.id);
          results.push({ otNumber: d.id, ...d.data(), updatedAt: d.data().updatedAt || new Date().toISOString() } as WorkOrder);
        }
      }
    }
    return results;
  },

  // Obtener todas las OTs (con filtros opcionales)
  async getAll(filters?: { clienteId?: string; sistemaId?: string; status?: WorkOrder['status'] }) {
    console.log('📥 Cargando órdenes de trabajo desde Firestore...');
    let q = query(collection(db, 'reportes'));

    // Aplicar filtros si existen
    if (filters?.clienteId) {
      q = query(q, where('clienteId', '==', filters.clienteId));
    }
    if (filters?.sistemaId) {
      q = query(q, where('sistemaId', '==', filters.sistemaId));
    }
    if (filters?.status) {
      q = query(q, where('status', '==', filters.status));
    }

    const querySnapshot = await getDocs(q);
    const ordenes = querySnapshot.docs.map(doc => ({
      otNumber: doc.id,
      ...doc.data(),
      updatedAt: doc.data().updatedAt || new Date().toISOString(),
    })) as WorkOrder[];

    // Ordenar por número de OT (descendente - más recientes primero)
    ordenes.sort((a, b) => {
      const numA = parseInt(a.otNumber.split('.')[0]);
      const numB = parseInt(b.otNumber.split('.')[0]);
      if (numA !== numB) return numB - numA;
      // Si mismo número base, ordenar por item
      const itemA = a.otNumber.includes('.') ? parseInt(a.otNumber.split('.')[1]) : 0;
      const itemB = b.otNumber.includes('.') ? parseInt(b.otNumber.split('.')[1]) : 0;
      return itemB - itemA;
    });

    console.log(`✅ ${ordenes.length} órdenes de trabajo cargadas`);
    return ordenes;
  },

  /**
   * Phase 12 W4: Scoped query — returns only OTs linked to a specific presupuesto numero.
   * Uses array-contains on 'budgets' field (single-field; no composite index required).
   * Called from presupuestosService._recomputeAndPersistEsquema instead of getAll()
   * to avoid loading all OTs for each recompute (performance fix W4).
   */
  async queryByBudget(presupuestoNumero: string): Promise<WorkOrder[]> {
    const q = query(
      collection(db, 'reportes'),
      where('budgets', 'array-contains', String(presupuestoNumero)),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      otNumber: d.id,
      ...d.data(),
      updatedAt: d.data().updatedAt || new Date().toISOString(),
    } as WorkOrder));
  },

  /** Real-time subscription for OTs. Returns unsubscribe function. */
  subscribe(
    filters: { clienteId?: string; sistemaId?: string; status?: WorkOrder['status'] } | undefined,
    callback: (ots: WorkOrder[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    let q = query(collection(db, 'reportes'));
    if (filters?.clienteId) q = query(q, where('clienteId', '==', filters.clienteId));
    if (filters?.sistemaId) q = query(q, where('sistemaId', '==', filters.sistemaId));
    if (filters?.status) q = query(q, where('status', '==', filters.status));

    return onSnapshot(q, snap => {
      const ordenes = snap.docs.map(d => ({
        otNumber: d.id,
        ...d.data(),
        updatedAt: d.data().updatedAt || new Date().toISOString(),
      })) as WorkOrder[];
      ordenes.sort((a, b) => {
        const numA = parseInt(a.otNumber.split('.')[0]);
        const numB = parseInt(b.otNumber.split('.')[0]);
        if (numA !== numB) return numB - numA;
        const itemA = a.otNumber.includes('.') ? parseInt(a.otNumber.split('.')[1]) : 0;
        const itemB = b.otNumber.includes('.') ? parseInt(b.otNumber.split('.')[1]) : 0;
        return itemB - itemA;
      });
      callback(ordenes);
    }, err => {
      console.error('OT subscription error:', err);
      onError?.(err);
    });
  },

  // Obtener items de una OT padre
  async getItemsByOtPadre(otPadre: string): Promise<WorkOrder[]> {
    const q = query(collection(db, 'reportes'));
    const querySnapshot = await getDocs(q);
    const prefix = otPadre + '.';

    const items = querySnapshot.docs
      .filter(doc => doc.id.startsWith(prefix))
      .map(doc => ({
        otNumber: doc.id,
        ...doc.data(),
        updatedAt: doc.data().updatedAt || new Date().toISOString(),
      })) as WorkOrder[];

    // Ordenar por número de item
    items.sort((a, b) => {
      const itemA = parseInt(a.otNumber.split('.')[1]);
      const itemB = parseInt(b.otNumber.split('.')[1]);
      return itemA - itemB;
    });

    return items;
  },

  // Obtener OT por número
  async getByOtNumber(otNumber: string) {
    const otDocRef = doc(db, 'reportes', otNumber);
    const docSnap = await getDoc(otDocRef);
    if (docSnap.exists()) {
      return {
        otNumber: docSnap.id,
        ...docSnap.data(),
        updatedAt: docSnap.data().updatedAt || new Date().toISOString(),
      } as WorkOrder;
    }
    return null;
  },

  /**
   * Agrega un número de presupuesto al array `budgets` de una OT (dedupe).
   * Usado cuando se crea un presupuesto ADICIONAL desde la pantalla de una OT:
   * sin esto el ppto quedaba solo como metadata (`origenTipo:'ot'`) y el cierre
   * —que resuelve los presupuestos por `ot.budgets`— no lo levantaba. Reusa
   * `update` (mismo camino que agregar el budget a mano en la sidebar de la OT).
   * No-op si la OT no existe o el número ya está vinculado.
   */
  async vincularPresupuesto(otNumber: string, presupuestoNumero: string): Promise<void> {
    if (!otNumber || !presupuestoNumero) return;
    const ot = await this.getByOtNumber(otNumber);
    if (!ot) return;
    // Lado OT: agregar el budget a la OT y, si es PADRE, a todos sus items. El item .01
    // (la work unit que se edita) copia los budgets del padre al crearse; cuando el vínculo
    // llega después (flujo "presupuesto pendiente"), hay que propagarlo a los items o el
    // presupuesto no aparece al abrir el .01.
    const targets = [otNumber];
    if (!otNumber.includes('.')) {
      try {
        const itemsSnap = await getDocs(query(
          collection(db, 'reportes'),
          where(documentId(), '>=', `${otNumber}.`),
          where(documentId(), '<', `${otNumber}.:`), // ':' (0x3A) > digitos
        ));
        for (const d of itemsSnap.docs) targets.push(d.id);
      } catch (err) {
        console.error('[vincularPresupuesto] buscar items del padre falló:', err);
      }
    }
    for (const num of targets) {
      const target = num === otNumber ? ot : await this.getByOtNumber(num);
      if (!target) continue;
      const actuales = (target.budgets || []).filter(Boolean);
      if (!actuales.includes(presupuestoNumero)) {
        await this.update(num, { budgets: [...actuales, presupuestoNumero] });
      }
    }
    // Lado presupuesto: agregar la OT a otsVinculadasNumbers (vínculo BIDIRECCIONAL).
    // Sin esto, el presupuesto no "sabía" de la OT y la OT no mostraba el presupuesto.
    try {
      const pres = (await presupuestosService.getAll()).find(p => p.numero === presupuestoNumero);
      if (pres) {
        const prev = pres.otsVinculadasNumbers ?? [];
        const yaVinculada = prev.includes(otNumber);
        // Items sin OT asignada → asignarles esta OT, para que aparezcan en /entregas con
        // su OT# (igual que el flujo de alta de OT). No pisa un otNumeroVinculada ya seteado.
        const items = pres.items ?? [];
        const itemsVinculados = items.map(it => it.otNumeroVinculada ? it : { ...it, otNumeroVinculada: otNumber });
        const itemsCambiaron = itemsVinculados.some((it, i) => it !== items[i]);
        if (!yaVinculada || itemsCambiaron) {
          await presupuestosService.update(pres.id, {
            otsVinculadasNumbers: yaVinculada ? prev : [...prev, otNumber],
            otVinculadaNumber: otNumber,
            ...(itemsCambiaron ? { items: itemsVinculados } : {}),
          });
        }
      }
    } catch (err) {
      console.error('[vincularPresupuesto] lado presupuesto falló:', err);
    }
  },

  /**
   * True si alguna de las OTs dadas (o sus items) ya tuvo cierre administrativo
   * (estadoAdmin CIERRE_ADMINISTRATIVO/FINALIZADO o cierreAdmin.stockDeducido). Usado por
   * la aceptación de presupuesto para NO reservar stock cuando la baja real ya ocurrió en
   * el cierre — reservar después generaría stock fantasma.
   */
  async algunaConCierreAdmin(otNumbers: string[]): Promise<boolean> {
    const cerrados = new Set<OTEstadoAdmin>(['CIERRE_ADMINISTRATIVO', 'FINALIZADO']);
    for (const base of otNumbers.filter(Boolean)) {
      const nums = [base];
      if (!base.includes('.')) {
        try {
          const prefijo = base + '.';
          const snap = await getDocs(query(
            collection(db, 'reportes'),
            where(documentId(), '>=', prefijo),
            where(documentId(), '<', prefijo + ':'),
          ));
          for (const d of snap.docs) nums.push(d.id);
        } catch (err) {
          console.error('[algunaConCierreAdmin] buscar items falló:', err);
        }
      }
      for (const num of nums) {
        const ot = await this.getByOtNumber(num);
        if (ot && (cerrados.has(ot.estadoAdmin as OTEstadoAdmin) || ot.cierreAdmin?.stockDeducido)) {
          return true;
        }
      }
    }
    return false;
  },

  /**
   * Agrega un N° de OC a la OT y, si es PADRE, a todos sus items (mismo criterio que
   * vincularPresupuesto). Sin duplicar. Mantiene `ordenCompra` (legacy) = primera OC.
   * Usado al propagar la OC del presupuesto: la OC debe verse en el item .01 que se edita,
   * no solo en el padre.
   */
  async agregarOrdenCompra(otNumber: string, ocNumero: string): Promise<void> {
    if (!otNumber || !ocNumero) return;
    const targets = [otNumber];
    if (!otNumber.includes('.')) {
      try {
        const prefijo = otNumber + '.';
        const itemsSnap = await getDocs(query(
          collection(db, 'reportes'),
          where(documentId(), '>=', prefijo),
          where(documentId(), '<', prefijo + ':'),
        ));
        for (const d of itemsSnap.docs) targets.push(d.id);
      } catch (err) {
        console.error('[agregarOrdenCompra] buscar items del padre falló:', err);
      }
    }
    for (const num of targets) {
      try {
        const ot = await this.getByOtNumber(num);
        if (!ot) continue;
        const ocs = (ot.ordenesCompra && ot.ordenesCompra.length > 0
          ? ot.ordenesCompra
          : (ot.ordenCompra ? [ot.ordenCompra] : [])).filter(Boolean);
        if (!ocs.includes(ocNumero)) {
          const next = [...ocs, ocNumero];
          await this.update(num, { ordenesCompra: next, ordenCompra: next[0] });
        }
      } catch (err) {
        console.error(`[agregarOrdenCompra] OT ${num} falló:`, err);
      }
    }
  },

  /**
   * Ticket a Administración Soporte (Miguel Barrios) para preparar y ENVIAR el presupuesto
   * de una OT que se creó con base "presupuesto pendiente" (todavía no hay presupuesto).
   * Si no se resuelve a Miguel, queda sin asignar y el área 'admin_soporte' auto-asigna.
   * Best-effort: devuelve el id del ticket o null.
   */
  async crearTicketPresupuestoPendiente(params: {
    otNumber: string;
    clienteId?: string | null;
    clienteNombre?: string | null;
    /** Detalle de qué presupuestar (ej. "Presupuestar visita de diagnóstico"). Se concatena. */
    detalle?: string | null;
  }): Promise<string | null> {
    try {
      const miguel = await getAdminSoporteAssignee();
      const detalleTxt = params.detalle?.trim();
      const ticketId = await leadsService.create({
        clienteId: params.clienteId ?? null,
        contactoId: null,
        razonSocial: params.clienteNombre || '',
        contactos: [],
        contacto: '',
        email: '',
        telefono: '',
        motivoLlamado: 'administracion',
        motivoContacto: `Preparar presupuesto — OT ${params.otNumber}`,
        descripcion: `La OT ${params.otNumber}${params.clienteNombre ? ` (${params.clienteNombre})` : ''} se creó con presupuesto PENDIENTE. Preparar y enviar el presupuesto al cliente.${detalleTxt ? `\n\nA presupuestar: ${detalleTxt}` : ''}`,
        // Detalle a la vista en la grilla (que muestra ultimaObservacion antes que descripcion).
        ultimaObservacion: detalleTxt ? `A presupuestar: ${detalleTxt}` : null,
        sistemaId: null,
        moduloId: null,
        estado: 'nuevo' as TicketEstado,
        postas: [],
        asignadoA: miguel?.id ?? null,
        asignadoNombre: miguel?.nombre ?? null,
        derivadoPor: null,
        areaActual: 'admin_soporte' as TicketArea,
        accionPendiente: `Preparar y enviar presupuesto${detalleTxt ? `: ${detalleTxt}` : ''}`,
        adjuntos: [],
        presupuestosIds: [],
        otIds: [params.otNumber],
        finalizadoAt: null,
        prioridad: 'urgente', // prioridad más alta: preparar el presupuesto no debe esperar
        proximoContacto: null,
        valorEstimado: null,
      });
      return ticketId;
    } catch (err) {
      console.error('[crearTicketPresupuestoPendiente] falló:', err);
      return null;
    }
  },

  /**
   * Registra un documento anexado al PDF definitivo de un reporte finalizado.
   * El merge físico (descarga + pdf-lib + re-upload + backup) lo hace
   * `reportePdfService.appendDocumentToReportPdf`; acá solo se persiste el
   * metadata en el doc del reporte. No toca estadoAdmin → no dispara los
   * side-effects de transición de `update`.
   */
  async registrarDocumentoAdicional(
    otNumber: string,
    entry: DocumentoAdicionalReporte,
    nuevaPdfUrl?: string,
  ): Promise<void> {
    const ot = await this.getByOtNumber(otNumber);
    if (!ot) throw new Error(`OT ${otNumber} no existe`);
    const actuales = ot.documentosAdicionales ?? [];
    await this.update(otNumber, {
      documentosAdicionales: [...actuales, entry],
      pdfActualizadoAt: new Date().toISOString(),
      // Sobrescribir el PDF rota su downloadToken → persistir la URL nueva
      // para que portal/cierre no apunten a un token muerto.
      ...(nuevaPdfUrl ? { pdfUrl: nuevaPdfUrl } : {}),
    });
  },

  /**
   * Phase 14 BOM-05 — reads the technician report's `patronesSeleccionados`
   * array from `reportes/{otNumber}`. Used by the cierre admin step to
   * auto-prefill the consumo de componentes table. The reporte técnico
   * remains intocable — this is a read-only access.
   *
   * Service-only Firestore access (rule .claude/rules/firestore.md): hooks
   * must not perform raw getDoc calls; they go through this method instead.
   */
  async getPatronesSeleccionados(otNumber: string): Promise<PatronSeleccionado[]> {
    const snap = await getDoc(doc(db, 'reportes', otNumber));
    if (!snap.exists()) return [];
    const data = snap.data() as any;
    return Array.isArray(data?.patronesSeleccionados)
      ? (data.patronesSeleccionados as PatronSeleccionado[])
      : [];
  },

  /** Real-time subscription to a single OT by otNumber. Returns unsubscribe function. */
  subscribeByOtNumber(
    otNumber: string,
    callback: (ot: WorkOrder | null) => void,
    onError?: (err: Error) => void,
  ): () => void {
    return onSnapshot(doc(db, 'reportes', otNumber), snap => {
      if (!snap.exists()) { callback(null); return; }
      callback({
        otNumber: snap.id,
        ...snap.data(),
        updatedAt: snap.data().updatedAt || new Date().toISOString(),
      } as WorkOrder);
    }, err => {
      console.error('OT single subscription error:', err);
      onError?.(err);
    });
  },

  // Crear nueva OT (usa setDoc para controlar el ID).
  // Si el otNumber es de parent (sin punto), auto-crea también el primer
  // item child .01 — el parent es contenedor agrupador, el child es la
  // unidad de trabajo real. Esto previene la UX inconsistente de OTs
  // parent-only que confunden agenda/cierre técnico/admin.
  async create(otData: Omit<WorkOrder, 'otNumber'> & { otNumber: string }) {
    console.log('📝 Creando orden de trabajo:', otData.otNumber);

    const isParent = !otData.otNumber.includes('.');
    const otDocRef = doc(db, 'reportes', otData.otNumber);

    // Anti-overwrite guard: si la OT ya existe, abortar. Sin esto un dedazo en
    // el número de OT (la UI permite override del auto-generado) pisaba la OT
    // real con todo su contenido (artículos, fechas, ingeniero, posta histórica)
    // sin ningún warning. Disaster recovery = restore desde backup.
    const existing = await getDoc(otDocRef);
    if (existing.exists()) {
      throw new Error(`La OT ${otData.otNumber} ya existe. Elegí otro número.`);
    }

    const cleanedData = deepCleanForFirestore({
      ...otData,
      ...getCreateTrace(),
      status: otData.status || 'BORRADOR',
      updatedAt: Timestamp.now(),
      createdAt: Timestamp.now(),
    });

    const batch = createBatch();
    batch.set(otDocRef, cleanedData);
    batchAudit(batch, { action: 'create', collection: 'ordenes_trabajo', documentId: otData.otNumber, after: cleanedData });
    await batch.commit();
    console.log('✅ Orden de trabajo creada exitosamente');

    // Si es parent: auto-crear primer item child .01 con copia de los datos.
    // El child ES la work unit (lo que aparece en list/agenda por filter rule
    // commit 2b264e2). El parent queda oculto, solo visible al buscar por número.
    // Best-effort — si el auto-child falla, el parent queda creado y el user
    // puede agregar items manualmente con "+ Item".
    if (isParent) {
      try {
        const childNumber = await this.getNextItemNumber(otData.otNumber);
        const ahora = new Date().toISOString();
        const childData = {
          ...otData,
          otNumber: childNumber,
          status: 'BORRADOR' as const,
          estadoAdmin: 'CREADA' as OTEstadoAdmin,
          estadoAdminFecha: ahora,
          estadoHistorial: [{ estado: 'CREADA' as OTEstadoAdmin, fecha: ahora }],
        };
        // Recursive call — el child entra con dot, no se re-auto-creará.
        await this.create(childData as any);
        console.log(`✅ Auto-creado item .01 del parent ${otData.otNumber}: ${childNumber}`);
      } catch (err) {
        console.error('[otService] Auto-create .01 failed (parent queda sin child):', err);
      }
    }

    // Auto-create agenda entry SOLO para children (no para parents — parents
    // son contenedores ocultos del agenda sidebar; la unidad de trabajo es la child).
    if (otData.ingenieroAsignadoId && otData.fechaServicioAprox && otData.otNumber.includes('.')) {
      try {
        await agendaService.autoCreateFromOT(otData as any);
      } catch (err) {
        console.error('[otService] Error auto-creating agenda entry:', err);
      }
    }

    // Sync ticket linked al OT recién creada (presupuesto → OT → ticket = ot_creada).
    // Sin esto, el ticket quedaba en 'en_coordinacion' hasta que la asignación en
    // agenda disparara update() (que sí llama syncFromOT). Solo para children: el
    // parent es contenedor sin estadoAdmin propio.
    if (otData.leadId && otData.otNumber.includes('.')) {
      try {
        await leadsService.syncFromOT(
          otData.leadId,
          otData.otNumber,
          (otData.estadoAdmin as OTEstadoAdmin) || 'CREADA',
        );
      } catch (err) {
        console.error('[otService] Error syncing ticket from OT creation:', err);
      }
    }

    return otData.otNumber;
  },

  // Actualizar OT
  async update(otNumber: string, data: Partial<WorkOrder>) {
    // D7: si data.estadoAdmin está presente, validar que la transición sea legal.
    // Antes el dropdown del EditOTModal podía mover de cualquier estado a cualquier
    // otro (incluyendo retrocesos desde FINALIZADO o saltos a estados terminales).
    if (data.estadoAdmin) {
      const currentForValidate = await this.getByOtNumber(otNumber);
      if (!isOTTransicionValida(currentForValidate?.estadoAdmin, data.estadoAdmin)) {
        throw new Error(
          `Transición OT inválida: ${currentForValidate?.estadoAdmin ?? '(sin estado)'} → ${data.estadoAdmin}. ` +
          `Estados válidos desde ${currentForValidate?.estadoAdmin ?? 'inicial'}: ${currentForValidate?.estadoAdmin ? OT_TRANSICIONES_VALIDAS[currentForValidate.estadoAdmin].join(', ') || '(ninguno — terminal)' : 'CREADA'}`,
        );
      }
    }

    // Branching: si la transición es → CIERRE_ADMINISTRATIVO, delegar a
    // cerrarAdministrativamente para que corra la tx atómica (crea
    // solicitudFacturacion, mailQueue, admin ticket). Sin esto, el dropdown
    // del EditOTModal cambiaba estadoAdmin sin side-effects de Phase 10.
    if (data.estadoAdmin === 'CIERRE_ADMINISTRATIVO') {
      const current = await this.getByOtNumber(otNumber);
      const currentEstado = current?.estadoAdmin;
      if (currentEstado !== 'CIERRE_ADMINISTRATIVO' && currentEstado !== 'FINALIZADO') {
        await this.cerrarAdministrativamente(otNumber, {});
        const { estadoAdmin: _omit, estadoAdminFecha: _omit2, estadoHistorial: _omit3, ...otherFields } = data;
        if (Object.keys(otherFields).length > 0) {
          const cleaned2 = deepCleanForFirestore({
            ...otherFields,
            ...getUpdateTrace(),
            updatedAt: Timestamp.now(),
          });
          const batch2 = createBatch();
          batch2.update(docRef('reportes', otNumber), cleaned2);
          batchAudit(batch2, { action: 'update', collection: 'ordenes_trabajo', documentId: otNumber, after: cleaned2 });
          await batch2.commit();
        }
        return;
      }
    }

    const cleanedData = deepCleanForFirestore({
      ...data,
      ...getUpdateTrace(),
      updatedAt: Timestamp.now(),
    });

    // Si hay transición de estadoAdmin, capturar el estado previo para evento.
    let previousEstado: OTEstadoAdmin | undefined;
    if (data.estadoAdmin) {
      const prev = await this.getByOtNumber(otNumber);
      previousEstado = prev?.estadoAdmin;
    }

    const batch = createBatch();
    batch.update(docRef('reportes', otNumber), cleanedData);
    batchAudit(batch, { action: 'update', collection: 'ordenes_trabajo', documentId: otNumber, after: cleanedData });
    await batch.commit();

    // Evento de negocio: transición de estado. Hace que el cambio aparezca como
    // un "ot.estado_cambiado" destacado en la auditoría, además del update genérico.
    if (data.estadoAdmin && previousEstado !== data.estadoAdmin) {
      logBusinessEvent({
        eventName: 'ot.estado_cambiado',
        collection: 'ordenes_trabajo',
        documentId: otNumber,
        details: { from: previousEstado ?? null, to: data.estadoAdmin },
        entityLabel: `OT ${otNumber}`,
      });
    }

    // ── Auto-sync lead when OT estadoAdmin changes ──
    if (data.estadoAdmin) {
      try {
        const ot = await this.getByOtNumber(otNumber);
        console.info(`[otService.update] estadoAdmin → ${data.estadoAdmin} for OT ${otNumber}`, {
          leadId: ot?.leadId, budgets: ot?.budgets,
        });
        const leadIdsToSync = new Set<string>();
        if (ot?.leadId) leadIdsToSync.add(ot.leadId);
        // Fallback: si no hay leadId directo, buscar tickets linkeados al(los)
        // ppto(s) de la OT via presupuestosIds array-contains. Necesario porque
        // los tickets de FLOW-01 / Phase 10 se linkean vía presupuestosIds,
        // no vía OT.leadId. Sin esto, transiciones de agenda/cierre técnico/
        // admin no propagaban al ticket.
        if (ot && (ot.budgets || []).length > 0) {
          const budgetsForQuery = ot.budgets!.slice(0, 10);
          try {
            const pressSnap = await getDocs(
              query(collection(db, 'presupuestos'), where('numero', 'in', budgetsForQuery)),
            );
            const presIds = pressSnap.docs.map(d => d.id);
            console.info(`[otService.update] resolved ${presIds.length} presupuesto ids from budgets:`, budgetsForQuery, '→', presIds);
            for (const pid of presIds) {
              try {
                const tksSnap = await getDocs(
                  query(collection(db, 'leads'), where('presupuestosIds', 'array-contains', pid)),
                );
                console.info(`[otService.update] found ${tksSnap.docs.length} tickets for ppto ${pid}`);
                for (const d of tksSnap.docs) {
                  const t = d.data() as any;
                  if (t.estado !== 'finalizado' && t.estado !== 'no_concretado') {
                    leadIdsToSync.add(d.id);
                  }
                }
              } catch (err) {
                console.error(`[otService.update] tickets query for ppto ${pid} failed:`, err);
              }
            }
          } catch (err) {
            console.error('[otService.update] presupuestos query by numero failed:', err);
          }
        } else {
          console.info(`[otService.update] OT ${otNumber} has no budgets — cannot fallback-resolve tickets`);
        }
        console.info(`[otService.update] will sync ${leadIdsToSync.size} ticket(s):`, Array.from(leadIdsToSync));
        for (const lid of leadIdsToSync) {
          await leadsService.syncFromOT(lid, otNumber, data.estadoAdmin as OTEstadoAdmin)
            .catch(err => console.error(`[otService] syncFromOT ${lid} failed:`, err));
        }
        // Sync presupuesto estado
        if (ot && data.estadoAdmin === 'FINALIZADO') {
          await this._syncPresupuestoOnFinalize(ot).catch(err =>
            console.error('[otService] Error syncing presupuesto:', err)
          );
        }
      } catch (err) {
        console.error('[otService] Error syncing lead from OT:', err);
      }
    }

    // ── Auto-sync agenda when engineer or date changes ──
    if (data.ingenieroAsignadoId !== undefined || data.fechaServicioAprox !== undefined) {
      try {
        await agendaService.syncFromOT(otNumber, {
          ingenieroId: data.ingenieroAsignadoId as string | null | undefined,
          ingenieroNombre: data.ingenieroAsignadoNombre as string | null | undefined,
          fechaServicioAprox: data.fechaServicioAprox as string | undefined,
        });
        // If engineer+date now present but no entry existed, auto-create
        if (data.ingenieroAsignadoId && data.fechaServicioAprox) {
          const ot = await this.getByOtNumber(otNumber);
          if (ot) await agendaService.autoCreateFromOT(ot as any);
        }
      } catch (err) {
        console.error('[otService] Error syncing agenda:', err);
      }
    }
  },

  /**
   * Al finalizar una OT, intenta sincronizar el estado de los presupuestos
   * vinculados via `presupuestosService.trySyncFinalizacion` — que chequea
   * work-unit OTs + solicitudesFacturacion antes de transicionar a `finalizado`.
   * Reemplaza la lógica vieja que miraba solo parent OTs (bug: parents nunca
   * llegan a FINALIZADO — son contenedores).
   */
  async _syncPresupuestoOnFinalize(ot: WorkOrder): Promise<void> {
    const budgetNumbers = ot.budgets || [];
    if (budgetNumbers.length === 0) return;
    const allPresupuestos = await presupuestosService.getAll();
    for (const budgetNum of budgetNumbers) {
      const pres = allPresupuestos.find(p => p.numero === budgetNum);
      if (!pres) continue;
      // Phase 12 BILL-02: recompute cuota estados before checking finalizacion
      // (cuotas with hito='todas_ots_cerradas' become habilitada when OT → FINALIZADO).
      await (presupuestosService as any)._recomputeAndPersistEsquema(pres.id).catch((err: unknown) =>
        console.warn(`[_syncPresupuestoOnFinalize] recompute ${pres.numero} failed (non-blocking):`, err)
      );
      await presupuestosService.trySyncFinalizacion(pres.id).catch(err =>
        console.error(`[_syncPresupuestoOnFinalize] trySyncFinalizacion ${pres.numero} failed:`, err)
      );
    }
  },

  /**
   * Delete con cleanup referencial. Antes era un solo batch.delete que dejaba
   * referencias muertas en agenda, lead.otIds y presupuesto.otsVinculadasNumbers.
   *
   * Bloquea el delete si la OT está en CIERRE_ADMINISTRATIVO o FINALIZADO —
   * esos estados generan solicitudFacturacion y otra metadata downstream que
   * un delete naive deja orphan. Para OTs cerradas, usar baja lógica vía
   * estadoAdmin (no implementada acá).
   */
  async delete(otNumber: string) {
    const otSnap = await getDoc(doc(db, 'reportes', otNumber));
    if (!otSnap.exists()) {
      throw new Error(`OT ${otNumber} no existe`);
    }
    const otData = otSnap.data() as WorkOrder;

    if (otData.estadoAdmin === 'CIERRE_ADMINISTRATIVO' || otData.estadoAdmin === 'FINALIZADO') {
      throw new Error(
        `No se puede eliminar la OT ${otNumber} en estado ${otData.estadoAdmin}. Tiene solicitudes de facturación o referencias downstream — anular en lugar de eliminar.`,
      );
    }

    // 1. Borrar agenda entries vinculadas (best-effort)
    try {
      const agendaEntries = await agendaService.getByOtNumber(otNumber);
      await Promise.all(agendaEntries.map(e => agendaService.delete(e.id)));
    } catch (err) {
      console.error(`[otService.delete] Error limpiando agenda de ${otNumber}:`, err);
    }

    // 2. Quitar otNumber de lead.otIds[] en cualquier ticket que lo contenga.
    //    Además, FINALIZAR el ticket auto-generado de "presupuesto pendiente" de ESTA OT
    //    (su único motivo era esta OT; sin ella el presupuesto ya no hace falta). Se
    //    identifica por la firma exacta del motivoContacto que setea
    //    crearTicketPresupuestoPendiente. Los tickets de coordinación/origen (que pueden
    //    tener otras OTs o seguir vivos) solo pierden el otId, no se finalizan.
    try {
      const leadsSnap = await getDocs(
        query(collection(db, 'leads'), where('otIds', 'array-contains', otNumber)),
      );
      const ahora = Timestamp.now();
      const actor = getCurrentUserTrace();
      await Promise.all(leadsSnap.docs.map(async d => {
        const data = d.data();
        const next = ((data.otIds as string[] | undefined) ?? []).filter(n => n !== otNumber);
        const updates: Record<string, any> = { otIds: next, updatedAt: ahora, ...getUpdateTrace() };

        const esTicketPendienteDeEstaOT = data.motivoContacto === `Preparar presupuesto — OT ${otNumber}`;
        if (esTicketPendienteDeEstaOT && data.estado !== 'finalizado') {
          updates.estado = 'finalizado';
          updates.finalizadoAt = ahora;
          updates.accionPendiente = null;
          updates.ultimaObservacion = `OT ${otNumber} eliminada — presupuesto ya no es necesario`;
          updates.postas = [...((data.postas as unknown[]) ?? []), deepCleanForFirestore({
            id: crypto.randomUUID(), fecha: new Date().toISOString(),
            deUsuarioId: actor?.uid ?? '', deUsuarioNombre: actor?.name ?? 'Sistema',
            aUsuarioId: actor?.uid ?? '', aUsuarioNombre: actor?.name ?? 'Sistema',
            comentario: `OT ${otNumber} eliminada — ticket finalizado automáticamente.`,
            estadoAnterior: data.estado ?? 'nuevo', estadoNuevo: 'finalizado',
          })];
        }
        await updateDoc(d.ref, updates);
      }));
    } catch (err) {
      console.error(`[otService.delete] Error limpiando otIds de tickets:`, err);
    }

    // 3. Quitar otNumber de presupuesto.otsVinculadasNumbers[] y otsListasParaFacturar[]
    try {
      const presSnap = await getDocs(
        query(collection(db, 'presupuestos'), where('otsVinculadasNumbers', 'array-contains', otNumber)),
      );
      await Promise.all(presSnap.docs.map(async d => {
        const data = d.data();
        const ovn = (data.otsVinculadasNumbers as string[] | undefined) ?? [];
        const olf = (data.otsListasParaFacturar as string[] | undefined) ?? [];
        const updates: Record<string, unknown> = { updatedAt: Timestamp.now() };
        const nextOvn = ovn.filter(n => n !== otNumber);
        if (nextOvn.length !== ovn.length) updates.otsVinculadasNumbers = nextOvn;
        const nextOlf = olf.filter(n => n !== otNumber);
        if (nextOlf.length !== olf.length) updates.otsListasParaFacturar = nextOlf;
        if (Object.keys(updates).length > 1) await updateDoc(d.ref, updates as Record<string, any>);
      }));
    } catch (err) {
      console.error(`[otService.delete] Error limpiando refs en presupuestos:`, err);
    }

    // 4. Borrar la OT
    const batch = createBatch();
    batch.delete(docRef('reportes', otNumber));
    batchAudit(batch, { action: 'delete', collection: 'ordenes_trabajo', documentId: otNumber });
    await batch.commit();
  },

  /**
   * FLOW-04: cierra una OT administrativamente de forma atómica.
   *
   * Modelo Tier-1 (Presupuesto-céntrico): ya NO crea solicitudesFacturacion aquí.
   * En su lugar registra `otNumber` en `presupuesto.otsListasParaFacturar[]` de
   * cada presupuesto vinculado — el admin del ppto agrupa las OTs manualmente y
   * genera el aviso de facturación desde EditPresupuestoModal.
   *
   * runTransaction — Firestore reads-before-writes invariant respetado estrictamente:
   *   Reads (READ PHASE):
   *     R1. OT doc (validate existencia)
   *     R2+. doc de cada presupuesto vinculado (para leer otsListasParaFacturar actual)
   *   Writes (WRITE PHASE — todos después del READ PHASE):
   *     1. Update OT: estadoAdmin='CIERRE_ADMINISTRATIVO' + fechaCierre
   *     2. Ticket admin nuevo (colección `leads`, area='administracion') — notificación para admin
   *     3. mailQueue doc (type='cierre_admin_ot') — aviso al contable de que la OT cerró
   *     4+. tx.update por cada presupuesto vinculado: merge otNumber en otsListasParaFacturar[]
   *         (no se usa arrayUnion — prohibido dentro de tx; se computa manualmente)
   *
   * Post-commit (best-effort, fuera de tx):
   *   - `leadsService.syncFromOT` para ticket origen de la OT (si tiene leadId)
   *     → transiciona ticket a `pendiente_aviso_facturacion`
   *
   * @returns `{ adminTicketId, mailQueueId, pptosNotificados }` — pptosNotificados
   *   son los IDs de presupuestos que recibieron el otNumber en otsListasParaFacturar.
   */
  async cerrarAdministrativamente(
    otNumber: string,
    cierreData: { notas?: string; fechaCierre?: string },
    actor?: { uid: string; name?: string },
  ): Promise<{ adminTicketId: string; mailQueueId: string; pptosNotificados: string[] }> {
    // ── Pre-reads fuera de tx ─────────────────────────────────────
    const ot = await this.getByOtNumber(otNumber);
    if (!ot) throw new Error('OT no encontrada');

    // Guard de re-entrada a nivel service: si la OT ya está cerrada, NO se
    // re-escribe el estado ni se duplican ticket admin / mailQueue / avance de
    // ppto (la UI ya lo bloqueaba por estado, pero el service no). La deducción
    // de stock SÍ se reintenta más abajo — tiene su propio flag stockDeducido,
    // y un retry legítimo es justamente para cuando esa parte best-effort falló.
    const yaCerrada = ot.estadoAdmin === 'CIERRE_ADMINISTRATIVO' || ot.estadoAdmin === 'FINALIZADO';
    if (yaCerrada) {
      console.log(`[cerrarAdmin] OT ${otNumber} ya estaba en ${ot.estadoAdmin}; no se duplican ticket/mail (solo retry de stock si quedó pendiente).`);
    }

    // Config con defaults (fallback hardcoded si adminConfig lectura falla).
    let mailTo = 'mbarrios@agsanalitica.com';
    try {
      const cfg = await adminConfigService.getWithDefaults();
      mailTo = cfg.mailFacturacion || mailTo;
    } catch (err) {
      console.warn('[cerrarAdministrativamente] adminConfig read failed; using default mail:', err);
    }

    // Pre-cargar presupuestos vinculados para el body del mail. OT.budgets contiene
    // los `numero` (PRE-XXXX.NN) — aquí los resolvemos a IDs para el tx.update.
    const presupuestoNumeros = ot.budgets || [];
    let presupuestosPorNumero: Array<Presupuesto | null> = [];
    let presupuestoIds: string[] = [];
    if (presupuestoNumeros.length > 0) {
      try {
        const all = await presupuestosService.getAll();
        presupuestosPorNumero = presupuestoNumeros.map(num => all.find(p => p.numero === num) ?? null);
        presupuestoIds = presupuestosPorNumero.filter((p): p is Presupuesto => !!p).map(p => p.id);
      } catch (err) {
        console.warn('[cerrarAdministrativamente] presupuestos read failed:', err);
      }
    }

    const ocIds = Array.from(new Set(
      presupuestosPorNumero.flatMap(p => (p?.ordenesCompraIds || [])),
    ));

    const subject = `Aviso facturación — OT ${otNumber}`;
    const body = buildAvisoFacturacionBody(ot, presupuestosPorNumero);
    const bodyWithCTA = `${body}\n\n---\nVer en sistema: /facturacion`;

    const nowIso = new Date().toISOString();

    const newAdminTicketRef = newDocRef('leads');
    const newMailQueueRef = newDocRef('mailQueue');

    // ── Transaction: reads-before-writes invariant ──────────────────────────────
    const txResult = yaCerrada
      ? { adminTicketId: '', mailQueueId: '' }
      : await runTransaction(db, async (tx) => {
      // ═══════════════ READ PHASE (todos los tx.get aquí — ningún write antes) ═══════════════

      // R1: OT
      const otRef = doc(db, 'reportes', otNumber);
      const otSnap = await tx.get(otRef);
      if (!otSnap.exists()) throw new Error(`OT ${otNumber} no encontrada (tx)`);

      // R2+: leer doc de cada presupuesto para conocer otsListasParaFacturar + estado actual
      const pptoSnaps = new Map<string, { ref: ReturnType<typeof doc>; current: string[]; estado: string }>();
      for (const pid of presupuestoIds) {
        const pRef = doc(db, 'presupuestos', pid);
        const pSnap = await tx.get(pRef);
        const existing: string[] = pSnap.exists()
          ? (pSnap.data()?.otsListasParaFacturar ?? [])
          : [];
        pptoSnaps.set(pid, { ref: pRef, current: existing, estado: pSnap.data()?.estado ?? '' });
      }

      // ═══════════════ WRITE PHASE (todos los tx.set/update después de los reads) ═══════════════

      // Write 1: update OT a CIERRE_ADMINISTRATIVO
      tx.update(otRef, deepCleanForFirestore({
        estadoAdmin: 'CIERRE_ADMINISTRATIVO' as OTEstadoAdmin,
        fechaCierre: cierreData.fechaCierre ?? nowIso,
        updatedAt: nowIso,
        updatedBy: actor?.uid ?? null,
        updatedByName: actor?.name ?? null,
      }));

      // Write 2: ticket de cierre para admin_soporte — revisar el cierre/entrega de la OT.
      // El aviso de facturación NO se genera acá: es un paso posterior y manual a nivel
      // presupuesto (cuando todas las OTs del ppto están finalizadas, o anticipado).
      const adminTicketPayload: Omit<Lead, 'id'> & { createdAt: string; updatedAt: string } = {
        clienteId: ot.clienteId ?? null,
        contactoId: null,
        razonSocial: ot.razonSocial || '',
        contactos: [],
        contacto: ot.contacto || '',
        email: ot.emailPrincipal || '',
        telefono: '',
        motivoLlamado: 'administracion',
        motivoContacto: `Cierre OT ${otNumber}`,
        descripcion: `OT ${otNumber} cerrada administrativamente. ${presupuestoNumeros.length ? `Presupuesto(s): ${presupuestoNumeros.join(', ')}.` : 'Sin presupuesto vinculado.'} Revisar cierre/entrega.`,
        sistemaId: ot.sistemaId ?? null,
        moduloId: ot.moduloId ?? null,
        estado: 'nuevo' as TicketEstado,
        postas: [],
        asignadoA: null,
        asignadoNombre: null,
        derivadoPor: actor?.uid ?? null,
        areaActual: 'admin_soporte' as TicketArea,
        accionPendiente: 'Revisar cierre de OT',
        adjuntos: [],
        presupuestosIds: presupuestoIds,
        otIds: [otNumber],
        finalizadoAt: null,
        prioridad: 'normal',
        proximoContacto: null,
        valorEstimado: null,
        createdAt: nowIso,
        updatedAt: nowIso,
        createdBy: actor?.uid ?? undefined,
      };
      tx.set(newAdminTicketRef, deepCleanForFirestore(adminTicketPayload));

      // Write 3: mailQueue doc (type='cierre_admin_ot', status='pending')
      tx.set(newMailQueueRef, deepCleanForFirestore({
        type: 'cierre_admin_ot',
        status: 'pending',
        data: {
          to: mailTo,
          subject,
          body: bodyWithCTA,
          otNumber,
          presupuestoIds,
          presupuestoNumeros,
          ocIds,
          attachments: [
            ...presupuestoIds.map(pid => ({ type: 'pdf_presupuesto', presupuestoId: pid })),
          ],
          razonSocial: ot.razonSocial || '',
          clienteId: ot.clienteId ?? null,
        },
        createdAt: nowIso,
        createdBy: actor?.uid ?? null,
      }));

      // Write 4+: registrar otNumber en otsListasParaFacturar[] de cada presupuesto vinculado.
      // Se usa manual merge (no arrayUnion — sentinel prohibido en tx). Además, el cierre
      // genera el aviso a facturación → el presupuesto pasa a 'pendiente_facturacion' (a la
      // espera de que Administración confirme la factura). No se pisa anulado/finalizado.
      for (const [pid, { ref: pRef, current, estado }] of pptoSnaps) {
        const yaListo = current.includes(otNumber);
        const avanzaEstado = estado === 'aceptado' || estado === 'en_ejecucion';
        if (!yaListo || avanzaEstado) {
          tx.update(pRef, deepCleanForFirestore({
            ...(yaListo ? {} : { otsListasParaFacturar: [...current, otNumber] }),
            ...(avanzaEstado ? { estado: 'pendiente_facturacion' } : {}),
            updatedAt: nowIso,
          }));
        } else {
          console.log(`[cerrarAdministrativamente] OT ${otNumber} ya en otsListasParaFacturar y estado ${estado} de ppto ${pid}, skip`);
        }
      }

      return { adminTicketId: newAdminTicketRef.id, mailQueueId: newMailQueueRef.id };
    });

    // ── Post-commit side-effects (best-effort, NO bloquea) ────────
    if (!yaCerrada) {
      try {
        if (ot.leadId) {
          await leadsService.syncFromOT(ot.leadId, otNumber, 'CIERRE_ADMINISTRATIVO');
        }
      } catch (err) {
        console.error('[cerrarAdministrativamente] syncFromOT failed (non-blocking):', err);
      }

      // ── Phase 12 BILL-02: recompute cuota estados for all linked presupuestos ──
      // When an OT closes, cuotas with hito='todas_ots_cerradas' may become habilitada.
      // Recompute BEFORE trySyncFinalizacion so finalizacion sees fresh cuota estados.
      // Pitfall 2: called post-commit (never inside runTransaction).
      for (const presupuestoId of presupuestoIds) {
        try {
          await (presupuestosService as any)._recomputeAndPersistEsquema(presupuestoId);
        } catch (err) {
          console.warn(`[cerrarAdmin.recompute] ppto ${presupuestoId}:`, err);
        }
        try {
          await presupuestosService.trySyncFinalizacion(presupuestoId);
        } catch (err) {
          console.warn(`[cerrarAdmin.trySync] ppto ${presupuestoId}:`, err);
        }
      }
    }

    // ── Deducción de stock al cierre (idempotente) ─────────────────────────────
    // Guard de re-entrada: si la OT ya tuvo su stock deducido en un cierre previo,
    // NO volver a descontar. Sin esto, reinvocar cerrarAdministrativamente sobre la
    // misma OT generaba un segundo egreso (doble descuento). El flag existía pero no
    // se chequeaba a la entrada — acá lo cableamos.
    if (ot.cierreAdmin?.stockDeducido) {
      console.log(`[cerrarAdmin] OT ${otNumber} ya tiene stock deducido; se omite la deducción.`);
    } else {
      let huboDeduccion = false;

      // Camino A — SELECCIÓN manual del cierre (entrega de partes).
      // Las unidades/posiciones elegidas en cierreAdmin.stockSelections se descuentan
      // (disponible→entregado). Independiente del camino de presupuesto (reservado→
      // entregado): el guard por estado evita solapamiento. Best-effort.
      const stockSelections = ot.cierreAdmin?.stockSelections ?? [];
      if (stockSelections.length > 0) {
        huboDeduccion = true;
        try {
          const { deducidas } = await reservasService.entregarSeleccionesCierre({
            selections: stockSelections,
            otNumber,
            clienteId: ot.clienteId ?? null,
            clienteNombre: ot.razonSocial ?? null,
            solicitadoPorNombre: actor?.name || 'Sistema',
          });
          if (deducidas > 0) {
            console.log(`[cerrarAdmin] ${deducidas} unidad(es) descontada(s) por selección manual en OT ${otNumber}`);
          }
        } catch (err) {
          console.warn(`[cerrarAdmin.stockSelections] OT ${otNumber}:`, err);
        }
      }

      // Camino B — entregar unidades RESERVADAS de los presupuestos vinculados.
      // Las unidades reservadas (estado 'reservado') pasan a 'entregado' → salen del ATP.
      // Best-effort: si falla, el cierre admin no se revierte (el stock se ajusta a mano).
      if (presupuestoIds.length > 0) {
        huboDeduccion = true;
        let stockEntregado = 0;
        for (const presupuestoId of presupuestoIds) {
          try {
            const { entregadas } = await reservasService.entregarPorPresupuesto({
              presupuestoId,
              otNumber,
              solicitadoPorNombre: actor?.name || 'Sistema',
            });
            stockEntregado += entregadas;
          } catch (err) {
            console.warn(`[cerrarAdmin.stock] ppto ${presupuestoId}:`, err);
          }
        }
        if (stockEntregado > 0) {
          console.log(`[cerrarAdmin] ${stockEntregado} unidad(es) entregada(s) por cierre de OT ${otNumber}`);
        }
      }

      // Marcar stockDeducido UNA sola vez si hubo algún camino de deducción.
      if (huboDeduccion) {
        try {
          const cierreAdminActual: CierreAdministrativo = {
            horasConfirmadas: false, partesConfirmadas: false, avisoAdminEnviado: false,
            ...(ot.cierreAdmin ?? {}), stockDeducido: true,
          };
          await this.update(otNumber, { cierreAdmin: cierreAdminActual });
        } catch (err) {
          console.warn(`[cerrarAdmin.stockDeducido] no se pudo marcar OT ${otNumber}:`, err);
        }
      }
    }

    // Evento de negocio: OT cerrada administrativamente (solo en el cierre real).
    if (!yaCerrada) {
      logBusinessEvent({
        eventName: 'ot.cerrada',
        collection: 'ordenes_trabajo',
        documentId: otNumber,
        entityLabel: `OT ${otNumber}`,
        details: {
          adminTicketId: txResult.adminTicketId,
          pptosNotificados: presupuestoIds,
          notas: cierreData.notas ?? null,
        },
      });
    }

    return {
      adminTicketId: txResult.adminTicketId,
      mailQueueId: txResult.mailQueueId,
      pptosNotificados: presupuestoIds,
    };
  },

};
