import { useState, useMemo } from 'react';
import { presupuestosService } from '../../services/firebaseService';
import { PageHeader } from '../../components/ui/PageHeader';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { GenerarSolicitudCuotaModal } from '../../components/presupuestos/GenerarSolicitudCuotaModal';
import { CuotaFilaRow } from '../../components/facturacion/CuotaFilaRow';
import { MarcarFacturadaExternaModal } from '../../components/facturacion/MarcarFacturadaExternaModal';
import { RegistrarFacturaCuotaModal } from '../../components/facturacion/RegistrarFacturaCuotaModal';
import { ExportarButton } from '../../components/ui/ExportarButton';
import { CUOTAS_POR_FACTURAR_EXPORT_COLUMNS, buildCuotasPorFacturarRows } from '../../utils/exports/exportCuotasPorFacturar';
import { filtrosAplicadosDesc } from '../../utils/exports/filtros';
import { useCuotasPorFacturar, type CuotaFila } from '../../hooks/useCuotasPorFacturar';
import { notify } from '../../utils/notify';

const FILTER_SCHEMA = {
  mes: { type: 'string' as const, default: new Date().toISOString().slice(0, 7) },
  /** Mostrar también facturadas y cobradas (por defecto solo lo pendiente). */
  verFacturadas: { type: 'boolean' as const, default: false },
};

const th = 'text-left text-[11px] font-medium text-slate-400 tracking-wider py-2 px-3 whitespace-nowrap';

/**
 * Cuotas por facturar (2026-09-16, vista compacta): cuotas de CONTRATO (una
 * por moneda) y cuotas mensuales del esquema, hasta el mes elegido. El aviso
 * —a mano o automático del primer día hábil— deja la fila en "Aviso enviado"
 * hasta que Contable registra el número de factura; las facturadas se
 * ocultan por defecto.
 */
export const CuotasPorFacturarPage = () => {
  const { firebaseUser, usuario } = useAuth();
  const confirm = useConfirm();
  const [filters, setFilter] = useUrlFilters(FILTER_SCHEMA);
  const { loading, filas, reload } = useCuotasPorFacturar(filters.mes, filters.verFacturadas);
  const [modalEsquema, setModalEsquema] = useState<CuotaFila | null>(null);
  const [externa, setExterna] = useState<CuotaFila | null>(null);
  const [registrar, setRegistrar] = useState<CuotaFila | null>(null);
  const [ocupada, setOcupada] = useState<string | null>(null);
  const actor = { uid: firebaseUser?.uid || '', name: usuario?.displayName };

  const exportRows = useMemo(() => buildCuotasPorFacturarRows(
    filas.filter(f => f.cuotaEsquema && f.estado === 'por_facturar').map(f => ({ ppto: f.ppto, cuota: f.cuotaEsquema! })),
    new Map(filas.map(f => [f.ppto.clienteId, f.clienteNombre])),
  ), [filas]);

  const generar = async (fila: CuotaFila) => {
    if (fila.cuotaEsquema) { setModalEsquema(fila); return; }
    const c = fila.cuotaContrato!;
    const ok = await confirm(`¿Generar el aviso a facturación de ${fila.descripcion} (${fila.montoTexto}) del contrato ${fila.ppto.numero}?`);
    if (!ok) return;
    setOcupada(fila.key);
    try {
      await presupuestosService.generarAvisoFacturacion(fila.ppto.id, [], {
        monto: c.monto, montoPorMoneda: { [c.moneda]: c.monto }, cuotaNumero: c.numero, cuotaMoneda: c.moneda,
        observaciones: `${fila.descripcion} (${c.moneda}) — contrato ${fila.ppto.numero}.`,
      }, actor);
      notify.success('Aviso a facturación generado.');
      await reload();
    } catch (err) {
      console.error('[CuotasPorFacturar]', err);
      notify.error(err instanceof Error ? err.message : 'No se pudo generar el aviso');
    } finally { setOcupada(null); }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Cuotas por facturar"
        subtitle="Cuotas mensuales hasta el mes elegido — el aviso sale solo el primer día hábil y la fila queda pendiente hasta cargar el N° de factura"
        actions={
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
              <input type="checkbox" checked={filters.verFacturadas} onChange={e => setFilter('verFacturadas', e.target.checked)} className="rounded border-slate-300" />
              Ver facturadas
            </label>
            <ExportarButton
              columnas={CUOTAS_POR_FACTURAR_EXPORT_COLUMNS}
              data={exportRows}
              titulo="Cuotas por Facturar"
              filename="cuotas-por-facturar"
              filtrosAplicados={filtrosAplicadosDesc({ 'Vence hasta': filters.mes })}
            />
            <input type="month" value={filters.mes} onChange={e => setFilter('mes', e.target.value)} className="border rounded-lg px-2 py-1 text-xs border-slate-300 bg-white" />
          </div>
        }
      />
      <div className="flex-1 min-h-0 overflow-auto px-5 pb-4 pt-3">
        {loading ? (
          <p className="text-slate-400 text-sm">Cargando...</p>
        ) : filas.length === 0 ? (
          <p className="text-slate-400 text-sm">No hay cuotas {filters.verFacturadas ? '' : 'pendientes '}hasta ese mes.</p>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <table className="tabla-compacta w-full">
              <thead className="sticky top-0 z-10 bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className={th}>Cliente</th>
                  <th className={th}>Presupuesto</th>
                  <th className={th}>Cuota</th>
                  <th className={th}>Mes</th>
                  <th className={`${th} text-right`}>Monto</th>
                  <th className={th}>Estado</th>
                  <th className={th}>Aviso</th>
                  <th className={th}>N° factura</th>
                  <th className={`${th} text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filas.map(fila => (
                  <CuotaFilaRow key={fila.key} fila={fila} ocupada={ocupada === fila.key}
                    onGenerar={() => void generar(fila)}
                    onFacturadaExterna={() => setExterna(fila)}
                    onRegistrarFactura={() => setRegistrar(fila)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {modalEsquema?.cuotaEsquema && (
        <GenerarSolicitudCuotaModal
          open
          cuota={modalEsquema.cuotaEsquema}
          presupuestoId={modalEsquema.ppto.id}
          itemsForTotals={modalEsquema.ppto.items ?? []}
          pptoMoneda={modalEsquema.ppto.moneda}
          otsListasParaFacturar={modalEsquema.ppto.otsListasParaFacturar ?? []}
          onClose={() => setModalEsquema(null)}
          onGenerated={() => { setModalEsquema(null); void reload(); }}
          actor={actor}
        />
      )}
      {externa?.cuotaContrato && (
        <MarcarFacturadaExternaModal
          ppto={externa.ppto} cuota={externa.cuotaContrato} clienteNombre={externa.clienteNombre} actor={actor}
          onClose={() => setExterna(null)} onDone={() => { setExterna(null); void reload(); }} />
      )}
      {registrar?.solicitud && (
        <RegistrarFacturaCuotaModal
          solicitud={registrar.solicitud}
          titulo={`${registrar.clienteNombre} · ${registrar.ppto.numero} · ${registrar.descripcion} · ${registrar.montoTexto}`}
          onClose={() => setRegistrar(null)} onDone={() => { setRegistrar(null); void reload(); }} />
      )}
    </div>
  );
};
