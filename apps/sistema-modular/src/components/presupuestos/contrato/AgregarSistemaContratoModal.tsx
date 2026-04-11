import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { SearchableSelect } from '../../ui/SearchableSelect';
import { tiposEquipoService } from '../../../services/tiposEquipoService';
import type { PresupuestoItem, Sistema, ModuloSistema, TipoEquipoPlantilla } from '@ags/shared';
import { buildItemsFromPlantilla, findPlantillaForSistema, nextGrupoNumber } from './contratoItemHelpers';

interface Props {
  open: boolean;
  onClose: () => void;
  sistemas: Sistema[];
  loadModulos: (sistemaId: string) => Promise<ModuloSistema[]>;
  existingItems: PresupuestoItem[];
  /** Sectores ya usados en el presupuesto, para autocomplete. */
  sectoresUsados: string[];
  onConfirm: (newItems: PresupuestoItem[]) => void;
}

const labelCls = 'block text-[11px] font-medium text-slate-500 mb-1';

export const AgregarSistemaContratoModal: React.FC<Props> = ({
  open, onClose, sistemas, loadModulos, existingItems, sectoresUsados, onConfirm,
}) => {
  const [plantillas, setPlantillas] = useState<TipoEquipoPlantilla[]>([]);
  const [sistemaId, setSistemaId] = useState('');
  const [plantillaId, setPlantillaId] = useState('');
  const [sector, setSector] = useState('');
  const [modulos, setModulos] = useState<ModuloSistema[]>([]);
  const [preview, setPreview] = useState<PresupuestoItem[]>([]);
  const [loadingPlantillas, setLoadingPlantillas] = useState(false);

  // Load plantillas once when modal opens
  useEffect(() => {
    if (!open) return;
    setLoadingPlantillas(true);
    tiposEquipoService.getAll()
      .then(setPlantillas)
      .catch(err => console.error('Error cargando plantillas:', err))
      .finally(() => setLoadingPlantillas(false));
  }, [open]);

  // Reset when modal closes
  useEffect(() => {
    if (!open) {
      setSistemaId(''); setPlantillaId(''); setSector('');
      setModulos([]); setPreview([]);
    }
  }, [open]);

  const selectedSistema = useMemo(() => sistemas.find(s => s.id === sistemaId) || null, [sistemas, sistemaId]);

  // Auto-populate sector & plantilla when a sistema is picked
  useEffect(() => {
    if (!selectedSistema) return;
    // Sector from sistema if present
    if (selectedSistema.sector && !sector) setSector(selectedSistema.sector);
    // Auto-match plantilla
    const match = findPlantillaForSistema(selectedSistema, plantillas);
    if (match) setPlantillaId(match.id);
    // Load módulos reales
    loadModulos(selectedSistema.id).then(setModulos).catch(() => setModulos([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sistemaId, plantillas]);

  // Build preview whenever inputs change
  useEffect(() => {
    if (!selectedSistema || !plantillaId) { setPreview([]); return; }
    const plantilla = plantillas.find(p => p.id === plantillaId);
    if (!plantilla) { setPreview([]); return; }
    const grupo = nextGrupoNumber(existingItems);
    const items = buildItemsFromPlantilla({
      grupo,
      sector: sector.trim() || null,
      sistema: selectedSistema,
      modulosReales: modulos,
      plantilla,
      moduloPrincipalSerie: modulos[0]?.serie ?? null,
    });
    setPreview(items);
  }, [selectedSistema, plantillaId, sector, modulos, plantillas, existingItems]);

  const handleConfirm = () => {
    if (preview.length === 0) { alert('Seleccione un sistema y una plantilla válida'); return; }
    onConfirm(preview);
    onClose();
  };

  const updatePreviewPrice = (itemId: string, field: 'precioUnitario' | 'cantidad', value: number) => {
    setPreview(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const updated = { ...item, [field]: value };
      if (!updated.esSinCargo) {
        updated.subtotal = (updated.cantidad || 0) * (updated.precioUnitario || 0);
      }
      return updated;
    }));
  };

  if (!open) return null;

  const sectoresOptions = Array.from(new Set([...sectoresUsados, sector].filter(Boolean)));

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl" title="Agregar sistema al contrato"
      subtitle="Seleccione sistema, sector y plantilla. Los items se generan automáticamente."
      footer={<>
        <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
        <Button size="sm" onClick={handleConfirm} disabled={preview.length === 0}>
          Agregar {preview.length > 0 && `(${preview.length} items)`}
        </Button>
      </>}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Sistema *</label>
            <SearchableSelect value={sistemaId} onChange={setSistemaId}
              options={sistemas.map(s => ({
                value: s.id,
                label: `${s.nombre}${s.codigoInternoCliente ? ` — ${s.codigoInternoCliente}` : ''}`,
              }))}
              placeholder="Seleccionar..." />
          </div>
          <div>
            <label className={labelCls}>Sector</label>
            <input type="text" value={sector} onChange={e => setSector(e.target.value)}
              list="sectores-datalist" placeholder="Ej: QC, Control de Calidad"
              className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-teal-400 focus:border-teal-400" />
            <datalist id="sectores-datalist">
              {sectoresOptions.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>
          <div>
            <label className={labelCls}>Plantilla *</label>
            <SearchableSelect value={plantillaId} onChange={setPlantillaId}
              options={plantillas.filter(p => p.activo).map(p => ({ value: p.id, label: p.nombre }))}
              placeholder={loadingPlantillas ? 'Cargando...' : 'Seleccionar...'} />
            {selectedSistema && !plantillaId && plantillas.length > 0 && (
              <p className="text-[10px] text-amber-600 mt-0.5">No se encontró plantilla automática para "{selectedSistema.nombre}".</p>
            )}
          </div>
        </div>

        {preview.length > 0 && (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-200">
              <span className="text-[10px] font-mono uppercase tracking-wide text-slate-500">
                Preview · {preview.length} items ({modulos.length > 0 ? 'módulos reales del cliente' : 'componentes de plantilla'})
              </span>
            </div>
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-1 text-left text-[10px] font-mono text-slate-500">#</th>
                    <th className="px-2 py-1 text-left text-[10px] font-mono text-slate-500">Descripción</th>
                    <th className="px-2 py-1 text-right text-[10px] font-mono text-slate-500 w-16">Cant.</th>
                    <th className="px-2 py-1 text-right text-[10px] font-mono text-slate-500 w-24">Precio</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map(item => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-2 py-1 text-slate-400 font-mono text-[10px]">{item.subItem}</td>
                      <td className="px-2 py-1">
                        <div className="text-slate-700">{item.descripcion}</div>
                        {item.servicioCode && <div className="text-[10px] text-slate-400 font-mono">{item.servicioCode}</div>}
                      </td>
                      <td className="px-2 py-1 text-right">
                        {item.esSinCargo ? (
                          <span className="text-[10px] text-slate-400">S/L</span>
                        ) : (
                          <input type="number" min="0" value={item.cantidad}
                            onChange={e => updatePreviewPrice(item.id, 'cantidad', parseFloat(e.target.value) || 0)}
                            className="w-14 border border-slate-200 rounded px-1 py-0.5 text-xs text-right" />
                        )}
                      </td>
                      <td className="px-2 py-1 text-right">
                        {item.esSinCargo ? (
                          <span className="text-[10px] text-slate-400">—</span>
                        ) : (
                          <input type="number" min="0" step="0.01" value={item.precioUnitario || ''}
                            onChange={e => updatePreviewPrice(item.id, 'precioUnitario', parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            className="w-20 border border-slate-200 rounded px-1 py-0.5 text-xs text-right" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
