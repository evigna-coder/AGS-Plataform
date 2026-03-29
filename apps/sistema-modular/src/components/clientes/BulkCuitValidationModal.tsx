import { useCallback } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { validateCuitAfip, isValidCuitLocal, type CuitValidationResult } from '../../services/afipService';
import { useBackgroundTasks } from '../../contexts/BackgroundTasksContext';
import type { Cliente } from '@ags/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  clientes: Cliente[];
}

export interface CuitValidationRow {
  cliente: Cliente;
  status: 'pending' | 'validating' | 'done' | 'skipped';
  result: CuitValidationResult | null;
}

const TASK_ID = 'bulk-cuit-validation';
const DELAY_MS = 200;

export const BulkCuitValidationModal: React.FC<Props> = ({ open, onClose, clientes }) => {
  const bg = useBackgroundTasks();
  const task = bg.getTask<CuitValidationRow>(TASK_ID);

  const rows = task?.rows ?? [];
  const running = task?.running ?? false;
  const done = task?.done ?? false;
  const progress = task?.progress ?? { current: 0, total: 0 };

  const handleStart = useCallback(async () => {
    const withCuit = clientes.filter(c => c.cuit && c.cuit.trim().length >= 10);
    const noCuit = clientes.filter(c => !c.cuit || c.cuit.trim().length < 10);

    const initial: CuitValidationRow[] = [
      ...withCuit.map(c => ({ cliente: c, status: 'pending' as const, result: null })),
      ...noCuit.map(c => ({ cliente: c, status: 'skipped' as const, result: null })),
    ];

    bg.startTask<CuitValidationRow>(TASK_ID, initial, withCuit.length);

    for (let i = 0; i < withCuit.length; i++) {
      if (bg.isCancelled(TASK_ID)) break;

      const cliente = withCuit[i];
      const cuit = (cliente.cuit || '').trim();

      bg.updateRows<CuitValidationRow>(TASK_ID, prev =>
        prev.map(r => r.cliente.id === cliente.id ? { ...r, status: 'validating' } : r)
      );

      let result: CuitValidationResult;

      if (!isValidCuitLocal(cuit)) {
        result = {
          valid: false, cuit, checksumOk: false, afipFound: false,
          razonSocial: null, tipoPersona: null, estadoClave: null,
          domicilioFiscal: null, error: 'Dígito verificador incorrecto',
        };
      } else {
        try {
          result = await validateCuitAfip(cuit);
        } catch {
          result = {
            valid: false, cuit, checksumOk: true, afipFound: false,
            razonSocial: null, tipoPersona: null, estadoClave: null,
            domicilioFiscal: null, error: 'Error de conexión',
          };
        }
      }

      bg.updateRows<CuitValidationRow>(TASK_ID, prev =>
        prev.map(r => r.cliente.id === cliente.id ? { ...r, status: 'done', result } : r)
      );
      bg.setProgress(TASK_ID, i + 1);

      if (i < withCuit.length - 1 && !bg.isCancelled(TASK_ID)) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }

    bg.finishTask(TASK_ID);
  }, [clientes, bg]);

  const handleClose = () => {
    if (!running) bg.clearTask(TASK_ID);
    onClose();
  };

  const stats = {
    total: rows.length,
    valid: rows.filter(r => r.result?.valid).length,
    invalid: rows.filter(r => r.status === 'done' && !r.result?.valid).length,
    skipped: rows.filter(r => r.status === 'skipped').length,
  };

  return (
    <Modal open={open} onClose={handleClose} title="Validación masiva de CUIT"
      subtitle={`${clientes.length} clientes en el sistema`} maxWidth="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-[10px] text-slate-400">
            {done && <>Válidos: <span className="text-green-600 font-medium">{stats.valid}</span> · Inválidos: <span className="text-red-500 font-medium">{stats.invalid}</span> · Sin CUIT: {stats.skipped}</>}
          </div>
          <div className="flex gap-2">
            {!running && !done && (
              <Button size="sm" onClick={handleStart}>Iniciar validación</Button>
            )}
            {running && (
              <>
                <Button size="sm" variant="ghost" onClick={onClose}>Minimizar</Button>
                <Button size="sm" variant="outline" onClick={() => bg.cancelTask(TASK_ID)}>Detener</Button>
              </>
            )}
            {done && (
              <Button size="sm" variant="outline" onClick={handleClose}>Cerrar</Button>
            )}
          </div>
        </div>
      }>

      {/* Info banner */}
      <div className="mb-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-[10px] text-blue-700">
        Valida el dígito verificador (módulo 11) y detecta tipo de persona (Física/Jurídica). La consulta al padrón AFIP no está disponible actualmente.
        {running && <span className="block mt-1 font-medium">Podés cerrar este modal y seguir trabajando. El proceso continuará en segundo plano.</span>}
      </div>

      {/* Progress bar */}
      {(running || done) && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-slate-500">
              {running ? `Validando ${progress.current} de ${progress.total}...` : `Completado: ${progress.current} de ${progress.total}`}
            </span>
            <span className="text-[10px] text-slate-400">{progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${done ? 'bg-green-500' : 'bg-teal-500'}`}
              style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Results table */}
      {rows.length > 0 && (
        <div className="max-h-[400px] overflow-y-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50 z-10">
              <tr className="border-b border-slate-200">
                <th className="px-2 py-1.5 text-center text-[10px] font-medium text-slate-400">Cliente</th>
                <th className="px-2 py-1.5 text-center text-[10px] font-medium text-slate-400">CUIT</th>
                <th className="px-2 py-1.5 text-center text-[10px] font-medium text-slate-400">Tipo persona</th>
                <th className="px-2 py-1.5 text-center text-[10px] font-medium text-slate-400">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(row => (
                <tr key={row.cliente.id} className={row.result && !row.result.valid && row.status === 'done' ? 'bg-red-50' : ''}>
                  <td className="px-2 py-1.5 text-xs text-slate-700 truncate max-w-[180px]" title={row.cliente.razonSocial}>
                    {row.cliente.razonSocial}
                  </td>
                  <td className="px-2 py-1.5 text-xs font-mono text-slate-600 whitespace-nowrap">
                    {row.cliente.cuit || <span className="text-slate-300 italic">sin CUIT</span>}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    {row.status === 'done' && row.result?.valid && row.result.tipoPersona && (
                      <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                        row.result.tipoPersona === 'JURIDICA'
                          ? 'bg-teal-100 text-teal-700'
                          : 'bg-sky-100 text-sky-700'
                      }`}>
                        {row.result.tipoPersona === 'JURIDICA' ? 'Jurídica' : 'Física'}
                      </span>
                    )}
                    {row.status === 'skipped' && <span className="text-[9px] text-slate-300">—</span>}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    {row.status === 'validating' && <span className="text-[9px] text-teal-500 animate-pulse">Validando...</span>}
                    {row.status === 'pending' && <span className="text-[9px] text-slate-300">pendiente</span>}
                    {row.status === 'skipped' && <span className="text-[9px] text-slate-300">sin CUIT</span>}
                    {row.status === 'done' && row.result?.valid && (
                      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                        CUIT válido
                      </span>
                    )}
                    {row.status === 'done' && !row.result?.valid && (
                      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
                        {row.result?.error || 'CUIT inválido'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {rows.length === 0 && !running && !done && (
        <div className="text-center py-8 text-slate-400 text-xs">
          Presioná "Iniciar validación" para verificar todos los CUITs cargados.
          <br /><span className="text-[10px] text-slate-300 mt-1 block">Se validarán {clientes.filter(c => c.cuit && c.cuit.trim().length >= 10).length} clientes con CUIT.</span>
        </div>
      )}
    </Modal>
  );
};
