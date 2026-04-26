import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BuscarOTStep } from '../components/recepcion/BuscarOTStep';
import { DatosBasicosStep, type DatosBasicosForm } from '../components/recepcion/DatosBasicosStep';
import { CapturaFotosStep } from '../components/recepcion/CapturaFotosStep';
import { Button } from '../components/ui/Button';
import { fichasPropiedadService } from '../services/fichasPropiedadService';
import { leadsService } from '../services/firebaseService';
import type { WorkOrder, Lead } from '@ags/shared';

type Step = 'ot' | 'datos' | 'fotos' | 'done';

interface FichaCreada {
  id: string;
  numero: string;
}

/**
 * Wizard de recepción de equipos en planta.
 *
 * Flujo:
 *   1. ot      → buscar/saltear OT
 *   2. datos   → datos mínimos (cliente, equipo, problema, vía)
 *   3. fotos   → captura múltiple a IndexedDB → cola sube cuando hay red
 *
 * Al confirmar paso 2 ya creamos el doc en Firestore (offline-tolerant gracias a
 * persistentLocalCache) — eso nos da `numero` correlativo y permite encolar fotos
 * con el path correcto (`fotosFichas/FPC-XXXX/...`) aunque estemos offline.
 */
export default function RecepcionPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('ot');
  const [ot, setOt] = useState<WorkOrder | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [ficha, setFicha] = useState<FichaCreada | null>(null);

  const handleOTContinue = (selected: WorkOrder | null) => {
    setOt(selected);
    setStep('datos');
  };

  const handleDatosSubmit = async (form: DatosBasicosForm) => {
    setCreating(true);
    setCreateError(null);
    try {
      const result = await fichasPropiedadService.create({
        clienteId: form.clienteId,
        clienteNombre: form.clienteNombre,
        establecimientoId: ot?.establecimientoId ?? null,
        establecimientoNombre: null,
        sistemaId: ot?.sistemaId ?? null,
        sistemaNombre: form.sistemaNombre || null,
        moduloId: ot?.moduloId ?? null,
        moduloNombre: form.moduloNombre || null,
        descripcionLibre: form.descripcionLibre || null,
        codigoArticulo: null,
        serie: form.moduloSerie || null,
        viaIngreso: form.viaIngreso,
        traidoPor: form.traidoPor,
        fechaIngreso: new Date().toISOString(),
        otReferencia: ot?.otNumber ?? null,
        otNumber: ot?.otNumber ?? null,
        descripcionProblema: form.descripcionProblema,
        sintomasReportados: null,
        accesorios: [],
        condicionFisica: form.condicionFisica || null,
      });
      setFicha(result);
      // Side-effect: crear ticket a materiales (admin_soporte)
      void crearTicketRecepcion(result, form, ot);
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
        <BuscarOTStep onContinue={handleOTContinue} />
      </div>
    );
  }

  if (step === 'datos') {
    return (
      <div className="max-w-md mx-auto px-4 py-4">
        <DatosBasicosStep
          ot={ot}
          onSubmit={form => void handleDatosSubmit(form)}
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
        <Button onClick={() => { setStep('ot'); setOt(null); setFicha(null); }} className="w-full" size="lg">
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
 * que entró un equipo y debe completar la ficha. Best-effort: si falla, lo
 * logueamos pero no bloqueamos el flujo del usuario.
 */
async function crearTicketRecepcion(
  ficha: FichaCreada,
  form: DatosBasicosForm,
  ot: WorkOrder | null,
): Promise<void> {
  try {
    const desc = `Equipo recibido — completar ficha ${ficha.numero}${
      ot ? ` para OT-${ot.otNumber}` : ''
    }. Problema reportado: ${form.descripcionProblema}.`;
    const lead: Omit<Lead, 'id' | 'updatedAt'> = {
      clienteId: form.clienteId || null,
      contactoId: null,
      razonSocial: form.clienteNombre,
      contacto: form.traidoPor,
      email: '',
      telefono: '',
      motivoLlamado: 'soporte',
      motivoContacto: `Recepción de equipo · ${form.sistemaNombre || form.descripcionLibre || 'Equipo'}`,
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
