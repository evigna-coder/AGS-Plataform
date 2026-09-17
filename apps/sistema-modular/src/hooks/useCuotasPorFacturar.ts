import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Presupuesto, PresupuestoCuota, PresupuestoCuotaFacturacion, SolicitudFacturacion, MonedaCuota, MonedaPresupuesto } from '@ags/shared';
import { presupuestosService, clientesService } from '../services/firebaseService';
import { facturacionService } from '../services/facturacionService';
import { computeTotalsByCurrency } from '../utils/cuotasFacturacion';
import { cuotasDeContrato, esContratoConCuotas, finDeMes, type EstadoCuotaContrato } from '../utils/cuotasContrato';

export type EstadoCuotaFila = Exclude<EstadoCuotaContrato, 'futura'>;

/**
 * Una fila de "Cuotas por facturar" (2026-09-16): cuota de CONTRATO (una por
 * moneda) o cuota mensual del esquema porcentual. El aviso pasa por acá y la
 * fila sigue pendiente hasta que Contable registra el número de factura.
 */
export interface CuotaFila {
  key: string;
  ppto: Presupuesto;
  clienteNombre: string;
  origen: 'contrato' | 'esquema';
  descripcion: string;
  /** Mes de la cuota (YYYY-MM-01 o fechaPrevista ISO). */
  fecha: string;
  montoTexto: string;
  estado: EstadoCuotaFila;
  solicitud: SolicitudFacturacion | null;
  cuotaContrato?: PresupuestoCuota;
  cuotaEsquema?: PresupuestoCuotaFacturacion;
}

const ESTADO_DE_CUOTA_ESQUEMA: Partial<Record<PresupuestoCuotaFacturacion['estado'], EstadoCuotaFila>> = {
  habilitada: 'por_facturar', solicitada: 'solicitada', facturada: 'facturada', cobrada: 'cobrada',
};

const montoEsquema = (cuota: PresupuestoCuotaFacturacion, ppto: Presupuesto): string => {
  const totals = computeTotalsByCurrency(ppto.items ?? [], ppto.moneda as MonedaPresupuesto);
  return Object.entries(cuota.porcentajePorMoneda ?? {})
    .filter(([, p]) => (p ?? 0) > 0)
    .map(([m, p]) => `${m} ${Math.round(((p as number) / 100) * (totals[m as MonedaCuota] ?? 0)).toLocaleString('es-AR')}`)
    .join(' + ') || '—';
};

const fmtMonto = (moneda: string, monto: number) => `${moneda} ${monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

export function useCuotasPorFacturar(mes: string, verFacturadas: boolean) {
  const [pptos, setPptos] = useState<Presupuesto[]>([]);
  const [nombreById, setNombreById] = useState<Map<string, string>>(new Map());
  const [solicitudesPorPpto, setSolicitudesPorPpto] = useState<Map<string, SolicitudFacturacion[]>>(new Map());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ps, cs] = await Promise.all([presupuestosService.getAll(), clientesService.getAll(false)]);
      setPptos(ps);
      setNombreById(new Map(cs.map(c => [c.id, c.razonSocial])));
      // Solicitudes solo de los pptos que pueden tener filas: contratos con cuotas y esquemas mensuales.
      const relevantes = ps.filter(p => esContratoConCuotas(p) || (p.esquemaFacturacion ?? []).some(c => !!c.fechaPrevista));
      const m = new Map<string, SolicitudFacturacion[]>();
      await Promise.all(relevantes.map(async p => {
        m.set(p.id, await facturacionService.getByPresupuesto(p.id).catch(() => []));
      }));
      setSolicitudesPorPpto(m);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const hasta = finDeMes(mes);

  const filas = useMemo<CuotaFila[]>(() => {
    const out: CuotaFila[] = [];
    const hastaISO = `${hasta}T23:59:59.999Z`;
    for (const p of pptos) {
      const nombre = nombreById.get(p.clienteId) || p.clienteId;
      const sols = solicitudesPorPpto.get(p.id) ?? [];
      for (const r of cuotasDeContrato(p, sols, hasta)) {
        if (r.estado === 'futura') continue;
        out.push({
          key: `c:${p.id}:${r.cuota.numero}:${r.cuota.moneda}`, ppto: p, clienteNombre: nombre, origen: 'contrato',
          descripcion: r.cuota.descripcion || `Cuota ${r.cuota.numero}`, fecha: r.fecha,
          montoTexto: fmtMonto(r.cuota.moneda, r.cuota.monto), estado: r.estado, solicitud: r.solicitud, cuotaContrato: r.cuota,
        });
      }
      for (const c of p.esquemaFacturacion ?? []) {
        if (!c.fechaPrevista || c.fechaPrevista > hastaISO) continue;
        const estado = ESTADO_DE_CUOTA_ESQUEMA[c.estado];
        if (!estado) continue;
        const solicitud = c.solicitudFacturacionId ? (sols.find(s => s.id === c.solicitudFacturacionId) ?? null) : null;
        out.push({
          key: `e:${p.id}:${c.id}`, ppto: p, clienteNombre: nombre, origen: 'esquema',
          descripcion: c.descripcion, fecha: c.fechaPrevista, montoTexto: montoEsquema(c, p), estado, solicitud, cuotaEsquema: c,
        });
      }
    }
    const visibles = verFacturadas ? out : out.filter(f => f.estado === 'por_facturar' || f.estado === 'solicitada');
    visibles.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.clienteNombre.localeCompare(b.clienteNombre) || a.descripcion.localeCompare(b.descripcion));
    return visibles;
  }, [pptos, nombreById, solicitudesPorPpto, hasta, verFacturadas]);

  return { loading, nombreById, filas, reload: load };
}
