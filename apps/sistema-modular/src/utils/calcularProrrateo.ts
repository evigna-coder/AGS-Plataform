/**
 * Calcula el costo unitario de un ítem incluyendo los gastos de importación
 * prorrateados por valor proporcional.
 *
 * Limitación conocida: solo se prorratean gastos en la misma moneda que la OC.
 * Gastos en otras monedas deben mostrarse como referencia informativa.
 */
export function calcularCostoConGastos(params: {
  precioUnitario: number;
  cantidadRecibida: number;
  valorTotalImportacion: number; // suma de (precioUnitario * cantidadRecibida) de todos los ítems
  totalGastosEnMonedaOC: number; // gastos en misma moneda que la OC sumados
}): number {
  const { precioUnitario, cantidadRecibida, valorTotalImportacion, totalGastosEnMonedaOC } = params;
  if (cantidadRecibida <= 0) return precioUnitario;
  const valorItem = precioUnitario * cantidadRecibida;
  const proporcion = valorTotalImportacion > 0 ? valorItem / valorTotalImportacion : 0;
  const gastosItem = totalGastosEnMonedaOC * proporcion;
  return precioUnitario + gastosItem / cantidadRecibida;
}
