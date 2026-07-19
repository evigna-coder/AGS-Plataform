import { useRef, useState } from 'react';
import type { PresupuestoSubItem } from '@ags/shared';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { useSubItemFotos } from './useSubItemFotos';

interface Props {
  subItem: PresupuestoSubItem;
  presupuestoId?: string | null;
  onSave: (patch: { detalleLargo: string | null; fotos: string[] | null }) => void;
  onClose: () => void;
}

const lbl = 'block text-[10px] font-mono font-medium text-slate-500 mb-1 uppercase tracking-wide';

/**
 * Editor del detalle largo de un sub-ítem (Equipos): texto multilínea para la
 * sección "Detalles de Configuración" del PDF + fotos del equipo.
 * Las fotos se pueden PEGAR (Ctrl+V) o elegir con el input de archivo.
 * Textarea plano a propósito: el HTML rich no se traslada bien a @react-pdf.
 */
export const SubItemDetalleModal = ({ subItem, presupuestoId, onSave, onClose }: Props) => {
  const [detalle, setDetalle] = useState(subItem.detalleLargo || '');
  const [fotos, setFotos] = useState<string[]>(subItem.fotos || []);
  const fileRef = useRef<HTMLInputElement>(null);
  const { uploading, uploadFiles, extractPastedImages } = useSubItemFotos(presupuestoId);

  const addFiles = async (files: File[]) => {
    const urls = await uploadFiles(files);
    if (urls.length > 0) setFotos(prev => [...prev, ...urls]);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const images = extractPastedImages(e);
    if (images.length === 0) return;
    e.preventDefault();
    await addFiles(images);
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (fileRef.current) fileRef.current.value = '';
    await addFiles(files);
  };

  const handleGuardar = () => {
    onSave({
      detalleLargo: detalle.trim() ? detalle : null,
      fotos: fotos.length > 0 ? fotos : null,
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Detalle de configuración" maxWidth="lg"
      subtitle={`${subItem.codigo || 'Sub-ítem'} — ${subItem.descripcion || 'sin descripción'}`.slice(0, 80)}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" size="sm" onClick={handleGuardar} disabled={uploading}>
            {uploading ? 'Subiendo fotos...' : 'Guardar detalle'}
          </Button>
        </>
      }>
      <div className="space-y-4" onPaste={handlePaste}>
        <div>
          <label className={lbl}>Detalle largo (Detalles de Configuración del PDF)</label>
          <textarea
            value={detalle}
            onChange={e => setDetalle(e.target.value)}
            rows={10}
            placeholder={'Configuración completa del equipo, qué incluye, qué no incluye...\nLos saltos de línea se respetan en el PDF.'}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none bg-white focus:ring-1 focus:ring-teal-500 font-mono leading-relaxed"
          />
        </div>

        <div>
          <label className={lbl}>Fotos del equipo</label>
          {fotos.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {fotos.map((url, i) => (
                <div key={`${url}-${i}`} className="relative group">
                  <img src={url} alt={`Foto ${i + 1}`}
                    className="w-24 h-24 object-cover rounded-lg border border-slate-200" />
                  <button type="button" title="Quitar foto"
                    onClick={() => setFotos(prev => prev.filter((_, j) => j !== i))}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs leading-none opacity-0 group-hover:opacity-100 transition-opacity">
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
          <div
            tabIndex={0}
            onPaste={handlePaste}
            className="border-2 border-dashed border-slate-200 rounded-lg px-3 py-4 text-center focus:border-teal-400 focus:outline-none">
            <p className="text-[11px] text-slate-400 mb-2">
              Pegá una imagen acá (Ctrl+V) o elegí un archivo — PNG/JPG, máx. 5 MB
            </p>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" multiple
              className="hidden" onChange={handleFileInput} />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? 'Subiendo...' : '+ Elegir archivo'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
