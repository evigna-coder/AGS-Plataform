import type { Loaner, ParteLoanerPrestada } from '@ags/shared';
import { remitosService } from '../services/firebaseService';
import { imprimirRemitoStock, TRANSPORTISTA_AGS } from './remitoImprimir';

export interface RemitoSalidaLoanerInput {
  loaner: Loaner;
  numero: string;
  clienteId: string;
  clienteNombre: string;
  establecimientoId: string | null;
  establecimientoNombre: string | null;
  otNumber: string | null;
  /** Si se presta una PARTE, el papel describe la parte, no el módulo (2026-09-04). */
  parte: ParteLoanerPrestada | null;
}

/**
 * Crea e imprime el remito de SALIDA de un préstamo de loaner. Antes vivía
 * adentro de `LoanerPrestamoModal`; salió de ahí al sumar el préstamo por
 * partes, que ya no entraba en el presupuesto del componente.
 *
 * El ítem del loaner es DOCUMENTAL (sin unidadId, con tipoEntidad): el remito
 * no mueve stock, pero el papel detalla qué salió. El artículo del catálogo
 * viaja al ítem (2026-08-23): la columna Código del papel lo lee de acá.
 *
 * La impresión va por el MISMO camino que el resto de los remitos (offsets
 * calibrados, domicilio por establecimiento, triplicado en silencio). Es
 * best-effort: una impresora caída no bloquea el préstamo.
 */
export async function crearEImprimirRemitoSalidaLoaner(
  input: RemitoSalidaLoanerInput,
): Promise<{ remitoId: string; remitoNumero: string | null }> {
  const { loaner, parte } = input;
  const remitoId = await remitosService.create({
    numero: input.numero.trim(),
    tipo: 'loaner_salida',
    estado: 'borrador',
    ingenieroId: '',
    ingenieroNombre: 'AGS Taller',
    clienteId: input.clienteId,
    clienteNombre: input.clienteNombre,
    establecimientoId: input.establecimientoId,
    establecimientoNombre: input.establecimientoNombre,
    otNumbers: input.otNumber ? [input.otNumber] : [],
    loanerId: loaner.id,
    loanerCodigo: loaner.codigo,
    items: [parte
      ? {
        id: crypto.randomUUID(),
        cantidad: 1,
        tipoItem: 'sale_y_vuelve',
        devuelto: false,
        tipoEntidad: 'loaner',
        loanerId: loaner.id,
        loanerCodigo: loaner.codigo,
        // El papel nombra la parte y el MÓDULO del que sale, por su descripción
        // y su serie — no por el código LNR, que al cliente no le dice nada
        // (pedido 2026-09-04: "Motor de Bomba cuaternaria · S/N …"). El N° de
        // parte va a la columna Producto.
        loanerDescripcion: `${parte.descripcion}${parte.serie ? ` S/N ${parte.serie}` : ''} de ${loaner.descripcion}${loaner.serie ? ` · S/N ${loaner.serie}` : ''}`,
        articuloId: parte.articuloId ?? undefined,
        articuloCodigo: parte.codigoArticulo ?? undefined,
        serie: parte.serie ?? loaner.serie ?? null,
      }
      : {
        id: crypto.randomUUID(),
        cantidad: 1,
        tipoItem: 'sale_y_vuelve',
        devuelto: false,
        tipoEntidad: 'loaner',
        loanerId: loaner.id,
        loanerCodigo: loaner.codigo,
        loanerDescripcion: loaner.descripcion,
        articuloId: loaner.articuloId ?? undefined,
        articuloCodigo: loaner.articuloCodigo ?? undefined,
        articuloDescripcion: loaner.articuloDescripcion ?? undefined,
        serie: loaner.serie ?? null,
      }],
    // En un préstamo el transporte lo hace AGS, siempre.
    transportistaNombre: TRANSPORTISTA_AGS.razonSocial,
    transportista: TRANSPORTISTA_AGS,
    observaciones: `Loaner ${loaner.codigo}${parte ? ` · parte: ${parte.descripcion}` : ''}${input.otNumber ? ` · OT ${input.otNumber}` : ''}`,
  });

  const remitoCreado = await remitosService.getById(remitoId);
  if (!remitoCreado) return { remitoId, remitoNumero: null };
  await imprimirRemitoStock(remitoCreado)
    .catch(err => console.warn('[loanerRemitoSalida] impresión de remito falló:', err));
  return { remitoId, remitoNumero: remitoCreado.numero };
}
