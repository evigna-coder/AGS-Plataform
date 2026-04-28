import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BuscarOTStep } from '../components/recepcion/BuscarOTStep';
import { DatosBasicosStep, type DatosBasicosForm } from '../components/recepcion/DatosBasicosStep';
import { CapturaFotosStep } from '../components/recepcion/CapturaFotosStep';
import { Button } from '../components/ui/Button';
import { fichasPropiedadService } from '../services/fichasPropiedadService';
import { leadsService } from '../services/firebaseService';
import type { WorkOrder, Lead } from '@ags/shared';

type Step = 'ot' | 'cliente' | 'fotos' | 'done';

interface FichaCreada {
  id: string;
  numero: string;
  itemId: string;
}

/**
 * Wizard de recepción de equipos en planta — versión mínima.
 *
 * Flujo:
 *   1. ot      → buscar/saltear OT (si trae OT, hereda cliente y datos del equipo)
 *   2. cliente → solo si NO vino OT (sino se saltea)
 *   3. fotos   → captura múltiple a IndexedDB → cola sube cuando hay red
 *
 * Todo lo demás (sistema, módulo, serie, problema, accesorios, vía de ingreso, etc.)
 * se completa después desde sistema-modular. Acá solo cargamos lo mínimo para que
 * la ficha exista y se le puedan colgar fotos.
 */
export default function RecepcionPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('ot');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [ficha, setFicha] = useState<FichaCreada | null>(null);

  const handleOTContinue = async (selected: WorkOrder | null) => {
    if (selected) {
      // Si trae OT, ya tenemos el cliente — saltamos el paso 2 y creamos la ficha.
      await createFichaAndAdvance({
        clienteId: selected.clienteId ?? '',
        clienteNombre: selected.razonSocial,
      }, selected);
    } else {
      setStep('cliente');
    }
  };

  const handleClienteSubmit = async (form: DatosBasicosForm) => {
    await createFichaAndAdvance(form, null);
  };

  const createFichaAndAdvance = async (form: DatosBasicosForm, fromOT: WorkOrder | null) => {
    setCreating(true);
    setCreateError(null);
    try {
      // Construyo un hint de descripción para el item placeholder a partir de la OT
      // si la hay, para que materiales lo vea identificable antes de completarlo.
      const hint = fromOT
        ? [fromOT.sistema, fromOT.moduloModelo].filter(Boolean).join(' · ') || null
        : null;
      const result = await fichasPropiedadService.create({
        clienteId: form.clienteId,
        clienteNombre: form.clienteNombre,
        establecimientoId: fromOT?.establecimientoId ?? null,
        establecimientoNombre: null,
        articuloDescripcionHint: hint,
        serieHint: fromOT?.moduloSerie ?? null,
        // Defaults para campos requeridos del modelo. Se editan luego desde sistema-modular.
        viaIngreso: 'envio',
        traidoPor: '',
        fechaIngreso: new Date().toISOString(),
        otReferencia: fromOT?.otNumber ?? null,
        otNumber: fromOT?.otNumber ?? null,
      });
      setFicha(result);
      void crearTicketRecepcion(result, form, fromOT);
      setStep('fotos');
    } catch (err) {
      console.error('Error creando ficha:', err);
      setCreateError(err instanceof Error ? err.message : 'No se pudo crear la ficha');
    } finally {
      setCreating(false);
    }
  };

  const handleFotosDone = () => {
    setStep('done');
  };

  if (step === 'ot') {
    return (
      <div className="max-w-md mx-auto px-4 py-4">
        <BuscarOTStep onContinue={ot => void handleOTContinue(ot)} />
        {creating && (
          <p className="mt-3 text-xs text-slate-500 text-center">Creando ficha…</p>
        )}
        {createError && (
          <p className="mt-3 text-xs text-red-600 text-center">{createError}</p>
        )}
      </div>
    );
  }

  if (step === 'cliente') {
    return (
      <div className="max-w-md mx-auto px-4 py-4">
        <DatosBasicosStep
          onSubmit={form => void handleClienteSubmit(form)}
          onBack={() => setStep('ot')}
        />
        {creating && (
          <p className="mt-3 text-xs text-slate-500 text-center">Creando ficha…</p>
        )}
        {createError && (
          <p className="mt-3 text-xs text-red-600 text-center">{createError}</p>
        )}
      </div>
    );
  }

  if (step === 'fotos' && ficha) {
    return (
      <div className="max-w-md mx-auto px-4 py-4">
        <CapturaFotosStep
          fichaId={ficha.id}
          fichaNumero={ficha.numero}
          itemId={ficha.itemId}
          itemSubId={`${ficha.numero}-1`}
          momento="ingreso"
          onDone={handleFotosDone}
          doneLabel="Finalizar recepción"
        />
      </div>
    );
  }

  // done
  return (
    <div className="max-w-md mx-auto px-4 py-8 text-center space-y-4">
      <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
        <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Ficha creada</h2>
        <p className="font-mono text-teal-700 text-sm mt-1">{ficha?.numero}</p>
        <p className="text-xs text-slate-500 mt-2">
          Las fotos se siguen sincronizando en segundo plano.<br />
          Materiales recibió el aviso para completar la ficha.
        </p>
      </div>
      <div className="space-y-2">
        <Button onClick={() => { setStep('ot'); setFicha(null); }} className="w-full" size="lg">
          Recibir otro equipo
        </Button>
        <Button variant="outline" onClick={() => navigate('/leads')} className="w-full" size="lg">
          Ir a tickets
        </Button>
      </div>
    </div>
  );
}

/**
 * Crea un ticket en `leads` con `area: admin_soporte` para que materiales sepa
 * que entró un equipo y debe completar la ficha. Best-effort.
 */
async function crearTicketRecepcion(
  ficha: FichaCreada,
  form: DatosBasicosForm,
  ot: WorkOrder | null,
): Promise<void> {
  try {
    const desc = `Equipo recibido — completar ficha ${ficha.numero}${
      ot ? ` para OT-${ot.otNumber}` : ''
    }.`;
    const lead: Omit<Lead, 'id' | 'updatedAt'> = {
      clienteId: form.clienteId || null,
      contactoId: null,
      razonSocial: form.clienteNombre,
      contacto: '',
      email: '',
      telefono: '',
      motivoLlamado: 'soporte',
      motivoContacto: `Recepción de equipo${ot ? ` · OT-${ot.otNumber}` : ''}`,
      sistemaId: null,
      estado: 'nuevo',
      postas: [],
      asignadoA: null,
      derivadoPor: null,
      areaActual: 'admin_soporte',
      descripcion: desc,
      prioridad: 'normal',
      otIds: ot ? [ot.otNumber] : [],
      presupuestosIds: [],
      source: 'portal',
      createdAt: new Date().toISOString(),
    };
    await leadsService.create(lead);
  } catch (err) {
    console.error('No se pudo crear ticket de recepción:', err);
  }
}
