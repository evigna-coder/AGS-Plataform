import { type FC, useCallback, useState, useEffect, useMemo, useRef } from 'react';
import type { AgendaEntry, WorkOrder, EstadoAgenda, OTEstadoAdmin } from '@ags/shared';
import { esAgendaInterior, ESTADO_AGENDA_INTERIOR } from '@ags/shared';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import { addDays, differenceInCalendarDays, parseISO, isWeekend } from 'date-fns';
import { ordenesTrabajoService } from '../../services/otService';
import { establecimientosService } from '../../services/firebaseService';
import { estadoAgendaInicialPorUbicacion } from '../../utils/distanciaInterior';
import { colorDeTituloFijo } from '../../utils/agendaCellColor';
import { useAgenda } from '../../hooks/useAgenda';
import { useAgendaDnd, snapToCursor } from '../../hooks/useAgendaDnd';
import { useAgendaKeyboard, type AgendaKeyboardCallbacks } from '../../hooks/useAgendaKeyboard';
import { useUrlFilters } from '@ags/shared';
import { AgendaHeader, type AgendaVista } from '../../components/agenda/AgendaHeader';
import { AgendaInfoBar } from '../../components/agenda/AgendaInfoBar';
import { AgendaGrid } from '../../components/agenda/AgendaGrid';
import { AgendaAlmanaqueView } from '../../components/agenda/AgendaAlmanaqueView';
import { AgendaPendingSidebar } from '../../components/agenda/AgendaPendingSidebar';
import { AgendaBuscador } from '../../components/agenda/AgendaBuscador';
import { AgendaReservaModal, type ReservaServicioDatos } from '../../components/agenda/AgendaReservaModal';
import { previsionesService } from '../../services/previsionesService';
import { findEntriesAtCell, formatDateKey, normalizeRange, type SelectedCell, type SelectionRange } from '../../utils/agendaDateUtils';
import { primerFinDeSemanaEnRango, mensajeFinDeSemana } from '../../utils/finDeSemana';
import { otrasEntradasDeOTs, etiquetaEntrada } from '../../utils/agendaDuplicados';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import {
  AGENDA_TO_OT_ESTADO, OT_ESTADO_ORDER, addWeekdays, resolveEquipoAgsId,
  type ClipboardData,
} from '../../utils/agendaOTSync';

/**
 * Posición del menú contextual. Abría SIEMPRE hacia arriba
 * (`bottom: innerHeight - y`), así que en la primera fila de celdas se salía por
 * el techo y quedaba cortado — más notorio a medida que el menú creció con los
 * eventos nuevos (2026-08-09). Ahora elige la dirección según el espacio
 * disponible, clampea horizontalmente y, si no entra en ninguna, scrollea.
 */
function estiloMenuContextual(x: number, y: number): React.CSSProperties {
  const ALTO_EST = 330;   // ~10 ítems de 28px + padding
  const ANCHO_EST = 230;
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const espacioArriba = y;
  const espacioAbajo = vh - y;
  // Hacia arriba solo si de verdad entra; si no, hacia abajo.
  const abreArriba = espacioArriba >= Math.min(ALTO_EST, vh - 16) || espacioArriba > espacioAbajo;
  const left = Math.min(Math.max(8, x), Math.max(8, vw - ANCHO_EST - 8));
  return abreArriba
    ? { left, bottom: Math.max(8, vh - y), maxHeight: Math.max(120, espacioArriba - 8), overflowY: 'auto' }
    : { left, top: Math.max(8, y), maxHeight: Math.max(120, espacioAbajo - 8), overflowY: 'auto' };
}

/**
 * Muestra del color que va a tomar la celda, como referencia en el menú
 * contextual (2026-08-09). El color sale de la tabla de reglas — no se repite
 * el hexadecimal acá, para que un retoque de color no deje el menú mintiendo.
 */
const ColorRef: FC<{ titulo: string }> = ({ titulo }) => {
  const bg = colorDeTituloFijo(titulo);
  if (!bg) return null;
  return <span className={`w-3.5 h-3.5 rounded-sm border border-slate-300 shrink-0 ${bg}`} aria-hidden />;
};

