import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { Sistema, CategoriaEquipo, Cliente, Establecimiento } from '@ags/shared';
import { esGaseoso } from '@ags/shared';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';
import { GCPortsGrid } from '../GCPortsGrid';
import { Button } from '../ui/Button';
import { sistemasService } from '@/services/firebaseService';
import { sectoresCatalogService, type SectorCatalog } from '@/services/catalogService';
import QREquipoModal from './QREquipoModal';

const lbl = 'text-[11px] font-medium text-slate-400 mb-0.5';
const val = 'text-xs text-slate-700';

interface EquipoInfoSidebarProps {
  sistema: Sistema;
  cliente: Cliente | undefined;
  establecimiento: Establecimiento | null;
  categoria: CategoriaEquipo | undefined;
  editing: boolean;
  formData: any;
  setFormData: (data: any) => void;
  clientes: Cliente[];
  establecimientos: Establecimiento[];
  setEstablecimientos: (list: Establecimiento[]) => void;
  categorias: CategoriaEquipo[];
  loadEstablecimientos: (clienteId: string) => Promise<Establecimiento[]>;
}

export const EquipoInfoSidebar: React.FC<EquipoInfoSidebarProps> = ({
  sistema,
  cliente,
  establecimiento,
  categoria,
  editing,
  formData,
  setFormData,
  clientes,
  establecimientos,
  setEstablecimientos,
  categorias,
  loadEstablecimientos,
}) => {
  const [showQR, setShowQR] = useState(false);
  const [sectorCatalog, setSectorCatalog] = useState<SectorCatalog[]>([]);

  useEffect(() => {
    if (editing) sectoresCatalogService.getAll().then(setSectorCatalog);
  }, [editing]);

  const showGC = editing
    ? esGaseoso(formData.nombre ?? '') || esGaseoso(categorias.find(c => c.id === formData.categoriaId)?.nombre ?? '')
    : esGaseoso(sistema.nombre) || esGaseoso(categoria?.nombre ?? '');

  return (
    <div className="w-72 shrink-0 space-y-4">
      <Card compact>
        <p className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-3">
          Datos del Sistema
        </p>
        {editing ? (
          <EditForm
            formData={formData}
            setFormData={setFormData}
            clientes={clientes}
            establecimientos={establecimientos}
            setEstablecimientos={setEstablecimientos}
            categorias={categorias}
            loadEstablecimientos={loadEstablecimientos}
            sectorCatalog={sectorCatalog}
          />
        ) : (
          <ViewFields
            sistema={sistema}
            cliente={cliente}
            establecimiento={establecimiento}
            categoria={categoria}
            onShowQR={() => setShowQR(true)}
          />
        )}
      </Card>

      {showGC && (
        <Card compact>
          {editing ? (
            <GCPortsGrid
              value={formData.configuracionGC ?? {}}
              onChange={v => setFormData({ ...formData, configuracionGC: v })}
            />
          ) : (
            <GCPortsGrid
              value={sistema.configuracionGC ?? {}}
              onChange={() => {}}
              readOnly
            />
          )}
        </Card>
      )}

      {showQR && sistema.agsVisibleId && (
        <QREquipoModal
          agsVisibleId={sistema.agsVisibleId}
          equipoNombre={sistema.nombre}
          onClose={() => setShowQR(false)}
        />
      )}
    </div>
  );
};

/* ---- View mode fields ---- */
interface ViewFieldsProps {
  sistema: Sistema;
  cliente: Cliente | undefined;
  establecimiento: Establecimiento | null;
  categoria: CategoriaEquipo | undefined;
  onShowQR: () => void;
}

const ViewFields: React.FC<ViewFieldsProps> = ({ sistema, cliente, establecimiento, categoria, onShowQR }) => {
  const { pathname } = useLocation();
  return (
  <div className="space-y-3">
    <div>
      <p className={lbl}>Cliente</p>
      {cliente ? (
        <Link to={`/clientes/${cliente.id}`} state={{ from: pathname }} className="text-xs text-indigo-600 hover:underline font-medium">
          {cliente.razonSocial}
        </Link>
      ) : (
        <p className={val}>-</p>
      )}
    </div>
    {establecimiento && (
      <div>
        <p className={lbl}>Establecimiento</p>
        <p className={val}>{establecimiento.nombre}</p>
      </div>
    )}
    <div>
      <p className={lbl}>Categoria</p>
      <p className={val}>{categoria?.nombre || '-'}</p>
    </div>
    <div>
      <p className={lbl}>Codigo Interno</p>
      <p className={`${val} font-mono`}>{sistema.codigoInternoCliente || '-'}</p>
    </div>
    <div>
      <p className={lbl}>Software</p>
      <p className={`${val} font-semibold`}>{sistema.software || '-'}</p>
    </div>
    <div>
      <p className={lbl}>Sector</p>
      <p className={val}>{sistema.sector || '-'}</p>
    </div>
    {/* AGS ID + QR */}
    <div>
      <p className={lbl}>ID AGS</p>
      <div className="flex items-center gap-2">
        <p className={`${val} font-mono`}>{sistema.agsVisibleId || '-'}</p>
        {sistema.agsVisibleId && (
          <button
            type="button"
            onClick={onShowQR}
            className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium underline"
          >
            Ver QR
          </button>
        )}
      </div>
    </div>
    <div>
      <p className={lbl}>Contrato</p>
      {sistema.enContrato ? (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          En contrato
        </span>
      ) : (
        <p className={val}>Per-Incident</p>
      )}
    </div>
    {sistema.observaciones && (
      <div>
        <p className={lbl}>Observaciones</p>
        <p className={`${val} italic`}>{sistema.observaciones}</p>
      </div>
    )}
  </div>
  );
};

