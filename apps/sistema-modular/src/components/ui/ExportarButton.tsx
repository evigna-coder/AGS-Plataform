import { MenuButton } from './MenuButton';
import { exportToExcel, type ExportColumn } from '../../utils/exportToExcel';
import { exportListadoPDF } from '../../utils/exportListadoPDF';

/**
 * Botón estándar "Exportar ▾" para el header de las listas (2026-08-12):
 * Excel (.xlsx) y PDF desde la MISMA definición de columnas (`ExportColumn<T>`)
 * y el MISMO array filtrado que renderiza la tabla — el archivo refleja
 * exactamente lo que el usuario ve en pantalla.
 */
export interface ExportarButtonProps<T> {
  columnas: ExportColumn<T>[];
  /** El array YA filtrado que muestra la tabla — nunca re-fetchear. */
  data: T[];
  /** Título del PDF y nombre de la hoja Excel. */
  titulo: string;
  /** Slug base del archivo; se le agrega -<yyyymmdd> (ej. "ordenes-trabajo"). */
  filename: string;
  /** Strings legibles de filtros activos — ver filtrosAplicadosDesc. */
  filtrosAplicados?: string[];
  subtitulo?: string;
  orientacion?: 'portrait' | 'landscape';
}

/** yyyymmdd en hora local (no UTC — un export a la noche no debe saltar de día). */
function hoySlug(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

export function ExportarButton<T>({
  columnas, data, titulo, filename, filtrosAplicados, subtitulo, orientacion,
}: ExportarButtonProps<T>) {
  const fname = `${filename}-${hoySlug()}`;
  return (
    <MenuButton
      label="Exportar"
      disabled={data.length === 0}
      title={data.length === 0 ? 'No hay registros para exportar' : 'Exportar los datos filtrados'}
      items={[
        {
          label: 'Excel (.xlsx)',
          onClick: () => exportToExcel({
            data,
            columns: columnas,
            // Nombre de hoja Excel: máx 31 chars, sin \ / ? * [ ] :
            sheetName: titulo.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31).trim() || 'Datos',
            filename: fname,
          }),
        },
        {
          label: 'PDF',
          onClick: () => {
            void exportListadoPDF({
              titulo, subtitulo, filtrosAplicados, columnas, data, filename: fname, orientacion,
            }).catch(err => {
              console.error('[ExportarButton] error generando PDF:', err);
              alert('Error al generar el PDF');
            });
          },
        },
      ]}
    />
  );
}
