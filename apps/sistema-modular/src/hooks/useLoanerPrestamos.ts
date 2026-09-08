import { useState } from 'react';
import type { ItemAsignacion, Loaner, ParteLoanerPrestada, PrestamoLoaner } from '@ags/shared';
import { prestamoModuloActivo } from '@ags/shared';
import { loanersService } from '../services/firebaseService';
import { iniciarRecalificacion } from '../utils/loanerRecalificacion';
import type { PrestamoLoanerDatos } from '../components/loaners/LoanerPrestamoModal';
import { notify } from '../utils/notify';

export interface DevolucionDatos {
  fechaRetornoReal: string;
  condicionRetorno: string;
  requiereRecalificacion: boolean;
  fotos: File[];
}

/** Parte sobre la que se está actuando (vuelta a base o reinstalación). */
export interface ParteEnAccion {
  prestamo: PrestamoLoaner;
  parteId: string;
  parte: ParteLoanerPrestada;
}

/**
 * Alta y devolución de préstamos desde el detalle del loaner. Salió de
 * `LoanerDetail` (2026-09-04) al sumar el préstamo por PARTES. Desde
 * 2026-09-08 una parte tiene dos hechos: "volvió a la base" y "reinstalada";
 * y puede ir a un INGENIERO, en cuyo caso nace como asignación en su
 * inventario.
 */
export function useLoanerPrestamos(loaner: Loaner | null) {
  const [vueltaBase, setVueltaBase] = useState<ParteEnAccion | null>(null);
  const [reinstalar, setReinstalar] = useState<ParteEnAccion | null>(null);
  const prestamoActivo = loaner ? prestamoModuloActivo(loaner) : undefined;

  const subirFotos = async (files: File[], contexto: 'prestamo' | 'devolucion', prestamoId: string) => {
    if (!loaner) return;
    // Best-effort — el préstamo/devolución ya quedó registrado.
    for (const file of files) {
      await loanersService.agregarFoto(loaner.id, file, { nombre: file.name, contexto, prestamoId })
        .catch(err => console.warn(`[useLoanerPrestamos] foto de ${contexto} falló:`, err));
    }
  };

  /** Partes al inventario de un ingeniero: una asignación con una línea por parte. */
  const crearAsignacionDePartes = async (data: PrestamoLoanerDatos, prestamoId: string) => {
    if (!loaner) throw new Error('Loaner no cargado');
    const { asignacionesService } = await import('../services/asignacionesService');
    const ahora = new Date().toISOString();
    const items: ItemAsignacion[] = data.partes.map(p => ({
      id: crypto.randomUUID(),
      tipo: 'loaner',
      unidadId: null,
      articuloId: p.articuloId ?? null,
      articuloCodigo: p.codigoArticulo ?? null,
      // Qué es y de qué equipo sale: es lo que el IST ve en su panel.
      articuloDescripcion: `${p.descripcion}${p.serie ? ` S/N ${p.serie}` : ''} · de ${loaner.descripcion}${loaner.serie ? ` S/N ${loaner.serie}` : ''}`,
      cantidad: 1, cantidadDevuelta: 0, cantidadConsumida: 0,
      loanerId: loaner.id, loanerCodigo: loaner.codigo,
      loanerPrestamoId: prestamoId, loanerParteId: p.id ?? null,
      proposito: `Parte del loaner ${loaner.codigo}`,
      estado: 'asignado', permanente: false, fechaAsignacion: ahora,
    }));
    const asignacionId = await asignacionesService.create({
      ingenieroId: data.ingenieroId ?? '',
      ingenieroNombre: data.ingenieroNombre ?? '',
      items,
      clienteId: null, clienteNombre: null,
      observaciones: `Partes del loaner ${loaner.codigo} (${loaner.descripcion}${loaner.serie ? ` S/N ${loaner.serie}` : ''})`,
      estado: 'activa',
      remitoId: null,
    });
    const asg = await asignacionesService.getById(asignacionId);
    return { asignacionId, asignacionNumero: asg?.numero ?? null };
  };

  const registrarPrestamo = async (data: PrestamoLoanerDatos) => {
    if (!loaner) return;
    const { fotos, ...prestamo } = data;
    const prestamoId = crypto.randomUUID();
    const asg = data.destino === 'ingeniero' ? await crearAsignacionDePartes(data, prestamoId) : null;
    await loanersService.registrarPrestamo(loaner.id, {
      ...prestamo,
      id: prestamoId,
      asignacionId: asg?.asignacionId ?? null,
      asignacionNumero: asg?.asignacionNumero ?? null,
      fechaSalida: new Date().toISOString(),
      estado: 'activo',
    });
    await subirFotos(fotos, 'prestamo', prestamoId);
    if (asg) notify.success(`Partes asignadas a ${data.ingenieroNombre}: asignación ${asg.asignacionNumero ?? ''}. Ya las ve en su inventario.`);
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
        notify.success(`Devolución registrada. Se creó la OT de recalificación ${otNumber}${ticketId ? ' y el ticket de coordinación' : ''}. El loaner queda "En recalificación" hasta el cierre técnico.`);
      } else if (yaEnCurso) {
        // Otra pantalla/sesión ya la está creando: avisar sin alarmar y sin duplicar.
        notify.warning('Devolución registrada. La OT de recalificación ya estaba en curso — revisá el detalle del loaner en unos segundos.');
      } else {
        notify.error('Devolución registrada, pero la OT de recalificación no se pudo crear automáticamente. Revisá el ticket generado o creala a mano.');
      }
    }
  };

  /** La parte volvió a la base: sigue pendiente de reinstalar. */
  const registrarVueltaBase = async (data: DevolucionDatos) => {
    if (!loaner || !vueltaBase) return;
    await loanersService.registrarVueltaBaseParte(loaner.id, vueltaBase.prestamo.id, vueltaBase.parteId, {
      fecha: data.fechaRetornoReal, condicion: data.condicionRetorno,
    });
    await subirFotos(data.fotos, 'devolucion', vueltaBase.prestamo.id);
    setVueltaBase(null);
  };

  /** La parte se reinstaló en el módulo: cierra su ciclo. */
  const registrarReinstalacion = async (data: { fecha: string; otNumber: string | null }) => {
    if (!loaner || !reinstalar) return;
    await loanersService.registrarReinstalacionParte(loaner.id, reinstalar.prestamo.id, reinstalar.parteId, data);
    setReinstalar(null);
  };

  return {
    prestamoActivo,
    vueltaBase, setVueltaBase, reinstalar, setReinstalar,
    registrarPrestamo, registrarDevolucion, registrarVueltaBase, registrarReinstalacion,
  };
}
