import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Certificacion, EstadoOTCertificacion } from '@ags/shared';
import {
  ESTADO_CERTIFICACION_LABELS, ESTADO_OT_CERTIFICACION_LABELS, itemsDeCertificacion,
} from '@ags/shared';
import { AgregarRecibidaModal } from './AgregarRecibidaModal';
import { CertificacionRecibidasBlock } from './CertificacionRecibidasBlock';
import { abrirPdfCertificacion } from '../../utils/imprimirCertificacion';
import { certificacionesService } from '../../services/certificacionesService';
import { Card } from '../ui/Card';
import { ExportarButton } from '../ui/ExportarButton';
import { CERTIFICACION_EXPORT_COLUMNS } from '../../utils/exports/exportCertificacion';
import { usePrompt } from '../ui/PromptDialog';
import { useAuth } from '../../contexts/AuthContext';

const CHIP: Record<EstadoOTCertificacion, string> = {
  pendiente: 'bg-slate-100 text-slate-600',
  certificada: 'bg-emerald-100 text-emerald-700',
  objetada: 'bg-amber-100 text-amber-800',
  no_facturable: 'bg-red-50 text-red-700 line-through',
};

interface Props {
  /** Se dispara al resolver una OT: la lista de retenidas cambió. */
  onResuelta: () => void;
}

/**
 * Pedidos de certificación con OTs sin resolver (2026-08-17).
 *
 * Cada OT se resuelve por separado — el cliente puede certificar 7 de 8 y
 * objetar una. Certificar libera esa OT a facturación; "no se factura" la saca
 * del circuito con el motivo escrito, que es la salida que faltaba para las OTs
 * que iban a quedar retenidas para siempre.
 */
