import { useEffect, useState } from 'react';
import type { Presupuesto, Sistema } from '@ags/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import {
  misOTService,
  type MisOTDoc,
  type ParteSolicitada,
  type ArticuloStockOption,
} from '../../services/misOTService';
import { PartesSolicitadasEditor, ROW_VACIA, type ParteRow } from './PartesSolicitadasEditor';

interface Props {
  open: boolean;
  onClose: () => void;
  ot: MisOTDoc;
  sistema: Sistema | null;
  /**
   * Modo EDICIÓN (2026-09-10): presupuesto en borrador que nació de esta OT.
   * Se precargan sus partes y al confirmar se actualizan los ítems en vez de
   * crear uno nuevo. Null/ausente = alta.
   */
  presupuesto?: Presupuesto | null;
  /** Edición guardada: el caller refresca lo vinculado a la OT. */
  onSaved?: () => void;
}

type Step = 'confirm' | 'working' | 'done' | 'error';

/** Filas del editor a partir de los ítems de un presupuesto existente. */
function rowsDePresupuesto(p: Presupuesto): ParteRow[] {
  const rows = (p.items ?? []).map(it => ({
    itemId: it.id,
    articuloId: it.stockArticuloId ?? null,
    numeroParte: it.codigoProducto || it.descripcion,
    descripcion: it.descripcion,
    cantidad: String(it.cantidad),
  }));
  return rows.length > 0 ? rows : [{ ...ROW_VACIA }];
}

/**
 * Flujo "Solicitar presupuesto" desde una OT:
 * el ingeniero busca la parte en el stock (o tipea el número si no está) +
 * cantidad → van como items sin precio al presupuesto, con descripción ya
 * cargada → confirma → número atómico + presupuesto borrador + ticket a
 * ventas → muestra el número PRE-XXXX.RR bien visible.
 *
 * Con `presupuesto` edita uno ya creado (mientras siga en borrador): agregar,
 * quitar o cambiar cantidades. Los ítems que ventas ya cotizó conservan el precio.
 */
