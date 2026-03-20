import { Button } from '../ui/Button';
import type { AccesorioFicha } from '@ags/shared';

interface Props {
  accesorios: AccesorioFicha[];
  onChange: (accesorios: AccesorioFicha[]) => void;
  readOnly?: boolean;
}

export function FichaAccesoriosSection({ accesorios, onChange, readOnly }: Props) {
  const addAccesorio = () => {
    onChange([...accesorios, { id: crypto.randomUUID(), descripcion: '', cantidad: 1 }]);
  };

  const updateAccesorio = (id: string, field: keyof AccesorioFicha, value: string | number) => {
    onChange(accesorios.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const removeAccesorio = (id: string) => {
    onChange(accesorios.filter(a => a.id !== id));
  };

  if (readOnly && accesorios.length === 0) {
    return <p className="text-sm text-slate-400">Sin accesorios registrados</p>;
  }

  return (
    <div className="space-y-2">
      {accesorios.map(a => (
        <div key={a.id} className="flex items-center gap-3">
          <input
            className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
            value={a.descripcion}
            onChange={e => updateAccesorio(a.id, 'descripcion', e.target.value)}
            placeholder="Descripcion del accesorio"
            disabled={readOnly}
          />
          <input
            type="number"
            className="w-20 border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-center"
            value={a.cantidad}
            onChange={e => updateAccesorio(a.id, 'cantidad', parseInt(e.target.value) || 1)}
            min={1}
            disabled={readOnly}
          />
          {!readOnly && (
            <button className="text-red-400 hover:text-red-600 text-sm" onClick={() => removeAccesorio(a.id)}>
              Quitar
            </button>
          )}
        </div>
      ))}
      {!readOnly && (
        <Button variant="ghost" size="sm" onClick={addAccesorio}>+ Agregar accesorio</Button>
      )}
    </div>
  );
}
