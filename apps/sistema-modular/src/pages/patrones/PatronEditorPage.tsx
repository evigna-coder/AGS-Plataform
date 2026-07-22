import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePatrones } from '../../hooks/usePatrones';
import { marcasService } from '../../services/firebaseService';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { PatronComponentesEditor } from './PatronComponentesEditor';
import { PatronComponentesAlertBanner } from './PatronComponentesAlertBanner';
import { PatronLotesBajaSection } from './PatronLotesBajaSection';
import { patronesService } from '../../services/patronesService';
import {
  CATEGORIA_PATRON_LABELS,
  calcularEstadoCertificado,
  type CategoriaPatron,
  type ComponentePatron,
  type Patron,
  type PatronLote,
  type PatronLoteBajaEntry,
  type Marca,
} from '@ags/shared';
import { validatePatronComponentes } from './patronComponentesValidation';

const CATS_PATRON = Object.entries(CATEGORIA_PATRON_LABELS) as [CategoriaPatron, string][];

const ESTADO_BADGE: Record<string, { label: string; cls: string }> = {
  vigente: { label: 'Vigente', cls: 'bg-green-100 text-green-800' },
  por_vencer: { label: 'Por vencer', cls: 'bg-amber-100 text-amber-800' },
  vencido: { label: 'Vencido', cls: 'bg-red-100 text-red-800' },
  sin_certificado: { label: 'Sin certificado', cls: 'bg-slate-100 text-slate-500' },
};

const emptyLote = (): PatronLote => ({
  lote: '',
  fechaVencimiento: null,
  cantidad: null,
  certificadoEmisor: null,
  certificadoUrl: null,
  certificadoStoragePath: null,
  certificadoNombre: null,
  certificadoFechaEmision: null,
  notas: null,
});

