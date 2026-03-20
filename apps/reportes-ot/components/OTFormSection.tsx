import React, { useState, useCallback } from 'react';
import { SmartSelect } from './ui/SmartSelect';
import { formatDateToDDMMYYYY, parseDDMMYYYYToISO, isValidDDMMYYYY } from '../services/utils';
import { calcHours, isValidTimeHHMM } from '../services/time';

// ── Contactos adicionales (para futuro envío directo) ──
function ContactosAdicionales({ contactos, contactoPrincipalId, readOnly }: {
  contactos: { id: string; nombre: string; email: string; esPrincipal: boolean }[];
  contactoPrincipalId: string | null;
  readOnly: boolean;
}) {
  const [extras, setExtras] = useState<string[]>([]);
  const available = contactos.filter(c => c.id !== contactoPrincipalId && !extras.includes(c.id));

  const addContacto = useCallback((id: string) => {
    if (id) setExtras(prev => [...prev, id]);
  }, []);

  const removeContacto = useCallback((id: string) => {
    setExtras(prev => prev.filter(x => x !== id));
  }, []);

  const selectedExtras = contactos.filter(c => extras.includes(c.id));

  if (contactos.length <= 1) return null;

  return (
    <div className="mt-2">
      {selectedExtras.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {selectedExtras.map(c => (
            <span key={c.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-200 rounded-full text-xs text-blue-700">
              {c.nombre} {c.email && <span className="text-blue-400">({c.email})</span>}
              {!readOnly && (
                <button type="button" onClick={() => removeContacto(c.id)}
                  className="ml-0.5 text-blue-400 hover:text-red-500 font-bold">&times;</button>
              )}
            </span>
          ))}
        </div>
      )}
      {!readOnly && available.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            className="border rounded-lg px-2 py-1 text-xs text-slate-600 bg-white border-slate-200"
            value=""
            onChange={(e) => addContacto(e.target.value)}
          >
            <option value="">+ Agregar contacto...</option>
            {available.map(c => (
              <option key={c.id} value={c.id}>{c.nombre} {c.email ? `(${c.email})` : ''}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

interface OTFormSectionProps {
  // OT
  otInput: string;
  setOtInput: (v: string) => void;
  readOnlyByStatus: boolean;
  readOnly: boolean;
  confirmLoadOt: () => void;
  baseInputClass: string;
  // Cliente
  razonSocial: string;
  setRazonSocial: (v: string) => void;
  contacto: string;
  setContacto: (v: string) => void;
  emailPrincipal: string;
  setEmailPrincipal: (v: string) => void;
  direccion: string;
  setDireccion: (v: string) => void;
  localidad: string;
  setLocalidad: (v: string) => void;
  provincia: string;
  setProvincia: (v: string) => void;
  // Equipo
  sistema: string;
  setSistema: (v: string) => void;
  codigoInternoCliente: string;
  setCodigoInternoCliente: (v: string) => void;
  moduloModelo: string;
  setModuloModelo: (v: string) => void;
  moduloDescripcion: string;
  setModuloDescripcion: (v: string) => void;
  moduloSerie: string;
  setModuloSerie: (v: string) => void;
  // Fechas
  fechaInicio: string;
  setFechaInicio: (v: string) => void;
  fechaFin: string;
  setFechaFin: (v: string) => void;
  fechaInicioDisplay: string;
  setFechaInicioDisplay: (v: string) => void;
  fechaFinDisplay: string;
  setFechaFinDisplay: (v: string) => void;
  horaInicio: string;
  setHoraInicio: (v: string) => void;
  horaFin: string;
  setHoraFin: (v: string) => void;
  horasTrabajadas: string;
  setHorasTrabajadas: (v: string) => void;
  tiempoViaje: string;
  setTiempoViaje: (v: string) => void;
  manualHoras: boolean;
  setManualHoras: (v: boolean) => void;
  // Entity selectors
  entitySelectors: any;
  // Interaction marker
  markUserInteracted: () => void;
}

export const OTFormSection: React.FC<OTFormSectionProps> = ({
  otInput, setOtInput, readOnlyByStatus, readOnly, confirmLoadOt, baseInputClass,
  razonSocial, setRazonSocial, contacto, setContacto, emailPrincipal, setEmailPrincipal,
  direccion, setDireccion, localidad, setLocalidad, provincia, setProvincia,
  sistema, setSistema, codigoInternoCliente, setCodigoInternoCliente,
  moduloModelo, setModuloModelo, moduloDescripcion, setModuloDescripcion,
  moduloSerie, setModuloSerie,
  fechaInicio, setFechaInicio, fechaFin, setFechaFin,
  fechaInicioDisplay, setFechaInicioDisplay, fechaFinDisplay, setFechaFinDisplay,
  horaInicio, setHoraInicio, horaFin, setHoraFin,
  horasTrabajadas, setHorasTrabajadas, tiempoViaje, setTiempoViaje,
  manualHoras, setManualHoras,
  entitySelectors, markUserInteracted,
}) => {
  return (
    <div
      className="lg:col-span-8 space-y-4"
      onChange={markUserInteracted}
      onInput={markUserInteracted}
    >
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Datos del Cliente</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-[9px] font-bold text-slate-500 uppercase block mb-0.5">
              OT #
            </label>

            <input
              type="text"
              value={otInput}

              onChange={(e) => {
                if (readOnlyByStatus) return;

                // Detener propagación para evitar que markUserInteracted se dispare
                e.stopPropagation();

                let value = e.target.value;

                // Solo números y punto
                value = value.replace(/[^0-9.]/g, '');

                // Si llega a 5 dígitos sin punto → agregar "."
                if (/^\d{5}$/.test(value)) {
                  value = value + '.';
                }

                // Máximo: 5 dígitos + punto + 2 decimales
                if (!/^\d{0,5}(\.\d{0,2})?$/.test(value)) {
                  return;
                }

                setOtInput(value);
                // NO marcar hasUserInteracted solo por editar otInput - evita autosave prematuro
              }}

              onBlur={(e) => {
                if (readOnlyByStatus) return;
                const v = (e.target as HTMLInputElement).value.trim();
                if (!v) return;
                setOtInput(v);
                // Validar y cargar OT al salir del campo
                confirmLoadOt();
              }}

              maxLength={10}
              disabled={readOnlyByStatus}

              className={`w-full border rounded-lg px-3 py-1.5 text-sm font-mono font-bold
              ${baseInputClass}
                ${readOnlyByStatus
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-white border-slate-300 text-blue-700'}
              `}
            />
          </div>
          <div>
            <label className="text-[9px] font-bold text-slate-500 uppercase block mb-0.5">
              Razón Social
            </label>
            {entitySelectors.manualMode.cliente ? (
              <>
                <input
                  type="text"
                  value={razonSocial}
                  onChange={(e) => { if (readOnly) return; setRazonSocial(e.target.value); }}
                  disabled={readOnly}
                  placeholder=""
                  className={`w-full border rounded-lg px-3 py-1.5 text-sm font-bold
                    ${readOnly ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white border-slate-300'}`}
                />
                {!readOnly && (
                  <button type="button" onClick={() => entitySelectors.toggleManualMode('cliente')}
                    className="text-[9px] text-blue-600 mt-0.5 hover:underline">
                    Buscar en base de datos
                  </button>
                )}
              </>
            ) : (
              <>
                <SmartSelect
                  value={entitySelectors.clienteId || ''}
                  onChange={entitySelectors.selectCliente}
                  options={entitySelectors.clienteOptions}
                  placeholder="Seleccionar cliente..."
                  disabled={readOnly}
                  loading={entitySelectors.loadingClientes}
                />
                {!readOnly && (
                  <button type="button" onClick={() => entitySelectors.toggleManualMode('cliente')}
                    className="text-[9px] text-slate-400 mt-0.5 hover:underline">
                    Escribir manualmente
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Establecimiento + Sector (visible solo si hay cliente seleccionado desde DB) */}
        {entitySelectors.clienteId && !entitySelectors.manualMode.cliente && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase block mb-0.5">Establecimiento</label>
                <SmartSelect
                  value={entitySelectors.establecimientoId || ''}
                  onChange={(id: string) => entitySelectors.selectEstablecimiento(id)}
                  options={entitySelectors.establecimientoOptions}
                  placeholder="Seleccionar establecimiento..."
                  disabled={readOnly}
                  loading={entitySelectors.loadingEstablecimientos}
                />
              </div>
              {entitySelectors.establecimientoId && entitySelectors.sectorOptions.length > 0 && (
                <div>
                  <label className="text-[9px] font-bold text-slate-500 uppercase block mb-0.5">Sector</label>
                  <SmartSelect
                    value={entitySelectors.selectedSector || ''}
                    onChange={entitySelectors.selectSector}
                    options={entitySelectors.sectorOptions}
                    placeholder="Seleccionar sector..."
                    disabled={readOnly}
                  />
                </div>
              )}
            </div>
            {/* Contacto principal */}
            {entitySelectors.establecimientoId && entitySelectors.contactoOptions.length > 0 && (
              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase block mb-0.5">Contacto</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <SmartSelect
                    value={entitySelectors.contactoId || ''}
                    onChange={entitySelectors.selectContacto}
                    options={entitySelectors.contactoOptions}
                    placeholder="Seleccionar contacto..."
                    disabled={readOnly}
                  />
                  <input
                    type="email"
                    value={emailPrincipal}
                    placeholder="correo@ejemplo.com"
                    onChange={(e) => { if (readOnly) return; setEmailPrincipal(e.target.value); }}
                    disabled={readOnly}
                    className={`w-full border rounded-lg px-3 py-1.5 text-sm
                      ${readOnly ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white border-slate-300'}`}
                  />
                </div>
                {/* Contactos adicionales */}
                <ContactosAdicionales
                  contactos={entitySelectors.contactos}
                  contactoPrincipalId={entitySelectors.contactoId}
                  readOnly={readOnly}
                />
              </div>
            )}
          </>
        )}

        {/* Fallback: contacto manual cuando no hay selector de DB */}
        {!(entitySelectors.establecimientoId && entitySelectors.contactoOptions.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              value={contacto}
              placeholder="Persona de contacto"
              onChange={(e) => { if (readOnly) return; setContacto(e.target.value); }}
              disabled={readOnly}
              className={`w-full border rounded-lg px-3 py-1.5 text-sm
                ${readOnly ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white border-slate-300'}`}
            />
            <input
              type="email"
              value={emailPrincipal}
              placeholder="correo@ejemplo.com"
              onChange={(e) => { if (readOnly) return; setEmailPrincipal(e.target.value); }}
              disabled={readOnly}
              className={`w-full border rounded-lg px-3 py-1.5 text-sm
                ${readOnly ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white border-slate-300'}`}
            />
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            value={direccion}
            placeholder="Calle y número"
            onChange={(e) => { if (readOnly) return; setDireccion(e.target.value); }}
            disabled={readOnly}
            className={`w-full border rounded-lg px-3 py-1.5 text-sm
              ${readOnly ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white border-slate-300'}`}
          />
          <input
            type="text"
            value={localidad}
            placeholder="Localidad"
            onChange={(e) => { if (readOnly) return; setLocalidad(e.target.value); }}
            disabled={readOnly}
            className={`w-full border rounded-lg px-3 py-1.5 text-sm
              ${readOnly ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white border-slate-300'}`}
          />
          <input
            type="text"
            value={provincia}
            placeholder="Provincia"
            onChange={(e) => { if (readOnly) return; setProvincia(e.target.value); }}
            disabled={readOnly}
            className={`w-full border rounded-lg px-3 py-1.5 text-sm
              ${readOnly ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white border-slate-300'}`}
          />
        </div>

        <div className="border-t pt-3">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
            ID Equipo
          </h3>

          <div className="mb-3">
              {entitySelectors.manualMode.sistema || entitySelectors.manualMode.cliente ? (
                <>
                  <input
                    type="text"
                    value={sistema}
                    placeholder="Nombre del sistema intervenido"
                    onChange={(e) => { if (readOnly) return; setSistema(e.target.value); }}
                    disabled={readOnly}
                    className={`w-full border rounded-lg px-3 py-1.5 text-sm font-bold
                      ${readOnly ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white border-slate-300'}`}
                  />
                  {!readOnly && !entitySelectors.manualMode.cliente && (
                    <button type="button" onClick={() => entitySelectors.toggleManualMode('sistema')}
                      className="text-[9px] text-blue-600 mt-0.5 hover:underline">
                      Buscar en base de datos
                    </button>
                  )}
                </>
              ) : (
                <>
                  <SmartSelect
                    value={entitySelectors.sistemaId || ''}
                    onChange={(id: string) => entitySelectors.selectSistema(id)}
                    options={entitySelectors.sistemaOptions}
                    placeholder={entitySelectors.establecimientoId ? 'Seleccionar equipo...' : 'Primero seleccionar establecimiento'}
                    disabled={readOnly || !entitySelectors.establecimientoId}
                    loading={entitySelectors.loadingSistemas}
                  />
                  {!readOnly && (
                    <button type="button" onClick={() => entitySelectors.toggleManualMode('sistema')}
                      className="text-[9px] text-slate-400 mt-0.5 hover:underline">
                      Escribir manualmente
                    </button>
                  )}
                </>
              )}
          </div>

          {/* Selector de módulo (visible si hay sistema seleccionado desde DB) */}
          {entitySelectors.sistemaId && !entitySelectors.manualMode.sistema && entitySelectors.moduloOptions.length > 0 && (
            <div className="mb-3">
              <label className="text-[9px] font-bold text-slate-500 uppercase block mb-0.5">Módulo</label>
              <SmartSelect
                value={entitySelectors.moduloId || ''}
                onChange={(id: string) => entitySelectors.selectModulo(id)}
                options={entitySelectors.moduloOptions}
                placeholder="Seleccionar módulo..."
                disabled={readOnly}
                loading={entitySelectors.loadingModulos}
              />
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <input
              type="text"
              value={moduloModelo}
              placeholder="Modelo"
              onChange={(e) => { if (readOnly) return; setModuloModelo(e.target.value); }}
              disabled={readOnly}
              className={`w-full border rounded-lg px-3 py-1.5 text-sm
                ${readOnly ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white border-slate-300'}`}
            />
            <input
              type="text"
              value={moduloDescripcion}
              placeholder="Descripción"
              onChange={(e) => { if (readOnly) return; setModuloDescripcion(e.target.value); }}
              disabled={readOnly}
              className={`w-full border rounded-lg px-3 py-1.5 text-sm
                ${readOnly ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white border-slate-300'}`}
            />
            <input
              type="text"
              value={moduloSerie}
              placeholder="S/N o Serie"
              onChange={(e) => { if (readOnly) return; setModuloSerie(e.target.value); }}
              disabled={readOnly}
              className={`w-full border rounded-lg px-3 py-1.5 text-sm font-mono
                ${readOnly ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white border-slate-300'}`}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border-t pt-3">
          <div>
            <label className="text-[9px] font-bold text-slate-400 uppercase">Inicio</label>
            <input
              type="text"
              value={fechaInicioDisplay}
              placeholder="DD/MM/AAAA"

              onChange={(e) => {
                if (readOnly) return;
                let value = e.target.value;

                // Solo permitir números y barras
                value = value.replace(/[^\d/]/g, '');

                // Auto-formatear mientras escribe
                if (value.length > 2 && value[2] !== '/') {
                  value = value.slice(0, 2) + '/' + value.slice(2);
                }
                if (value.length > 5 && value[5] !== '/') {
                  value = value.slice(0, 5) + '/' + value.slice(5);
                }

                // Limitar a DD/MM/AAAA
                if (value.length > 10) {
                  value = value.slice(0, 10);
                }

                // Actualizar siempre el valor visible
                setFechaInicioDisplay(value);

                // Convertir a formato ISO para guardar solo si es válida o vacío
                const isoDate = parseDDMMYYYYToISO(value);
                if (isoDate || value === '') {
                  setFechaInicio(isoDate || '');
                }
              }}

              onBlur={(e) => {
                if (readOnly) return;
                const value = e.target.value;
                if (value && !isValidDDMMYYYY(value)) {
                  // Si el formato es inválido, limpiar o mantener el último válido
                  if (fechaInicio) {
                    const formatted = formatDateToDDMMYYYY(fechaInicio);
                    setFechaInicioDisplay(formatted);
                    e.target.value = formatted;
                  } else {
                    setFechaInicioDisplay('');
                    e.target.value = '';
                    setFechaInicio('');
                  }
                }
              }}

              disabled={readOnly}

              className={`w-full border rounded-lg px-2 md:px-3 py-1.5 text-[10px] md:text-xs font-mono
                ${readOnly
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-white border-slate-300'}
              `}
            />
          </div>

          <div>
            <label className="text-[9px] font-bold text-slate-400 uppercase">Fin</label>
            <input
              type="text"
              value={fechaFinDisplay}
              placeholder="DD/MM/AAAA"

              onChange={(e) => {
                if (readOnly) return;
                let value = e.target.value;

                // Solo permitir números y barras
                value = value.replace(/[^\d/]/g, '');

                // Auto-formatear mientras escribe
                if (value.length > 2 && value[2] !== '/') {
                  value = value.slice(0, 2) + '/' + value.slice(2);
                }
                if (value.length > 5 && value[5] !== '/') {
                  value = value.slice(0, 5) + '/' + value.slice(5);
                }

                // Limitar a DD/MM/AAAA
                if (value.length > 10) {
                  value = value.slice(0, 10);
                }

                // Actualizar siempre el valor visible
                setFechaFinDisplay(value);

                // Convertir a formato ISO para guardar solo si es válida o vacío
                const isoDate = parseDDMMYYYYToISO(value);
                if (isoDate || value === '') {
                  setFechaFin(isoDate || '');
                }
              }}

              onBlur={(e) => {
                if (readOnly) return;
                const value = e.target.value;
                if (value && !isValidDDMMYYYY(value)) {
                  // Si el formato es inválido, limpiar o mantener el último válido
                  if (fechaFin) {
                    const formatted = formatDateToDDMMYYYY(fechaFin);
                    setFechaFinDisplay(formatted);
                    e.target.value = formatted;
                  } else {
                    setFechaFinDisplay('');
                    e.target.value = '';
                    setFechaFin('');
                  }
                }
              }}

              disabled={readOnly}

              className={`w-full border rounded-lg px-2 md:px-3 py-1.5 text-[10px] md:text-xs font-mono
                ${readOnly
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-white border-slate-300'}
              `}
            />
          </div>

          <div>
            <label className="text-[9px] font-bold text-slate-400 uppercase">Hora inicio</label>
            <input
              type="time"
              value={horaInicio}
              onChange={(e) => {
                if (readOnly) return;
                setHoraInicio(e.target.value);
              }}
              disabled={readOnly}
              className={`w-full border rounded-lg px-2 md:px-3 py-1.5 text-[10px] md:text-xs font-mono
                ${readOnly ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white border-slate-300'}`}
            />
          </div>

          <div>
            <label className="text-[9px] font-bold text-slate-400 uppercase">Hora fin</label>
            <input
              type="time"
              value={horaFin}
              onChange={(e) => {
                if (readOnly) return;
                setHoraFin(e.target.value);
              }}
              disabled={readOnly}
              className={`w-full border rounded-lg px-2 md:px-3 py-1.5 text-[10px] md:text-xs font-mono
                ${readOnly ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white border-slate-300'}`}
            />
          </div>

          <div>
            <label className="text-[9px] font-bold text-slate-400 uppercase">Hs Lab</label>
            <input
              type="text"
              value={horasTrabajadas}
              placeholder="0.0"

              onChange={(e) => {
                if (readOnly) return;
                setManualHoras(true);
                setHorasTrabajadas(e.target.value);
              }}

              disabled={readOnly}

              className={`w-full border rounded-lg px-3 py-1.5 text-xs
                ${readOnly
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-white border-slate-300'}
              `}
            />
          </div>

          <div>
            <label className="text-[9px] font-bold text-slate-400 uppercase">Hs Trasl</label>
            <input
              type="text"
              value={tiempoViaje}
              placeholder="0.0"

              onChange={(e) => {
                if (readOnly) return;
                setTiempoViaje(e.target.value);
              }}

              disabled={readOnly}

              className={`w-full border rounded-lg px-3 py-1.5 text-xs
                ${readOnly
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-white border-slate-300'}
              `}
            />
          </div>
        </div>
        {!readOnly && (
          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px]">
            <label className="inline-flex items-center gap-1.5 text-slate-500">
              <input
                type="checkbox"
                checked={!manualHoras}
                onChange={(e) => setManualHoras(!e.target.checked)}
                className="rounded border-slate-300"
              />
              Calcular automáticamente
            </label>
            {!manualHoras && (!horaInicio || !horaFin) && (
              <span className="text-amber-600">Complete horas para calcular automáticamente.</span>
            )}
            {!manualHoras && fechaInicio && fechaFin && horaInicio && horaFin &&
             isValidTimeHHMM(horaInicio) && isValidTimeHHMM(horaFin) &&
             calcHours(fechaInicio, horaInicio, fechaFin, horaFin) <= 0 && (
              <span className="text-red-600">La hora fin debe ser posterior a la hora inicio.</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