export const AgendaPage: FC = () => {
  const {
    anchor, zoomLevel, visibleDays,
    goToPrev, goToNext, goToToday, goToDate,
    ingenieros, entries, notas, pendingOTs, equipoIdBySistema, feriados, loading,
    createEntry, updateEntry, deleteEntry, upsertNota, deleteNota, toggleFeriado,
    primerFeriadoEnRango,
    diasAgs, toggleDiaAgs, primerDiaAgsEnRango,
  } = useAgenda();

  // Vista + filtro de ingeniero en la URL (2026-08-14). Van por `useUrlFilters`
  // y no por useState —regla del proyecto— para que la pestaña sobreviva a un
  // F5 y se pueda compartir "la agenda de Fulano" pegando el link.
  const [filters, setFilter] = useUrlFilters({
    vista: { type: 'string', default: 'grilla' },
    ingeniero: { type: 'string', default: '' },
  });
  const vista: AgendaVista = filters.vista === 'almanaque' ? 'almanaque' : 'grilla';

  const confirm = useConfirm();
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [clipboard, setClipboard] = useState<ClipboardData | null>(null);
  const [selectedPendingOTs, setSelectedPendingOTs] = useState<Set<string>>(new Set());
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [selectionRange, setSelectionRange] = useState<SelectionRange | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; ingenieroId: string; ingenieroNombre: string; fecha: string; quarter: 1|2|3|4 } | null>(null);
  const [manualTaskInput, setManualTaskInput] = useState<{ ingenieroId: string; ingenieroNombre: string; fecha: string; quarter: 1|2|3|4; x: number; y: number; initialValue?: string } | null>(null);
  const manualTaskInputRef = useRef<HTMLInputElement>(null);
  /** Comentario de celda (estilo Excel) — pedido 2026-07-30. */
  const [notaInput, setNotaInput] = useState<{ ingenieroId: string; ingenieroNombre: string; fecha: string; quarter: 1|2|3|4; x: number; y: number; initialValue: string; notaId: string | null } | null>(null);
  const [notaTexto, setNotaTexto] = useState('');
  /** Buscador con salto a celda (Ctrl+B) — pedido 2026-08-03. */
  const [showBuscador, setShowBuscador] = useState(false);
  /** Reserva de servicio sin OT (previsión manual) — pedido 2026-08-03. */
  const [reservaTarget, setReservaTarget] = useState<{ ingenieroId: string; ingenieroNombre: string; fecha: string; quarter: 1|2|3|4 } | null>(null);
  /** Celda destino de un salto del buscador: sobrevive al clear de navegación. */
  const jumpTargetRef = useRef<SelectedCell | null>(null);

  // Clear selection on navigation/zoom change — salvo que la navegación sea
  // un salto del buscador (el destino ES la selección nueva).
  useEffect(() => {
    if (jumpTargetRef.current) {
      setSelectedCell(jumpTargetRef.current);
      jumpTargetRef.current = null;
    } else {
      setSelectedCell(null);
    }
    setSelectionRange(null);
    // `vista` incluida a propósito (2026-08-14): la lista no dibuja celdas, así
    // que una selección heredada de la grilla quedaba invisible y activa — y el
    // atajo Supr habría borrado esa entrada a ciegas. Sin celda seleccionada
    // todos los atajos de `useAgendaKeyboard` cortan en seco.
  }, [anchor, zoomLevel, vista]);

  // Auto-scroll selected cell into view when navigating with keyboard
  useEffect(() => {
    if (!selectedCell) return;
    const el = document.querySelector('[data-agenda-selected="true"]');
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [selectedCell]);

  // Ctrl+B abre/cierra el buscador (funciona también sin celda seleccionada).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setShowBuscador(v => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /** Reserva de servicio sin OT: crea la entrada de agenda (ocupa la celda)
   *  y la previsión vinculada (solapa Previsiones, convertible a OT). */
  const handleCrearReserva = useCallback(async (datos: ReservaServicioDatos) => {
    const tgt = reservaTarget;
    if (!tgt) return;
    const entryId = await createEntry({
      fechaInicio: tgt.fecha,
      fechaFin: tgt.fecha,
      quarterStart: tgt.quarter,
      quarterEnd: tgt.quarter,
      ingenieroId: tgt.ingenieroId,
      ingenieroNombre: tgt.ingenieroNombre,
      otNumber: '',
      clienteNombre: datos.clienteNombre,
      tipoServicio: datos.tipoServicio,
      sistemaNombre: datos.sistemaNombre,
      establecimientoNombre: datos.establecimientoNombre,
      equipoModelo: null,
      equipoAgsId: datos.equipoAgsId,
      estadoAgenda: 'pendiente',
      notas: datos.notas,
      // La celda muestra otNumber || titulo — sin OT, se ve el cliente.
      titulo: datos.clienteNombre,
    });
    if (!entryId) return; // bloqueado por feriado / día AGS (el guard ya avisó)
    await previsionesService.crearManualDesdeEntry(entryId, {
      fechaInicio: tgt.fecha,
      fechaFin: tgt.fecha,
      ingenieroId: tgt.ingenieroId,
      ingenieroNombre: tgt.ingenieroNombre,
      clienteId: datos.clienteId,
      clienteNombre: datos.clienteNombre,
      establecimientoId: datos.establecimientoId,
      establecimientoNombre: datos.establecimientoNombre,
      sistemaId: datos.sistemaId,
      sistemaNombre: datos.sistemaNombre,
      equipoAgsId: datos.equipoAgsId,
      tipoServicioId: datos.tipoServicioId,
      tipoServicio: datos.tipoServicio,
      notas: datos.notas,
    });
  }, [reservaTarget, createEntry]);

  /** Salto del buscador: navegar a la fecha, seleccionar la celda y scrollearla. */
  const handleJumpToEntry = useCallback((entry: AgendaEntry) => {
    const found = findEntriesAtCell(entries, entry.ingenieroId, entry.fechaInicio, entry.quarterStart);
    const cell: SelectedCell = {
      ingenieroId: entry.ingenieroId,
      ingenieroNombre: entry.ingenieroNombre,
      fecha: entry.fechaInicio,
      quarter: entry.quarterStart,
      entry,
      allEntries: found.length > 0 ? found : [entry],
    };
    setShowBuscador(false);
    // Si la fecha ya está visible el anchor no cambia (el clear no corre y la
    // selección directa alcanza); si cambia, el ref la re-aplica tras el clear.
    jumpTargetRef.current = cell;
    setSelectedCell(cell);
    goToDate(parseISO(entry.fechaInicio));
    // Si el anchor NO cambió, el efecto nunca consume el ref — limpiarlo para
    // que una navegación manual posterior no "restaure" este salto viejo.
    // (El efecto corre en el commit, antes de este timeout.)
    setTimeout(() => { jumpTargetRef.current = null; }, 0);
  }, [entries, goToDate]);

  // El comentario de celda viaja con el servicio al moverlo por DnD o al
  // cortar/pegar (UAT 2026-07-30/31): describe al servicio agendado, no a la
  // celda física. Si la celda destino ya tiene comentario, se concatenan.
  const notasRef = useRef(notas);
  notasRef.current = notas;
  const moverNotaConEntry = useCallback((
    src: { ingenieroId: string; fecha: string; quarter: 1 | 2 | 3 | 4 },
    tgt: { ingenieroId: string; ingenieroNombre: string; fecha: string; quarter: 1 | 2 | 3 | 4 },
  ) => {
    if (src.ingenieroId === tgt.ingenieroId && src.fecha === tgt.fecha && src.quarter === tgt.quarter) return;
    // Legacy sin quarter → celda 4 del día (mismo default que el render).
    const srcNota = notasRef.current.find(n =>
      n.ingenieroId === src.ingenieroId && n.fecha === src.fecha && (n.quarter ?? 4) === src.quarter);
    if (!srcNota) return;
    const tgtNota = notasRef.current.find(n =>
      n.ingenieroId === tgt.ingenieroId && n.fecha === tgt.fecha && (n.quarter ?? 4) === tgt.quarter);
    const texto = tgtNota?.texto?.trim() ? `${tgtNota.texto}\n${srcNota.texto}` : srcNota.texto;
    void (async () => {
      try {
        await upsertNota({ fecha: tgt.fecha, ingenieroId: tgt.ingenieroId, ingenieroNombre: tgt.ingenieroNombre, quarter: tgt.quarter, texto });
        await deleteNota(srcNota.id);
      } catch (err) {
        console.error('[AgendaPage] mover comentario junto con el servicio falló:', err);
      }
    })();
  }, [upsertNota, deleteNota]);

  // ── Clipboard handlers ──

  // Use ref to avoid stale closures in the keyboard callback
  const clipboardRef = useRef(clipboard);
  clipboardRef.current = clipboard;
  const selectedCellRef = useRef(selectedCell);
  selectedCellRef.current = selectedCell;
  const selectionRangeRef = useRef(selectionRange);
  selectionRangeRef.current = selectionRange;

  const handleCopy = useCallback(() => {
    const cell = selectedCellRef.current;
    if (!cell?.entry) return;
    // Copiar TODOS los servicios de la celda (pedido 2026-08-03): antes iba
    // solo cell.entry (el de arriba) y el pegado dejaba los demás atrás.
    const found = findEntriesAtCell(entries, cell.ingenieroId, cell.fecha, cell.quarter);
    setClipboard({ type: 'entry', entry: cell.entry, entries: found.length > 0 ? found : [cell.entry] });
  }, [entries]);

  // ── Cortar (pedido 2026-07-31) ──
  // Levanta TODOS los servicios de la celda: se borran (las OTs vuelven solas a
  // "para coordinar" porque la cola es derivada de las entradas) y quedan en el
  // clipboard hasta pegarse — el pegado los recrea preservando estado/notas.
  const cutCell = useCallback((ingenieroId: string, fecha: string, quarter: 1 | 2 | 3 | 4) => {
    const found = findEntriesAtCell(entries, ingenieroId, fecha, quarter);
    if (found.length === 0) return;
    setClipboard({ type: 'cut', entries: found, srcCell: { ingenieroId, fecha, quarter } });
    for (const en of found) deleteEntry(en.id);
  }, [entries, deleteEntry]);

  const handleCut = useCallback(() => {
    const cell = selectedCellRef.current;
    if (!cell) return;
    cutCell(cell.ingenieroId, cell.fecha, cell.quarter);
  }, [cutCell]);

  const handlePaste = useCallback(() => {
    const cell = selectedCellRef.current;
    const cb = clipboardRef.current;
    const range = selectionRangeRef.current;
    if (!cell || !cb) return;

    const ingeniero = ingenieros.find(i => i.id === cell.ingenieroId);
    if (!ingeniero) return;

    // Determine paste range: use multi-selection if exists, otherwise single cell
    const nr = range ? normalizeRange(range) : null;
    const fechaInicio = nr ? nr.startFecha : cell.fecha;
    const fechaFin = nr ? nr.endFecha : cell.fecha;
    const quarterStart = nr ? nr.startQuarter : cell.quarter;
    const quarterEnd = nr ? nr.endQuarter : cell.quarter;

    // Fin de semana — ANTES de cualquier efecto, igual que feriados (2026-08-12).
    const findePaste = primerFinDeSemanaEnRango(fechaInicio, fechaFin);
    if (findePaste) {
      alert(mensajeFinDeSemana(findePaste));
      return;
    }
    // Bloqueo duro de feriados — ANTES de cualquier efecto (el sync de la OT
    // corre en paralelo al alta de la entrada).
    const feriadoPaste = primerFeriadoEnRango(fechaInicio, fechaFin);
    if (feriadoPaste) {
      alert(`El ${feriadoPaste} está marcado como feriado — no se puede agendar ese día. Para hacerlo, desmarcá el feriado (click derecho sobre la fecha).`);
      return;
    }
    // Día AGS del ingeniero destino (no laborable individual) — mismo bloqueo.
    const diaAgsPaste = primerDiaAgsEnRango(cell.ingenieroId, fechaInicio, fechaFin);
    if (diaAgsPaste) {
      alert(`El ${diaAgsPaste} es día AGS de ${ingeniero.nombre} (no laborable) — no se le puede agendar ese día. Para hacerlo, quitá el día AGS (click derecho sobre la celda).`);
      return;
    }

    // ── Pegar un CORTE: recrear las entradas preservando estado/notas/título ──
    if (cb.type === 'cut' && cb.entries && cb.entries.length > 0) {
      // Feriados y fin de semana: validar el rango resultante de CADA entrada
      // antes de crear nada (un corte de varios días puede terminar en sábado).
      for (const src of cb.entries) {
        const span = differenceInCalendarDays(parseISO(src.fechaFin), parseISO(src.fechaInicio));
        const end = span > 0 ? formatDateKey(addDays(parseISO(cell.fecha), span)) : cell.fecha;
        const finde = primerFinDeSemanaEnRango(cell.fecha, end);
        if (finde) {
          alert(mensajeFinDeSemana(finde));
          return;
        }
        const fer = primerFeriadoEnRango(cell.fecha, end);
        if (fer) {
          alert(`El ${fer} está marcado como feriado — no se puede agendar ese día. Para hacerlo, desmarcá el feriado (click derecho sobre la fecha).`);
          return;
        }
      }
      for (const src of cb.entries) {
        const span = differenceInCalendarDays(parseISO(src.fechaFin), parseISO(src.fechaInicio));
        const end = span > 0 ? formatDateKey(addDays(parseISO(cell.fecha), span)) : cell.fecha;
        // Un día: preservar DURACIÓN en cuartos — pegar Q1→Q3 dejaba Q3-Q1
        // (rango invertido = invisible en la grilla, 2026-08-04).
        const quarterEndPegado = span === 0
          ? (Math.min(4, cell.quarter + Math.max(0, src.quarterEnd - src.quarterStart)) as 1 | 2 | 3 | 4)
          : src.quarterEnd;
        const creado = createEntry({
          fechaInicio: cell.fecha,
          fechaFin: end,
          quarterStart: cell.quarter,
          quarterEnd: quarterEndPegado,
          ingenieroId: cell.ingenieroId,
          ingenieroNombre: ingeniero.nombre,
          otNumber: src.otNumber,
          clienteNombre: src.clienteNombre,
          tipoServicio: src.tipoServicio,
          sistemaNombre: src.sistemaNombre ?? null,
          establecimientoNombre: src.establecimientoNombre ?? null,
          equipoModelo: src.equipoModelo ?? null,
          equipoAgsId: src.equipoAgsId ?? null,
          problemaFallaInicial: src.problemaFallaInicial ?? null,
          // Cortar/pegar es un MOVIMIENTO: el estado se preserva (un confirmado
          // no vuelve a tentativo por moverlo de celda).
          estadoAgenda: src.estadoAgenda,
          pagoAdelantado: src.pagoAdelantado ?? false,
          // Cortar/pegar MUEVE la misma jornada, no crea otra (2026-08-20): la
          // inducción viaja con ella. Es la diferencia con COPIAR, donde se
          // pierde a propósito porque la copia es un día distinto del trabajo.
          requiereInduccion: src.requiereInduccion ?? false,
          ventaConcretada: src.ventaConcretada ?? false,
          perIncident: src.perIncident ?? false,
          esperaImportacion: src.esperaImportacion ?? false,
          notas: src.notas ?? null,
          titulo: src.titulo ?? null,
        });
        // Reserva sin OT (2026-08-03): el corte descartó su previsión (vía
        // deleteEntry) — el pegado la revive y re-vincula a la entrada nueva.
        if (!src.otNumber) {
          creado.then(newId => {
            if (!newId) return;
            return previsionesService.relinkReserva(src.id, newId, {
              fechaInicio: cell.fecha,
              fechaFin: end,
              ingenieroId: cell.ingenieroId,
              ingenieroNombre: ingeniero.nombre,
            });
          }).catch(err => console.error('[AgendaPage] relink previsión al pegar corte falló:', err));
        }
        // Sync de la OT al nuevo ingeniero/fecha. Best-effort.
        // Re-PROMOCIONAR (2026-08-03): el corte revirtió la OT a CREADA
        // (deleteEntry la devuelve a la cola por si el corte nunca se pega);
        // al pegar, la OT vuelve a estar agendada → CREADA→ASIGNADA, igual
        // que el drop desde la cola. Sin esto, mover con Ctrl+X/Ctrl+V
        // dejaba la OT en CREADA para siempre.
        if (src.otNumber) {
          const otNum = src.otNumber;
          ordenesTrabajoService.getByOtNumber(otNum).then(ot => {
            const shouldPromote = !ot?.estadoAdmin || ot.estadoAdmin === 'CREADA';
            // skipAgendaSync (2026-08-03): la entrada ya se creó ACÁ con su
            // estado preservado — el rebote OT→agenda corría en paralelo al
            // alta y, si le ganaba, creaba un duplicado gris 'tentativo'.
            return ordenesTrabajoService.update(otNum, {
              ingenieroAsignadoId: cell.ingenieroId,
              ingenieroAsignadoNombre: ingeniero.nombre,
              fechaServicioAprox: cell.fecha,
              ...(shouldPromote ? { estadoAdmin: 'ASIGNADA', estadoAdminFecha: new Date().toISOString() } : {}),
            }, { skipAgendaSync: true });
          }).catch(err => console.error('[AgendaPage] sync OT al pegar corte falló:', err));
        }
      }
      // El comentario de la celda origen viaja con el corte.
      if (cb.srcCell) {
        moverNotaConEntry(cb.srcCell, {
          ingenieroId: cell.ingenieroId, ingenieroNombre: ingeniero.nombre,
          fecha: cell.fecha, quarter: cell.quarter,
        });
      }
      setClipboard(null); // el corte pega UNA sola vez
      return;
    }

    if (cb.type === 'entry' && cb.entry) {
      // Pegar TODOS los servicios copiados de la celda (pedido 2026-08-03).
      // Entradas viejas en el clipboard pueden no traer `entries` — fallback.
      const copiadas = cb.entries && cb.entries.length > 0 ? cb.entries : [cb.entry];
      // PEGAR crea SIEMPRE una entrada nueva en la celda destino (2026-08-11).
      // Antes, si el dia continuaba el rango de la misma OT, ESTIRABA la barra
      // — y la barra estirada pasaba por encima de los cuartos intermedios,
      // tapando otros eventos (caso 30022.01: pegarla en vie q3 para que
      // siguiera DESPUES de la firma de recibos y los estudios medicos pintaba
      // vie q1-q3 encima de ellos). Copiar es "quiero el servicio ACA", no
      // "alarga el bloque"; para alargar esta el arrastre del borde.
      const pegarCopiadas = (fuentes: AgendaEntry[]) => {
        for (const src of fuentes) {
          // Duplicado EXACTO no: si la misma OT del mismo ingeniero ya arranca
          // en esta celda, el pegado se saltea — Ctrl+V sostenido/repetido dejó
          // la 30021.01 pegada 8 veces en una celda (2026-08-11). Pegar en OTRA
          // celda (días sueltos) sigue permitido.
          if (src.otNumber && entries.some(e =>
            e.otNumber === src.otNumber && e.ingenieroId === cell.ingenieroId
            && e.fechaInicio === fechaInicio && e.quarterStart === quarterStart
            && e.estadoAgenda !== 'cancelado')) continue;
          createEntry({
            fechaInicio, fechaFin, quarterStart, quarterEnd,
            ingenieroId: cell.ingenieroId,
            ingenieroNombre: ingeniero.nombre,
            otNumber: src.otNumber,
            clienteNombre: src.clienteNombre,
            tipoServicio: src.tipoServicio,
            sistemaNombre: src.sistemaNombre,
            establecimientoNombre: src.establecimientoNombre,
            equipoModelo: src.equipoModelo ?? null,
            equipoAgsId: src.equipoAgsId ?? null,
            estadoAgenda: 'tentativo',
            pagoAdelantado: src.pagoAdelantado ?? false,
            // La inducción NO se copia (2026-08-09): es del PRIMER día del trabajo.
            // La jornada nueva es otro día y arranca sin la marca.
            requiereInduccion: false,
            ventaConcretada: src.ventaConcretada ?? false,
            perIncident: src.perIncident ?? false,
            // Espera importación SÍ se copia: es condición del trabajo, no de
            // la jornada — si falta la parte, falta todos los días.
            esperaImportacion: src.esperaImportacion ?? false,
            // El detalle de la falla viaja con la copia (2026-08-12): es el
            // mismo trabajo continuando otro día, como el resto de los flags.
            notas: src.notas ?? null,
            titulo: src.titulo || null,
          });
        }
      };

      // Aviso de duplicado (2026-08-12, caso 29616.02): con el portapapeles
      // cargado de otra OT, un Ctrl+V en la celda equivocada duplicaba el
      // servicio en otra fecha sin decir nada. Duplicar a propósito sigue siendo
      // válido (trabajos partidos en días sueltos) — avisa y deja seguir.
      void (async () => {
        const avisos = await otrasEntradasDeOTs(copiadas.map(s => s.otNumber), fechaInicio);
        if (avisos.length === 0) { pegarCopiadas(copiadas); return; }
        const ok = await confirm(
          `${avisos.join('\n')}\n\nPegar acá NO mueve la entrada existente: crea una NUEVA. ¿Pegar igual?`,
        );
        if (ok) pegarCopiadas(copiadas);
      })();
    } else if (cb.type === 'pending' && cb.ot) {
      const existing = entries.find(e => e.otNumber === cb.ot!.otNumber && e.ingenieroId === cell.ingenieroId);
      if (existing) {
        const newEnd = fechaFin > existing.fechaFin ? fechaFin : existing.fechaFin;
        updateEntry(existing.id, {
          fechaFin: newEnd,
          quarterEnd: newEnd === fechaFin ? quarterEnd : existing.quarterEnd,
        });
      } else {
        const ot = cb.ot;
        // El estado nace INTERIOR si el establecimiento está a +200 km
        // (2026-08-08): de esa marca depende el desarraigo del mes, y hacerla
        // depender de que la coordinadora la elija a mano garantiza olvidos.
        Promise.all([
          resolveEquipoAgsId(ot.sistemaId),
          estadoAgendaInicialPorUbicacion(ot.establecimientoId, id => establecimientosService.getById(id)),
        ]).then(([equipoAgsId, estadoAgenda]) => {
          createEntry({
            fechaInicio, fechaFin, quarterStart, quarterEnd,
            ingenieroId: cell.ingenieroId,
            ingenieroNombre: ingeniero.nombre,
            otNumber: ot.otNumber,
            clienteNombre: ot.razonSocial,
            tipoServicio: ot.tipoServicio,
            sistemaNombre: ot.sistema || null,
            establecimientoNombre: null,
            equipoModelo: ot.moduloModelo || null,
            equipoAgsId,
            estadoAgenda,
            notas: null,
            titulo: null,
          });
        });
        // Sync la OT: asignar ingeniero + fecha y, si estaba en CREADA, transicionar
        // a ASIGNADA. Best-effort post-entry (no bloquea el drop si falla).
        // Estado FRESCO de Firestore (2026-08-03): el de la cola puede estar
        // viejo (refresh 60s) y saltearse la promoción tras un eliminar.
        ordenesTrabajoService.getByOtNumber(ot.otNumber).then(fresh => {
          const shouldPromote = !fresh?.estadoAdmin || fresh.estadoAdmin === 'CREADA';
          // skipAgendaSync: la entrada se crea acá — evita el duplicado del
          // rebote OT→agenda si el ensure gana la carrera al addDoc.
          return ordenesTrabajoService.update(ot.otNumber, {
            ingenieroAsignadoId: cell.ingenieroId,
            ingenieroAsignadoNombre: ingeniero.nombre,
            fechaServicioAprox: fechaInicio,
            ...(shouldPromote ? { estadoAdmin: 'ASIGNADA', estadoAdminFecha: new Date().toISOString() } : {}),
          }, { skipAgendaSync: true });
        }).catch(err => console.error('[AgendaPage] sync OT al dropear pending falló:', err));
      }
    }
  }, [ingenieros, entries, createEntry, updateEntry, primerFeriadoEnRango, primerDiaAgsEnRango, moverNotaConEntry]);

  const handleKeyDelete = useCallback(async () => {
    const cell = selectedCellRef.current;
    if (!cell?.entry) return;
    // Misma protección que la ✕ de la barra: con varios servicios en la celda,
    // Del se lleva el seleccionado y hay que decir cuál es (2026-08-12).
    if (cell.allEntries.length > 1) {
      const ok = await confirm(
        `En esta celda hay ${cell.allEntries.length} servicios. Se va a eliminar ${etiquetaEntrada(cell.entry)}. ¿Confirmás?`,
      );
      if (!ok) return;
    }
    deleteEntry(cell.entry.id);
    setSelectedCell(null);
  }, [deleteEntry, confirm]);

  const handleTypeStart = useCallback((char: string) => {
    const cell = selectedCellRef.current;
    if (!cell || cell.entry) return;
    const ing = ingenieros.find(i => i.id === cell.ingenieroId);
    setManualTaskInput({
      ingenieroId: cell.ingenieroId,
      ingenieroNombre: ing?.nombre || '',
      fecha: cell.fecha,
      quarter: cell.quarter,
      x: window.innerWidth / 2 - 120,
      y: window.innerHeight / 2 - 80,
      initialValue: char,
    });
  }, [ingenieros]);

  const keyboardCallbacks = useMemo<AgendaKeyboardCallbacks>(() => ({
    onCopy: handleCopy,
    onCut: handleCut,
    onPaste: handlePaste,
    onDelete: handleKeyDelete,
    onNavigatePrev: goToPrev,
    onNavigateNext: goToNext,
    onTypeStart: handleTypeStart,
  }), [handleCopy, handleCut, handlePaste, handleKeyDelete, goToPrev, goToNext, handleTypeStart]);

  // Keyboard navigation + copy/paste/delete
  useAgendaKeyboard(selectedCell, setSelectedCell, ingenieros, visibleDays, entries, keyboardCallbacks, selectionRange, setSelectionRange);

  /** Copy a pending OT from sidebar (called via click) */
  const handleCopyPendingOT = useCallback((ot: WorkOrder) => {
    setClipboard({ type: 'pending', ot });
  }, []);

  /** Toggle selection of a pending OT in sidebar */
  const handleTogglePendingOT = useCallback((otNumber: string) => {
    setSelectedPendingOTs(prev => {
      const next = new Set(prev);
      if (next.has(otNumber)) next.delete(otNumber);
      else next.add(otNumber);
      return next;
    });
  }, []);

  // DnD: handlers + sensors + activeDrag state encapsulados en el hook.
  const {
    sensors, activeDragOT, activeDragEntry,
    handleDragStart, handleDragOver, handleDragEnd,
  } = useAgendaDnd({
    entries, pendingOTs, ingenieros, selectedPendingOTs,
    setSelectedPendingOTs, setSelectedCell, createEntry, updateEntry,
    primerFeriadoEnRango, primerDiaAgsEnRango, moverNotaConEntry,
  });

  const handleCellClick = useCallback((ingenieroId: string, fecha: string, quarter: 1 | 2 | 3 | 4, shiftKey?: boolean) => {
    const ing = ingenieros.find(i => i.id === ingenieroId);
    const found = findEntriesAtCell(entries, ingenieroId, fecha, quarter);

    // Shift+Click: extend selection range from anchor cell
    if (shiftKey && selectedCell && selectedCell.ingenieroId === ingenieroId) {
      setSelectionRange({
        ingenieroId,
        ingenieroNombre: ing?.nombre || '',
        startFecha: selectedCell.fecha,
        startQuarter: selectedCell.quarter,
        endFecha: fecha,
        endQuarter: quarter,
      });
      return;
    }

    // Normal click: set anchor, clear range
    setSelectedCell({
      ingenieroId,
      ingenieroNombre: ing?.nombre || '',
      fecha,
      quarter,
      entry: found[0] || null,
      allEntries: found,
    });
    setSelectionRange(null);
  }, [ingenieros, entries, selectedCell]);

  const handleEntryClick = useCallback((allEntries: AgendaEntry[], primary: AgendaEntry) => {
    setSelectedCell({
      ingenieroId: primary.ingenieroId,
      ingenieroNombre: primary.ingenieroNombre,
      fecha: primary.fechaInicio,
      quarter: primary.quarterStart,
      entry: primary,
      allEntries,
    });
    setSelectionRange(null);
  }, []);

  const handleSelectEntry = useCallback((entry: AgendaEntry) => {
    if (!selectedCell) return;
    setSelectedCell({ ...selectedCell, entry });
  }, [selectedCell]);

  const handleWeekClick = useCallback((weekStart: Date) => {
    goToDate(weekStart);
  }, [goToDate]);

  // ── Context menu for manual tasks ──

  const handleContextMenu = useCallback((ingenieroId: string, fecha: string, quarter: 1|2|3|4, e: React.MouseEvent) => {
    e.preventDefault();
    const ing = ingenieros.find(i => i.id === ingenieroId);
    setContextMenu({ x: e.clientX, y: e.clientY, ingenieroId, ingenieroNombre: ing?.nombre || '', fecha, quarter });
  }, [ingenieros]);

  // Comentario de la CELDA exacta del context menu (fecha + quarter; legacy sin
  // quarter se ancla a la celda 4 del día).
  const notaDeContextMenu = useMemo(() => {
    if (!contextMenu) return null;
    return notas.find(n =>
      n.ingenieroId === contextMenu.ingenieroId &&
      n.fecha === contextMenu.fecha &&
      (n.quarter ?? 4) === contextMenu.quarter,
    ) ?? null;
  }, [contextMenu, notas]);

  const handleOpenNotaInput = useCallback(() => {
    if (!contextMenu) return;
    setNotaTexto(notaDeContextMenu?.texto ?? '');
    setNotaInput({
      ingenieroId: contextMenu.ingenieroId,
      ingenieroNombre: contextMenu.ingenieroNombre,
      fecha: contextMenu.fecha,
      quarter: contextMenu.quarter,
      x: contextMenu.x,
      y: contextMenu.y,
      initialValue: notaDeContextMenu?.texto ?? '',
      notaId: notaDeContextMenu?.id ?? null,
    });
    setContextMenu(null);
  }, [contextMenu, notaDeContextMenu]);

  const handleGuardarNota = useCallback(async () => {
    if (!notaInput) return;
    const texto = notaTexto.trim();
    try {
      if (texto) {
        await upsertNota({ fecha: notaInput.fecha, ingenieroId: notaInput.ingenieroId, ingenieroNombre: notaInput.ingenieroNombre, quarter: notaInput.quarter, texto });
      } else if (notaInput.notaId) {
        await deleteNota(notaInput.notaId);
      }
    } catch (err) {
      console.error('Error guardando comentario de agenda:', err);
      alert('Error al guardar el comentario');
    }
    setNotaInput(null);
  }, [notaInput, notaTexto, upsertNota, deleteNota]);

  const handleEliminarNota = useCallback(async () => {
    if (!notaInput?.notaId) { setNotaInput(null); return; }
    try {
      await deleteNota(notaInput.notaId);
    } catch (err) {
      console.error('Error eliminando comentario de agenda:', err);
    }
    setNotaInput(null);
  }, [notaInput, deleteNota]);

  const handleOpenManualTaskInput = useCallback(() => {
    if (!contextMenu) return;
    setManualTaskInput({
      ingenieroId: contextMenu.ingenieroId,
      ingenieroNombre: contextMenu.ingenieroNombre,
      fecha: contextMenu.fecha,
      quarter: contextMenu.quarter,
      x: contextMenu.x,
      y: contextMenu.y,
    });
    setContextMenu(null);
  }, [contextMenu]);

  const handleConfirmManualTask = useCallback((titulo: string) => {
    if (!manualTaskInput || !titulo.trim()) { setManualTaskInput(null); return; }
    createEntry({
      fechaInicio: manualTaskInput.fecha,
      fechaFin: manualTaskInput.fecha,
      quarterStart: manualTaskInput.quarter,
      quarterEnd: manualTaskInput.quarter,
      ingenieroId: manualTaskInput.ingenieroId,
      ingenieroNombre: manualTaskInput.ingenieroNombre,
      otNumber: '',
      clienteNombre: '',
      tipoServicio: '',
      sistemaNombre: null,
      establecimientoNombre: null,
      estadoAgenda: 'confirmado',
      notas: null,
      titulo: titulo.trim(),
    });
    setManualTaskInput(null);
  }, [manualTaskInput, createEntry]);

  // Close context menu on click anywhere
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [contextMenu]);

  // Auto-focus the manual task input when it appears
  useEffect(() => {
    if (manualTaskInput) {
      setTimeout(() => {
        const el = manualTaskInputRef.current;
        if (!el) return;
        el.focus();
        // Move cursor to end of any pre-filled value
        const len = el.value.length;
        el.setSelectionRange(len, len);
      }, 50);
    }
  }, [manualTaskInput]);

  // ── Sidebar resize ──

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    const onMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX;
      setSidebarWidth(Math.max(200, Math.min(500, startWidth + delta)));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [sidebarWidth]);

  // ── Info bar actions ──

  const handleChangeEstado = useCallback((entryId: string, estadoElegido: EstadoAgenda) => {
    // El estado es DE LA CELDA (pedido 2026-08-03): con varias OTs en la misma
    // celda (nunca se mezclan interior con locales), cambiar el estado de una
    // cambia el de TODAS — antes había que repetirlo servicio por servicio.
    const targets = selectedCell?.allEntries?.some(e => e.id === entryId)
      ? selectedCell.allEntries
      : entries.filter(e => e.id === entryId);

    // Una visita al interior SIGUE siendo al interior en todo el ciclo
    // (2026-08-08): si la celda ya era interior y se elige un estado común, se
    // usa su variante interior. Sin esto, completar una visita le borraba la
    // marca y el desarraigo del mes no la encontraba — y depender de que la
    // coordinadora se acuerde de elegir "Completado (interior)" es pedir que
    // no se equivoque nunca.
    const eraInterior = targets.some(e => esAgendaInterior(e.estadoAgenda));
    const estado = eraInterior
      ? (ESTADO_AGENDA_INTERIOR[estadoElegido] ?? estadoElegido)
      : estadoElegido;

    for (const en of targets) updateEntry(en.id, { estadoAgenda: estado });
    // Update selected cell in-place for instant UI feedback
    if (selectedCell?.entry) {
      setSelectedCell({
        ...selectedCell,
        entry: { ...selectedCell.entry, estadoAgenda: estado },
        allEntries: selectedCell.allEntries.map(e => ({ ...e, estadoAgenda: estado })),
      });
    }
    // Propagar a las OTs linkeadas. Avanza siempre; REGRESA solo dentro de la
    // banda que maneja la agenda (ASIGNADA↔COORDINADA): confirmado→tentativo
    // debe volver la OT a ASIGNADA (UAT 2026-07-30). Estados de trabajo
    // (EN_CURSO+) nunca se regresan desde acá. Best-effort.
    const targetOT = AGENDA_TO_OT_ESTADO[estado];
    if (targetOT) {
      for (const en of targets) {
        if (!en.otNumber) continue;
        const otNum = en.otNumber;
        ordenesTrabajoService.getByOtNumber(otNum).then(ot => {
          if (!ot) return;
          const current = (ot.estadoAdmin || 'CREADA') as OTEstadoAdmin;
          const BANDA_AGENDA: OTEstadoAdmin[] = ['ASIGNADA', 'COORDINADA'];
          const avanza = OT_ESTADO_ORDER[targetOT] > OT_ESTADO_ORDER[current];
          const regresa = OT_ESTADO_ORDER[targetOT] < OT_ESTADO_ORDER[current]
            && BANDA_AGENDA.includes(current) && BANDA_AGENDA.includes(targetOT);
          if (avanza || regresa) {
            return ordenesTrabajoService.update(otNum, {
              estadoAdmin: targetOT,
              estadoAdminFecha: new Date().toISOString(),
            });
          }
        }).catch(err => console.error('[AgendaPage] propagar estadoAgenda a OT falló:', err));
      }
    }
  }, [updateEntry, selectedCell, entries]);

  /** Pago adelantado: flag ortogonal al estado — aplica a TODA la celda
   *  (mismo criterio que el cambio de estado, 2026-08-04). */
  const handleTogglePagoAdelantado = useCallback((entryId: string, valor: boolean) => {
    const targets = selectedCell?.allEntries?.some(e => e.id === entryId)
      ? selectedCell.allEntries
      : entries.filter(e => e.id === entryId);
    for (const en of targets) updateEntry(en.id, { pagoAdelantado: valor });
    if (selectedCell?.entry) {
      setSelectedCell({
        ...selectedCell,
        entry: { ...selectedCell.entry, pagoAdelantado: valor },
        allEntries: selectedCell.allEntries.map(e => ({ ...e, pagoAdelantado: valor })),
      });
    }
  }, [updateEntry, selectedCell, entries]);

  /** Venta concretada (2026-08-09): flag ortogonal que pinta la celda ENTERA
   *  de verde agua institucional. */
  const handleToggleVentaConcretada = useCallback((entryId: string, valor: boolean) => {
    updateEntry(entryId, { ventaConcretada: valor });
    if (selectedCell?.entry) {
      setSelectedCell({
        ...selectedCell,
        entry: selectedCell.entry.id === entryId
          ? { ...selectedCell.entry, ventaConcretada: valor }
          : selectedCell.entry,
        allEntries: selectedCell.allEntries.map(e =>
          e.id === entryId ? { ...e, ventaConcretada: valor } : e),
      });
    }
  }, [updateEntry, selectedCell]);

  /** Per Incident (2026-08-12): flag ortogonal que pinta la celda ENTERA de
   *  verde oliva — mismo comportamiento que venta concretada. */
  const handleTogglePerIncident = useCallback((entryId: string, valor: boolean) => {
    updateEntry(entryId, { perIncident: valor });
    if (selectedCell?.entry) {
      setSelectedCell({
        ...selectedCell,
        entry: selectedCell.entry.id === entryId
          ? { ...selectedCell.entry, perIncident: valor }
          : selectedCell.entry,
        allEntries: selectedCell.allEntries.map(e =>
          e.id === entryId ? { ...e, perIncident: valor } : e),
      });
    }
  }, [updateEntry, selectedCell]);

  /** Espera importación (2026-08-20): el trabajo no se puede hacer hasta que
   *  llegue la importación. Celda entera azul fuerte, igual que los otros dos
   *  flags de celda completa. */
  const handleToggleEsperaImportacion = useCallback((entryId: string, valor: boolean) => {
    updateEntry(entryId, { esperaImportacion: valor });
    if (selectedCell?.entry) {
      setSelectedCell({
        ...selectedCell,
        entry: selectedCell.entry.id === entryId
          ? { ...selectedCell.entry, esperaImportacion: valor }
          : selectedCell.entry,
        allEntries: selectedCell.allEntries.map(e =>
          e.id === entryId ? { ...e, esperaImportacion: valor } : e),
      });
    }
  }, [updateEntry, selectedCell]);

  /** Detalle técnico de bench (2026-08-12): problema / falla inicial del módulo
   *  que está en el taller. Se escribe desde la barra superior y se lee también
   *  en la card del hover. Vive en `notas` de la entrada. */
  const handleChangeNotas = useCallback((entryId: string, notas: string | null) => {
    updateEntry(entryId, { notas });
    if (selectedCell?.entry) {
      setSelectedCell({
        ...selectedCell,
        entry: selectedCell.entry.id === entryId
          ? { ...selectedCell.entry, notas }
          : selectedCell.entry,
        allEntries: selectedCell.allEntries.map(e =>
          e.id === entryId ? { ...e, notas } : e),
      });
    }
  }, [updateEntry, selectedCell]);

  /** Requiere inducción (2026-08-05): flag ortogonal — SOLO la entrada marcada
   *  (a diferencia del pago adelantado, que aplica a toda la celda). */
  const handleToggleRequiereInduccion = useCallback((entryId: string, valor: boolean) => {
    updateEntry(entryId, { requiereInduccion: valor });
    if (selectedCell?.entry) {
      setSelectedCell({
        ...selectedCell,
        entry: selectedCell.entry.id === entryId
          ? { ...selectedCell.entry, requiereInduccion: valor }
          : selectedCell.entry,
        allEntries: selectedCell.allEntries.map(e =>
          e.id === entryId ? { ...e, requiereInduccion: valor } : e),
      });
    }
  }, [updateEntry, selectedCell]);

  /** Eventos fijos de agenda (2026-08-05/06): tarea sin OT con título fijo que
   *  reserva la celda — el TÍTULO manda el color en AgendaGridCell
   *  ("Firma de recibos" → violeta; "Oficina" → amarillo bench). */
  const handleAgregarEventoFijo = useCallback((titulo: string) => {
    if (!contextMenu) return;
    createEntry({
      fechaInicio: contextMenu.fecha,
      fechaFin: contextMenu.fecha,
      quarterStart: contextMenu.quarter,
      quarterEnd: contextMenu.quarter,
      ingenieroId: contextMenu.ingenieroId,
      ingenieroNombre: contextMenu.ingenieroNombre,
      otNumber: '',
      clienteNombre: '',
      tipoServicio: '',
      sistemaNombre: null,
      establecimientoNombre: null,
      estadoAgenda: 'confirmado',
      notas: null,
      titulo,
    });
    setContextMenu(null);
  }, [contextMenu, createEntry]);

  const handleDeleteEntry = useCallback(async (entryId: string) => {
    // Celda con varios servicios (2026-08-12): el borrado se lleva el
    // SELECCIONADO, que no siempre es el que la persona cree — así se perdió la
    // 30043.01 al querer sacar una entrada pegada por error. Confirmar diciendo
    // cuál es. Con un solo servicio en la celda no molesta: borra directo.
    const enCelda = selectedCell?.allEntries ?? [];
    if (enCelda.length > 1) {
      const victima = enCelda.find(e => e.id === entryId);
      const ok = await confirm(
        `En esta celda hay ${enCelda.length} servicios. Se va a eliminar ${victima ? etiquetaEntrada(victima) : 'la asignación seleccionada'}. ¿Confirmás?`,
      );
      if (!ok) return;
    }
    deleteEntry(entryId);
    if (selectedCell && selectedCell.allEntries.length > 1) {
      const remaining = selectedCell.allEntries.filter(e => e.id !== entryId);
      setSelectedCell({ ...selectedCell, entry: remaining[0] || null, allEntries: remaining });
    } else {
      setSelectedCell(null);
    }
  }, [deleteEntry, selectedCell, confirm]);

  const handleExtendEntry = useCallback((entryId: string) => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;

    if (entry.quarterEnd < 4) {
      updateEntry(entryId, { quarterEnd: (entry.quarterEnd + 1) as 1 | 2 | 3 | 4 });
    } else {
      const endDate = parseISO(entry.fechaFin);
      const nextDay = addWeekdays(endDate, 1);
      updateEntry(entryId, { fechaFin: formatDateKey(nextDay), quarterEnd: 1 });
    }
  }, [entries, updateEntry]);

  const handleShrinkEntry = useCallback((entryId: string) => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;

    if (entry.fechaInicio === entry.fechaFin && entry.quarterStart === entry.quarterEnd) return;

    if (entry.quarterEnd > 1) {
      updateEntry(entryId, { quarterEnd: (entry.quarterEnd - 1) as 1 | 2 | 3 | 4 });
    } else {
      const endDate = parseISO(entry.fechaFin);
      let prevDay = addDays(endDate, -1);
      while (isWeekend(prevDay)) prevDay = addDays(prevDay, -1);
      const prevFecha = formatDateKey(prevDay);
      if (prevFecha < entry.fechaInicio) return;
      updateEntry(entryId, { fechaFin: prevFecha, quarterEnd: 4 });
    }
  }, [entries, updateEntry]);

  const selectedCellKey = selectedCell
    ? `${selectedCell.ingenieroId}:${selectedCell.fecha}:${selectedCell.quarter}`
    : null;

  const clipboardLabel = clipboard
    ? clipboard.type === 'cut' && clipboard.entries?.length
      ? `✂ ${clipboard.entries.map(e => (e.otNumber ? `OT-${e.otNumber}` : e.titulo || 'tarea')).join(', ')}`
      : clipboard.type === 'entry' && clipboard.entry
        ? `OT-${clipboard.entry.otNumber}`
        : clipboard.type === 'pending' && clipboard.ot
          ? `OT-${clipboard.ot.otNumber}`
          : null
    : null;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <AgendaHeader
        anchor={anchor}
        zoomLevel={zoomLevel}
        onPrev={goToPrev}
        onNext={goToNext}
        onToday={goToToday}
        onSearch={() => setShowBuscador(true)}
        onPickDate={goToDate}
        vista={vista}
        onVistaChange={v => setFilter('vista', v)}
        ingenieros={ingenieros}
        ingenieroId={filters.ingeniero}
        onIngenieroChange={id => setFilter('ingeniero', id)}
      />

      {showBuscador && (
        <AgendaBuscador entries={entries} onJump={handleJumpToEntry} onClose={() => setShowBuscador(false)} />
      )}

      {reservaTarget && (
        <AgendaReservaModal
          ingenieroNombre={reservaTarget.ingenieroNombre}
          fecha={reservaTarget.fecha}
          onClose={() => setReservaTarget(null)}
          onCreate={handleCrearReserva}
        />
      )}

      <AgendaInfoBar
        selectedCell={selectedCell}
        clipboardLabel={clipboardLabel}
        onDeleteEntry={handleDeleteEntry}
        onExtendEntry={handleExtendEntry}
        onShrinkEntry={handleShrinkEntry}
        onSelectEntry={handleSelectEntry}
        onChangeEstado={handleChangeEstado}
        onTogglePagoAdelantado={handleTogglePagoAdelantado}
        onToggleRequiereInduccion={handleToggleRequiereInduccion}
        onToggleVentaConcretada={handleToggleVentaConcretada}
        onTogglePerIncident={handleTogglePerIncident}
        onToggleEsperaImportacion={handleToggleEsperaImportacion}
        onChangeNotas={handleChangeNotas}
      />

      <DndContext
        sensors={sensors}
        autoScroll={{ threshold: { x: 0.15, y: 0.15 }, acceleration: 15 }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 relative overflow-hidden">
          {/* Grid area — absolute positioning decouples grid from sidebar */}
          <div
            className="absolute top-0 left-0 bottom-0 overflow-hidden"
            style={{ right: sidebarWidth + 6 }}
          >
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <span className="text-teal-600 font-bold text-xl tracking-tight">AGS</span>
                  <p className="text-xs text-slate-400 mt-2">Cargando agenda...</p>
                </div>
              </div>
            ) : vista === 'almanaque' ? (
              // Misma data y mismo rango que la grilla — solo cambia la lectura.
              <AgendaAlmanaqueView
                visibleDays={visibleDays}
                entries={entries}
                ingenieros={ingenieros}
                ingenieroId={filters.ingeniero}
              />
            ) : (
              <AgendaGrid
                ingenieros={ingenieros}
                visibleDays={visibleDays}
                zoom={zoomLevel}
                entries={entries}
                selectedCellKey={selectedCellKey}
                selectionRange={selectionRange}
                onCellClick={handleCellClick}
                onEntryClick={handleEntryClick}
                onWeekClick={handleWeekClick}
                onCellContextMenu={handleContextMenu}
                feriados={feriados}
                onToggleFeriado={toggleFeriado}
                notas={notas}
                diasAgs={diasAgs}
              />
            )}
          </div>

          {/* Resize handle */}
          <div
            className="absolute top-0 bottom-0 cursor-col-resize hover:bg-teal-200 active:bg-teal-300 transition-colors bg-slate-200"
            style={{ right: sidebarWidth, width: 6 }}
            onMouseDown={handleResizeStart}
          />

          {/* Sidebar — fixed to right edge */}
          <div className="absolute top-0 right-0 bottom-0 overflow-hidden" style={{ width: sidebarWidth }}>
            <AgendaPendingSidebar
              pendingOTs={pendingOTs}
              equipoIdBySistema={equipoIdBySistema}
              selectedOTs={selectedPendingOTs}
              onToggleSelect={handleTogglePendingOT}
              onCopyOT={handleCopyPendingOT}
              width={sidebarWidth}
            />
          </div>
        </div>

        {/* Context menu */}
        {/* Menú contextual COMPACTO y desplegado hacia ARRIBA (anclado por bottom):
            el visor resumen de servicios se abre hacia abajo y se pisaban (2026-07-30).
            z-[10000]: por encima del popover de servicios (9999), que en las filas
            de abajo también se abre hacia arriba y lo tapaba (2026-08-03). */}
        {contextMenu && (
          <div
            className="fixed z-[10000] bg-white border border-slate-200 rounded-lg shadow-lg py-0.5 min-w-[150px]"
            style={estiloMenuContextual(contextMenu.x, contextMenu.y)}
          >
            <button
              onClick={handleOpenManualTaskInput}
              className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-teal-50 hover:text-teal-700 flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Agregar tarea manual
            </button>
            {/* Reserva de servicio sin OT → previsión (2026-08-03) */}
            <button
              onClick={() => {
                setReservaTarget({
                  ingenieroId: contextMenu.ingenieroId,
                  ingenieroNombre: contextMenu.ingenieroNombre,
                  fecha: contextMenu.fecha,
                  quarter: contextMenu.quarter,
                });
                setContextMenu(null);
              }}
              className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-teal-50 hover:text-teal-700 flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              Reservar servicio (sin OT)
            </button>
            {/* Firma de recibos (2026-08-05): evento mensual, celda violeta clarito */}
            <button
              onClick={() => handleAgregarEventoFijo('Firma de recibos')}
              className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-purple-50 hover:text-purple-700 flex items-center gap-1.5"
            >
              <ColorRef titulo="Firma de recibos" />
              Agregar firma de recibos
            </button>
            {/* Oficina (2026-08-06): día en oficina — celda amarilla (mismo tono bench) */}
            <button
              onClick={() => handleAgregarEventoFijo('Oficina')}
              className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-amber-50 hover:text-amber-700 flex items-center gap-1.5"
            >
              <ColorRef titulo="Oficina" />
              Agregar día de oficina
            </button>
            {/* Permisos especiales (2026-08-09): celda marrón oscuro */}
            <button
              onClick={() => handleAgregarEventoFijo('Permisos especiales')}
              className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-[#f2ece8] hover:text-[#5c4033] flex items-center gap-1.5"
            >
              <ColorRef titulo="Permisos especiales" />
              Agregar permisos especiales
            </button>
            {/* Estudios médicos (2026-08-09): celda amarillo fuerte */}
            <button
              onClick={() => handleAgregarEventoFijo('Estudios médicos')}
              className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-yellow-50 hover:text-yellow-700 flex items-center gap-1.5"
            >
              <ColorRef titulo="Estudios médicos" />
              Agregar estudios médicos
            </button>
            {/* Día por enfermedad (2026-08-09): celda verde chillón */}
            <button
              onClick={() => handleAgregarEventoFijo('Día por enfermedad')}
              className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-lime-50 hover:text-lime-700 flex items-center gap-1.5"
            >
              <ColorRef titulo="Día por enfermedad" />
              Agregar día por enfermedad
            </button>
            {/* Vacaciones (2026-08-12): celda naranja Claude */}
            <button
              onClick={() => handleAgregarEventoFijo('Vacaciones')}
              className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-orange-50 hover:text-orange-700 flex items-center gap-1.5"
            >
              <ColorRef titulo="Vacaciones" />
              Agregar vacaciones
            </button>
            <button
              onClick={handleOpenNotaInput}
              className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-teal-50 hover:text-teal-700 flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.282 48.282 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
              </svg>
              {notaDeContextMenu ? 'Editar comentario' : 'Agregar comentario'}
            </button>
            {findEntriesAtCell(entries, contextMenu.ingenieroId, contextMenu.fecha, contextMenu.quarter).length > 0 && (
              <button
                onClick={() => {
                  cutCell(contextMenu.ingenieroId, contextMenu.fecha, contextMenu.quarter);
                  setContextMenu(null);
                }}
                className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-amber-50 hover:text-amber-700 flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.848 8.25l1.536.887M7.848 8.25a3 3 0 1 1-5.196-3 3 3 0 0 1 5.196 3Zm1.536.887a2.165 2.165 0 0 1 1.083 1.839c.005.351.054.695.14 1.024M9.384 9.137l2.077 1.199M7.848 15.75l1.536-.887m-1.536.887a3 3 0 1 1-5.196 3 3 3 0 0 1 5.196-3Zm1.536-.887a2.165 2.165 0 0 0 1.083-1.838c.005-.352.054-.695.14-1.025m-1.223 2.863 2.077-1.199m0-3.328a4.323 4.323 0 0 1 2.068-1.379l5.325-1.628a4.5 4.5 0 0 1 2.48-.044l.803.215-7.794 4.5m-2.882-.28a4.33 4.33 0 0 0 .805 1.968m1.077 1.04 4.876 2.815a4.5 4.5 0 0 0 2.48.043l.803-.214-7.475-4.316m-1.761 1.712a4.32 4.32 0 0 1-1.077-1.04" />
                </svg>
                Cortar servicio(s) — quedan en "para coordinar" hasta pegar
              </button>
            )}
            {/* Día AGS (2026-08-02): no laborable POR INGENIERO (cumpleaños +
                2 días de empresa al año). Celda turquesa + bloqueo de agendado. */}
            <button
              onClick={() => {
                void toggleDiaAgs(contextMenu.ingenieroId, contextMenu.ingenieroNombre, contextMenu.fecha);
                setContextMenu(null);
              }}
              className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-cyan-50 hover:text-cyan-700 flex items-center gap-1.5"
            >
              <span className="w-3.5 h-3.5 rounded-sm bg-cyan-300 border border-cyan-400 shrink-0" />
              {diasAgs.has(`${contextMenu.ingenieroId}_${contextMenu.fecha}`)
                ? 'Quitar día AGS'
                : 'Marcar día AGS (no laborable)'}
            </button>
          </div>
        )}

        {/* Comentario de celda (estilo Excel) */}
        {notaInput && (
          <div
            className="fixed z-[10000] bg-white border border-slate-200 rounded-lg shadow-lg p-3 min-w-[260px]"
            style={{ left: notaInput.x, bottom: Math.max(8, window.innerHeight - notaInput.y) }}
            onClick={e => e.stopPropagation()}
          >
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">
              Comentario — {notaInput.ingenieroNombre} · {notaInput.fecha}
            </label>
            <textarea
              autoFocus
              value={notaTexto}
              onChange={e => setNotaTexto(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') setNotaInput(null);
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void handleGuardarNota();
              }}
              rows={3}
              className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs resize-y focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Escribí el comentario…"
            />
            <div className="flex justify-between items-center mt-2">
              {notaInput.notaId ? (
                <button onClick={() => void handleEliminarNota()} className="text-[11px] text-red-500 hover:underline">
                  Eliminar
                </button>
              ) : <span />}
              <div className="flex gap-2">
                <button onClick={() => setNotaInput(null)} className="text-[11px] text-slate-500 hover:underline">Cancelar</button>
                <button onClick={() => void handleGuardarNota()}
                  className="text-[11px] font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded px-2.5 py-1">
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Manual task inline input */}
        {manualTaskInput && (
          <div
            className="fixed z-[10000] bg-white border border-slate-200 rounded-lg shadow-lg p-3 min-w-[240px]"
            style={{ left: manualTaskInput.x, bottom: Math.max(8, window.innerHeight - manualTaskInput.y) }}
            onClick={e => e.stopPropagation()}
          >
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">
              Título de la tarea
            </label>
            <input
              ref={manualTaskInputRef}
              type="text"
              defaultValue={manualTaskInput?.initialValue || ''}
              placeholder="Ej: Llevar auto al mecánico..."
              className="w-full text-sm px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-teal-400"
              onKeyDown={e => {
                if (e.key === 'Enter') handleConfirmManualTask((e.target as HTMLInputElement).value);
                if (e.key === 'Escape') setManualTaskInput(null);
              }}
            />
            <div className="flex justify-end gap-1.5 mt-2">
              <button onClick={() => setManualTaskInput(null)} className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1">
                Cancelar
              </button>
              <button
                onClick={() => handleConfirmManualTask(manualTaskInputRef.current?.value || '')}
                className="text-xs bg-teal-600 text-white px-3 py-1 rounded hover:bg-teal-700"
              >
                Crear
              </button>
            </div>
          </div>
        )}

        <DragOverlay dropAnimation={null} modifiers={[snapToCursor]}>
          {activeDragOT && (
            <div className="relative bg-amber-400 border border-amber-500 rounded-sm shadow-md pointer-events-none flex items-center justify-center"
              style={{ width: 26, height: 26 }}>
              <span className="text-[7px] font-bold text-amber-900 leading-none select-none truncate px-0.5">
                {activeDragOT.otNumber}
              </span>
              {selectedPendingOTs.size > 1 && (
                <span className="absolute -top-2 -right-2 text-[7px] font-bold text-white bg-teal-600 rounded-full w-3.5 h-3.5 flex items-center justify-center shadow">
                  {selectedPendingOTs.size}
                </span>
              )}
            </div>
          )}
          {activeDragEntry && (
            <div className="bg-teal-400 border border-teal-500 rounded-sm shadow-md pointer-events-none"
              style={{ width: 26, height: 26 }} />
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
};
