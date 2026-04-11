import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useColumnas } from '../../hooks/useColumnas';
import { marcasService } from '../../services/firebaseService';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import {
  CATEGORIA_PATRON_LABELS,
  calcularEstadoCertificado,
  type CategoriaPatron,
  type Columna,
  type ColumnaSerie,
  type Marca,
} from '@ags/shared';

const CATS_PATRON = Object.entries(CATEGORIA_PATRON_LABELS) as [CategoriaPatron, string][];

const ESTADO_BADGE: Record<string, { label: string; cls: string }> = {
  vigente: { label: 'Vigente', cls: 'bg-green-100 text-green-800' },
  por_vencer: { label: 'Por vencer', cls: 'bg-amber-100 text-amber-800' },
  vencido: { label: 'Vencido', cls: 'bg-red-100 text-red-800' },
  sin_certificado: { label: 'Sin certificado', cls: 'bg-slate-100 text-slate-500' },
};

const emptySerie = (): ColumnaSerie => ({
  serie: '',
  fechaVencimiento: null,
  certificadoEmisor: null,
  certificadoUrl: null,
  certificadoStoragePath: null,
  certificadoNombre: null,
  notas: null,
});

export const ColumnaEditorPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const goBack = useNavigateBack();
  const isNew = !id;
  const { getColumna, saveColumna, uploadCertificadoSerie } = useColumnas();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  const [codigoArticulo, setCodigoArticulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [marca, setMarca] = useState('');
  const [categorias, setCategorias] = useState<CategoriaPatron[]>([]);
  const [series, setSeries] = useState<ColumnaSerie[]>([]);

  const [marcas, setMarcas] = useState<Marca[]>([]);
  useEffect(() => { marcasService.getAll().then(setMarcas); }, []);

  const [uploadingSerieIdx, setUploadingSerieIdx] = useState<number | null>(null);
  const fileInputRefs = useRef<Map<number, HTMLInputElement>>(new Map());

  useEffect(() => {
    if (!isNew && id) {
      getColumna(id).then(c => {
        if (!c) { navigate('/columnas'); return; }
        setCodigoArticulo(c.codigoArticulo);
        setDescripcion(c.descripcion);
        setMarca(c.marca);
        setCategorias(c.categorias);
        setSeries(c.series);
        setLoading(false);
      });
    }
  }, [id]);

  const toggleCategoria = (cat: CategoriaPatron) => {
    setCategorias(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };

  const addSerie = () => setSeries(prev => [...prev, emptySerie()]);
  const removeSerie = (idx: number) => setSeries(prev => prev.filter((_, i) => i !== idx));
  const updateSerie = (idx: number, key: keyof ColumnaSerie, value: any) => {
    setSeries(prev => prev.map((s, i) => i === idx ? { ...s, [key]: value } : s));
  };

  const handleSave = async (): Promise<string | null> => {
    if (!codigoArticulo.trim()) { alert('El código de artículo es obligatorio'); return null; }
    if (!descripcion.trim()) { alert('La descripción es obligatoria'); return null; }
    if (categorias.length === 0) { alert('Seleccione al menos una categoría'); return null; }
    for (const [i, s] of series.entries()) {
      if (!s.serie.trim()) { alert(`La serie #${i + 1} necesita un número de serie`); return null; }
    }
    setSaving(true);
    try {
      const data: Omit<Columna, 'id' | 'createdAt' | 'updatedAt'> = {
        codigoArticulo: codigoArticulo.trim(),
        descripcion: descripcion.trim(),
        marca: marca.trim(),
        categorias,
        series,
        activo: true,
      };
      return await saveColumna(data, id);
    } catch {
      alert('Error al guardar la columna');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndClose = async () => {
    const savedId = await handleSave();
    if (savedId) navigate('/columnas');
  };

  const handleCertUpload = async (serieIdx: number, file: File) => {
    if (!id) { alert('Guarde la columna primero antes de subir certificados'); return; }
    setUploadingSerieIdx(serieIdx);
    try {
      await uploadCertificadoSerie(id, serieIdx, file);
      const refreshed = await getColumna(id);
      if (refreshed) setSeries(refreshed.series);
    } catch {
      alert('Error al subir el certificado');
    } finally {
      setUploadingSerieIdx(null);
    }
  };

  if (loading) return <div className="p-6 text-slate-400">Cargando columna…</div>;

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
              {isNew ? 'Nueva columna' : 'Editar columna'}
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
        <Card>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Información general</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Código de artículo *</label>
              <Input value={codigoArticulo} onChange={e => setCodigoArticulo(e.target.value)}
                placeholder="Ej: G3900-63001" />
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
                placeholder="Ej: HP-5 30m x 0.25mm x 0.25um" />
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

        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700">Números de serie ({series.length})</h2>
            <Button size="sm" variant="secondary" onClick={addSerie}>+ Agregar serie</Button>
          </div>

          {series.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Sin series cargadas. Presione "Agregar serie".</p>
          ) : (
            <div className="space-y-3">
              {series.map((s, idx) => {
                const estado = calcularEstadoCertificado(s.fechaVencimiento);
                const badge = ESTADO_BADGE[estado];
                return (
                  <div key={idx} className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                        Serie #{idx + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        {s.fechaVencimiento && (
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badge.cls}`}>
                            {badge.label}
                          </span>
                        )}
                        <button
                          onClick={() => removeSerie(idx)}
                          className="text-[10px] text-red-500 hover:text-red-700 font-medium"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className={lbl}>Número de serie *</label>
                        <Input value={s.serie}
                          onChange={e => updateSerie(idx, 'serie', e.target.value)}
                          placeholder="Ej: US2216A043" />
                      </div>
                      <div>
                        <label className={lbl}>Fecha de vencimiento</label>
                        <Input type="date" value={s.fechaVencimiento ?? ''}
                          onChange={e => updateSerie(idx, 'fechaVencimiento', e.target.value || null)} />
                      </div>
                      <div>
                        <label className={lbl}>Emisor del certificado</label>
                        <Input value={s.certificadoEmisor ?? ''}
                          onChange={e => updateSerie(idx, 'certificadoEmisor', e.target.value || null)} />
                      </div>
                      <div className="col-span-3">
                        <label className={lbl}>Notas</label>
                        <Input value={s.notas ?? ''}
                          onChange={e => updateSerie(idx, 'notas', e.target.value || null)}
                          placeholder="Estado, horas de uso, observaciones" />
                      </div>
                      <div className="col-span-3 pt-2 border-t border-slate-200">
                        <label className={lbl}>Certificado PDF (opcional)</label>
                        <div className="flex items-center gap-2">
                          {s.certificadoUrl ? (
                            <a href={s.certificadoUrl} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-teal-600 hover:underline font-medium">
                              📄 {s.certificadoNombre || 'Ver certificado'}
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
                            disabled={uploadingSerieIdx === idx || isNew}
                          >
                            {uploadingSerieIdx === idx ? 'Subiendo…' : s.certificadoUrl ? 'Reemplazar' : 'Subir PDF'}
                          </Button>
                        </div>
                        {isNew && (
                          <p className="text-[10px] text-amber-600 mt-1">
                            Guarde la columna primero para poder subir certificados.
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
      </div>
    </div>
  );
};
