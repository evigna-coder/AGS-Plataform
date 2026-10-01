import { useState, useEffect, useRef } from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useTableCatalog } from '../../hooks/useTableCatalog';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { TableEditor } from '../../components/protocol-catalog/TableEditor';
import { TablePreview } from '../../components/protocol-catalog/TablePreview';
import { ChecklistEditor } from '../../components/protocol-catalog/ChecklistEditor';
import { EditorCoverageFields } from '../../components/protocol-catalog/EditorCoverageFields';
import { ProjectPicker } from '../../components/protocol-catalog/ProjectPicker';
import { useCoverageCatalog } from '../../hooks/useCoverageCatalog';
import { validateForPublish } from '../../utils/tableCatalogValidation';
import { SYS_TYPES } from '../../utils/tableCatalogConstants';
import { RichTextEditor } from '../../components/ui/RichTextEditor';
import { categoriasEquipoService } from '../../services/firebaseService';
import { useTableProjects } from '../../hooks/useTableProjects';
import type { TableCatalogEntry, CategoriaEquipo } from '@ags/shared';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import { useConfirm } from '../../components/ui/ConfirmDialog';

import { Select } from '../../components/ui/Select';
function emptyEntry(): TableCatalogEntry {
  return {
    id: '',
    name: '',
    description: null,
    sysType: '',
    isDefault: false,
    tableType: 'informational',
    columns: [],
    templateRows: [],
    validationRules: [],
    checklistItems: [],
    textContent: null,
    tipoServicio: [],
    modelos: [],
    orden: 0,
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'admin',
  };
}

