import type { Cliente } from '@ags/shared';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';

interface ClienteInfoSidebarProps {
  cliente: Cliente;
  editing: boolean;
  formData: any;
  setFormData: (data: any) => void;
}

const LabelValue = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-[11px] font-medium text-slate-400 mb-0.5">{label}</p>
    <p className="text-xs text-slate-700">{value || '—'}</p>
  </div>
);

export const ClienteInfoSidebar = ({ cliente, editing, formData, setFormData }: ClienteInfoSidebarProps) => {
  const direccionFiscal = (cliente as any).direccionFiscal ?? (cliente as any).direccion;
  const localidadFiscal = (cliente as any).localidadFiscal ?? (cliente as any).localidad ?? '';
  const provinciaFiscal = (cliente as any).provinciaFiscal ?? (cliente as any).provincia ?? '';
  const cpFiscal = (cliente as any).codigoPostalFiscal ?? (cliente as any).codigoPostal ?? '';

  return (
    <div className="w-72 shrink-0 space-y-4">
      {/* Datos basicos */}
      <Card compact>
        <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-3">Datos basicos</h3>
        {editing ? (
          <div className="space-y-3">
            <Input
              inputSize="sm"
              label="Razon Social *"
              value={formData.razonSocial}
              onChange={(e) => setFormData({ ...formData, razonSocial: e.target.value })}
              required
            />
            <Input
              inputSize="sm"
              label="CUIT"
              value={formData.cuit}
              onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
            />
            <Input
              inputSize="sm"
              label="Pais"
              value={formData.pais}
              onChange={(e) => setFormData({ ...formData, pais: e.target.value })}
            />
            <Input
              inputSize="sm"
              label="Rubro *"
              value={formData.rubro}
              onChange={(e) => setFormData({ ...formData, rubro: e.target.value })}
              required
            />
          </div>
        ) : (
          <div className="space-y-2.5">
            <LabelValue label="Razon Social" value={cliente.razonSocial} />
            <LabelValue label="CUIT" value={cliente.cuit || '—'} />
            <LabelValue label="Pais" value={cliente.pais} />
            <LabelValue label="Rubro" value={cliente.rubro} />
          </div>
        )}
      </Card>

      {/* Domicilio fiscal */}
      <Card compact>
        <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-3">Domicilio fiscal</h3>
        {editing ? (
          <div className="space-y-3">
            <Input
              inputSize="sm"
              label="Direccion"
              value={formData.direccionFiscal ?? ''}
              onChange={(e) => setFormData({ ...formData, direccionFiscal: e.target.value })}
            />
            <Input
              inputSize="sm"
              label="Localidad"
              value={formData.localidadFiscal ?? ''}
              onChange={(e) => setFormData({ ...formData, localidadFiscal: e.target.value })}
            />
            <Input
              inputSize="sm"
              label="Provincia"
              value={formData.provinciaFiscal ?? ''}
              onChange={(e) => setFormData({ ...formData, provinciaFiscal: e.target.value })}
            />
            <Input
              inputSize="sm"
              label="Codigo Postal"
              value={formData.codigoPostalFiscal ?? ''}
              onChange={(e) => setFormData({ ...formData, codigoPostalFiscal: e.target.value })}
            />
          </div>
        ) : (
          <div className="space-y-2.5">
            <LabelValue label="Direccion" value={direccionFiscal || '—'} />
            <LabelValue label="Localidad" value={localidadFiscal || '—'} />
            <LabelValue label="Provincia" value={provinciaFiscal || '—'} />
            <LabelValue label="Codigo Postal" value={cpFiscal || '—'} />
          </div>
        )}
      </Card>

      {/* Fiscal / IVA */}
      <Card compact>
        <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-3">Fiscal / IVA</h3>
        {editing ? (
          <div className="space-y-3">
            {(cliente as any).condicionIva && (
              <LabelValue label="Condicion IVA" value={(cliente as any).condicionIva} />
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData?.requiereTrazabilidad || false}
                onChange={(e) => setFormData({ ...formData, requiereTrazabilidad: e.target.checked })}
                className="w-3.5 h-3.5"
              />
              <span className="text-xs text-slate-600">Requiere Trazabilidad</span>
            </label>
            <p className="text-[11px] text-slate-400 ml-5.5">Los reportes requeriran documentacion de trazabilidad</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {(cliente as any).condicionIva && (
              <LabelValue label="Condicion IVA" value={(cliente as any).condicionIva} />
            )}
            <div>
              <p className="text-[11px] font-medium text-slate-400 mb-0.5">Requiere Trazabilidad</p>
              <p className={`text-xs font-medium ${(cliente as any).requiereTrazabilidad ? 'text-green-600' : 'text-slate-400'}`}>
                {(cliente as any).requiereTrazabilidad ? 'Si' : 'No'}
              </p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
