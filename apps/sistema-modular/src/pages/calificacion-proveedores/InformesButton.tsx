import type { CalificacionProveedor } from '@ags/shared';
import { MenuButton } from '../../components/ui/MenuButton';
import { exportToExcel } from '../../utils/exportToExcel';
import { exportListadoPDF, type ExportListadoPDFOptions } from '../../utils/exportListadoPDF';
import {
  buildCalificacionesResumen, buildCalificacionesDetalle,
  CALIFICACIONES_RESUMEN_COLUMNS, CALIFICACIONES_DETALLE_COLUMNS,
} from '../../utils/exports/exportCalificaciones';

/** yyyymmdd en hora local — mismo criterio que ExportarButton. */
function hoySlug(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Informes de calificación por proveedor (2026-08-28): ranking de promedios y
 * detalle agrupado por proveedor. Consumen TODO lo suscripto (`items`), no la
 * pestaña activa — el informe es del historial, no de la vista.
 */
export function InformesButton({ items }: { items: CalificacionProveedor[] }) {
  const pdf = <T,>(opts: ExportListadoPDFOptions<T>) => {
    void exportListadoPDF(opts).catch(err => {
      console.error('[InformesButton] error generando PDF:', err);
      alert('Error al generar el PDF');
    });
  };

  return (
    <MenuButton
      label="Informes"
      disabled={items.length === 0}
      title={items.length === 0 ? 'No hay calificaciones' : 'Informes por proveedor'}
      items={[
        {
          label: 'Promedio por proveedor — PDF',
          onClick: () => pdf({
            titulo: 'Calificación de Proveedores',
            subtitulo: 'Promedio ponderado por proveedor',
            columnas: CALIFICACIONES_RESUMEN_COLUMNS,
            data: buildCalificacionesResumen(items),
            filename: `calificaciones-promedio-${hoySlug()}`,
          }),
        },
        {
          label: 'Promedio por proveedor — Excel',
          onClick: () => exportToExcel({
            data: buildCalificacionesResumen(items),
            columns: CALIFICACIONES_RESUMEN_COLUMNS,
            sheetName: 'Promedio por proveedor',
            filename: `calificaciones-promedio-${hoySlug()}`,
          }),
        },
        {
          label: 'Detalle por proveedor — PDF',
          onClick: () => pdf({
            titulo: 'Calificación de Proveedores',
            subtitulo: 'Detalle por proveedor',
            columnas: CALIFICACIONES_DETALLE_COLUMNS,
            data: buildCalificacionesDetalle(items),
            filename: `calificaciones-detalle-${hoySlug()}`,
            orientacion: 'landscape',
          }),
        },
        {
          label: 'Detalle por proveedor — Excel',
          onClick: () => exportToExcel({
            data: buildCalificacionesDetalle(items),
            columns: CALIFICACIONES_DETALLE_COLUMNS,
            sheetName: 'Detalle por proveedor',
            filename: `calificaciones-detalle-${hoySlug()}`,
          }),
        },
      ]}
    />
  );
}
