import { collection, getDocs, doc, getDoc, query, where, orderBy, Timestamp } from 'firebase/firestore';
import type { AgendaPrevision, EstadoPrevision, PrevisionesGenerarReport, TipoServicio } from '@ags/shared';
import {
  db, logAudit, deepCleanForFirestore, getCreateTrace, getUpdateTrace, onSnapshot,
  setDoc, updateDoc, deleteDoc,
} from './firebase';
import { agendaService, feriadosService } from './agendaService';
import { contratosService } from './contratosService';
import { tiposServicioService } from './importacionesService';
import { ordenesTrabajoService } from './otService';
import { calcularFechasPrevision } from '../utils/previsionesFechas';

const COL = 'agendaPrevisiones';

/** Doc id determinístico → idempotencia del generador. */
export const previsionDocId = (anioDestino: number, origenAgendaEntryId: string) =>
  `${anioDestino}_${origenAgendaEntryId}`;

/** Estados que indican intervención manual de la coordinadora: el batch NO los pisa. */
const ESTADOS_MANUALES: EstadoPrevision[] = ['reprogramada', 'convertida', 'descartada'];

const normalizar = (s: string) => (s || '').trim().toLowerCase();

function parsePrevision(id: string, data: Record<string, any>): AgendaPrevision {
  return {
    id,
    anioDestino: data.anioDestino,
    fechaInicio: data.fechaInicio,
    fechaFin: data.fechaFin,
    ingenieroId: data.ingenieroId ?? '',
    ingenieroNombre: data.ingenieroNombre ?? '',
    clienteNombre: data.clienteNombre ?? '',
    tipoServicio: data.tipoServicio ?? '',
    sistemaNombre: data.sistemaNombre ?? null,
    establecimientoNombre: data.establecimientoNombre ?? null,
    equipoModelo: data.equipoModelo ?? null,
    equipoAgsId: data.equipoAgsId ?? null,
    clienteId: data.clienteId ?? null,
    establecimientoId: data.establecimientoId ?? null,
    sistemaId: data.sistemaId ?? null,
    moduloId: data.moduloId ?? null,
    tipoServicioId: data.tipoServicioId ?? null,
    origenAgendaEntryId: data.origenAgendaEntryId ?? '',
    origenOtNumber: data.origenOtNumber ?? '',
    reservaAgendaEntryId: data.reservaAgendaEntryId ?? null,
    estado: data.estado ?? 'prevista',
    tieneContrato: !!data.tieneContrato,
    otNumberGenerada: data.otNumberGenerada ?? null,
    notas: data.notas ?? null,
    createdAt: data.createdAt?.toDate?.()?.toISOString() ?? '',
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? '',
    createdBy: data.createdBy ?? null,
    createdByName: data.createdByName ?? null,
    updatedBy: data.updatedBy ?? null,
    updatedByName: data.updatedByName ?? null,
  };
}

