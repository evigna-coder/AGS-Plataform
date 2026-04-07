import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useTableCatalog } from '../../hooks/useTableCatalog';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { TableEditor } from '../../components/protocol-catalog/TableEditor';
import { TablePreview } from '../../components/protocol-catalog/TablePreview';
import { ChecklistEditor } from '../../components/protocol-catalog/ChecklistEditor';
import { RichTextEditor } from '../../components/ui/RichTextEditor';
import { categoriasEquipoService } from '../../services/firebaseService';
import { useTableProjects } from '../../hooks/useTableProjects';
import type { TableCatalogEntry, CategoriaEquipo } from '@ags/shared';
import { useNavigateBack } from '../../hooks/useNavigateBack';

const SYS_TYPES = ['HPLC', 'GC', 'UV', 'OSMOMETRO', 'OTRO'];

const SERVICIO_TYPES = [
  'Calibración',
  'Calificación de instalación',
  'Calificación de operación',
  'Calificación de software',
  'Limpieza de fuente de Iones',
  'Mantenimiento preventivo con consumibles',
  'Mantenimiento preventivo sin consumibles',
  'Mantenimiento preventivo sin consumibles, incluye limpieza de módulos',
  'Recalificación post reparación',
];

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

function validateForPublish(entry: TableCatalogEntry): string[] {
  const errors: string[] = [];
  if (!entry.name.trim()) errors.push('Nombre vacío');
  if (!entry.sysType) errors.push('SysType no asignado');
  if (entry.tableType === 'text') {
    if (!entry.textContent?.trim()) errors.push('El contenido de texto está vacío');
  } else if (entry.tableType === 'checklist') {
    if (!entry.checklistItems || entry.checklistItems.length === 0)
      errors.push('El checklist no tiene ítems');
    entry.checklistItems?.forEach((item, i) => {
      if (!item.label.trim()) errors.push(`Ítem ${i + 1}: texto vacío`);
    });
  } else if (entry.columns.length === 0) errors.push('La tabla no tiene columnas');
  if (entry.tableType === 'validation') {
    entry.validationRules.forEach((r, i) => {
      if (!r.operator || r.factoryThreshold === '' || !r.targetColumn || !r.valueIfPass || !r.valueIfFail) {
        errors.push(`Regla ${i + 1}: campos incompletos`);
      }
    });
  }
  return errors;
}

