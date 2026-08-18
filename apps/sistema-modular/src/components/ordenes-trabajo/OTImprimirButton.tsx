import { useState } from 'react';

interface Props {
  otNumber: string;
  /** `icono` para el listado (solo la impresora), `boton` para el modal. */
  variante?: 'icono' | 'boton';
}

/**
 * Imprime la hoja de la OT: el trabajo A REALIZAR, con la configuracion del
 * sistema y el modulo intervenido destacado (2026-08-14).
 *
 * La hoja acompaña al modulo en el banco de trabajo. No es el reporte tecnico
 * del servicio — ese lo sigue generando `reportes-ot` desde el otro boton.
 */
export function OTImprimirButton({ otNumber, variante = 'icono' }: Props) {
  const [cargando, setCargando] = useState(false);

  const handle = async () => {
    if (cargando) return;
    setCargando(true);
    try {
      const { imprimirOT } = await import('../../utils/imprimirOT');
      await imprimirOT(otNumber);
    } catch (err) {
      console.error('[OTImprimirButton] imprimir fallo:', err);
      alert(err instanceof Error ? err.message : 'No se pudo generar la hoja de la OT');
    } finally {
      setCargando(false);
    }
  };

  const title = 'Imprimir la hoja de la OT (trabajo a realizar + configuracion del equipo)';

  if (variante === 'boton') {
    return (
      <button
        onClick={handle}
        disabled={cargando}
        title={title}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
      >
        <Impresora />
        {cargando ? 'Generando…' : 'Imprimir OT'}
      </button>
    );
  }

  return (
    <button
      onClick={handle}
      disabled={cargando}
      title={title}
      className="text-slate-400 hover:text-teal-700 px-1 py-0.5 rounded hover:bg-teal-50 disabled:opacity-40"
    >
      <Impresora />
    </button>
  );
}

const Impresora = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
  </svg>
);