export const PatronEditorPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const goBack = useNavigateBack();
  const isNew = !id;
  const { getPatron, savePatron, uploadCertificadoLote } = usePatrones();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  // Datos generales
  const [codigoArticulo, setCodigoArticulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [marca, setMarca] = useState('');
  const [categorias, setCategorias] = useState<CategoriaPatron[]>([]);
  const [lotes, setLotes] = useState<PatronLote[]>([]);
  // Historial de bajas + set de códigos de lote ya persistidos en el doc.
  // "Quitar" un lote persistido = baja con historial (service); un lote nuevo
  // sin guardar se remueve local nomás.
  const [lotesBaja, setLotesBaja] = useState<PatronLoteBajaEntry[]>([]);
  const savedLoteCodigos = useRef<Set<string>>(new Set());
  const confirm = useConfirm();
  // Phase 14 BOM-04 — componentes declarativos (BOM) del patrón.
  const [componentes, setComponentes] = useState<ComponentePatron[]>([]);

  /**
   * Codigos que no pueden renombrarse porque algún lote ya tiene consumos
   * registrados sobre ellos. Derivado en real-time desde lotes[*].componentesConsumidos.
   * El sub-componente desactiva el input + el service guard (Task 3 del plan) bloquea
   * el rename a nivel persistencia como defense-in-depth.
   */
  const lockedCodigos = useMemo(() => {
    const s = new Set<string>();
    for (const lote of lotes ?? []) {
      for (const cc of lote.componentesConsumidos ?? []) {
        s.add(cc.codigoComponente);
      }
    }
    return s;
  }, [lotes]);

  /**
   * Snapshot del patrón en estado actual (lotes + componentes locales) para el
   * alert banner BOM-06. Reactive a la edición: si admin agrega/quita componentes
   * o lotes, el banner se actualiza sin reload.
   */
  const patronSnapshot = useMemo(
    (): Patron => ({
      id: id ?? 'new',
      codigoArticulo,
      descripcion,
      marca,
      categorias,
      lotes,
      componentes,
      activo: true,
      createdAt: '',
      updatedAt: '',
    }),
    [id, codigoArticulo, descripcion, marca, categorias, lotes, componentes],
  );

  // Marcas
  const [marcas, setMarcas] = useState<Marca[]>([]);
  useEffect(() => { marcasService.getAll().then(setMarcas); }, []);

  // Upload por lote
  const [uploadingLoteIdx, setUploadingLoteIdx] = useState<number | null>(null);
  const fileInputRefs = useRef<Map<number, HTMLInputElement>>(new Map());

  useEffect(() => {
    if (!isNew && id) {
      getPatron(id).then(p => {
        if (!p) { navigate('/patrones'); return; }
        setCodigoArticulo(p.codigoArticulo);
        setDescripcion(p.descripcion);
        setMarca(p.marca);
        setCategorias(p.categorias);
        setLotes(p.lotes);
        setLotesBaja(p.lotesBaja ?? []);
        savedLoteCodigos.current = new Set(p.lotes.map(l => l.lote));
        setComponentes(p.componentes ?? []);
        setLoading(false);
      });
    }
  }, [id]);

  const toggleCategoria = (cat: CategoriaPatron) => {
    setCategorias(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };

  const addLote = () => setLotes(prev => [...prev, emptyLote()]);

  /**
   * Lote persistido → baja con historial (queda consultable el certificado).
   * Lote nuevo sin guardar → remove local. Si el código fue editado sin
   * guardar no matchea el doc y cae al remove local (comportamiento previo).
   */
  const removeLote = async (idx: number) => {
    const lote = lotes[idx];
    const esPersistido = !isNew && id && lote?.lote && savedLoteCodigos.current.has(lote.lote);
    if (!esPersistido) {
      setLotes(prev => prev.filter((_, i) => i !== idx));
      return;
    }
    const motivo = lote.cantidad === 0 ? 'agotado' : 'baja_manual';
    if (!await confirm(`¿Dar de baja el lote ${lote.lote}? Pasa al historial de bajas — el certificado sigue consultable.`)) return;
    try {
      const entry = await patronesService.darDeBajaLote(id, lote.lote, motivo);
      if (entry) {
        savedLoteCodigos.current.delete(lote.lote);
        setLotes(prev => prev.filter((_, i) => i !== idx));
        setLotesBaja(prev => [...prev, entry]);
      } else {
        alert('El lote ya no está en el patrón (posiblemente dado de baja desde otra sesión). Recargá la página.');
      }
    } catch {
      alert('Error al dar de baja el lote');
    }
  };
  const updateLote = (idx: number, key: keyof PatronLote, value: any) => {
    setLotes(prev => prev.map((l, i) => i === idx ? { ...l, [key]: value } : l));
  };

  const handleSave = async (): Promise<string | null> => {
    if (!codigoArticulo.trim()) { alert('El código de artículo es obligatorio'); return null; }
    if (!descripcion.trim()) { alert('La descripción es obligatoria'); return null; }
    if (categorias.length === 0) { alert('Seleccione al menos una categoría'); return null; }
    // Validar lotes: al menos tienen que tener lote
    for (const [i, l] of lotes.entries()) {
      if (!l.lote.trim()) { alert(`El lote #${i + 1} necesita un código de lote`); return null; }
    }
    // Phase 14 BOM-04 — guards sobre componentes (RESEARCH pitfalls 1+3)
    const componentesError = validatePatronComponentes(componentes);
    if (componentesError) { alert(componentesError); return null; }
    setSaving(true);
    try {
      const data: Omit<Patron, 'id' | 'createdAt' | 'updatedAt'> = {
        codigoArticulo: codigoArticulo.trim(),
        descripcion: descripcion.trim(),
        marca: marca.trim(),
        categorias,
        lotes,
        componentes,
        activo: true,
      };
      const savedId = await savePatron(data, id);
      return savedId;
    } catch (err) {
      // Errores del service guard (rename con consumos previos) propagan acá.
      const msg = err instanceof Error ? err.message : 'Error al guardar el patrón';
      alert(msg);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndClose = async () => {
    const savedId = await handleSave();
    if (savedId) navigate('/patrones');
  };

  const handleCertUpload = async (loteIdx: number, file: File) => {
    if (!id) { alert('Guarde el patrón primero antes de subir certificados'); return; }
    if (!lotes[loteIdx]?.lote.trim()) {
      alert('El lote necesita un código antes de subir el certificado');
      return;
    }
    setUploadingLoteIdx(loteIdx);
    try {
      // Persistir estado local antes del upload: el service lee los lotes
      // desde Firestore, así que lotes recién agregados o ediciones no
      // guardadas quedarían fuera del índice o se perderían al refrescar.
      const savedId = await savePatron(
        {
          codigoArticulo: codigoArticulo.trim(),
          descripcion: descripcion.trim(),
          marca: marca.trim(),
          categorias,
          lotes,
          componentes,
          activo: true,
        },
        id,
      );
      await uploadCertificadoLote(savedId, loteIdx, file);
      const refreshed = await getPatron(savedId);
      if (refreshed) setLotes(refreshed.lotes);
    } catch {
      alert('Error al subir el certificado');
    } finally {
      setUploadingLoteIdx(null);
    }
  };

  if (loading) {
    return <div className="p-6 text-slate-400">Cargando patrón…</div>;
  }

  const lbl = "block text-[11px] font-medium text-slate-500 mb-1";

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-y-auto">
      <div className="px-5 pt-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <div>
            <button onClick={goBack} className="text-[11px] text-slate-400 hover:text-slate-600 mb-1">
              ← Volver
            </button>
            <h1 className="text-xl font-semibold text-slate-800">
              {isNew ? 'Nuevo patrón' : 'Editar patrón'}
            </h1>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={goBack}>Cancelar</Button>
            <Button onClick={handleSaveAndClose} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar y cerrar'}
            </Button>
          </div>
        </div>
      </div>

      <div className="px-5 pb-4 space-y-4">
        {/* Datos generales */}
        <Card>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Información general</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Código de artículo *</label>
              <Input value={codigoArticulo} onChange={e => setCodigoArticulo(e.target.value)}
                placeholder="Ej: 8500-6917" />
            </div>
            <div>
              <label className={lbl}>Marca</label>
              <SearchableSelect value={marca}
                onChange={setMarca}
                options={[{ value: '', label: '—' }, ...marcas.map(m => ({ value: m.nombre, label: m.nombre }))]}
                placeholder="Seleccionar" />
            </div>
            <div className="col-span-2">
              <label className={lbl}>Descripción *</label>
              <Input value={descripcion} onChange={e => setDescripcion(e.target.value)}
                placeholder="Ej: Caffeine Standards Kit for LC/MS OQ/PV" />
            </div>
            <div className="col-span-2">
              <label className={lbl}>Categorías *</label>
              <div className="flex flex-wrap gap-1.5">
                {CATS_PATRON.map(([k, v]) => (
                  <button key={k} type="button"
                    onClick={() => toggleCategoria(k)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                      categorias.includes(k)
                        ? 'bg-teal-50 border-teal-300 text-teal-700'
                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* BOM-06: alert inline si algún (lote, componente) cayó al mínimo. Self-hides. */}
        <PatronComponentesAlertBanner patron={patronSnapshot} />

        {/* Lotes */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700">Lotes ({lotes.length})</h2>
            <Button size="sm" variant="secondary" onClick={addLote}>+ Agregar lote</Button>
          </div>

          {lotes.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Sin lotes cargados. Presione "Agregar lote".</p>
          ) : (
            <div className="space-y-3">
              {lotes.map((lote, idx) => {
                const estado = calcularEstadoCertificado(lote.fechaVencimiento);
                const badge = ESTADO_BADGE[estado];
                return (
                  <div key={idx} className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                        Lote #{idx + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badge.cls}`}>
                          {badge.label}
                        </span>
                        <button
                          onClick={() => void removeLote(idx)}
                          className="text-[10px] text-red-500 hover:text-red-700 font-medium"
                        >
                          Dar de baja
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <label className={lbl}>Código de lote *</label>
                        <Input value={lote.lote}
                          onChange={e => updateLote(idx, 'lote', e.target.value)}
                          placeholder="Ej: 0006686843" />
                      </div>
                      <div>
                        <label className={lbl}>Fecha de vencimiento</label>
                        <Input type="date" value={lote.fechaVencimiento ?? ''}
                          onChange={e => updateLote(idx, 'fechaVencimiento', e.target.value || null)} />
                      </div>
                      <div>
                        <label className={lbl}>Cantidad</label>
                        <Input type="number" min="0" step="1" value={lote.cantidad ?? ''}
                          onChange={e => {
                            const v = e.target.value;
                            updateLote(idx, 'cantidad', v === '' ? null : Number(v));
                          }}
                          placeholder="Ej: 1" />
                      </div>
                      <div>
                        <label className={lbl}>Emisor del certificado</label>
                        <Input value={lote.certificadoEmisor ?? ''}
                          onChange={e => updateLote(idx, 'certificadoEmisor', e.target.value || null)}
                          placeholder="Ej: Agilent Technologies" />
                      </div>
                      <div className="col-span-4">
                        <label className={lbl}>Notas</label>
                        <Input value={lote.notas ?? ''}
                          onChange={e => updateLote(idx, 'notas', e.target.value || null)}
                          placeholder="Observaciones del lote" />
                      </div>
                      <div className="col-span-4 pt-2 border-t border-slate-200">
                        <label className={lbl}>Certificado PDF</label>
                        <div className="flex items-center gap-2">
                          {lote.certificadoUrl ? (
                            <a href={lote.certificadoUrl} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-teal-600 hover:underline font-medium">
                              📄 {lote.certificadoNombre || 'Ver certificado'}
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Sin certificado</span>
                          )}
                          <input
                            ref={el => { if (el) fileInputRefs.current.set(idx, el); }}
                            type="file"
                            accept="application/pdf"
                            className="hidden"
                            onChange={e => {
                              const f = e.target.files?.[0];
                              if (f) handleCertUpload(idx, f);
                              e.target.value = '';
                            }}
                          />
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => fileInputRefs.current.get(idx)?.click()}
                            disabled={uploadingLoteIdx === idx || isNew}
                          >
                            {uploadingLoteIdx === idx ? 'Subiendo…' : lote.certificadoUrl ? 'Reemplazar' : 'Subir PDF'}
                          </Button>
                        </div>
                        {isNew && (
                          <p className="text-[10px] text-amber-600 mt-1">
                            Guarde el patrón primero para poder subir certificados.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Historial de lotes dados de baja (vencidos / agotados / baja manual) */}
        {!isNew && <PatronLotesBajaSection entries={lotesBaja} />}

        {/* Componentes (BOM) — Phase 14 BOM-04 */}
        <Card>
          <PatronComponentesEditor
            componentes={componentes}
            onChange={setComponentes}
            lockedCodigos={lockedCodigos}
            disabled={saving}
          />
        </Card>
      </div>
    </div>
  );
};
