import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useInstrumentos } from '../../hooks/useInstrumentos';
import { marcasService } from '../../services/firebaseService';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import {
  CATEGORIA_INSTRUMENTO_LABELS,
  CATEGORIA_PATRON_LABELS,
  calcularEstadoCertificado,
  type CategoriaInstrumento,
  type CategoriaPatron,
  type InstrumentoPatron,
  type Marca,
} from '@ags/shared';

const CATS_INSTRUMENTO = Object.entries(CATEGORIA_INSTRUMENTO_LABELS) as [CategoriaInstrumento, string][];
const CATS_PATRON = Object.entries(CATEGORIA_PATRON_LABELS) as [CategoriaPatron, string][];

const ESTADO_BADGE: Record<string, { label: string; cls: string }> = {
  vigente: { label: 'Vigente', cls: 'bg-green-100 text-green-800' },
  por_vencer: { label: 'Por vencer', cls: 'bg-amber-100 text-amber-800' },
  vencido: { label: 'Vencido', cls: 'bg-red-100 text-red-800' },
  sin_certificado: { label: 'Sin certificado', cls: 'bg-slate-100 text-slate-500' },
};

export const InstrumentoEditorPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id;
  const { getInstrumento, saveInstrumento, uploadCertificado, uploadTrazabilidad } = useInstrumentos();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  // Form state
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<'instrumento' | 'patron'>('instrumento');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [serie, setSerie] = useState('');
  const [lote, setLote] = useState('');
  const [categorias, setCategorias] = useState<(CategoriaInstrumento | CategoriaPatron)[]>([]);

  // Certificado
  const [certificadoEmisor, setCertificadoEmisor] = useState('');
  const [certificadoFechaEmision, setCertificadoFechaEmision] = useState('');
  const [certificadoVencimiento, setCertificadoVencimiento] = useState('');
  const [certificadoUrl, setCertificadoUrl] = useState<string | null>(null);
  const [certificadoNombre, setCertificadoNombre] = useState<string | null>(null);
  const [trazabilidadUrl, setTrazabilidadUrl] = useState<string | null>(null);
  const [trazabilidadNombre, setTrazabilidadNombre] = useState<string | null>(null);

  // Reemplazo (solo lectura)
  const [reemplazaA, setReemplazaA] = useState<string | null>(null);
  const [reemplazadoPor, setReemplazadoPor] = useState<string | null>(null);

  const certFileRef = useRef<HTMLInputElement>(null);
  const trazFileRef = useRef<HTMLInputElement>(null);
  const [uploadingCert, setUploadingCert] = useState(false);
  const [uploadingTraz, setUploadingTraz] = useState(false);

  // Marcas
  const [marcas, setMarcas] = useState<Marca[]>([]);
  useEffect(() => { marcasService.getAll().then(setMarcas); }, []);
  const marcaOptions = marcas.map(m => ({ value: m.nombre, label: m.nombre }));

  useEffect(() => {
    if (!isNew && id) {
      getInstrumento(id).then(inst => {
        if (!inst) { navigate('/instrumentos'); return; }
        setNombre(inst.nombre);
        setTipo(inst.tipo);
        setMarca(inst.marca);
        setModelo(inst.modelo);
        setSerie(inst.serie);
        setLote(inst.lote || '');
        setCategorias(inst.categorias);
        setCertificadoEmisor(inst.certificadoEmisor || '');
        setCertificadoFechaEmision(inst.certificadoFechaEmision || '');
        setCertificadoVencimiento(inst.certificadoVencimiento || '');
        setCertificadoUrl(inst.certificadoUrl || null);
        setCertificadoNombre(inst.certificadoNombre || null);
        setTrazabilidadUrl(inst.trazabilidadUrl || null);
        setTrazabilidadNombre(inst.trazabilidadNombre || null);
        setReemplazaA(inst.reemplazaA || null);
        setReemplazadoPor(inst.reemplazadoPor || null);
        setLoading(false);
      });
    }
  }, [id]);

  const toggleCategoria = (cat: CategoriaInstrumento | CategoriaPatron) => {
    setCategorias(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleTipoChange = (nuevoTipo: 'instrumento' | 'patron') => {
    setTipo(nuevoTipo);
    setCategorias([]);
  };

  const handleSave = async () => {
    if (!nombre.trim()) { alert('La identificación es obligatoria'); return; }
    if (categorias.length === 0) { alert('Seleccione al menos una categoría'); return; }
    setSaving(true);
    try {
      const data: Omit<InstrumentoPatron, 'id' | 'createdAt' | 'updatedAt'> = {
        nombre: nombre.trim(),
        tipo,
        marca: marca.trim(),
        modelo: modelo.trim(),
        serie: serie.trim(),
        categorias,
        lote: tipo === 'patron' ? lote.trim() || null : null,
        certificadoEmisor: certificadoEmisor.trim() || null,
        certificadoFechaEmision: certificadoFechaEmision || null,
        certificadoVencimiento: certificadoVencimiento || null,
        certificadoUrl,
        certificadoNombre,
        certificadoStoragePath: null, // kept by service on upload
        trazabilidadUrl,
        trazabilidadNombre,
        trazabilidadStoragePath: null,
        reemplazaA: reemplazaA || null,
        reemplazadoPor: reemplazadoPor || null,
        activo: true,
      };
      await saveInstrumento(data, id);
      navigate('/instrumentos');
    } catch (err) {
      alert('Error al guardar el instrumento');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleUploadCert = async (file: File) => {
    const targetId = id;
    if (!targetId) { alert('Guarde el instrumento antes de subir el certificado'); return; }
    setUploadingCert(true);
    try {
      const { url } = await uploadCertificado(targetId, file);
      setCertificadoUrl(url);
      setCertificadoNombre(file.name);
    } catch (err) {
      alert('Error al subir el certificado');
      console.error(err);
    } finally {
      setUploadingCert(false);
    }
  };

  const handleUploadTraz = async (file: File) => {
    const targetId = id;
    if (!targetId) { alert('Guarde el instrumento antes de subir la trazabilidad'); return; }
    setUploadingTraz(true);
    try {
      const { url } = await uploadTrazabilidad(targetId, file);
      setTrazabilidadUrl(url);
      setTrazabilidadNombre(file.name);
    } catch (err) {
      alert('Error al subir la trazabilidad');
      console.error(err);
    } finally {
      setUploadingTraz(false);
    }
  };

  const estadoCert = calcularEstadoCertificado(certificadoVencimiento);
  const badge = ESTADO_BADGE[estadoCert];

  if (loading) {
    return <div className="flex justify-center py-12"><p className="text-slate-400">Cargando...</p></div>;
  }

  return (
    <div className="-m-6 h-[calc(100%+3rem)] flex flex-col bg-slate-50">
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-4 bg-white border-b border-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.06)] z-10">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 tracking-tight">
              {isNew ? 'Nuevo instrumento' : `Editar: ${nombre}`}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {isNew ? 'Complete los datos y guarde' : `ID: ${id}`}
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate('/instrumentos')}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {/* Datos generales */}
        <Card>
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Datos generales</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Identificación" value={nombre} onChange={e => setNombre(e.target.value)} required />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
              <select value={tipo} onChange={e => handleTipoChange(e.target.value as 'instrumento' | 'patron')}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                <option value="instrumento">Instrumento</option>
                <option value="patron">Patrón</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Marca</label>
              <SearchableSelect
                value={marca}
                onChange={setMarca}
                options={marcaOptions}
                placeholder="Seleccionar marca..."
              />
            </div>
            <Input label="Modelo" value={modelo} onChange={e => setModelo(e.target.value)} />
            <Input label="Serie" value={serie} onChange={e => setSerie(e.target.value)} />
            {tipo === 'patron' && (
              <Input label="Lote" value={lote} onChange={e => setLote(e.target.value)} />
            )}
          </div>
        </Card>

        {/* Categorías */}
        <Card>
          <h3 className="text-sm font-semibold text-slate-900 mb-4">
            {tipo === 'patron' ? 'Equipo aplicable' : 'Categorías'}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {(tipo === 'patron' ? CATS_PATRON : CATS_INSTRUMENTO).map(([key, label]) => (
              <label key={key}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-sm ${
                  categorias.includes(key)
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}>
                <input type="checkbox" checked={categorias.includes(key)}
                  onChange={() => toggleCategoria(key)} className="w-4 h-4 accent-indigo-600" />
                {label}
              </label>
            ))}
          </div>
        </Card>

        {/* Certificado */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900">Certificado de calibración</h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.cls}`}>{badge.label}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Emisor" value={certificadoEmisor}
              onChange={e => setCertificadoEmisor(e.target.value)} />
            <Input label="Fecha de emisión" type="date" value={certificadoFechaEmision}
              onChange={e => setCertificadoFechaEmision(e.target.value)} />
            <Input label="Vencimiento" type="date" value={certificadoVencimiento}
              onChange={e => setCertificadoVencimiento(e.target.value)} />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Archivo PDF</label>
              {certificadoUrl ? (
                <div className="flex items-center gap-2">
                  <a href={certificadoUrl} target="_blank" rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-sm font-medium truncate max-w-xs">
                    {certificadoNombre || 'Ver PDF'}
                  </a>
                  <button onClick={() => certFileRef.current?.click()}
                    className="text-xs text-slate-500 hover:text-slate-700">Reemplazar</button>
                </div>
              ) : (
                <Button variant="outline" size="sm" disabled={isNew || uploadingCert}
                  onClick={() => certFileRef.current?.click()}>
                  {uploadingCert ? 'Subiendo...' : isNew ? 'Guarde primero' : 'Subir PDF'}
                </Button>
              )}
              <input ref={certFileRef} type="file" accept=".pdf" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadCert(f); e.target.value = ''; }} />
            </div>
          </div>
        </Card>

        {/* Trazabilidad */}
        <Card>
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Trazabilidad</h3>
          <p className="text-xs text-slate-500 mb-3">
            Documento de trazabilidad metrológica asociado al certificado de calibración.
          </p>
          <div>
            {trazabilidadUrl ? (
              <div className="flex items-center gap-2">
                <a href={trazabilidadUrl} target="_blank" rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm font-medium truncate max-w-xs">
                  {trazabilidadNombre || 'Ver PDF'}
                </a>
                <button onClick={() => trazFileRef.current?.click()}
                  className="text-xs text-slate-500 hover:text-slate-700">Reemplazar</button>
              </div>
            ) : (
              <Button variant="outline" size="sm" disabled={isNew || uploadingTraz}
                onClick={() => trazFileRef.current?.click()}>
                {uploadingTraz ? 'Subiendo...' : isNew ? 'Guarde primero' : 'Subir PDF'}
              </Button>
            )}
            <input ref={trazFileRef} type="file" accept=".pdf" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadTraz(f); e.target.value = ''; }} />
          </div>
        </Card>

        {/* Reemplazo (solo edición) */}
        {!isNew && (reemplazaA || reemplazadoPor) && (
          <Card>
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Cadena de reemplazo</h3>
            <div className="text-sm text-slate-600 space-y-1">
              {reemplazaA && <p>Reemplaza a: <span className="font-mono text-xs">{reemplazaA}</span></p>}
              {reemplazadoPor && <p>Reemplazado por: <span className="font-mono text-xs">{reemplazadoPor}</span></p>}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
