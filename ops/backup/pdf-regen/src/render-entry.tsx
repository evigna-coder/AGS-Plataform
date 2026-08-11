/**
 * render-entry.tsx — Punto de entrada Node para regenerar el PDF de un presupuesto
 * u orden de compra, reusando los componentes REALES de sistema-modular.
 *
 * La construcción de datos (impuestos, netos/totales por moneda, monto en letras)
 * usa `buildPresupuestoPDFData` — la MISMA función que la app (fuente única, sin
 * copia a mano que driftee). Solo diferencia con la app: usa renderToBuffer (Node)
 * en lugar de pdf().toBlob() (browser), y recibe modulosBySistema desde el dump
 * (sin fetch). Fotos de sub-ítems (tipo 'ventas') no se usan hoy.
 */
import { Buffer } from 'buffer';
if (typeof (globalThis as any).Buffer === 'undefined') (globalThis as any).Buffer = Buffer;

import { renderToBuffer } from '@react-pdf/renderer';
import { PresupuestoPDFEstandar } from '@app/components/presupuestos/pdf/PresupuestoPDFEstandar';
import { PresupuestoPDFContrato } from '@app/components/presupuestos/pdf/PresupuestoPDFContrato';
import { OrdenCompraPDF } from '@app/components/stock/pdf/OrdenCompraPDF';
import { buildPresupuestoPDFData } from '@app/components/presupuestos/pdf/presupuestoPdfData';
import type {
  Presupuesto, Cliente, Establecimiento, ContactoEstablecimiento,
  CondicionPago, CategoriaPresupuesto, ModuloSistema,
  OrdenCompra, Proveedor,
} from '@ags/shared';

export interface RenderParams {
  presupuesto: Presupuesto;
  cliente: Cliente | null;
  establecimiento: Establecimiento | null;
  contacto: ContactoEstablecimiento | null;
  condicionPago: CondicionPago | null;
  categorias: CategoriaPresupuesto[];
  modulosBySistema?: Record<string, ModuloSistema[]>;
}

export async function renderPresupuesto(params: RenderParams): Promise<Buffer> {
  const { presupuesto, cliente, establecimiento, contacto, condicionPago, categorias, modulosBySistema } = params;
  const data = buildPresupuestoPDFData(
    { presupuesto, cliente, establecimiento, contacto, condicionPago, categorias },
    { modulosBySistema },
  );
  const el = presupuesto.tipo === 'contrato'
    ? <PresupuestoPDFContrato data={data} />
    : <PresupuestoPDFEstandar data={data} />;
  return await renderToBuffer(el);
}

/** Regenera el PDF de una orden de compra a proveedor (mismo componente que la app). */
export async function renderOrdenCompra(oc: OrdenCompra, proveedor: Proveedor | null): Promise<Buffer> {
  return await renderToBuffer(<OrdenCompraPDF oc={oc} proveedor={proveedor} />);
}
