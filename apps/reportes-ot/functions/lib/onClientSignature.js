"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.onClientSignature = void 0;
/**
 * Cloud Function: aviso al técnico cuando el cliente firma una OT remotamente.
 *
 * Trigger: onDocumentUpdated('reportes/{otNumber}').
 * Dispara cuando `signedAt` pasa de null/undefined a un valor con
 * `signedFrom === 'mobile'` (firma remota vía QR, no firma presencial).
 *
 * Comportamiento (híbrido):
 *  - Si la OT ya tiene un ticket linkeado abierto (otIds array-contains otNumber,
 *    estado ∉ {finalizado, no_concretado}) → agrega una posta de comentario en
 *    el más reciente. La notificación push existente (onLeadWritten, rama 3)
 *    avisa al asignado.
 *  - Si no hay ticket abierto linkeado → crea un ticket nuevo con TKT-XXXXX,
 *    area=ing_soporte, prioridad=normal, asignado al ingeniero de la OT (o a
 *    Esteban como fallback hoy, mientras las OTs se crean desde reportes-ot
 *    sin ingenieroAsignadoId).
 *
 * Idempotencia: setea `clientSignatureNotified: true` en el doc del reporte al
 * finalizar. Si el trigger se reejecuta (re-firma, snapshot tardío), skip.
 */
