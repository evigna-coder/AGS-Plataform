import { useState, useEffect, useCallback } from 'react';
import { ordenesCompraService, proveedoresService } from '../services/firebaseService';
import { importacionesService } from '../services/importacionesService';
import type { ItemOC, TipoOC, Proveedor, OrdenCompra, Importacion } from '@ags/shared';

type Moneda = 'ARS' | 'USD' | 'EUR';
export interface OCPrefill { proveedorId?: string; proveedorNombre?: string; items?: ItemOC[]; }

/** Lógica de carga/edición/guardado de una OC, extraída de OCEditor para usar en el modal. */
export function useOrdenCompraForm(ocId: string | null, open: boolean, prefill?: OCPrefill) {
  const isEdit = !!ocId;
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [oc, setOc] = useState<OrdenCompra | null>(null);
  const [importaciones, setImportaciones] = useState<Importacion[]>([]);

  const [tipo, setTipo] = useState<TipoOC>('nacional');
  const [proveedorId, setProveedorId] = useState('');
  const [proveedorNombre, setProveedorNombre] = useState('');
  const [moneda, setMoneda] = useState<Moneda>('USD');
  const [proformaNumero, setProformaNumero] = useState('');
  const [fechaProforma, setFechaProforma] = useState('');
  const [condicionesPago, setCondicionesPago] = useState('');
  const [incoterm, setIncoterm] = useState('');
  const [fechaEntregaEstimada, setFechaEntregaEstimada] = useState('');
  const [notas, setNotas] = useState('');
  const [items, setItems] = useState<ItemOC[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const provData = await proveedoresService.getAll();
      setProveedores(provData);
      if (ocId) {
        const data = await ordenesCompraService.getById(ocId);
        if (data) {
          setOc(data);
          setTipo(data.tipo); setProveedorId(data.proveedorId); setProveedorNombre(data.proveedorNombre);
          setMoneda(data.moneda); setProformaNumero(data.proformaNumero || '');
          setFechaProforma(data.fechaProforma ? data.fechaProforma.split('T')[0] : '');
          setCondicionesPago(data.condicionesPago || '');
          setIncoterm(data.incoterm || '');
          setFechaEntregaEstimada(data.fechaEntregaEstimada ? data.fechaEntregaEstimada.split('T')[0] : '');
          setNotas(data.notas || ''); setItems(data.items || []);
          if (data.tipo === 'importacion') {
            importacionesService.getAll({ ordenCompraId: data.id }).then(setImportaciones).catch(() => {});
          }
        }
      } else {
        setOc(null); setTipo('nacional'); setProveedorId(''); setProveedorNombre('');
        setMoneda('USD'); setProformaNumero(''); setFechaProforma(''); setCondicionesPago(''); setIncoterm('');
        setFechaEntregaEstimada(''); setNotas(''); setItems([]); setImportaciones([]);
        if (prefill) {
          if (prefill.proveedorId) {
            const prov = provData.find(p => p.id === prefill.proveedorId);
            setProveedorId(prefill.proveedorId);
            setProveedorNombre(prov?.nombre ?? prefill.proveedorNombre ?? '');
            // Derivar tipo/moneda del proveedor también en el prefill (UAT 2026-07-16:
            // proveedor internacional prefilleado quedaba como OC nacional).
            if (prov) {
              setTipo(prov.tipo === 'internacional' ? 'importacion' : 'nacional');
              if (prov.moneda) setMoneda(prov.moneda);
              else if (prov.tipo === 'internacional') setMoneda('USD');
            }
          }
          if (prefill.items?.length) setItems(prefill.items);
        }
      }
    } catch (err) {
      console.error('Error cargando OC:', err);
    } finally {
      setLoading(false);
    }
  }, [ocId, prefill]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const handleProveedorChange = (provId: string) => {
    const prov = proveedores.find(p => p.id === provId);
    setProveedorId(provId);
    setProveedorNombre(prov?.nombre || '');
    if (prov) {
      // El tipo de OC se deriva del proveedor (no es seleccionable).
      setTipo(prov.tipo === 'internacional' ? 'importacion' : 'nacional');
      // Traer la moneda declarada en el proveedor (si tiene).
      if (prov.moneda) setMoneda(prov.moneda);
    }
  };
  const addItem = () => setItems(prev => [...prev, {
    id: crypto.randomUUID(), descripcion: '', cantidad: 1, cantidadRecibida: 0,
    unidadMedida: 'unidad', precioUnitario: null, moneda: null, notas: null,
    // IVA 21% por defecto en OC nacional; sin IVA en importación.
    porcentajeIva: tipo === 'nacional' ? 21 : null,
    articuloId: null, articuloCodigo: null, requerimientoId: null,
  }]);
  // Agrega un item con datos ya cargados (desde el wizard de artículo→cantidad→valor).
  const pushItem = (partial: Partial<ItemOC>) => setItems(prev => [...prev, {
    id: crypto.randomUUID(), descripcion: '', cantidad: 1, cantidadRecibida: 0,
    unidadMedida: 'unidad', precioUnitario: null, moneda: null, notas: null,
    porcentajeIva: tipo === 'nacional' ? 21 : null,
    articuloId: null, articuloCodigo: null, requerimientoId: null,
    ...partial,
  }]);
  const updateItem = (itemId: string, field: keyof ItemOC, value: unknown) =>
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, [field]: value } : i));
  const removeItem = (itemId: string) => setItems(prev => prev.filter(i => i.id !== itemId));

  const calcSubtotal = () => items.reduce((s, i) => s + i.cantidad * (i.precioUnitario || 0), 0);
  const calcIva = () => tipo !== 'nacional' ? 0
    : items.reduce((s, i) => s + i.cantidad * (i.precioUnitario || 0) * ((i.porcentajeIva ?? 21) / 100), 0);
  const calcTotal = () => calcSubtotal() + calcIva();

  const save = useCallback(async (): Promise<string | null> => {
    if (!proveedorId) { alert('Seleccione un proveedor'); return null; }
    if (items.length === 0) { alert('Agregue al menos un item'); return null; }
    setSaving(true);
    try {
      const esNacional = tipo === 'nacional';
      const subtotal = items.reduce((s, i) => s + i.cantidad * (i.precioUnitario || 0), 0);
      const impuestos = esNacional
        ? items.reduce((s, i) => s + i.cantidad * (i.precioUnitario || 0) * ((i.porcentajeIva ?? 21) / 100), 0)
        : 0;
      const total = subtotal + impuestos;
      // Normalizar IVA según tipo: importación sin IVA, nacional 21% si faltaba.
      const itemsNorm = items.map(i => ({ ...i, porcentajeIva: esNacional ? (i.porcentajeIva ?? 21) : null }));
      const payload = {
        tipo, proveedorId, proveedorNombre, moneda, items: itemsNorm,
        // Preservar el estado al editar (no volver a borrador una OC ya enviada/embarcada).
        subtotal, impuestos, total, estado: oc?.estado ?? 'borrador',
        proformaNumero: proformaNumero || null, fechaProforma: fechaProforma || null,
        condicionesPago: condicionesPago || null, incoterm: incoterm || null, fechaEntregaEstimada: fechaEntregaEstimada || null,
        notas: notas || null, proformaUrl: null, proformaNombre: null,
        // Preservar vínculos a presupuestos al editar (OCEditor los borraba).
        presupuestoIds: oc?.presupuestoIds ?? [], fechaRecepcion: null, importacionId: null,
        archivoUrl: null, archivoNombre: null,
      };
      if (isEdit && ocId) { await ordenesCompraService.update(ocId, payload); return ocId; }
      return await ordenesCompraService.create(payload);
    } catch (err) {
      console.error('Error guardando OC:', err);
      alert('Error al guardar la orden de compra');
      return null;
    } finally {
      setSaving(false);
    }
  }, [tipo, proveedorId, proveedorNombre, moneda, items, proformaNumero, fechaProforma,
      condicionesPago, incoterm, fechaEntregaEstimada, notas, oc, ocId, isEdit]);

  return {
    loading, saving, proveedores, oc, importaciones,
    tipo, setTipo, proveedorId, handleProveedorChange, moneda, setMoneda,
    proformaNumero, setProformaNumero, fechaProforma, setFechaProforma,
    condicionesPago, setCondicionesPago, incoterm, setIncoterm, fechaEntregaEstimada, setFechaEntregaEstimada,
    notas, setNotas, items, addItem, pushItem, updateItem, removeItem, calcTotal,
    save, reload: load,
  };
}
