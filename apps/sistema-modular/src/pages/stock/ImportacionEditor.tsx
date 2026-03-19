import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ordenesCompraService } from '../../services/firebaseService';
import { useImportaciones } from '../../hooks/useImportaciones';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import type { OrdenCompra } from '@ags/shared';
import { useNavigateBack } from '../../hooks/useNavigateBack';

const INCOTERMS = ['FOB', 'CIF', 'EXW', 'FCA', 'DAP'] as const;

export const ImportacionEditor = () => {
  const navigate = useNavigate();
  const goBack = useNavigateBack();
  const { createImportacion } = useImportaciones();
  const [ordenesCompra, setOrdenesCompra] = useState<OrdenCompra[]>([]);
  const [loadingOC, setLoadingOC] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    ordenCompraId: '',
    ordenCompraNumero: '',
    proveedorId: '',
    proveedorNombre: '',
    puertoOrigen: '',
    puertoDestino: '',
    naviera: '',
    incoterm: '',
    notas: '',
  });

  useEffect(() => {
    loadOrdenesCompra();
  }, []);

  const loadOrdenesCompra = async () => {
    try {
      setLoadingOC(true);
      const data = await ordenesCompraService.getAll({ tipo: 'importacion' });
      setOrdenesCompra(data);
    } catch (err) {
      console.error('Error cargando OCs:', err);
    } finally {
      setLoadingOC(false);
    }
  };

  const handleOCChange = (ocId: string) => {
    const oc = ordenesCompra.find(o => o.id === ocId);
    if (oc) {
      setForm(prev => ({
        ...prev,
        ordenCompraId: oc.id,
        ordenCompraNumero: oc.numero,
        proveedorId: oc.proveedorId,
        proveedorNombre: oc.proveedorNombre,
      }));
    } else {
      setForm(prev => ({
        ...prev,
        ordenCompraId: '',
        ordenCompraNumero: '',
        proveedorId: '',
        proveedorNombre: '',
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.ordenCompraId) { alert('Selecciona una orden de compra'); return; }
    try {
      setSaving(true);
      const id = await createImportacion({
        estado: 'preparacion',
        ordenCompraId: form.ordenCompraId,
        ordenCompraNumero: form.ordenCompraNumero,
        proveedorId: form.proveedorId,
        proveedorNombre: form.proveedorNombre,
        puertoOrigen: form.puertoOrigen || null,
        puertoDestino: form.puertoDestino || null,
        naviera: form.naviera || null,
        incoterm: form.incoterm || null,
        notas: form.notas || null,
        gastos: [],
        documentos: [],
      });
      navigate(`/stock/importaciones/${id}`);
    } catch (err) {
      alert('Error al crear la importacion');
    } finally {
      setSaving(false);
    }
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <PageHeader
        title="Nueva importacion"
        subtitle="Crear operacion de comercio exterior"
        actions={
          <Button variant="ghost" size="sm" onClick={() => goBack()}>
            Cancelar
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-5">
        <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
          <Card title="Orden de compra vinculada" compact>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Orden de compra (tipo importacion)</label>
                <select
                  value={form.ordenCompraId}
                  onChange={e => handleOCChange(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={loadingOC}
                >
                  <option value="">{loadingOC ? 'Cargando...' : 'Seleccionar OC'}</option>
                  {ordenesCompra.map(oc => (
                    <option key={oc.id} value={oc.id}>
                      {oc.numero} - {oc.proveedorNombre}
                    </option>
                  ))}
                </select>
              </div>
              {form.proveedorNombre && (
                <div>
                  <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Proveedor</label>
                  <p className="text-xs text-slate-700">{form.proveedorNombre}</p>
                </div>
              )}
            </div>
          </Card>

          <Card title="Datos de embarque" compact>
            <div className="grid grid-cols-2 gap-3">
              <Input inputSize="sm" label="Puerto de origen" value={form.puertoOrigen} onChange={set('puertoOrigen')} placeholder="Ej: Shanghai, China" />
              <Input inputSize="sm" label="Puerto de destino" value={form.puertoDestino} onChange={set('puertoDestino')} placeholder="Ej: Buenos Aires" />
              <Input inputSize="sm" label="Naviera" value={form.naviera} onChange={set('naviera')} placeholder="Ej: Maersk" />
              <div>
                <label className="text-[11px] font-medium text-slate-700 mb-1 block">Incoterm</label>
                <select
                  value={form.incoterm}
                  onChange={set('incoterm')}
                  className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Seleccionar</option>
                  {INCOTERMS.map(i => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          <Card title="Notas" compact>
            <textarea
              value={form.notas}
              onChange={set('notas')}
              rows={3}
              className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder="Notas adicionales..."
            />
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" type="button" onClick={() => goBack()}>
              Cancelar
            </Button>
            <Button size="sm" type="submit" disabled={saving || !form.ordenCompraId}>
              {saving ? 'Creando...' : 'Crear importacion'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