const functions = __importStar(require("firebase-functions/v2"));
const firestore_1 = require("firebase-admin/firestore");
const FALLBACK_ASIGNADO_UID = 'pHDkcnzLEdX93APkPcf3ebqyOJL2';
const FALLBACK_ASIGNADO_NOMBRE = 'Esteban Vigna';
const TICKET_AREA = 'ing_soporte';
const FINAL_STATES = new Set(['finalizado', 'no_concretado']);
function hasValue(v) {
    return v !== null && v !== undefined && v !== '';
}
function formatTimestampAR(ts) {
    let date = null;
    if (ts instanceof firestore_1.Timestamp)
        date = ts.toDate();
    else if (ts instanceof Date)
        date = ts;
    else if (typeof ts === 'string')
        date = new Date(ts);
    if (!date || isNaN(date.getTime()))
        return new Date().toLocaleString('es-AR');
    return date.toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
}
async function generateTicketNumero() {
    const db = (0, firestore_1.getFirestore)();
    const counterRef = db.doc('_counters/tickets');
    return db.runTransaction(async (tx) => {
        const snap = await tx.get(counterRef);
        let currentMax;
        if (snap.exists) {
            currentMax = snap.data()?.value ?? 0;
        }
        else {
            // Bootstrap si el counter no existe: scan de leads existentes.
            const all = await db.collection('leads').get();
            currentMax = 0;
            all.docs.forEach((d) => {
                const n = typeof d.data().numero === 'string' ? d.data().numero.match(/TKT-(\d+)/) : null;
                if (n)
                    currentMax = Math.max(currentMax, parseInt(n[1], 10));
            });
        }
        const next = currentMax + 1;
        tx.set(counterRef, { value: next });
        return `TKT-${String(next).padStart(5, '0')}`;
    });
}
exports.onClientSignature = functions.firestore.onDocumentUpdated('reportes/{otNumber}', async (event) => {
    const otNumber = event.params.otNumber;
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after)
        return;
    // Filtro 1: solo firmas remotas (mobile). Firmas presenciales del técnico
    // no necesitan aviso — él ya está parado al lado.
    if (after.signedFrom !== 'mobile')
        return;
    // Filtro 2: transición no-firmado → firmado.
    if (hasValue(before.signedAt) || !hasValue(after.signedAt))
        return;
    // Filtro 3: idempotencia. Si ya disparamos antes para esta OT, skip.
    if (before.clientSignatureNotified === true || after.clientSignatureNotified === true) {
        console.log(`[onClientSignature] OT ${otNumber} ya tiene clientSignatureNotified=true, skip`);
        return;
    }
    const db = (0, firestore_1.getFirestore)();
    const razonSocial = (after.razonSocial || 'Sin razón social').toString();
    const fechaFirma = formatTimestampAR(after.signedAt);
    const motivoContacto = `[OT-${otNumber}] Cliente firmó reporte remotamente`;
    const descripcion = `${razonSocial} firmó la OT-${otNumber} desde el link de firma remota (móvil) el ${fechaFirma}.`;
    // Resolver asignado: ingeniero de la OT o fallback Esteban.
    let asignadoA = after.ingenieroAsignadoId || null;
    let asignadoNombre = after.ingenieroAsignadoNombre || null;
    if (!asignadoA) {
        // Fallback: chequear si el usuarioMaterialesId está configurado y activo,
        // pero por decisión del producto este aviso va a Esteban por ahora.
        asignadoA = FALLBACK_ASIGNADO_UID;
        asignadoNombre = FALLBACK_ASIGNADO_NOMBRE;
        console.log(`[onClientSignature] OT ${otNumber} sin ingenieroAsignadoId, usando fallback ${asignadoNombre}`);
    }
    try {
        // Buscar tickets linkeados abiertos para hacer posta en lugar de crear nuevo.
        const linkedSnap = await db
            .collection('leads')
            .where('otIds', 'array-contains', otNumber)
            .get();
        const openTickets = linkedSnap.docs
            .filter((d) => !FINAL_STATES.has(d.data().estado))
            .sort((a, b) => {
            const av = a.data().updatedAt?.toMillis?.() ?? 0;
            const bv = b.data().updatedAt?.toMillis?.() ?? 0;
            return bv - av;
        });
        if (openTickets.length > 0) {
            // Posta en el ticket abierto más reciente.
            const target = openTickets[0];
            const targetData = target.data();
            const posta = {
                id: crypto.randomUUID(),
                fecha: new Date().toISOString(),
                deUsuarioId: 'system',
                deUsuarioNombre: 'Sistema (firma cliente)',
                aUsuarioId: targetData.asignadoA ?? null,
                aUsuarioNombre: targetData.asignadoNombre ?? null,
                aArea: null,
                comentario: `Cliente firmó OT-${otNumber} remotamente — ${razonSocial} (${fechaFirma}).`,
                estadoAnterior: targetData.estado,
                estadoNuevo: targetData.estado,
                accionRequerida: null,
            };
            await target.ref.update({
                postas: [...(targetData.postas || []), posta],
                updatedAt: firestore_1.Timestamp.now(),
            });
            console.log(`[onClientSignature] OT ${otNumber}: posta agregada al ticket ${target.id} (asignado=${targetData.asignadoNombre || targetData.asignadoA || 'área'})`);
        }
        else {
            // No hay ticket abierto: crear uno nuevo.
            const numero = await generateTicketNumero().catch((err) => {
                console.warn('[onClientSignature] no se pudo generar numero correlativo:', err);
                return '';
            });
            const now = firestore_1.Timestamp.now();
            const newTicket = {
                ...(numero ? { numero } : {}),
                razonSocial,
                contacto: after.contacto || '',
                email: '',
                telefono: '',
                motivoLlamado: 'soporte',
                motivoContacto,
                descripcion,
                estado: 'nuevo',
                areaActual: TICKET_AREA,
                asignadoA,
                asignadoNombre,
                derivadoPor: null,
                prioridad: 'normal',
                clienteId: after.clienteId || null,
                contactoId: null,
                sistemaId: after.sistemaId || null,
                postas: [],
                otIds: [otNumber],
                presupuestosIds: [],
                adjuntos: [],
                proximoContacto: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                source: 'firma_remota',
                createdBy: null,
                createdAt: now,
                updatedAt: now,
            };
            const ref = await db.collection('leads').add(newTicket);
            console.log(`[onClientSignature] OT ${otNumber}: ticket ${numero || ref.id} creado, asignado a ${asignadoNombre}`);
        }
        // Marcar el reporte para no re-disparar.
        await db.doc(`reportes/${otNumber}`).update({
            clientSignatureNotified: true,
            clientSignatureNotifiedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    catch (err) {
        console.error(`[onClientSignature] error procesando OT ${otNumber}:`, err);
        // No re-throw: el doc del reporte queda firmado igual, este es un side-effect.
    }
});
