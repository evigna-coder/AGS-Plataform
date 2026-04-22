import { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { facturacionService } from '../../services/facturacionService';
import { useAuth } from '../../contexts/AuthContext';
import type { SolicitudFacturacion } from '@ags/shared';
import { SOLICITUD_FACTURACION_ESTADO_LABELS, SOLICITUD_FACTURACION_ESTADO_COLORS, MONEDA_SIMBOLO } from '@ags/shared';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import { useConfirm } from '../../components/ui/ConfirmDialog';

const lbl = "block text-[10px] font-mono font-medium text-slate-500 mb-1 uppercase tracking-wide";
const inputClass = "w-full border border-[#E5E5E5] rounded-md px-3 py-1.5 text-xs";

export const FacturacionDetail = () => {
  const { id } = useParams<{ id: string }>();
  const goBack = useNavigateBack();
  const confirm = useConfirm();
  const { pathname } = useLocation();
  const { firebaseUser, usuario, hasRole } = useAuth();
  const canAdminAction = hasRole('admin', 'admin_soporte');
  const actor = { uid: firebaseUser?.uid || '', name: usuario?.displayName || undefined };

  const [solicitud, setSolicitud] = useState<SolicitudFacturacion | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Nota del contable (editable for admin/admin_soporte)
  const [notaDraft, setNotaDraft] = useState('');
  const [savingNota, setSavingNota] = useState(false);

  // Form for registering invoice
  const [factura, setFactura] = useState({
    numeroFactura: '',
    fechaFactura: '',
    tipoComprobante: '',
    puntoVenta: '',
    cae: '',
    fechaVencimientoCae: '',
  });
  const [fechaCobro, setFechaCobro] = useState('');

  const reload = async () => {
    if (!id) return;
    const fresh = await facturacionService.getById(id);
    setSolicitud(fresh);
    setNotaDraft(fresh?.observaciones || '');
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    facturacionService.getById(id).then(data => {
      setSolicitud(data);
      if (data) {
        setFactura({
          numeroFactura: data.numeroFactura || '',
          fechaFactura: data.fechaFactura?.split('T')[0] || '',
          tipoComprobante: data.tipoComprobante || '',
          puntoVenta: data.puntoVenta || '',
          cae: data.cae || '',
          fechaVencimientoCae: data.fechaVencimientoCae?.split('T')[0] || '',
        });
        setFechaCobro(data.fechaCobro?.split('T')[0] || '');
        setNotaDraft(data.observaciones || '');
      }
      setLoading(false);
    });
  }, [id]);

  const handleMarcarEnviada = async () => {
    if (!solicitud) return;
    if (!await confirm(`¿Marcar ${solicitud.presupuestoNumero} como enviada al contable?`)) return;
    try {
      setSaving(true);
      await facturacionService.marcarEnviada(solicitud.id, actor);
      await reload();
    } catch { alert('Error al marcar como enviada'); }
    finally { setSaving(false); }
  };

  const handleMarcarFacturada = async () => {
    if (!solicitud) return;
    if (!await confirm(`¿Marcar ${solicitud.presupuestoNumero} como facturada?`)) return;
    try {
      setSaving(true);
      await facturacionService.marcarFacturada(solicitud.id, actor);
      await reload();
    } catch { alert('Error al marcar como facturada'); }
    finally { setSaving(false); }
  };

  const handleSaveNota = async () => {
    if (!solicitud) return;
    setSavingNota(true);
    try {
      await facturacionService.agregarNota(solicitud.id, notaDraft, actor);
      await reload();
    } catch { alert('Error al guardar nota'); }
    finally { setSavingNota(false); }
  };

  const handleRegistrarFactura = async () => {
    if (!id || !factura.numeroFactura || !factura.fechaFactura) {
      alert('Ingrese al menos el numero y fecha de factura');
      return;
    }
    try {
      setSaving(true);
      await facturacionService.registrarFactura(id, {
        ...factura,
        tipoComprobante: factura.tipoComprobante || undefined,
        puntoVenta: factura.puntoVenta || undefined,
        cae: factura.cae || undefined,
        fechaVencimientoCae: factura.fechaVencimientoCae || undefined,
      });
      await reload();
    } catch {
      alert('Error al registrar la factura');
    } finally {
      setSaving(false);
    }
  };

  const handleRegistrarCobro = async () => {
    if (!id || !fechaCobro) { alert('Ingrese la fecha de cobro'); return; }
    try {
      setSaving(true);
      await facturacionService.registrarCobro(id, fechaCobro);
      await reload();
    } catch {
      alert('Error al registrar el cobro');
    } finally {
      setSaving(false);
    }
  };

  const handleAnular = async () => {
    if (!id || !await confirm('¿Anular esta solicitud de facturacion?')) return;
    try {
      setSaving(true);
      await facturacionService.update(id, { estado: 'anulada' });
      await reload();
    } catch {
      alert('Error al anular');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-center text-sm text-slate-400 py-12">Cargando...</p>;
  if (!solicitud) return <p className="text-center text-sm text-red-400 py-12">Solicitud no encontrada</p>;

  const sym = MONEDA_SIMBOLO[solicitud.moneda] || '$';
  const fmtMoney = (n: number) => `${sym} ${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  const fmtDate = (iso: string | null | undefined) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Solicitud de Facturacion</h2>
            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-medium ${SOLICITUD_FACTURACION_ESTADO_COLORS[solicitud.estado]}`}>
              {SOLICITUD_FACTURACION_ESTADO_LABELS[solicitud.estado]}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Presupuesto{' '}
            <Link to={`/presupuestos/${solicitud.presupuestoId}`} state={{ from: pathname }}
              className="text-teal-600 hover:underline font-medium">{solicitud.presupuestoNumero}</Link>
            {' '}— {solicitud.clienteNombre}
          </p>
        </div>
        <Button variant="outline" onClick={() => goBack()}>Volver</Button>
      </div>

      {/* Metadata */}
      <Card>
        <div className="grid grid-cols-4 gap-4">
          <div><p className={lbl}>Fecha solicitud</p><p className="text-xs text-slate-700">{fmtDate(solicitud.createdAt)}</p></div>
          <div><p className={lbl}>Solicitado por</p><p className="text-xs text-slate-700">{solicitud.solicitadoPorNombre || '—'}</p></div>
          <div><p className={lbl}>Condicion de pago</p><p className="text-xs text-slate-700">{solicitud.condicionPago || '—'}</p></div>
          <div><p className={lbl}>Monto total</p><p className="text-sm font-bold text-teal-700">{fmtMoney(solicitud.montoTotal)}</p></div>
        </div>
      </Card>

      {/* Admin quick-actions (Marcar enviada / facturada) */}
      {canAdminAction && (solicitud.estado === 'pendiente' || solicitud.estado === 'enviada') && (
        <Card>
          <p className="text-[9px] font-mono font-semibold text-teal-700/70 uppercase tracking-widest mb-3">Acciones</p>
          <div className="flex gap-2">
            {solicitud.estado === 'pendiente' && (
              <Button variant="primary" size="sm" onClick={handleMarcarEnviada} disabled={saving}>
                {saving ? 'Guardando...' : 'Marcar enviada'}
              </Button>
            )}
            {(solicitud.estado === 'pendiente' || solicitud.estado === 'enviada') && (
              <Button variant="primary" size="sm" onClick={handleMarcarFacturada} disabled={saving}>
                {saving ? 'Guardando...' : 'Marcar facturada'}
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Nota del contable */}
      <Card>
        <p className="text-[9px] font-mono font-semibold text-teal-700/70 uppercase tracking-widest mb-3">Nota del contable</p>
        {canAdminAction ? (
          <>
            <textarea
              value={notaDraft}
              onChange={e => setNotaDraft(e.target.value)}
              rows={3}
              className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-xs"
              placeholder="Observaciones..."
            />
            <div className="flex gap-2 mt-2">
              <Button size="sm" onClick={handleSaveNota}
                disabled={savingNota || notaDraft === (solicitud.observaciones || '')}>
                {savingNota ? 'Guardando...' : 'Guardar nota'}
              </Button>
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-600 whitespace-pre-wrap">{solicitud.observaciones || '—'}</p>
        )}
      </Card>

      {/* Items */}
      <Card>
        <p className="text-[9px] font-mono font-semibold text-teal-700/70 uppercase tracking-widest mb-3">Items a facturar</p>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="py-2 px-2 text-left text-[10px] font-mono text-slate-400 uppercase">Descripcion</th>
              <th className="py-2 px-2 text-center text-[10px] font-mono text-slate-400 uppercase w-28">Cant. facturar</th>
              <th className="py-2 px-2 text-center text-[10px] font-mono text-slate-400 uppercase w-28">Cant. total pres.</th>
              <th className="py-2 px-2 text-right text-[10px] font-mono text-slate-400 uppercase w-24">P. Unit.</th>
              <th className="py-2 px-2 text-right text-[10px] font-mono text-slate-400 uppercase w-28">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {solicitud.items.map(item => (
              <tr key={item.id} className="border-b border-slate-100">
                <td className="py-2 px-2 text-slate-700">{item.descripcion}</td>
                <td className="py-2 px-2 text-center font-medium text-slate-700">{item.cantidad}</td>
                <td className="py-2 px-2 text-center text-slate-400">{item.cantidadTotal}</td>
                <td className="py-2 px-2 text-right text-slate-600">{fmtMoney(item.precioUnitario)}</td>
                <td className="py-2 px-2 text-right font-medium text-slate-700">{fmtMoney(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-300">
              <td colSpan={4} className="py-2 px-2 text-right font-bold text-slate-600 text-[11px] uppercase">Total</td>
              <td className="py-2 px-2 text-right font-bold text-teal-700">{fmtMoney(solicitud.montoTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </Card>

      {/* Register invoice (for pendiente state — detailed AFIP form) */}
      {solicitud.estado === 'pendiente' && (
        <Card>
          <p className="text-[9px] font-mono font-semibold text-teal-700/70 uppercase tracking-widest mb-3">Registrar factura emitida</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={lbl}>Nro Factura *</label>
              <input value={factura.numeroFactura} onChange={e => setFactura(f => ({ ...f, numeroFactura: e.target.value }))} className={inputClass} placeholder="0001-00012345" />
            </div>
            <div>
              <label className={lbl}>Fecha Factura *</label>
              <input type="date" value={factura.fechaFactura} onChange={e => setFactura(f => ({ ...f, fechaFactura: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className={lbl}>Tipo Comprobante</label>
              <select value={factura.tipoComprobante} onChange={e => setFactura(f => ({ ...f, tipoComprobante: e.target.value }))} className={inputClass}>
                <option value="">—</option>
                <option value="FA">Factura A</option>
                <option value="FB">Factura B</option>
                <option value="FC">Factura C</option>
                <option value="NCA">Nota de Crédito A</option>
                <option value="NCB">Nota de Crédito B</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Punto de Venta</label>
              <input value={factura.puntoVenta} onChange={e => setFactura(f => ({ ...f, puntoVenta: e.target.value }))} className={inputClass} placeholder="0001" />
            </div>
            <div>
              <label className={lbl}>CAE</label>
              <input value={factura.cae} onChange={e => setFactura(f => ({ ...f, cae: e.target.value }))} className={inputClass} placeholder="CAE..." />
            </div>
            <div>
              <label className={lbl}>Vto. CAE</label>
              <input type="date" value={factura.fechaVencimientoCae} onChange={e => setFactura(f => ({ ...f, fechaVencimientoCae: e.target.value }))} className={inputClass} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="secondary" size="sm" onClick={handleAnular} disabled={saving}>Anular solicitud</Button>
            <Button variant="primary" size="sm" onClick={handleRegistrarFactura} disabled={saving || !factura.numeroFactura || !factura.fechaFactura}>
              {saving ? 'Guardando...' : 'Registrar factura'}
            </Button>
          </div>
        </Card>
      )}

      {/* Register payment */}
      {solicitud.estado === 'facturada' && (
        <Card>
          <p className="text-[9px] font-mono font-semibold text-teal-700/70 uppercase tracking-widest mb-3">Registrar cobro</p>
          <div className="flex items-end gap-3">
            <div>
              <label className={lbl}>Factura registrada</label>
              <p className="text-xs font-medium text-slate-700">{solicitud.tipoComprobante || ''} {solicitud.numeroFactura} — {fmtDate(solicitud.fechaFactura)}</p>
            </div>
            <div className="w-48">
              <label className={lbl}>Fecha de cobro *</label>
              <input type="date" value={fechaCobro} onChange={e => setFechaCobro(e.target.value)} className={inputClass} />
            </div>
            <Button variant="primary" size="sm" onClick={handleRegistrarCobro} disabled={saving || !fechaCobro}>
              {saving ? 'Guardando...' : 'Registrar cobro'}
            </Button>
          </div>
        </Card>
      )}

      {/* Completed state */}
      {solicitud.estado === 'cobrada' && (
        <Card>
          <div className="flex items-center gap-6">
            <div><p className={lbl}>Factura</p><p className="text-xs font-medium text-slate-700">{solicitud.tipoComprobante} {solicitud.numeroFactura}</p></div>
            <div><p className={lbl}>Fecha factura</p><p className="text-xs text-slate-700">{fmtDate(solicitud.fechaFactura)}</p></div>
            <div><p className={lbl}>Fecha cobro</p><p className="text-xs text-slate-700">{fmtDate(solicitud.fechaCobro)}</p></div>
            {solicitud.cae && <div><p className={lbl}>CAE</p><p className="text-xs text-slate-700">{solicitud.cae}</p></div>}
          </div>
        </Card>
      )}
    </div>
  );
};
