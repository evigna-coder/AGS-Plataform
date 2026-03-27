import { useState, useEffect } from 'react';
import { articulosService, marcasService, proveedoresService } from '../services/firebaseService';
import type { Marca, Proveedor, CategoriaEquipoStock, TipoArticulo, TratamientoArancelario } from '@ags/shared';

export interface ArticuloFormState {
  codigo: string; descripcion: string; categoriaEquipo: CategoriaEquipoStock;
  marcaId: string; tipo: TipoArticulo; unidadMedida: string; stockMinimo: number;
  precioReferencia: number | null; monedaPrecio: 'ARS' | 'USD'; proveedorIds: string[];
  posicionArancelaria: string; tratamiento: TratamientoArancelario; notas: string; origen: string;
}

export const EMPTY_ARTICULO_FORM: ArticuloFormState = {
  codigo: '', descripcion: '', categoriaEquipo: 'GENERAL', marcaId: '', tipo: 'repuesto',
  unidadMedida: 'unidad', stockMinimo: 0, precioReferencia: null, monedaPrecio: 'USD',
  proveedorIds: [], posicionArancelaria: '', tratamiento: {}, notas: '', origen: '',
};

export const formatPA = (raw: string): string => {
  const c = raw.replace(/[^0-9a-zA-Z]/g, '');
  const p: string[] = [];
  if (c.length > 0) p.push(c.slice(0, 4));
  if (c.length > 4) p.push(c.slice(4, 6));
  if (c.length > 6) p.push(c.slice(6, 8));
  if (c.length > 8) p.push(c.slice(8, 14));
  return p.join('.');
};

export function useEditArticuloForm(open: boolean, articuloId: string | null, onClose: () => void, onSaved: () => void) {
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<ArticuloFormState>(EMPTY_ARTICULO_FORM);
  const [codigoDupWarning, setCodigoDupWarning] = useState('');
  const [comexOpen, setComexOpen] = useState(false);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);

  useEffect(() => {
    if (!open) return;
    marcasService.getAll().then(setMarcas);
    proveedoresService.getAll().then(setProveedores);
  }, [open]);

  useEffect(() => {
    if (!open || !articuloId) { setForm(EMPTY_ARTICULO_FORM); return; }
    setLoading(true);
    articulosService.getById(articuloId).then(art => {
      if (!art) { onClose(); return; }
      setForm({
        codigo: art.codigo, descripcion: art.descripcion, categoriaEquipo: art.categoriaEquipo,
        marcaId: art.marcaId, tipo: art.tipo, unidadMedida: art.unidadMedida,
        stockMinimo: art.stockMinimo, precioReferencia: art.precioReferencia ?? null,
        monedaPrecio: art.monedaPrecio ?? 'USD', proveedorIds: art.proveedorIds ?? [],
        posicionArancelaria: art.posicionArancelaria ?? '',
        tratamiento: art.tratamientoArancelario ?? {}, notas: art.notas ?? '',
        origen: (art as any).origen ?? '',
      });
      if (art.posicionArancelaria) setComexOpen(true);
      setLoading(false);
    });
  }, [open, articuloId]);

  useEffect(() => {
    if (!form.codigo.trim()) { setCodigoDupWarning(''); return; }
    const timer = setTimeout(async () => {
      const existing = await articulosService.getByCodigo(form.codigo.trim());
      setCodigoDupWarning(existing && existing.id !== articuloId
        ? `Ya existe un articulo con codigo "${form.codigo}"` : '');
    }, 500);
    return () => clearTimeout(timer);
  }, [form.codigo, articuloId]);

  const set = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));
  const toggleProveedor = (pid: string) =>
    setForm(prev => ({
      ...prev,
      proveedorIds: prev.proveedorIds.includes(pid)
        ? prev.proveedorIds.filter(p => p !== pid)
        : [...prev.proveedorIds, pid],
    }));
  const updateTratamiento = (key: keyof TratamientoArancelario, val: string) =>
    setForm(prev => ({ ...prev, tratamiento: { ...prev.tratamiento, [key]: val ? Number(val) : null } }));

  const handleClose = () => { onClose(); setForm(EMPTY_ARTICULO_FORM); setCodigoDupWarning(''); setComexOpen(false); };

  const handleSave = async () => {
    if (!form.codigo.trim()) { alert('El codigo es obligatorio'); return; }
    if (!form.descripcion.trim()) { alert('La descripcion es obligatoria'); return; }
    if (codigoDupWarning) { alert(codigoDupWarning); return; }
    if (!articuloId) return;
    setSaving(true);
    try {
      await articulosService.update(articuloId, {
        codigo: form.codigo.trim(), descripcion: form.descripcion.trim(),
        categoriaEquipo: form.categoriaEquipo, marcaId: form.marcaId, tipo: form.tipo,
        unidadMedida: form.unidadMedida, stockMinimo: form.stockMinimo,
        precioReferencia: form.precioReferencia ?? null,
        monedaPrecio: form.precioReferencia && form.precioReferencia > 0 ? form.monedaPrecio : null,
        proveedorIds: form.proveedorIds,
        posicionArancelaria: form.posicionArancelaria.trim() || null,
        tratamientoArancelario: form.posicionArancelaria.trim() ? form.tratamiento : null,
        notas: form.notas.trim() || null, activo: true,
        origen: form.origen.trim() || null,
      });
      handleClose();
      onSaved();
    } catch { alert('Error al guardar el articulo'); }
    finally { setSaving(false); }
  };

  return {
    saving, loading, form, set, codigoDupWarning, comexOpen, setComexOpen,
    marcas, proveedores, toggleProveedor, updateTratamiento,
    handleClose, handleSave,
  };
}