export const TableCatalogEditorPage = () => {
  const { tableId } = useParams<{ tableId: string }>();
  const goBack = useNavigateBack();
  const confirm = useConfirm();
  const { getTable, saveDraft, saveKeepingStatus, publishTable, loading } = useTableCatalog();
  const { projects } = useTableProjects();
  const { servicios } = useCoverageCatalog();
  const [searchParams] = useSearchParams();
  // Referencia calculada por la lista (proyectos que nunca guardaron modelos/servicios propios).
  const heredar = (useLocation().state as { heredar?: { modelos: string[]; tipoServicio: string[] } } | null)?.heredar;

  const [entry, setEntry] = useState<TableCatalogEntry>(emptyEntry());
  const [categorias, setCategorias] = useState<CategoriaEquipo[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const dataLoaded = useRef(false);
  const project = projects.find(p => p.id === entry.projectId) ?? null;

  // Tabla nueva creada desde un proyecto (?projectId=): nace en ese proyecto con sus
  // modelos y servicios, para no arrancar con discrepancias.
  const herencia = useRef(false);
  useEffect(() => {
    const pid = searchParams.get('projectId');
    if (tableId || !pid || herencia.current || projects.length === 0) return;
    const p = projects.find(x => x.id === pid);
    if (!p) return;
    herencia.current = true;
    setEntry(prev => ({
      ...prev, projectId: p.id,
      sysType: prev.sysType || p.sysType || searchParams.get('sysType') || '',
      orden: prev.orden || Number(searchParams.get('orden')) || 0,
      modelos: prev.modelos?.length ? prev.modelos : [...(p.modelos?.length ? p.modelos : heredar?.modelos ?? [])],
      tipoServicio: prev.tipoServicio?.length ? prev.tipoServicio : [...(p.tipoServicio?.length ? p.tipoServicio : heredar?.tipoServicio ?? [])],
    }));
  }, [tableId, projects, searchParams, heredar]);

  useEffect(() => {
    // Reset cuando cambia tableId (ej. al clonar y navegar a la nueva tabla)
    dataLoaded.current = false;
  }, [tableId]);

  useEffect(() => {
    if (dataLoaded.current) return;
    let cancelled = false;
    if (tableId) {
      getTable(tableId).then(data => {
        if (!cancelled && data) {
          setEntry(data);
          dataLoaded.current = true;
        }
      });
    } else {
      dataLoaded.current = true;
    }
    categoriasEquipoService.getAll().then(cats => { if (!cancelled) setCategorias(cats); });
    return () => { cancelled = true; };
  }, [tableId]);

  // Auto-dismiss status messages
  useEffect(() => {
    if (!statusMsg) return;
    const t = setTimeout(() => setStatusMsg(null), 3500);
    return () => clearTimeout(t);
  }, [statusMsg]);

  const setMeta = (key: keyof TableCatalogEntry, value: any) =>
    setEntry(prev => ({ ...prev, [key]: value }));

  /** Devuelve si guardó (revisión 2026-10-01: "Pasar a borrador" lo necesita). */
  const handleSaveDraft = async (): Promise<boolean> => {
    if (saving) return false;
    setSaving(true);
    try {
      const id = await saveDraft(entry);
      if (!entry.id && id) {
        setEntry(prev => ({ ...prev, id }));
        // Actualizar URL sin remontar el componente (evita refetch y pérdida de foco)
        window.history.replaceState(null, '', `/table-catalog/${id}/edit`);
      }
      setStatusMsg({ type: 'success', text: 'Borrador guardado' });
      return true;
    } catch {
      setStatusMsg({ type: 'error', text: 'Error al guardar' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  /** Tabla ya publicada: guarda los cambios y la deja publicada (antes "guardar" la despublicaba). */
  const handleSavePublished = async () => {
    const errors = validateForPublish(entry);
    if (errors.length) {
      setValidationErrors(errors);
      if (!await confirm(`Hay ${errors.length} advertencia(s).\n\n${errors.join('\n')}\n\n¿Guardar igual? La tabla sigue publicada.`)) return;
    }
    if (saving) return;
    setSaving(true);
    try {
      await saveKeepingStatus(entry);
      setValidationErrors([]);
      setStatusMsg({ type: 'success', text: 'Cambios guardados · sigue publicada' });
    } catch {
      setStatusMsg({ type: 'error', text: 'Error al guardar' });
    } finally { setSaving(false); }
  };

  const handleToDraft = async () => {
    if (!await confirm('¿Pasar la tabla a borrador?\n\nDeja de ofrecerse en las OT hasta que se vuelva a publicar.')) return;
    // Antes marcaba "Borrador" aunque la escritura fallara: la tabla seguía
    // publicada en Firestore y ofreciéndose en las OT.
    if (await handleSaveDraft()) setEntry(prev => ({ ...prev, status: 'draft' }));
  };

  const handlePublish = async () => {
    const errors = validateForPublish(entry);
    if (errors.length) {
      setValidationErrors(errors);
      if (!await confirm(`Hay ${errors.length} advertencia(s).\n\n${errors.join('\n')}\n\n¿Publicar de todas formas?`)) return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const id = await saveDraft(entry);
      const targetId = entry.id || id;
      if (targetId) await publishTable(targetId);
      setEntry(prev => ({ ...prev, id: targetId, status: 'published' }));
      setValidationErrors([]);
      setStatusMsg({ type: 'success', text: 'Tabla publicada' });
    } catch {
      setStatusMsg({ type: 'error', text: 'Error al publicar' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* ─── Header sticky ───────────────────────────────────────────────── */}
      <div className="shrink-0 px-5 pt-4 pb-3 bg-white border-b border-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.06)] z-10">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 tracking-tight">
              {tableId ? 'Editar Tabla' : 'Nueva Tabla'}
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              Estado:{' '}
              {entry.status === 'draft' ? 'Borrador' :
               entry.status === 'published' ? '✅ Publicado' : 'Archivado'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {statusMsg && (
              <span className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-opacity ${
                statusMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                {statusMsg.text}
              </span>
            )}
            <Button variant="outline" onClick={() => goBack()}>← Volver</Button>
            {entry.status === 'published' ? (<>
              <Button variant="secondary" onClick={handleToDraft} disabled={saving || loading}>Pasar a borrador</Button>
              <Button onClick={handleSavePublished} disabled={saving || loading} estado={saving ? 'guardando' : 'idle'}>Guardar cambios</Button>
            </>) : (<>
              <Button variant="secondary" onClick={handleSaveDraft} disabled={saving || loading} estado={saving ? 'guardando' : 'idle'}>Guardar borrador</Button>
              <Button onClick={handlePublish} disabled={saving || loading}>Publicar</Button>
            </>)}
          </div>
        </div>
      </div>

      {/* ─── Contenido scrollable ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">
      {/* Validation warnings */}
      {validationErrors.length > 0 && (
        <Card className="border-yellow-300 bg-yellow-50">
          <h4 className="text-xs font-semibold text-yellow-800 tracking-wider uppercase mb-2">Advertencias de publicación</h4>
          <ul className="text-xs text-yellow-700 space-y-1 list-disc list-inside">
            {validationErrors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </Card>
      )}

      {/* Two-panel layout */}
      <div className="grid grid-cols-3 gap-6 items-start">
        {/* Metadata panel — sticky dentro del scroll container */}
        <div>
        <Card>
          <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-4">Metadatos</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
              <Input value={entry.name} onChange={e => setMeta('name', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
              <textarea
                value={entry.description ?? ''}
                onChange={e => setMeta('description', e.target.value || null)}
                rows={3}
                placeholder="Objetivo / línea secundaria. Enter o Shift+Enter para escribir en el renglón de abajo."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-y whitespace-pre-wrap focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Proyecto</label>
              <ProjectPicker projects={projects} value={entry.projectId ?? null} onChange={pid => setMeta('projectId', pid)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de sistema *</label>
              <Select value={entry.sysType} onChange={e => setMeta('sysType', e.target.value)}
                className="w-full" selectSize="md">
                <option value="">Seleccionar...</option>
                {SYS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de tabla</label>
              <Select value={entry.tableType} onChange={e => setMeta('tableType', e.target.value as TableCatalogEntry['tableType'])}
                className="w-full" selectSize="md">
                <option value="informational">Informacional</option>
                <option value="validation">Validación</option>
                <option value="instruments">Instrumentos</option>
                <option value="checklist">Checklist</option>
                <option value="text">Texto</option>
                <option value="signatures">Firmas</option>
                <option value="cover">Carátula</option>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer flex-1">
                <input type="checkbox" checked={entry.isDefault}
                  onChange={e => setMeta('isDefault', e.target.checked)} />
                Tabla por defecto para este sysType
              </label>
              <div className="w-20">
                <label className="block text-xs font-medium text-slate-600 mb-1">Orden</label>
                <input
                  type="number"
                  min={0}
                  value={entry.orden ?? 0}
                  onChange={e => setMeta('orden', parseInt(e.target.value) || 0)}
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-center"
                  title="Posición en el protocolo (menor = primero)"
                />
              </div>
              </div>
              <div className="space-y-1.5 pt-1">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={entry.showTitle !== false}
                    onChange={e => setMeta('showTitle', e.target.checked)} />
                  Mostrar título en protocolo
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={entry.attachToPrevious ?? false}
                    onChange={e => setMeta('attachToPrevious', e.target.checked)} />
                  Vincular con tabla anterior
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={entry.attachToNext ?? false}
                    onChange={e => setMeta('attachToNext', e.target.checked)} />
                  Vincular con tabla siguiente
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={entry.duplicableEnProtocolo ?? false}
                    onChange={e => setMeta('duplicableEnProtocolo', e.target.checked)} />
                  Duplicable en protocolo
                </label>
              </div>
              {!['checklist', 'text', 'signatures', 'cover'].includes(entry.tableType) && (
                <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={entry.allowExtraRows ?? false}
                    onChange={e => setMeta('allowExtraRows', e.target.checked)} />
                  Permitir agregar filas extra en protocolo
                </label>
              )}
              {['informational', 'validation'].includes(entry.tableType) && (
                <label
                  className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer"
                  title="Permite al ingeniero quitar filas (incluidas las del template) durante la ejecución. El template en la biblioteca no se modifica."
                >
                  <input type="checkbox" checked={entry.allowRowDeletion ?? false}
                    onChange={e => setMeta('allowRowDeletion', e.target.checked)} />
                  Permitir eliminar filas en protocolo
                </label>
              )}
              {!['checklist', 'text', 'signatures', 'cover'].includes(entry.tableType) && (
                <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer" title="Renderiza la tabla con el mismo estilo compacto que las tablas de Instrumentos y Patrones (texto más pequeño, celdas compactas, inputs inline).">
                  <input type="checkbox" checked={entry.compactDisplay ?? false}
                    onChange={e => setMeta('compactDisplay', e.target.checked)} />
                  Modo compacto (estilo Instrumentos/Patrones)
                </label>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tamaño de texto (contenido)</label>
                <Select
                  className="w-full" selectSize="md"
                  value={entry.fontSize ?? ''}
                  onChange={e => setMeta('fontSize', e.target.value === '' ? null : Number(e.target.value))}
                >
                  <option value="">Normal (defecto)</option>
                  <option value="13">Mediano (13px)</option>
                  <option value="15">Grande (15px)</option>
                  <option value="17">Muy grande (17px)</option>
                </Select>
              </div>
            </div>

            {/* Header / Footer del protocolo */}
            <div className="border-t border-slate-100 pt-3">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Encabezado / Pie de página</p>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Título del protocolo</label>
                  <Input
                    value={entry.headerTitle ?? ''}
                    onChange={e => setMeta('headerTitle', e.target.value || null)}
                    placeholder="Ej: Protocolo de verificación GC-MS"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Aparece en el header de cada página del reporte.</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">N° formulario (QF)</label>
                  <Input
                    value={entry.footerQF ?? ''}
                    onChange={e => setMeta('footerQF', e.target.value || null)}
                    placeholder="Ej: QF-AGS-012 Rev.01"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Aparece en el footer de cada página del reporte.</p>
                </div>
              </div>
            </div>

            <EditorCoverageFields entry={entry} setMeta={setMeta} project={project} categorias={categorias} servicios={servicios} />
          </div>
        </Card>
        </div>{/* /sticky */}

        {/* Editor panel — tabla, checklist o texto según tipo */}
        <div className="col-span-2 min-w-0">
          {entry.tableType === 'cover' ? (
            <Card>
              <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-4">Carátula del Protocolo</h3>
              <p className="text-xs text-slate-400 mb-4">
                El <strong>nombre</strong> se usa como título principal (ej. "Calificación Operacional / Verificación de Funcionamiento").
                Si contiene "/" se separa: la primera parte es el título grande y el resto el subtítulo.
                La <strong>descripción</strong> se muestra debajo con una barra vertical (ej. modelos compatibles).
                Los datos del equipo, fecha e ingeniero se completan automáticamente desde la OT.
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-500 space-y-1">
                <p><strong>Título:</strong> {entry.name || '(nombre de la tabla)'}</p>
                <p><strong>Marca/Modelo:</strong> <span className="italic text-slate-400">{entry.coverAutoFillFromModulo ? 'Auto desde OT (marca módulo / modelo módulo)' : 'Auto desde OT (sistema / marca módulo)'}</span></p>
                <p><strong>Descripción:</strong> {entry.description || <span className="italic text-slate-400">(línea secundaria, ej. series compatibles)</span>}</p>
                <p className="text-slate-400 mt-2">Campos auto-completados: Fecha, Modelo, ID, N° Serie, Realizado por</p>
              </div>

              {/* Marca/Modelo desde módulo — para mantenimiento de accesorios */}
              <div className="mt-5 border-t border-slate-100 pt-4">
                <label className="flex items-start gap-2 cursor-pointer" title="Si se activa, la carátula muestra Marca/Modelo del módulo seleccionado (moduloMarca / moduloModelo) en lugar del nombre del sistema. Útil para mantenimiento de accesorios (MSD, HSS, HTA).">
                  <input
                    type="checkbox"
                    checked={!!entry.coverAutoFillFromModulo}
                    onChange={e => setMeta('coverAutoFillFromModulo', e.target.checked || null)}
                    className="mt-0.5 accent-blue-600"
                  />
                  <div>
                    <p className="text-xs font-medium text-slate-700">Marca/Modelo desde módulo</p>
                    <p className="text-[10px] text-slate-400">Activar para mantenimientos de accesorios (MSD, HSS, HTA) — la carátula identifica el módulo, no el sistema padre.</p>
                  </div>
                </label>
              </div>

              {/* Pie de página — QF, Revisión, Fecha */}
              <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Pie de página de la carátula</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">N° QF</label>
                    <Input
                      value={entry.coverQF ?? ''}
                      onChange={e => setMeta('coverQF', e.target.value || null)}
                      placeholder="Ej: QF7.0506"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Revisión</label>
                    <Input
                      value={entry.coverRevision ?? ''}
                      onChange={e => setMeta('coverRevision', e.target.value || null)}
                      placeholder="Ej: Rev. 09"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Fecha</label>
                    <Input
                      value={entry.coverFecha ?? ''}
                      onChange={e => setMeta('coverFecha', e.target.value || null)}
                      placeholder="Ej: 01/03/2026"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">Aparecen en el pie de la carátula, separados por una línea degradé.</p>
              </div>

              {/* Campos extra editables — los completa el ingeniero al ejecutar el protocolo */}
              <div className="mt-5 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Campos extra editables</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">El ingeniero los completa en el protocolo. Aparecen en la carátula antes del nombre del ingeniero. Ej. "Versión del software", "Estación de trabajo".</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => {
                    const next = [...(entry.coverExtraFields ?? []), { id: crypto.randomUUID().slice(0, 8), label: '' }];
                    setMeta('coverExtraFields', next);
                  }}>+ Campo</Button>
                </div>
                {(entry.coverExtraFields ?? []).length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic">Sin campos extra. Click en "+ Campo" para agregar.</p>
                ) : (
                  <div className="space-y-2">
                    {(entry.coverExtraFields ?? []).map((f, i) => (
                      <div key={f.id} className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                        <Input
                          value={f.label}
                          placeholder='Ej: "Versión del software"'
                          onChange={e => {
                            const next = [...(entry.coverExtraFields ?? [])];
                            next[i] = { ...next[i], label: e.target.value };
                            setMeta('coverExtraFields', next);
                          }}
                          className="flex-1"
                        />
                        <button onClick={() => {
                          const next = (entry.coverExtraFields ?? []).filter((_, j) => j !== i);
                          setMeta('coverExtraFields', next.length ? next : null);
                        }} className="text-red-500 text-xs font-bold px-2" title="Quitar campo">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          ) : entry.tableType === 'text' ? (
            <Card>
              <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-4">Contenido de texto</h3>
              <div className="flex items-center gap-4 mb-3">
                <p className="text-xs text-slate-400 flex-1">
                  Escribí el texto que aparecerá en el protocolo (objetivos, alcance, procedimientos, etc.)
                </p>
                <div className="flex items-center gap-1.5 shrink-0" title="Default: Justificada (retrocompat). Para textos cortos donde justify queda mal, elegí Izquierda.">
                  <label className="text-xs font-medium text-slate-600">Alineación</label>
                  <Select
                    value={entry.textAlign ?? 'justify'}
                    onChange={e => setMeta('textAlign', e.target.value as 'justify' | 'left' | 'center' | 'right')}
                  >
                    <option value="justify">Justificada</option>
                    <option value="left">Izquierda</option>
                    <option value="center">Centro</option>
                    <option value="right">Derecha</option>
                  </Select>
                </div>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer whitespace-nowrap shrink-0">
                  <input type="checkbox"
                    checked={(entry.textDisplayMode ?? 'card') === 'inline'}
                    onChange={e => setMeta('textDisplayMode', e.target.checked ? 'inline' : 'card')}
                    className="accent-blue-600"
                  />
                  Texto suelto (sin recuadro)
                </label>
              </div>
              <RichTextEditor
                value={entry.textContent ?? ''}
                onChange={html => setMeta('textContent', html || null)}
                placeholder="Ej: La calificación operacional tiene como propósito verificar que el equipo opera dentro de los parámetros establecidos por el fabricante..."
                minHeight={200}
              />
            </Card>
          ) : entry.tableType === 'signatures' ? (
            <Card>
              <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-4">Bloque de firmas</h3>
              <p className="text-xs text-slate-400 mb-4">
                Este bloque muestra automáticamente las firmas capturadas en la hoja 1 del reporte.
              </p>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">Firmas a mostrar</label>
                <div className="space-y-1.5">
                  {([
                    { value: 'both', label: 'Ambas (cliente e ingeniero)' },
                    { value: 'client', label: 'Solo firma del cliente' },
                    { value: 'engineer', label: 'Solo firma del ingeniero' },
                  ] as const).map(opt => (
                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer group">
                      <input type="radio" name="signatureMode"
                        checked={(entry.signatureMode ?? 'both') === opt.value}
                        onChange={() => setMeta('signatureMode', opt.value)}
                        className="accent-blue-600" />
                      <span className="text-xs text-slate-700 group-hover:text-slate-900">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="mt-5">
                <label className="block text-xs font-medium text-slate-600 mb-2">Fecha a mostrar</label>
                <div className="space-y-1.5">
                  {([
                    { value: 'none', label: 'Sin fecha' },
                    { value: 'inicio', label: 'Fecha de inicio' },
                    { value: 'fin', label: 'Fecha de finalización' },
                    { value: 'both', label: 'Ambas fechas' },
                  ] as const).map(opt => (
                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer group">
                      <input type="radio" name="showDate"
                        checked={(entry.showDate ?? 'none') === opt.value}
                        onChange={() => setMeta('showDate', opt.value)}
                        className="accent-blue-600" />
                      <span className="text-xs text-slate-700 group-hover:text-slate-900">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              {(entry.showDate ?? 'none') !== 'none' && (
                <div className="mt-3">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Texto con fecha</label>
                  <textarea
                    value={entry.dateLabel ?? ''}
                    onChange={e => setMeta('dateLabel', e.target.value || null)}
                    placeholder="Ej: Confirmo que con fecha {fechaInicio} estoy de acuerdo con los límites establecidos..."
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs resize-none"
                    rows={3}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Usá <code className="bg-slate-100 px-1 rounded">{'{fechaInicio}'}</code> y <code className="bg-slate-100 px-1 rounded">{'{fechaFin}'}</code> donde quieras insertar la fecha.
                    Si no incluís placeholders, la fecha se muestra al final del texto.
                  </p>
                </div>
              )}
            </Card>
          ) : entry.tableType === 'checklist'
            ? <ChecklistEditor entry={entry} onChange={setEntry} />
            : <TableEditor table={entry} onChange={setEntry} />
          }
        </div>
      </div>

      {/* Vista previa (solo para tipos tabla; no aplica a checklist ni texto) */}
      {!['checklist', 'text', 'signatures', 'cover'].includes(entry.tableType) && <div className="border border-slate-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowPreview(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
        >
          <span className="text-xs font-semibold text-slate-500 tracking-wider uppercase">
            Vista previa de la tabla
          </span>
          <span className="text-xs text-slate-500 font-medium">
            {showPreview ? '▲ Ocultar' : '▼ Mostrar'}
          </span>
        </button>
        {showPreview && (
          <div className="p-4 bg-white">
            {entry.columns.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">
                Agregá columnas y filas para ver la vista previa.
              </p>
            ) : (
              <TablePreview table={entry} />
            )}
          </div>
        )}
      </div>}
      </div>{/* /overflow-y-auto */}
    </div>
  );
};
