import { Input } from '../ui/Input';
import type { DatosTransportista } from '../../services/stockService';

interface Props {
  title: string;
  value: DatosTransportista;
  onChange: (next: DatosTransportista) => void;
}

/**
 * Bloque de campos para destinatario o transportista en remitos. Mismo shape
 * en ambos casos — extraído para evitar duplicar la grilla 6× campos.
 */
export function RemitoPartyFields({ title, value, onChange }: Props) {
  const set = <K extends keyof DatosTransportista>(k: K, v: string) =>
    onChange({ ...value, [k]: v });

  return (
    <div>
      <p className="text-[11px] font-mono uppercase tracking-wide text-slate-500 mb-1.5">{title}</p>
      <div className="grid grid-cols-2 gap-2">
        <Input label="Razón social" value={value.razonSocial} onChange={e => set('razonSocial', e.target.value)} />
        <Input label="CUIT" value={value.cuit} onChange={e => set('cuit', e.target.value)} />
        <Input label="Domicilio" value={value.domicilio} onChange={e => set('domicilio', e.target.value)} />
        <Input label="IVA" value={value.iva} onChange={e => set('iva', e.target.value)} />
        <Input label="Localidad" value={value.localidad} onChange={e => set('localidad', e.target.value)} />
        <Input label="Provincia" value={value.provincia} onChange={e => set('provincia', e.target.value)} />
      </div>
    </div>
  );
}