export default function SolicitarPresupuestoModal({ open, onClose, ot, sistema, presupuesto = null, onSaved }: Props) {
  const editando = !!presupuesto;
  const [step, setStep] = useState<Step>('confirm');
  const [numero, setNumero] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [partes, setPartes] = useState<ParteRow[]>([{ ...ROW_VACIA }]);
  const [articulos, setArticulos] = useState<ArticuloStockOption[]>([]);

  useEffect(() => {
    if (!open || articulos.length > 0) return;
    misOTService.getArticulosStock().then(setArticulos).catch(err =>
      console.error('[SolicitarPresupuesto] articulos load failed:', err));
  }, [open, articulos.length]);

  // Precarga al abrir en edición (o vuelve a una fila vacía en alta).
  useEffect(() => {
    if (!open) return;
    setStep('confirm'); setNumero(''); setErrorMsg('');
    setPartes(presupuesto ? rowsDePresupuesto(presupuesto) : [{ ...ROW_VACIA }]);
  }, [open, presupuesto]);

  const handleClose = () => { if (step !== 'working') onClose(); };

  // Cantidades FRACCIONARIAS (2026-08-13): se cotiza medio kit ("0,5") cuando
  // solo se usa una parte del contenido. Antes esto era `parseInt`, que
  // convertía 0,5 en 0, más una validación de ≥ 1 y un `min={1}` en el input:
  // tres frenos para el mismo caso. Se acepta coma o punto — en es-AR el
  // teclado numérico escribe coma y `parseFloat('0,5')` da 0.
  const aCantidad = (v: string): number => parseFloat(v.replace(',', '.')) || 0;
  const partesLimpias: ParteSolicitada[] = partes
    .filter(p => p.numeroParte.trim())
    .map(p => ({
      itemId: p.itemId,
      numeroParte: p.numeroParte.trim(),
      cantidad: aCantidad(p.cantidad),
      descripcion: p.descripcion || null,
      stockArticuloId: p.articuloId,
    }));
  const partesValidas = partesLimpias.length > 0 && partesLimpias.every(p => p.cantidad > 0);

  async function handleConfirm() {
    setStep('working');
    try {
      if (presupuesto) {
        await misOTService.actualizarPartesPresupuesto(presupuesto, partesLimpias);
        setNumero(presupuesto.numero);
        onSaved?.();
      } else {
        const res = await misOTService.solicitarPresupuesto(ot, sistema, partesLimpias);
        setNumero(res.numero);
      }
      setStep('done');
    } catch (err) {
      console.error('[SolicitarPresupuesto] failed:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Error inesperado');
      setStep('error');
    }
  }

  const equipoLabel = [sistema?.nombre || ot.sistema, sistema?.agsVisibleId].filter(Boolean).join(' · ');

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={editando ? `Editar presupuesto ${presupuesto!.numero}` : 'Solicitar presupuesto'}
      footer={
        step === 'confirm' ? (
          <>
            <Button variant="secondary" onClick={handleClose}>Cancelar</Button>
            <Button onClick={handleConfirm} disabled={!partesValidas}>
              {editando ? 'Guardar cambios' : 'Generar presupuesto'}
            </Button>
          </>
        ) : step === 'done' || step === 'error' ? (
          <Button onClick={handleClose}>Cerrar</Button>
        ) : undefined
      }
    >
      {step === 'confirm' && (
        <div className="space-y-3 text-sm text-slate-700">
          {editando ? (
            <p>
              El presupuesto <span className="font-mono font-semibold">{presupuesto!.numero}</span> sigue
              en borrador: podés agregar, quitar o cambiar cantidades. Las partes que ventas ya
              cotizó conservan su precio.
            </p>
          ) : (
            <p>
              Se va a crear un presupuesto <strong>en borrador</strong> vinculado a la
              OT <span className="font-mono font-semibold">{ot.otNumber}</span> y un ticket
              al encargado de presupuestos para ponerle precios y enviarlo.
            </p>
          )}
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 space-y-1 text-xs">
            <p><span className="font-mono text-[10px] uppercase tracking-wider text-slate-500 mr-2">Cliente</span>{ot.razonSocial || '—'}</p>
            <p><span className="font-mono text-[10px] uppercase tracking-wider text-slate-500 mr-2">Equipo</span>{equipoLabel || '—'}</p>
            <p><span className="font-mono text-[10px] uppercase tracking-wider text-slate-500 mr-2">Servicio</span>{ot.tipoServicio || '—'}</p>
          </div>

          <PartesSolicitadasEditor partes={partes} onChange={setPartes} articulos={articulos} />
        </div>
      )}

      {step === 'working' && (
        <div className="py-6 text-center space-y-2">
          <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-600">{editando ? 'Guardando cambios…' : 'Generando presupuesto…'}</p>
        </div>
      )}

      {step === 'done' && (
        <div className="py-4 text-center space-y-3">
          <p className="text-sm text-slate-600">{editando ? 'Se actualizó el presupuesto' : 'Se generó el presupuesto'}</p>
          <p className="font-mono text-3xl font-bold text-teal-800 tracking-tight">{numero}</p>
          <p className="text-xs text-slate-500">
            {editando
              ? `Las partes quedaron actualizadas en el borrador vinculado a la OT ${ot.otNumber}. Ventas las ve al abrir el presupuesto.`
              : `Quedó en borrador, vinculado a la OT ${ot.otNumber}. Se creó un ticket al encargado de presupuestos para ponerle precios y enviarlo al cliente.`}
          </p>
        </div>
      )}

      {step === 'error' && (
        <div className="py-3 space-y-2">
          <p className="text-sm font-semibold text-red-700">
            {editando ? 'No se pudo guardar el presupuesto.' : 'No se pudo generar el presupuesto.'}
          </p>
          <p className="text-xs text-slate-500 break-words">{errorMsg}</p>
          <p className="text-xs text-slate-500">Verificá la conexión y volvé a intentar.</p>
        </div>
      )}
    </Modal>
  );
}