export const previsionesService = {
  /** Real-time por año destino (equality simple: no requiere índice compuesto). */
  subscribe(anioDestino: number, callback: (items: AgendaPrevision[]) => void, onError?: (e: Error) => void): () => void {
    const q = query(collection(db, COL), where('anioDestino', '==', anioDestino));
    return onSnapshot(q, snap => {
      const items = snap.docs.map(d => parsePrevision(d.id, d.data()));
      items.sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio));
      callback(items);
    }, err => {
      console.error('[previsionesService] subscribe error:', err);
      onError?.(err);
    });
  },

  async getByAnio(anioDestino: number): Promise<AgendaPrevision[]> {
    const q = query(collection(db, COL), where('anioDestino', '==', anioDestino), orderBy('fechaInicio', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => parsePrevision(d.id, d.data()));
  },

  async getById(id: string): Promise<AgendaPrevision | null> {
    const snap = await getDoc(doc(db, COL, id));
    return snap.exists() ? parsePrevision(snap.id, snap.data()) : null;
  },

  async update(id: string, data: Partial<AgendaPrevision>): Promise<void> {
    const { id: _omit, createdAt: _omit2, ...rest } = data;
    const payload = deepCleanForFirestore({ ...rest, ...getUpdateTrace(), updatedAt: Timestamp.now() });
    await updateDoc(doc(db, COL, id), payload);
    logAudit({ action: 'update', collection: COL, documentId: id, after: payload });
  },

  /** Reprogramación manual: fecha y/o ingeniero. Blinda la previsión contra el batch. */
  async reprogramar(id: string, cambios: {
    fechaInicio: string; fechaFin: string; ingenieroId: string; ingenieroNombre: string; notas?: string | null;
  }): Promise<void> {
    await this.update(id, {
      ...cambios,
      anioDestino: Number(cambios.fechaInicio.slice(0, 4)),
      estado: 'reprogramada',
    });
  },

  async descartar(id: string): Promise<void> {
    await this.update(id, { estado: 'descartada' });
  },

  /** Marca la previsión como convertida y guarda el número de la OT creada.
   *  Si la previsión era una RESERVA manual de agenda (2026-08-03), la entrada
   *  reservada pasa a ser la entrada de la OT: se le estampa el otNumber y se
   *  eliminan las entradas que el alta de la OT haya auto-creado (duplicado de
   *  un solo día — la reserva conserva el rango/cuartos elegidos a mano). */
  async marcarConvertida(id: string, otNumber: string): Promise<void> {
    const prev = await this.getById(id);
    await this.update(id, { estado: 'convertida', otNumberGenerada: otNumber });

    if (prev?.reservaAgendaEntryId) {
      try {
        const autoEntries = await agendaService.getByOtNumber(otNumber);
        for (const e of autoEntries) {
          if (e.id !== prev.reservaAgendaEntryId) await agendaService.delete(e.id);
        }
        await agendaService.update(prev.reservaAgendaEntryId, { otNumber });
      } catch (err) {
        console.error('[marcarConvertida] swap de la reserva de agenda falló:', err);
      }
    }
  },

  /** La previsión SIGUE a su reserva de agenda (2026-08-03): al mover la
   *  entrada en la grilla, fecha/ingeniero del doc se actualizan; al borrar
   *  la entrada, la previsión se descarta. Best-effort, no bloquea la agenda. */
  async syncDesdeReserva(entryId: string, cambios: {
    fechaInicio?: string; fechaFin?: string; ingenieroId?: string; ingenieroNombre?: string;
  } | { descartar: true }): Promise<void> {
    const snap = await getDocs(query(collection(db, COL), where('reservaAgendaEntryId', '==', entryId)));
    for (const d of snap.docs) {
      const estado = (d.data().estado ?? 'prevista') as EstadoPrevision;
      if (estado === 'convertida' || estado === 'descartada') continue;
      if ('descartar' in cambios) {
        await this.update(d.id, { estado: 'descartada', notas: 'Reserva de agenda eliminada.' });
      } else {
        await this.update(d.id, {
          ...cambios,
          ...(cambios.fechaInicio ? { anioDestino: Number(cambios.fechaInicio.slice(0, 4)) } : {}),
        });
      }
    }
  },

  /** Re-vincular la previsión tras un CORTAR/PEGAR de la reserva (2026-08-03):
   *  la entrada vieja se borró y se recreó con otro id en otra celda. */
  async relinkReserva(oldEntryId: string, newEntryId: string, cambios: {
    fechaInicio: string; fechaFin: string; ingenieroId: string; ingenieroNombre: string;
  }): Promise<void> {
    const snap = await getDocs(query(collection(db, COL), where('reservaAgendaEntryId', '==', oldEntryId)));
    for (const d of snap.docs) {
      const estado = (d.data().estado ?? 'prevista') as EstadoPrevision;
      if (estado === 'convertida') continue;
      await this.update(d.id, {
        reservaAgendaEntryId: newEntryId,
        ...cambios,
        anioDestino: Number(cambios.fechaInicio.slice(0, 4)),
        // Si un delete previo la descartó por error de orden, revive.
        ...(estado === 'descartada' ? { estado: 'prevista' as EstadoPrevision, notas: null } : {}),
      });
    }
  },

  /**
   * Previsión MANUAL desde la agenda (2026-08-03): "reservar agenda para un
   * servicio sin OT". La entrada de agenda ya fue creada por el caller (con
   * los guards de feriado/día AGS del hook) — acá se crea el doc de previsión
   * vinculado, para que aparezca en la solapa Previsiones y se convierta a OT
   * con todo precargado.
   */
  async crearManualDesdeEntry(entryId: string, datos: {
    fechaInicio: string;
    fechaFin: string;
    ingenieroId: string;
    ingenieroNombre: string;
    clienteId: string | null;
    clienteNombre: string;
    establecimientoId: string | null;
    establecimientoNombre: string | null;
    sistemaId: string | null;
    sistemaNombre: string | null;
    equipoAgsId: string | null;
    tipoServicioId: string | null;
    tipoServicio: string;
    notas?: string | null;
  }): Promise<string> {
    const anioDestino = Number(datos.fechaInicio.slice(0, 4));
    const id = previsionDocId(anioDestino, entryId);
    let tieneContrato = false;
    if (datos.clienteId) {
      const activos = await contratosService.getActiveForCliente(datos.clienteId).catch(() => []);
      tieneContrato = activos.length > 0;
    }
    const payload = deepCleanForFirestore({
      anioDestino,
      fechaInicio: datos.fechaInicio,
      fechaFin: datos.fechaFin,
      ingenieroId: datos.ingenieroId,
      ingenieroNombre: datos.ingenieroNombre,
      clienteNombre: datos.clienteNombre,
      tipoServicio: datos.tipoServicio,
      sistemaNombre: datos.sistemaNombre,
      establecimientoNombre: datos.establecimientoNombre,
      equipoModelo: null,
      equipoAgsId: datos.equipoAgsId,
      clienteId: datos.clienteId,
      establecimientoId: datos.establecimientoId,
      sistemaId: datos.sistemaId,
      moduloId: null,
      tipoServicioId: datos.tipoServicioId,
      origenAgendaEntryId: '',
      origenOtNumber: '',
      reservaAgendaEntryId: entryId,
      estado: 'prevista' as EstadoPrevision,
      tieneContrato,
      otNumberGenerada: null,
      notas: datos.notas ?? null,
      ...getCreateTrace(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    await setDoc(doc(db, COL, id), payload);
    logAudit({ action: 'create', collection: COL, documentId: id, after: payload });
    return id;
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, COL, id));
    logAudit({ action: 'delete', collection: COL, documentId: id });
  },

  /**
   * Genera (o refresca) las previsiones del año `anioOrigen + 1` a partir de lo
   * REALIZADO en `anioOrigen`.
   *
   * Fuente: `agendaEntries` con `estadoAgenda === 'completado'` cuyo `tipoServicio`
   * tenga prendido `generaRecurrenciaAnual` en el catálogo (data-driven, sin nombres
   * hardcodeados).
   *
   * Idempotente y pensado para correrse VARIAS veces mientras se carga la agenda:
   * el doc id es determinístico y las previsiones con estado manual
   * (reprogramada/convertida/descartada) se cuentan como "respetadas" y NO se tocan.
   * Mismo criterio que `qfDocumentos.sincronizarDesdeBiblioteca`.
   */
  async generar(anioOrigen: number): Promise<PrevisionesGenerarReport> {
    const anioDestino = anioOrigen + 1;
    const report: PrevisionesGenerarReport = {
      anioOrigen, anioDestino, creadas: 0, actualizadas: 0, respetadas: 0, salteadas: [],
    };

    const [tipos, feriados, entries] = await Promise.all([
      tiposServicioService.getAll(),
      feriadosService.getAllFechas(),
      agendaService.getByAnio(anioOrigen),
    ]);

    // Índice nombre normalizado → tipo, solo de los que generan recurrencia.
    // `AgendaEntry.tipoServicio` guarda el NOMBRE, no el id — de ahí el match por texto.
    const recurrentes = new Map<string, TipoServicio>();
    for (const t of tipos) {
      if (t.generaRecurrenciaAnual) recurrentes.set(normalizar(t.nombre), t);
    }
    if (recurrentes.size === 0) {
      report.salteadas.push({
        valor: `${anioOrigen}`,
        motivo: 'Ningún tipo de servicio tiene activada la recurrencia anual',
      });
      return report;
    }

    const completadas = entries.filter(e => e.estadoAgenda === 'completado');
    const contratoCache = new Map<string, boolean>();

    for (const entry of completadas) {
      const tipo = recurrentes.get(normalizar(entry.tipoServicio));
      if (!tipo) continue; // no es un servicio con vigencia anual → fuera de alcance, sin ruido

      const etiqueta = `${entry.fechaInicio} · ${entry.clienteNombre || 's/cliente'} · ${entry.tipoServicio}`;

      try {
        if (!entry.fechaInicio || !entry.fechaFin) {
          report.salteadas.push({ valor: etiqueta, motivo: 'Entrada de agenda sin fechas' });
          continue;
        }

        const id = previsionDocId(anioDestino, entry.id);
        const ref = doc(db, COL, id);
        const existente = await getDoc(ref);

        if (existente.exists()) {
          const estado = (existente.data().estado ?? 'prevista') as EstadoPrevision;
          if (ESTADOS_MANUALES.includes(estado)) {
            report.respetadas++;
            continue;
          }
        }

        const fechas = calcularFechasPrevision(entry.fechaInicio, entry.fechaFin, feriados);

        // Ids del alta original: habilitan precargar el modal de nueva OT al convertir.
        // Best-effort — si la OT origen se borró, la previsión igual vale por los nombres.
        let clienteId: string | null = null;
        let establecimientoId: string | null = null;
        let sistemaId: string | null = null;
        let moduloId: string | null = null;
        let tieneContrato = false;
        if (entry.otNumber) {
          const ot = await ordenesTrabajoService.getByOtNumber(entry.otNumber).catch(() => null);
          if (ot) {
            clienteId = ot.clienteId ?? null;
            establecimientoId = ot.establecimientoId ?? null;
            sistemaId = ot.sistemaId ?? null;
            moduloId = ot.moduloId ?? null;
            tieneContrato = !!ot.tieneContrato;
          }
        }
        // Snapshot real de contrato vigente (el flag de la OT es del año pasado).
        if (clienteId) {
          if (contratoCache.has(clienteId)) {
            tieneContrato = contratoCache.get(clienteId)!;
          } else {
            const activos = await contratosService.getActiveForCliente(clienteId).catch(() => []);
            tieneContrato = activos.length > 0;
            contratoCache.set(clienteId, tieneContrato);
          }
        }

        const base = {
          anioDestino,
          fechaInicio: fechas.fechaInicio,
          fechaFin: fechas.fechaFin,
          // Ingeniero: el mismo del año anterior (editable después vía "Reprogramar").
          ingenieroId: entry.ingenieroId ?? '',
          ingenieroNombre: entry.ingenieroNombre ?? '',
          clienteNombre: entry.clienteNombre ?? '',
          tipoServicio: entry.tipoServicio,
          sistemaNombre: entry.sistemaNombre ?? null,
          establecimientoNombre: entry.establecimientoNombre ?? null,
          equipoModelo: entry.equipoModelo ?? null,
          equipoAgsId: entry.equipoAgsId ?? null,
          clienteId, establecimientoId, sistemaId, moduloId,
          tipoServicioId: tipo.id,
          origenAgendaEntryId: entry.id,
          origenOtNumber: entry.otNumber ?? '',
          estado: 'prevista' as EstadoPrevision,
          tieneContrato,
          otNumberGenerada: null,
          notas: fechas.corridoPorDiaNoHabil
            ? 'Corrida al siguiente día hábil (fin de semana o feriado).'
            : null,
        };

        const payload = deepCleanForFirestore(
          existente.exists()
            ? { ...base, ...getUpdateTrace(), updatedAt: Timestamp.now() }
            : { ...base, ...getCreateTrace(), createdAt: Timestamp.now(), updatedAt: Timestamp.now() },
        );

        await setDoc(ref, payload, { merge: true });
        logAudit({
          action: existente.exists() ? 'update' : 'create',
          collection: COL, documentId: id, after: payload,
        });
        if (existente.exists()) report.actualizadas++;
        else report.creadas++;
      } catch (err) {
        console.error('[previsionesService.generar]', etiqueta, err);
        report.salteadas.push({
          valor: etiqueta,
          motivo: err instanceof Error ? err.message : 'Error inesperado',
        });
      }
    }

    return report;
  },
};