export function CertificacionesAbiertasSection({ onResuelta }: Props) {
  const promptText = usePrompt();
  const { firebaseUser, usuario } = useAuth();
  const [certs, setCerts] = useState<Certificacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [actuando, setActuando] = useState(false);
  /** lote al que se le está cargando una certificación recibida. */
  const [cargandoRecibida, setCargandoRecibida] = useState<Certificacion | null>(null);

  const load = useCallback(async () => {
    setCargando(true);
    try { setCerts(await certificacionesService.getAbiertas()); }
    catch (err) { console.error('[CertificacionesAbiertas]', err); setCerts([]); }
    finally { setCargando(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const resolver = async (cert: Certificacion, otNumber: string, estado: EstadoOTCertificacion) => {
    if (actuando) return;
    let motivo: string | null = null;
    if (estado !== 'certificada') {
      motivo = await promptText({
        title: estado === 'objetada' ? 'Objetar OT' : 'Marcar como no facturable',
        label: 'Motivo',
        placeholder: estado === 'objetada' ? 'Qué objetó el cliente…' : 'Por qué no se va a cobrar…',
        confirmLabel: 'Guardar',
      });
      if (motivo === null) return;
    }
    let numero: string | null = null;
    if (estado === 'certificada' && !cert.numero) {
      numero = await promptText({
        title: 'Certificación recibida',
        label: 'N° de certificación del cliente (opcional)',
        placeholder: 'Dejar vacío si no tiene',
        confirmLabel: 'Liberar OT',
      });
      if (numero === null) return;
    }
    setActuando(true);
    try {
      await certificacionesService.resolverItem(cert.id, otNumber, estado, {
        motivo, numeroCertificacion: numero || null,
        actor: { uid: firebaseUser?.uid || '', name: usuario?.displayName },
      });
      await load();
      onResuelta();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo resolver');
    } finally { setActuando(false); }
  };

  /**
   * Genera la solicitud de facturación con el importe CERTIFICADO — una por
   * moneda. Lo que se factura es lo que el cliente certificó, no lo que decía
   * el presupuesto.
   */
  const pasarAFacturacion = async (cert: Certificacion) => {
    if (actuando) return;
    setActuando(true);
    try {
      const ids = await certificacionesService.generarSolicitudes(cert.id, {
        uid: firebaseUser?.uid || '', name: usuario?.displayName,
      });
      await load();
      alert(`Se generaron ${ids.length} solicitud(es) de facturación con el importe certificado. El lote sigue acá mientras queden OTs o certificaciones por resolver.`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo pasar a facturación');
    } finally { setActuando(false); }
  };

  const abrirPdf = async (cert: Certificacion) => {
    try { await abrirPdfCertificacion(cert); }
    catch (e) { console.error('[abrirPdfCertificacion]', e); alert('No se pudo generar el PDF'); }
  };

  if (cargando) return null;
  if (certs.length === 0) return null;

  return (
    <Card compact>
      <p className="text-[9px] font-mono font-semibold text-teal-700/70 uppercase tracking-widest mb-3">
        Certificaciones pedidas al cliente ({certs.length})
      </p>
      <div className="space-y-4">
        {certs.map(cert => {
          const items = itemsDeCertificacion(cert);
          const pendientes = items.filter(i => i.estado === 'pendiente').length;
          return (
            <div key={cert.id} className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-slate-800">{cert.clienteNombre || 'Cliente'}</span>
                {cert.periodo && (
                  <span className="text-[10px] font-mono text-slate-500">Período {cert.periodo}</span>
                )}
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">
                  {ESTADO_CERTIFICACION_LABELS[cert.estado ?? 'solicitada']}
                </span>
                <span className="text-[10px] text-slate-400 ml-auto">
                  {pendientes} de {items.length} sin resolver
                </span>
                <button onClick={() => void abrirPdf(cert)}
                  className="text-[10px] font-medium text-teal-700 hover:underline shrink-0">
                  PDF con membrete
                </button>
                <ExportarButton
                  columnas={CERTIFICACION_EXPORT_COLUMNS}
                  data={items}
                  titulo={`Certificación ${cert.clienteNombre || ''}${cert.periodo ? ` — ${cert.periodo}` : ''}`}
                  filename={`certificacion-${cert.periodo || cert.id.slice(0, 6)}`}
                  subtitulo="Servicios ejecutados pendientes de certificación"
                  orientacion="landscape"
                />
                {pendientes > 0 && (
                  <button onClick={() => setCargandoRecibida(cert)}
                    className="text-[10px] font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded px-2 py-1 shrink-0">
                    Cargar certificación
                  </button>
                )}
              </div>
              <CertificacionRecibidasBlock cert={cert} actuando={actuando} onPasarAFacturacion={c => void pasarAFacturacion(c)} />

              <div className="divide-y divide-slate-100">
                {items.map(item => (
                  <div key={item.otNumber} className="px-3 py-1.5 flex items-center gap-2.5">
                    <Link to={`/ordenes-trabajo/${item.otNumber}`}
                      className="font-mono text-[11px] font-semibold text-teal-700 hover:underline shrink-0">
                      {item.otNumber}
                    </Link>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${CHIP[item.estado]}`}>
                      {ESTADO_OT_CERTIFICACION_LABELS[item.estado]}
                    </span>
                    {item.motivo && (
                      <span className="text-[11px] text-slate-500 truncate flex-1" title={item.motivo}>
                        {item.motivo}
                      </span>
                    )}
                    {item.estado !== 'certificada' && item.estado !== 'no_facturable' && (
                      <div className="flex gap-1 shrink-0 ml-auto">
                        <Accion label="Certificada" tono="ok"
                          onClick={() => void resolver(cert, item.otNumber, 'certificada')} disabled={actuando} />
                        {item.estado !== 'objetada' && (
                          <Accion label="Objetar" tono="warn"
                            onClick={() => void resolver(cert, item.otNumber, 'objetada')} disabled={actuando} />
                        )}
                        <Accion label="No se factura" tono="bad"
                          onClick={() => void resolver(cert, item.otNumber, 'no_facturable')} disabled={actuando} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {cargandoRecibida && (
        <AgregarRecibidaModal
          open={!!cargandoRecibida}
          onClose={() => setCargandoRecibida(null)}
          onAgregada={() => { setCargandoRecibida(null); void load(); }}
          loteId={cargandoRecibida.id}
          clienteNombre={cargandoRecibida.clienteNombre || ''}
          periodo={cargandoRecibida.periodo}
          pendientes={itemsDeCertificacion(cargandoRecibida).filter(i => i.estado === 'pendiente')}
        />
      )}
    </Card>
  );
}

const TONOS = {
  ok: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50',
  warn: 'border-amber-200 text-amber-700 hover:bg-amber-50',
  bad: 'border-red-200 text-red-600 hover:bg-red-50',
};

const Accion = ({ label, tono, onClick, disabled }: {
  label: string; tono: keyof typeof TONOS; onClick: () => void; disabled: boolean;
}) => (
  <button onClick={onClick} disabled={disabled}
    className={`px-2 py-0.5 text-[10px] font-medium rounded border transition-colors disabled:opacity-40 ${TONOS[tono]}`}>
    {label}
  </button>
);
