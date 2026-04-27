import type { WorkOrder, Sistema } from '@ags/shared';
import { resolveEstadoOT } from '../components/ordenes-trabajo/OTStatusBadge';

/** Export filtered OTs to CSV and trigger download. */
export function exportOTsToCSV(rows: { ot: WorkOrder }[], sistemas: Sistema[]) {
  const headers = ['OT', 'Cliente', 'Sistema', 'Id Equipo', 'Módulo', 'Serie', 'Tipo Servicio', 'Descripción', 'Estado', 'Ingeniero', 'Fecha Creación', 'Fecha Servicio', 'Hs Lab', 'Hs Viaje', 'Facturable', 'Contrato', 'Garantía'];
  const csvRows = rows.map(({ ot }) => {
    const sist = sistemas.find(s => s.id === ot.sistemaId);
    return [
      ot.otNumber, ot.razonSocial, sist?.nombre || ot.sistema || '', ot.codigoInternoCliente || '',
      ot.moduloModelo || '', ot.moduloSerie || '', ot.tipoServicio || '',
      (ot.problemaFallaInicial || '').replace(/[\n\r,]/g, ' '), resolveEstadoOT(ot),
      ot.ingenieroAsignadoNombre || '', ot.createdAt || '', ot.fechaInicio || ot.fechaServicioAprox || '',
      ot.horasTrabajadas || '', ot.tiempoViaje || '',
      ot.esFacturable ? 'Sí' : 'No', ot.tieneContrato ? 'Sí' : 'No', ot.esGarantia ? 'Sí' : 'No',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });
  const csv = [headers.join(','), ...csvRows].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ordenes_trabajo_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
