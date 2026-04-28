/**
 * Crea un ticket en `leads` (área admin_soporte) la primera vez que una ficha
 * tiene información sustantiva en su primer item.
 *
 * Flujo:
 *   - Recepción móvil (portal) → ficha creada con item placeholder vacío. Sin ticket.
 *   - Materiales completa el primer item desde sistema-modular (artículo + problema).
 *   - Al guardar, este helper se invoca y dispara el ticket — solo una vez por ficha.
 *
 * Se preserva el id del ticket en `ficha.leadId` para evitar duplicados y permitir
 * navegar entre ficha ↔ ticket más adelante.
 */
import type { FichaPropiedad, Lead } from '@ags/shared';
import { fichasService } from '../services/fichasService';
import { leadsService } from '../services/leadsService';

function tieneInfoMinima(ficha: FichaPropiedad): boolean {
  const first = ficha.items?.[0];
  if (!first) return false;
  const tieneIdentificacion =
    !!first.articuloId ||
    !!first.articuloDescripcion?.trim() ||
    !!first.descripcionLibre?.trim() ||
    !!first.articuloCodigo?.trim();
  const tieneProblema = !!first.descripcionProblema?.trim();
  return tieneIdentificacion && tieneProblema;
}

export async function ensureTicketForFicha(ficha: FichaPropiedad): Promise<void> {
  if (ficha.leadId) return;            // Ya tiene ticket
  if (!tieneInfoMinima(ficha)) return; // Aún no hay info suficiente

  const first = ficha.items[0];
  const equipo = first.articuloDescripcion
    || first.descripcionLibre
    || first.articuloCodigo
    || 'Equipo';
  const otRef = ficha.otIds?.[0] ?? null;

  const desc = [
    `Equipo recibido — ficha ${ficha.numero} (${ficha.items.length} item${ficha.items.length === 1 ? '' : 's'}).`,
    `Equipo: ${equipo}.`,
    first.descripcionProblema ? `Problema: ${first.descripcionProblema}.` : null,
    otRef ? `OT relacionada: ${otRef}.` : null,
  ].filter(Boolean).join(' ');

  const lead: Omit<Lead, 'id' | 'updatedAt'> = {
    clienteId: ficha.clienteId || null,
    contactoId: null,
    razonSocial: ficha.clienteNombre,
    contacto: ficha.traidoPor || '',
    email: '',
    telefono: '',
    motivoLlamado: 'soporte',
    motivoContacto: `Recepción de equipo · ${ficha.numero}`,
    sistemaId: first.articuloId ?? null,
    estado: 'nuevo',
    postas: [],
    asignadoA: null,
    derivadoPor: null,
    areaActual: 'admin_soporte',
    descripcion: desc,
    prioridad: 'normal',
    otIds: otRef ? [otRef] : [],
    presupuestosIds: [],
    source: 'manual',
    createdAt: new Date().toISOString(),
  };

  try {
    const leadId = await leadsService.create(lead);
    // Persistimos el FK en la ficha — el siguiente update no va a recrear.
    await fichasService.update(ficha.id, { leadId });
  } catch (err) {
    console.error('No se pudo crear ticket para ficha:', ficha.numero, err);
  }
}
