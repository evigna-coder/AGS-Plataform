import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useMigracionPatrones, type MigracionPreviewItem } from '../../hooks/useMigracionPatrones';

interface Props {
  open: boolean;
  onClose: () => void;
  onCompleted: () => void;
}

type Stage = 'idle' | 'preview' | 'confirming' | 'executing' | 'done';

export const MigracionPatronesModal: React.FC<Props> = ({ open, onClose, onCompleted }) => {
  const { loading, preview, result, error, progress, generarPreview, ejecutarMigracion, reset } = useMigracionPatrones();
  const [stage, setStage] = useState<Stage>('idle');
  const [desactivarOrigen, setDesactivarOrigen] = useState(true);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) {
      reset();
      setStage('idle');
      setExpandidos(new Set());
    }
  }, [open, reset]);

  const handleGenerarPreview = async () => {
    setStage('preview');
    const res = await generarPreview();
    if (!res || res.length === 0) {
      setStage('done');
    }
  };

  const handleEjecutar = async () => {
    if (!preview) return;
    setStage('executing');
    const res = await ejecutarMigracion(preview, desactivarOrigen);
    setStage('done');
    if (res && res.creados > 0) {
      onCompleted();
    }
  };

  const toggleExpanded = (key: string) => {
    setExpandidos(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const totalLotes = preview?.reduce((sum, g) => sum + g.lotesCount, 0) ?? 0;

  return (
    <Modal open={open} onClose={onClose} title="Migrar patrones desde /instrumentos" maxWidth="lg">
      <div className="space-y-4">
        {/* Estado inicial */}
        {stage === 'idle' && (
          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-800 font-semibold mb-1">¿Qué hace esta migración?</p>
              <ul className="text-[11px] text-blue-700 space-y-1 list-disc list-inside">
                <li>Lee todos los documentos con <code className="bg-blue-100 px-1 rounded">tipo='patron'</code> de <code className="bg-blue-100 px-1 rounded">/instrumentos</code></li>
                <li>Los agrupa por <b>código artículo</b> (campo modelo del instrumento original)</li>
                <li>Crea un documento en <code className="bg-blue-100 px-1 rounded">/patrones</code> por cada grupo, con múltiples entradas en <code className="bg-blue-100 px-1 rounded">lotes[]</code></li>
                <li>Cada lote conserva su código, vencimiento y certificado original</li>
                <li>Opcionalmente desactiva los documentos originales (no los borra)</li>
              </ul>
            </div>
            <Button onClick={handleGenerarPreview} disabled={loading}>
              {loading ? 'Leyendo…' : 'Generar vista previa'}
            </Button>
          </div>
        )}

        {/* Loading preview */}
        {stage === 'preview' && loading && (
          <p className="text-xs text-slate-500 text-center py-6">Leyendo instrumentos…</p>
        )}

        {/* Preview cargado */}
        {preview && preview.length > 0 && stage === 'preview' && !loading && (
          <div className="space-y-3">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-green-800 font-semibold">Vista previa generada</p>
                <p className="text-[11px] text-green-700 mt-0.5">
                  {preview.reduce((sum, g) => sum + g.sourceIds.length, 0)} instrumentos → <b>{preview.length} patrones</b> agrupados ({totalLotes} lotes en total)
                </p>
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg max-h-96 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Código</th>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Descripción</th>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Marca</th>
                    <th className="text-center px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Lotes</th>
                    <th className="px-3 py-2 text-[10px]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.map(g => {
                    const isOpen = expandidos.has(g.key);
                    return (
                      <>
                        <tr key={g.key} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-mono text-slate-700">{g.codigoArticulo || '—'}</td>
                          <td className="px-3 py-2 text-slate-700">{g.descripcion || '—'}</td>
                          <td className="px-3 py-2 text-slate-600">{g.marca || '—'}</td>
                          <td className="px-3 py-2 text-center font-mono text-slate-700">{g.lotesCount}</td>
                          <td className="px-3 py-2 text-right">
                            <button onClick={() => toggleExpanded(g.key)}
                              className="text-[10px] text-teal-600 hover:text-teal-800 font-medium">
                              {isOpen ? 'Ocultar lotes' : 'Ver lotes'}
                            </button>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr>
                            <td colSpan={5} className="bg-slate-50/60 px-6 py-2">
                              <ul className="space-y-1">
                                {g.lotes.map((l, idx) => (
                                  <li key={idx} className="text-[11px] text-slate-600 flex items-center gap-2">
                                    <span className="font-mono">Lote: {l.lote || '(vacío)'}</span>
                                    {l.fechaVencimiento && <span>· Vence: {l.fechaVencimiento}</span>}
                                    {l.certificadoUrl && <span className="text-teal-600">· ✓ cert</span>}
                                  </li>
                                ))}
                              </ul>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input type="checkbox" checked={desactivarOrigen}
                onChange={e => setDesactivarOrigen(e.target.checked)} />
              Desactivar documentos originales en <code className="bg-slate-100 px-1 rounded">/instrumentos</code> tras migrar (recomendado)
            </label>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-[11px] text-amber-800">
                ⚠️ Esta operación escribirá <b>{preview.length} documentos nuevos</b> en <code>/patrones</code>.
                {desactivarOrigen && ' Y marcará activo=false en los originales.'} No es reversible.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={onClose}>Cancelar</Button>
              <Button onClick={handleEjecutar}>Ejecutar migración</Button>
            </div>
          </div>
        )}

        {/* Ejecutando */}
        {stage === 'executing' && progress && (
          <div className="space-y-2 py-6">
            <p className="text-xs text-slate-600 text-center">
              Migrando {progress.current} de {progress.total}…
            </p>
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div className="bg-teal-500 h-2 rounded-full transition-all"
                style={{ width: `${(progress.current / progress.total) * 100}%` }} />
            </div>
          </div>
        )}

        {/* Resultado final */}
        {stage === 'done' && result && (
          <div className="space-y-3">
            <div className={`border rounded-lg p-3 ${result.errores.length === 0 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
              <p className={`text-xs font-semibold ${result.errores.length === 0 ? 'text-green-800' : 'text-amber-800'}`}>
                {result.errores.length === 0 ? '✓ Migración completada' : '⚠ Migración con errores'}
              </p>
              <ul className="text-[11px] text-slate-700 mt-2 space-y-0.5">
                <li>Instrumentos leídos: {result.totalSource}</li>
                <li>Grupos detectados: {result.totalGrupos}</li>
                <li>Patrones creados: {result.creados}</li>
                {result.errores.length > 0 && <li className="text-red-700">Errores: {result.errores.length}</li>}
              </ul>
            </div>
            {result.errores.length > 0 && (
              <div className="border border-red-200 rounded-lg max-h-40 overflow-y-auto p-2 bg-red-50">
                {result.errores.map((e, i) => (
                  <p key={i} className="text-[10px] text-red-700 font-mono">{e.key}: {e.error}</p>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={onClose}>Cerrar</Button>
            </div>
          </div>
        )}

        {/* Preview vacío */}
        {stage === 'done' && !result && preview && preview.length === 0 && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
            <p className="text-xs text-slate-600">No hay instrumentos con <code>tipo='patron'</code> para migrar.</p>
            <Button variant="secondary" onClick={onClose} className="mt-3">Cerrar</Button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}
      </div>
    </Modal>
  );
};