export const TableCatalogEditorPage = () => {
  const { tableId } = useParams<{ tableId: string }>();
  const goBack = useNavigateBack();
  const { getTable, saveDraft, publishTable, loading } = useTableCatalog();
  const { projects } = useTableProjects();

  const [entry, setEntry] = useState<TableCatalogEntry>(emptyEntry());
  const [categorias, setCategorias] = useState<CategoriaEquipo[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const dataLoaded = useRef(false);

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

  const handleSaveDraft = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const id = await saveDraft(entry);
      if (!entry.id && id) {
        setEntry(prev => ({ ...prev, id }));
        // Actualizar URL sin remontar el componente (evita refetch y pérdida de foco)
        window.history.replaceState(null, '', `/table-catalog/${id}/edit`);
      }
      setStatusMsg({ type: 'success', text: 'Borrador guardado' });
    } catch {
      setStatusMsg({ type: 'error', text: 'Error al guardar' });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    const errors = validateForPublish(entry);
    if (errors.length) {
      setValidationErrors(errors);
      if (!confirm(`Hay ${errors.length} advertencia(s).\n\n${errors.join('\n')}\n\n¿Publicar de todas formas?`)) return;
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
            <Button variant="secondary" onClick={handleSaveDraft} disabled={saving || loading}>
              {saving ? 'Guardando...' : 'Guardar borrador'}
            </Button>
            <Button onClick={handlePublish} disabled={saving || loading || entry.status === 'published'}>
              Publicar
            </Button>
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
              <Input value={entry.description ?? ''} onChange={e => setMeta('description', e.target.value || null)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Proyecto</label>
              <select value={entry.projectId ?? ''} onChange={e => setMeta('projectId', e.target.value || null)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                <option value="">Sin proyecto</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de sistema *</label>
              <select value={entry.sysType} onChange={e => setMeta('sysType', e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                <option value="">Seleccionar...</option>
                {SYS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de tabla</label>
              <select value={entry.tableType} onChange={e => setMeta('tableType', e.target.value as TableCatalogEntry['tableType'])}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                <option value="informational">Informacional</option>
                <option value="validation">Validación</option>
                <option value="instruments">Instrumentos</option>
                <option value="checklist">Checklist</option>
                <option value="text">Texto</option>
                <option value="signatures">Firmas</option>
                <option value="cover">Carátula</option>
              </select>
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
              </div>
              {!['checklist', 'text', 'signatures', 'cover'].includes(entry.tableType) && (
                <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={entry.allowExtraRows ?? false}
                    onChange={e => setMeta('allowExtraRows', e.target.checked)} />
                  Permitir agregar filas extra en protocolo
                </label>
              )}
              {!['checklist', 'text', 'signatures', 'cover'].includes(entry.tableType) && (
                <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer" title="Renderiza la tabla con el mismo estilo compacto que las tablas de Instrumentos y Patrones (texto más pequeño, celdas compactas, inputs inline).">
                  <input type="checkbox" checked={entry.compactDisplay ?? false}
                    onChange={e => setMeta('compactDisplay', e.target.checked)} />
                  Modo compacto (estilo Instrumentos/Patrones)
                </label>
              )}
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

            {/* Tipos de servicio */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">
                Tipos de servicio
                <span className="ml-1 font-normal text-slate-400 normal-case">(uno o más)</span>
              </label>
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {SERVICIO_TYPES.map(st => {
                  const selected = (entry.tipoServicio ?? []).includes(st);
                  return (
                    <label key={st} className="flex items-start gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => {
                          const current = entry.tipoServicio ?? [];
                          setMeta(
                            'tipoServicio',
                            selected ? current.filter(s => s !== st) : [...current, st]
                          );
                        }}
                        className="mt-0.5 accent-blue-600 shrink-0"
                      />
                      <span className="text-xs text-slate-700 group-hover:text-slate-900 leading-tight">
                        {st}
                      </span>
                    </label>
                  );
                })}
              </div>
              {(entry.tipoServicio ?? []).length === 0 && (
                <p className="text-[10px] text-slate-400 mt-1 italic">
                  Sin asignar — aparecerá en todos los servicios del catálogo.
                </p>
              )}
            </div>

            {/* Modelos de equipo */}
            {entry.sysType && (() => {
              const modelosPorCategoria = categorias
                .filter(c => (c.modelos ?? []).length > 0)
                .map(c => ({
                  categoria: c.nombre,
                  modelos: (c.modelos ?? []).filter((v, i, a) => a.indexOf(v) === i).sort(),
                }));
              const hayModelos = modelosPorCategoria.some(g => g.modelos.length > 0);
              if (!hayModelos) return null;
              return (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-2">
                    Modelos de equipo
                    <span className="ml-1 font-normal text-slate-400 normal-case">(uno o más)</span>
                  </label>
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {modelosPorCategoria.map(g => (
                      <div key={g.categoria}>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{g.categoria}</p>
                        <div className="space-y-1.5 pl-1">
                          {g.modelos.map(modelo => {
                            const selected = (entry.modelos ?? []).includes(modelo);
                            return (
                              <label key={modelo} className="flex items-start gap-2 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => {
                                    const current = entry.modelos ?? [];
                                    setMeta('modelos', selected ? current.filter(m => m !== modelo) : [...current, modelo]);
                                  }}
                                  className="mt-0.5 accent-blue-600 shrink-0"
                                />
                                <span className="text-xs text-slate-700 group-hover:text-slate-900 leading-tight">{modelo}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  {(entry.modelos ?? []).length === 0 && (
                    <p className="text-[10px] text-slate-400 mt-1 italic">
                      Sin asignar — aparecerá para todos los modelos de este tipo de sistema.
                    </p>
                  )}
                </div>
              );
            })()}
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
                <p><strong>Marca/Modelo:</strong> <span className="italic text-slate-400">Auto desde OT (sistema / marca módulo)</span></p>
                <p><strong>Descripción:</strong> {entry.description || <span className="italic text-slate-400">(línea secundaria, ej. series compatibles)</span>}</p>
                <p className="text-slate-400 mt-2">Campos auto-completados: Fecha, Modelo, ID, N° Serie, Realizado por</p>
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
            </Card>
          ) : entry.tableType === 'text' ? (
            <Card>
              <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-4">Contenido de texto</h3>
              <div className="flex items-center gap-4 mb-3">
                <p className="text-xs text-slate-400">
                  Escribí el texto que aparecerá en el protocolo (objetivos, alcance, procedimientos, etc.)
                </p>
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
