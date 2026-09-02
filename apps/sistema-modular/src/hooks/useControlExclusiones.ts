import { useConfirm } from '../components/ui/ConfirmDialog';

/**
 * Quitar/reponer filas del control de la semana visible (extraído de
 * ControlSemanal.tsx el 2026-09-02, presupuesto de 250 líneas).
 *
 * Son cinco pares del mismo diálogo con distinto sujeto: agenda, entregas, OTs
 * que arrastran y presupuestos. Sacar una fila NO toca el dato de origen —la
 * agenda, la OT y el presupuesto quedan como estaban—, solo deja de contar en
 * la foto de esta semana.
 */
export function useControlExclusiones(deps: {
  excluirDelControl: (otNumber: string, excluir: boolean) => Promise<void>;
  excluirEntregaDelControl: (otNumber: string, excluir: boolean) => Promise<void>;
  excluirPresupuestoDelControl: (presupuestoId: string, excluir: boolean) => Promise<void>;
  agendaExcluidas: { otNumber?: string | null }[];
  entregasExcluidas: { otNumber: string }[];
  otsArrastreExcluidas: { otNumber: string }[];
  presupuestosExcluidos: { id: string }[];
}) {
  const confirm = useConfirm();
  const {
    excluirDelControl, excluirEntregaDelControl, excluirPresupuestoDelControl,
    agendaExcluidas, entregasExcluidas, otsArrastreExcluidas, presupuestosExcluidos,
  } = deps;

  /** Diálogo común de "sacar de esta semana". `nota` explica qué pasa después. */
  const quitar = async (
    titulo: string,
    nota: string,
    accion: () => Promise<void>,
  ) => {
    if (!await confirm({ title: titulo, message: nota, confirmLabel: 'Quitar' })) return;
    try { await accion(); }
    catch { alert('No se pudo quitar del control'); }
  };

  const reponer = async (cuantas: number, sujeto: string, accion: () => Promise<void>) => {
    if (!await confirm(`¿Reponer ${cuantas} ${sujeto} al control de esta semana?`)) return;
    try { await accion(); }
    catch { alert('No se pudieron reponer'); }
  };

  return {
    /**
     * Sacar una OT del control de esta semana (2026-08-19). No toca la agenda:
     * la visita existió y sigue ahí. Deja de contar porque se recoordinó y
     * cierra en otra semana.
     */
    quitarDelControl: (otNumber: string) => quitar(
      `Quitar ${otNumber} del control`,
      'Deja de contar en el control de esta semana. La agenda no se toca — la visita sigue estando.',
      () => excluirDelControl(otNumber, true),
    ),
    reponerExcluidas: () => {
      const nums = [...new Set(agendaExcluidas.map(e => e.otNumber).filter((n): n is string => !!n))];
      return reponer(nums.length, 'OT(s)',
        () => Promise.all(nums.map(n => excluirDelControl(n, false))).then(() => undefined));
    },

    /** Entregas: no van a agenda y figuran en todas las semanas hasta entregarse. */
    quitarEntregaDelControl: (otNumber: string) => quitar(
      `Quitar ${otNumber} del control`,
      'Deja de contar en el control de esta semana. Sigue figurando en las demás hasta que se entregue.',
      () => excluirEntregaDelControl(otNumber, true),
    ),
    reponerEntregas: () => reponer(entregasExcluidas.length, 'entrega(s)',
      () => Promise.all(entregasExcluidas.map(o => excluirEntregaDelControl(o.otNumber, false)))
        .then(() => undefined)),

    /** OTs que arrastran (2026-09-02): misma marca que las entregas. */
    quitarArrastreDelControl: (otNumber: string) => quitar(
      `Quitar ${otNumber} del control`,
      'Deja de contar en el control de esta semana. Vuelve a figurar la semana que viene si sigue sin cerrarse.',
      () => excluirEntregaDelControl(otNumber, true),
    ),
    reponerArrastres: () => reponer(otsArrastreExcluidas.length, 'OT(s)',
      () => Promise.all(otsArrastreExcluidas.map(o => excluirEntregaDelControl(o.otNumber, false)))
        .then(() => undefined)),

    /** Presupuestos: arrastran mientras tengan algo pendiente. */
    quitarPresupuestoDelControl: (presupuestoId: string) => quitar(
      'Quitar del control',
      'Deja de contar en el control de esta semana. Sigue figurando en las demás mientras arrastre algo pendiente.',
      () => excluirPresupuestoDelControl(presupuestoId, true),
    ),
    reponerPresupuestos: () => reponer(presupuestosExcluidos.length, 'presupuesto(s)',
      () => Promise.all(presupuestosExcluidos.map(p => excluirPresupuestoDelControl(p.id, false)))
        .then(() => undefined)),
  };
}
