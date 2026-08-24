import React, { useState } from 'react';
import type { EntregaRow } from '../../utils/entregasResolver';
import { abrirPresupuestoPdf } from '../../utils/abrirPresupuestoPdf';
import { ordenesCompraService } from '../../services/firebaseService';
import { proveedoresService } from '../../services/personalService';
import { previewOrdenCompraPDF } from '../../components/stock/pdf/generateOrdenCompraPDF';

/**
 * Los papeles de la fila de entregas, abiertos sin salir de la pantalla
 * (2026-08-24).
 *
 * Antes el número de presupuesto era un link que NAVEGABA al presupuesto: para
 * chequear qué se había cotizado había que irse del visor y volver, perdiendo
 * filtros y scroll. Ahora abre el PDF —que es lo que se compara contra la
 * entrega— y el visor queda donde estaba.
 *
 * Se agrega al lado la OC del CLIENTE, que es el respaldo del pedido y hasta
 * ahora solo se podía ver desde el presupuesto o desde facturación.
 */

/** Abre una URL guardada en Storage: Electron → visor del sistema; browser → pestaña. */
const abrirUrl = (url: string) => {
  const api = (window as any).electronAPI;
  if (api?.openExternal) api.openExternal(url);
  else if (api?.openWindow) api.openWindow(url);
  else window.open(url, '_blank', 'noopener');
};

const linkCls = 'text-teal-700 hover:underline disabled:opacity-50 inline-flex items-center gap-1';

/** Columna "Presupuesto": el número abre su PDF, debajo la OC del cliente. */
export const EntregaPresupuestoCell: React.FC<{ row: EntregaRow }> = ({ row }) => {
  const [generando, setGenerando] = useState(false);

  const verPresupuesto = async () => {
    setGenerando(true);
    try {
      await abrirPresupuestoPdf(row.presupuestoId);
    } catch (err) {
      console.error('[EntregaPresupuestoCell] error abriendo PDF del presupuesto', err);
      alert('No se pudo generar el PDF del presupuesto.');
    } finally {
      setGenerando(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void verPresupuesto()}
        disabled={generando}
        title="Abrir el PDF del presupuesto"
        className={`${linkCls} font-mono`}
      >
        {row.presupuestoNumero}
        <span className="text-[9px]">{generando ? '…' : '↗'}</span>
      </button>
      <OCClienteLink oc={row.ocCliente} />
    </>
  );
};

/** OC del cliente. Sin archivo se muestra apagada: el número es dato igual. */
const OCClienteLink: React.FC<{ oc: EntregaRow['ocCliente'] }> = ({ oc }) => {
  if (!oc) return null;
  if (!oc.url) {
    return (
      <div className="text-[9px] font-mono text-slate-400 mt-0.5" title="El número está cargado pero no hay archivo adjunto">
        OC {oc.numero}
      </div>
    );
  }
  return (
    <div className="mt-0.5">
      <button
        type="button"
        onClick={() => abrirUrl(oc.url!)}
        title={oc.nombre ? `Abrir ${oc.nombre}` : 'Abrir la orden de compra del cliente'}
        className="text-[9px] font-mono text-teal-600 hover:underline inline-flex items-center gap-0.5"
      >
        OC {oc.numero}
        <span>↗</span>
      </button>
    </div>
  );
};

/**
 * Columna "OC prov.": la orden de compra que AGS le emitió al proveedor. Su PDF
 * se genera al vuelo, igual que el del presupuesto.
 */
export const EntregaOCProveedorCell: React.FC<{ row: EntregaRow; bold?: boolean }> = ({ row, bold }) => {
  const [loading, setLoading] = useState(false);

  if (!row.ocNumero) return <span className="text-slate-300">—</span>;
  if (!row.ocId) return <span className="text-slate-600">{row.ocNumero}</span>;

  const abrir = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      const oc = await ordenesCompraService.getById(row.ocId!);
      if (!oc) { alert('No se encontró la orden de compra.'); return; }
      const prov = await proveedoresService.getById(oc.proveedorId).catch(() => null);
      await previewOrdenCompraPDF(oc, prov);
    } catch (err) {
      console.error('[EntregaOCProveedorCell] error abriendo PDF de OC', err);
      alert('No se pudo abrir el PDF de la orden de compra.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={(e) => void abrir(e)}
      disabled={loading}
      title="Abrir PDF de la orden de compra al proveedor"
      className={`${linkCls} ${bold ? 'font-semibold' : ''}`}
    >
      {row.ocNumero}
      <span className="text-[9px]">{loading ? '…' : '↗'}</span>
    </button>
  );
};
