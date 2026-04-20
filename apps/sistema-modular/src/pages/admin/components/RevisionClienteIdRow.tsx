import { useState } from 'react';
import type { Ticket } from '@ags/shared';
import { Button } from '../../../components/ui/Button';
import { SearchableSelect } from '../../../components/ui/SearchableSelect';

interface RowProps {
  ticket: Ticket;
  clienteOptions: { value: string; label: string }[];
  onResolver: (ticketId: string, clienteId: string) => void | Promise<void>;
  onDescartar: (ticketId: string) => void | Promise<void>;
}

/**
 * Fila de `RevisionClienteIdPage`. Extraída por budget de 250 líneas.
 * Render de candidatos propuestos (bucket amber) o placeholder "sin candidato" (bucket red),
 * SearchableSelect para asignar cliente libre, y botón de descartar.
 */
export function RevisionClienteIdRow({ ticket, clienteOptions, onResolver, onDescartar }: RowProps) {
  const [seleccionado, setSeleccionado] = useState<string>('');
  const candidatos = ticket.candidatosPropuestos ?? [];
  const ambiguo = candidatos.length > 0;

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50">
      <td className="px-3 py-2 text-xs text-slate-800 align-top">
        <div className="font-medium truncate max-w-[200px]">{ticket.razonSocial || '—'}</div>
        <div className="text-[10px] font-mono text-slate-400 mt-0.5">{ticket.id}</div>
      </td>
      <td className="px-3 py-2 text-[11px] text-slate-500 align-top truncate max-w-[180px]">
        {ticket.motivoContacto || <span className="text-slate-300 italic">—</span>}
      </td>
      <td className="px-3 py-2 align-top">
        {ambiguo ? (
          <div className="flex flex-col gap-1">
            <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 w-fit">
              {candidatos.length} candidato{candidatos.length > 1 ? 's' : ''}
            </span>
            {candidatos.slice(0, 3).map(c => (
              <button
                key={c.clienteId}
                onClick={() => onResolver(ticket.id, c.clienteId)}
                className="text-left text-[10px] text-slate-600 hover:text-teal-700 hover:underline truncate max-w-[220px]"
                title={`Usar "${c.razonSocial}" (${c.clienteId})`}
              >
                {c.razonSocial}
                <span className="ml-1 font-mono text-[9px] text-slate-400">· {c.score}</span>
              </button>
            ))}
            {candidatos.length > 3 && (
              <span className="text-[10px] text-slate-400">+{candidatos.length - 3} más</span>
            )}
          </div>
        ) : (
          <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-50 text-red-800 border border-red-200">
            sin candidato
          </span>
        )}
      </td>
      <td className="px-3 py-2 align-top min-w-[220px]">
        <div className="flex items-center gap-1.5">
          <div className="flex-1 min-w-[160px]">
            <SearchableSelect
              value={seleccionado}
              onChange={setSeleccionado}
              options={clienteOptions}
              placeholder="Buscar cliente..."
              size="sm"
            />
          </div>
          <Button
            size="sm"
            variant="primary"
            disabled={!seleccionado}
            onClick={() => seleccionado && onResolver(ticket.id, seleccionado)}
          >
            Asignar
          </Button>
        </div>
      </td>
      <td className="px-3 py-2 text-right align-top whitespace-nowrap">
        <button
          onClick={() => onDescartar(ticket.id)}
          className="text-[10px] font-medium text-red-500 hover:text-red-700 px-1.5 py-0.5 rounded hover:bg-red-50"
        >
          Descartar
        </button>
      </td>
    </tr>
  );
}