/* ---- Edit mode form ---- */
interface EditFormProps {
  formData: any;
  setFormData: (data: any) => void;
  clientes: Cliente[];
  establecimientos: Establecimiento[];
  setEstablecimientos: (list: Establecimiento[]) => void;
  categorias: CategoriaEquipo[];
  loadEstablecimientos: (clienteId: string) => Promise<Establecimiento[]>;
  sectorCatalog: SectorCatalog[];
}

const EditForm: React.FC<EditFormProps> = ({
  formData,
  setFormData,
  clientes,
  establecimientos,
  setEstablecimientos,
  categorias,
  loadEstablecimientos,
  sectorCatalog,
}) => {
  const [generating, setGenerating] = useState(false);

  async function handleGenerateId() {
    setGenerating(true);
    try {
      const nextId = await sistemasService.generateNextAgsVisibleId();
      setFormData({ ...formData, agsVisibleId: nextId });
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className={lbl}>Cliente</label>
        <SearchableSelect
          value={formData.clienteId}
          onChange={async (value) => {
            setFormData({ ...formData, clienteId: value, establecimientoId: '' });
            const list = value ? await loadEstablecimientos(value) : [];
            setEstablecimientos(list);
          }}
          options={clientes.map(c => ({ value: c.id, label: `${c.razonSocial}${c.cuit ? ` (${c.cuit})` : ''}` }))}
          placeholder="Seleccionar..."
        />
      </div>
      <div>
        <label className={lbl}>Establecimiento *</label>
        <SearchableSelect
          value={formData.establecimientoId}
          onChange={(value) => setFormData({ ...formData, establecimientoId: value })}
          options={establecimientos.map(e => ({ value: e.id, label: e.nombre }))}
          placeholder={formData.clienteId ? 'Seleccionar...' : 'Primero seleccione cliente'}
        />
      </div>
      <div>
        <label className={lbl}>Categoria *</label>
        <SearchableSelect
          value={formData.categoriaId}
          onChange={(value) => setFormData({ ...formData, categoriaId: value })}
          options={categorias.map(cat => ({ value: cat.id, label: cat.nombre }))}
          placeholder="Seleccionar..."
          required
        />
      </div>
      <div>
        <label className={lbl}>Nombre *</label>
        <Input
          inputSize="sm"
          value={formData.nombre}
          onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
          required
        />
      </div>
      <div>
        <label className={lbl}>Codigo Interno Cliente</label>
        <Input
          inputSize="sm"
          value={formData.codigoInternoCliente}
          onChange={(e) => setFormData({ ...formData, codigoInternoCliente: e.target.value })}
        />
      </div>
      <div>
        <label className={lbl}>Software *</label>
        <Input
          inputSize="sm"
          value={formData.software}
          onChange={(e) => setFormData({ ...formData, software: e.target.value })}
          placeholder="Ej: OpenLab, ChemStation, MassHunter..."
          required
        />
      </div>
      <div>
        <label className={lbl}>Sector</label>
        {(() => {
          const selectedEst = establecimientos.find(e => e.id === formData.establecimientoId);
          const estSectores = selectedEst?.sectores || [];
          // Merge: sectores del establecimiento + catálogo global
          const allNames = new Set(estSectores);
          sectorCatalog.forEach(s => allNames.add(s.nombre));
          const sectorOptions = [
            { value: '', label: 'Sin sector' },
            ...[...allNames].sort().map(n => ({ value: n, label: n })),
          ];
          return (
            <SearchableSelect
              value={formData.sector || ''}
              onChange={(value) => setFormData({ ...formData, sector: value })}
              options={sectorOptions}
              placeholder="Seleccionar sector..."
              creatable createLabel="Crear sector"
            />
          );
        })()}
      </div>
      {/* AGS ID */}
      <div>
        <label className={lbl}>ID AGS</label>
        <div className="flex gap-1.5">
          <Input
            inputSize="sm"
            value={formData.agsVisibleId ?? ''}
            onChange={(e) => setFormData({ ...formData, agsVisibleId: e.target.value || null })}
            placeholder="AGS-EQ-0001"
            className="font-mono flex-1"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateId}
            disabled={generating}
            type="button"
          >
            {generating ? '...' : 'Auto'}
          </Button>
        </div>
      </div>
      <div>
        <label className={lbl}>Observaciones</label>
        <textarea
          value={formData.observaciones}
          onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
          rows={2}
          className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs"
        />
      </div>
      {/* Contrato toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={!!formData.enContrato}
          onChange={(e) => setFormData({ ...formData, enContrato: e.target.checked })}
          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
        />
        <span className="text-xs text-slate-700 font-medium">En contrato</span>
      </label>
    </div>
  );
};
