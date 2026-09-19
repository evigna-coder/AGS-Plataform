import { useState } from 'react';
import { Button } from '../ui/Button';
import { useConfirm } from '../ui/ConfirmDialog';
import { remitosService, loanersService } from '../../services/firebaseService';
import type { Loaner } from '@ags/shared';
import { patchRetornoProveedor } from '../../utils/loanerCicloRecalificacion';
import { recalificarTrasRetornoProveedor } from '../../utils/loanerRecalificacion';

import { notify } from '../../utils/notify';
/**
 * Registrar desde el LOANER la vuelta del proveedor (2026-08-27). El remito de
 * derivación puede haber salido en lote (varios loaners/fichas/partes), pero la
 * gestión del retorno es individual: acá se resuelve SOLO la línea de este
 * loaner — las demás siguen abiertas y el remito se completa cuando vuelve
 * todo. Antes esta acción solo existía parada sobre el remito, y desde el
 * loaner no había forma de registrar la vuelta (caso LNR-005).
 */
export function LoanerRetornoProveedorButton({ loaner }: { loaner: Loaner }) {
  const confirm = useConfirm();
  const [saving, setSaving] = useState(false);
  const salida = loaner.enProveedor;
  if (!salida) return null;

  const handleRetorno = async () => {
    const que = salida.alcance === 'parte'
      ? `la parte${salida.parteDescripcion ? ` "${salida.parteDescripcion}"` : ''} de ${loaner.codigo}`
      : loaner.codigo;
    const ok = await confirm(
      `¿Registrar el retorno de ${que} desde ${salida.proveedorNombre ?? 'el proveedor'}?\n\n` +
      `Se marca devuelta su línea del remito ${salida.remitoNumero} — las otras líneas del remito no se tocan. ` +
      `El módulo queda en recalificación${salida.alcance === 'parte' ? ' (hay que rearmarlo)' : ''}: se crea el ítem de RQ en la OT del trabajo (o una OT nueva si salió sin OT) y el ticket para coordinarla.`,
    );
    if (!ok) return;
    setSaving(true);
    try {
      const remito = await remitosService.getById(salida.remitoId);
      const item = (remito?.items ?? []).find(it => it.loanerId === loaner.id && !it.devuelto);
      if (remito && item) {
        await remitosService.marcarLoanerRetornado(remito.id, item.id);
      } else {
        // Remito viejo sin la línea rastreable: resolver el loaner igual, con
        // el mismo efecto (recalificación + fechaRetorno en el historial).
        const patch = patchRetornoProveedor(loaner, salida.remitoId, new Date().toISOString());
        await loanersService.update(loaner.id, patch);
        await recalificarTrasRetornoProveedor(loaner.id, salida.remitoId)
          .catch(err => console.error('[LoanerRetornoProveedorButton] recalificación no iniciada (la completa el sweep):', err));
      }
    } catch (err) {
      console.error('[LoanerRetornoProveedorButton] retorno falló:', err);
      notify.error(err instanceof Error ? err.message : 'Error al registrar el retorno');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Button variant="primary" size="sm" onClick={() => void handleRetorno()} disabled={saving}>
      {saving ? 'Registrando…' : 'Registrar retorno de proveedor'}
    </Button>
  );
}
