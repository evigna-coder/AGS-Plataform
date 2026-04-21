import { useState, useMemo } from 'react';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, collection } from 'firebase/firestore';
import type { OrdenCompraCliente, Presupuesto } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ordenesCompraClienteService } from '../../services/ordenesCompraClienteService';
import { db, storage } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import {
  TabButton, NuevaOCForm, ExistenteOCForm, OtrosPresupuestosList,
} from './CargarOCModalParts';

/**
 * FLOW-02: Modal para cargar una Orden de Compra del cliente sobre un presupuesto
 * `aceptado`. Soporta dos flows:
 *   - "Nueva OC" → upload multi-archivo + numero + fecha, crea doc nuevo
 *   - "Existente" → selecciona OC previa del cliente (N:M: una OC puede cubrir
 *     múltiples presupuestos)
 *
 * Checkbox opcional "Cubre otros presupuestos pendientes" permite linkear la
 * misma OC a otros presupuestos aceptados del cliente en el mismo submit.
 *
 * NO cambia el estado del presupuesto (lock Phase 7). El service transaccional
 * `cargarOC` se encarga de las writes multi-colección atómicas.
 */

interface Props {
  presupuesto: Presupuesto;
  open: boolean;
  onClose: () => void;
  onSuccess?: (ocId: string, numero: string) => void;
  /** OCs existentes del mismo cliente (render condicional del tab "Existente"). */
  ocsExistentes?: OrdenCompraCliente[];
  /** Otros presupuestos `aceptado` sin OC del mismo cliente (checkbox N:M). */
  otrosPresupuestosPendientes?: Presupuesto[];
}

type Tab = 'nueva' | 'existente';

function deriveTipo(filename: string): 'pdf' | 'jpg' | 'png' {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (ext === 'png') return 'png';
  return 'jpg';
}

export const CargarOCModal: React.FC<Props> = ({
  presupuesto,
  open,
  onClose,
  onSuccess,
  ocsExistentes = [],
  otrosPresupuestosPendientes = [],
}) => {
  const { firebaseUser, usuario } = useAuth();
  const [tab, setTab] = useState<Tab>(ocsExistentes.length > 0 ? 'existente' : 'nueva');
  const [numero, setNumero] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [notas, setNotas] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [existingId, setExistingId] = useState<string>('');
  const [selectedOtros, setSelectedOtros] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ocsOpts = useMemo(
    () => ocsExistentes.map(o => ({
      value: o.id,
      label: `${o.numero}${o.fecha ? ` · ${o.fecha.slice(0, 10)}` : ''}`,
    })),
    [ocsExistentes],
  );

  const canSubmit = tab === 'nueva'
    ? numero.trim().length > 0 && files.length > 0 && !submitting
    : existingId.length > 0 && !submitting;

  const presupuestosTarget = useMemo(
    () => [presupuesto.id, ...Array.from(selectedOtros)],
    [presupuesto.id, selectedOtros],
  );

  const toggleOtro = (id: string) => {
    setSelectedOtros(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(e.target.files ? Array.from(e.target.files) : []);
  };

  const uploadFiles = async (ocId: string) => Promise.all(files.map(async (file) => {
    const path = `ordenesCompraCliente/${ocId}/adjuntos/${Date.now()}_${file.name}`;
    const r = storageRef(storage, path);
    await uploadBytes(r, file);
    const url = await getDownloadURL(r);
    return {
      id: crypto.randomUUID(),
      url,
      tipo: deriveTipo(file.name),
      nombre: file.name,
      fechaCarga: new Date().toISOString(),
    };
  }));

  const leadIdForPresupuesto = presupuesto.origenTipo === 'lead' ? presupuesto.origenId ?? null : null;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const ocId = tab === 'existente' ? existingId : doc(collection(db, 'ordenesCompraCliente')).id;
      const adjuntos = tab === 'nueva' ? await uploadFiles(ocId) : [];
      const existente = tab === 'existente' ? ocsExistentes.find(o => o.id === existingId) : null;

      const payload: Omit<OrdenCompraCliente, 'id' | 'createdAt' | 'updatedAt'> = {
        numero: tab === 'nueva' ? numero.trim() : (existente?.numero || ''),
        fecha: tab === 'nueva' ? fecha : (existente?.fecha || fecha),
        clienteId: presupuesto.clienteId,
        presupuestosIds: presupuestosTarget,
        adjuntos,
        notas: tab === 'nueva' ? (notas.trim() || null) : null,
      };

      const actor = {
        uid: firebaseUser?.uid || '',
        name: usuario?.displayName || usuario?.email || 'sistema',
      };

      const { id, numero: ocNumero } = await ordenesCompraClienteService.cargarOC(
        payload,
        {
          leadId: leadIdForPresupuesto,
          presupuestosIds: presupuestosTarget,
          existingOcId: tab === 'existente' ? existingId : null,
        },
        actor,
      );

      onSuccess?.(id, ocNumero);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error al cargar OC');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="Cargar OC del cliente" subtitle={presupuesto.numero} maxWidth="md">
      {ocsExistentes.length > 0 && (
        <div className="flex gap-1 mb-4 border-b border-slate-200">
          <TabButton active={tab === 'existente'} onClick={() => setTab('existente')}>OC existente</TabButton>
          <TabButton active={tab === 'nueva'} onClick={() => setTab('nueva')}>+ Nueva OC</TabButton>
        </div>
      )}

      <div className="space-y-3">
        {tab === 'nueva' ? (
          <NuevaOCForm
            numero={numero}
            fecha={fecha}
            notas={notas}
            filesCount={files.length}
            onNumeroChange={setNumero}
            onFechaChange={setFecha}
            onNotasChange={setNotas}
            onFilesChange={handleFilesChange}
          />
        ) : (
          <ExistenteOCForm value={existingId} onChange={setExistingId} options={ocsOpts} />
        )}

        <OtrosPresupuestosList
          items={otrosPresupuestosPendientes}
          selected={selectedOtros}
          onToggle={toggleOtro}
        />

        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <Button variant="secondary" size="sm" onClick={onClose} disabled={submitting}>Cancelar</Button>
        <Button variant="primary" size="sm" onClick={handleSubmit} disabled={!canSubmit}>
          {submitting ? 'Cargando...' : 'Cargar OC'}
        </Button>
      </div>
    </Modal>
  );
};
