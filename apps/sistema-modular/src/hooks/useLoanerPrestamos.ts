import { useState } from 'react';
import type { Loaner, PrestamoLoaner } from '@ags/shared';
import { prestamoModuloActivo } from '@ags/shared';
import { loanersService } from '../services/firebaseService';
import { iniciarRecalificacion } from '../utils/loanerRecalificacion';
import type { PrestamoLoanerDatos } from '../components/loaners/LoanerPrestamoModal';

export interface DevolucionDatos {
  fechaRetornoReal: string;
  condicionRetorno: string;
  requiereRecalificacion: boolean;
  fotos: File[];
}

/**
 * Alta y devolución de préstamos desde el detalle del loaner. Salió de
 * `LoanerDetail` (2026-09-04) al sumar el préstamo por PARTES: el módulo
 * entero se devuelve desde la cabecera; una parte, desde su fila del
 * historial (`retornoParte`), y puede haber varias afuera a la vez.
 */
export function useLoanerPrestamos(loaner: Loaner | null) {
  /** Parte cuyo retorno se está registrando (abre el modal de devolución en modo parte). */
  const [retornoParte, setRetornoParte] = useState<PrestamoLoaner | null>(null);
  const prestamoActivo = loaner ? prestamoModuloActivo(loaner) : undefined;

  const subirFotos = async (files: File[], contexto: 'prestamo' | 'devolucion', prestamoId: string) => {
    if (!loaner) return;
    // Best-effort — el préstamo/devolución ya quedó registrado.
    for (const file of files) {
      await loanersService.agregarFoto(loaner.id, file, { nombre: file.name, contexto, prestamoId })
        .catch(err => console.warn(`[useLoanerPrestamos] foto de ${contexto} falló:`, err));
    }
  };

  const registrarPrestamo = async (data: PrestamoLoanerDatos) => {
    if (!loaner) return;
    const { fotos, ...prestamo } = data;
    const prestamoId = await loanersService.registrarPrestamo(loaner.id, {
      ...prestamo,
      fechaSalida: new Date().toISOString(),
      estado: 'activo',
    });
    await subirFotos(fotos, 'prestamo', prestamoId);
  };

  /** Devolución del MÓDULO entero (ciclo de recalificación incluido). */
  const registrarDevolucion = async (data: DevolucionDatos) => {
    if (!loaner || !prestamoActivo) return;
    const { fotos, ...devolucion } = data;
    await loanersService.registrarDevolucion(loaner.id, prestamoActivo.id, devolucion);
    await subirFotos(fotos, 'devolucion', prestamoActivo.id);
    // Ciclo de recalificación: OT interna + ticket. Best-effort — nunca rompe la devolución.
    if (data.requiereRecalificacion) {
      const { otNumber, ticketId, yaEnCurso } = await iniciarRecalificacion(loaner, prestamoActivo);
      if (otNumber) {
        alert(`Devolución registrada. Se creó la OT de recalificación ${otNumber}${ticketId ? ' y el ticket de coordinación' : ''}. El loaner queda "En recalificación" hasta el cierre técnico.`);
      } else if (yaEnCurso) {
        // Otra pantalla/sesión ya la está creando: avisar sin alarmar y sin duplicar.
        alert('Devolución registrada. La OT de recalificación ya estaba en curso — revisá el detalle del loaner en unos segundos.');
      } else {
        alert('Devolución registrada, pero la OT de recalificación no se pudo crear automáticamente. Revisá el ticket generado o creala a mano.');
      }
    }
  };

  /** Retorno de una PARTE: el módulo nunca se fue, no hay recalificación. */
  const registrarRetornoParte = async (data: DevolucionDatos) => {
    if (!loaner || !retornoParte) return;
    const { fotos, ...devolucion } = data;
    await loanersService.registrarDevolucion(loaner.id, retornoParte.id, { ...devolucion, requiereRecalificacion: false });
    await subirFotos(fotos, 'devolucion', retornoParte.id);
    setRetornoParte(null);
  };

  return { prestamoActivo, retornoParte, setRetornoParte, registrarPrestamo, registrarDevolucion, registrarRetornoParte };
}
