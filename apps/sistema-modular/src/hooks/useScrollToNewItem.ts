import { useEffect, useRef } from 'react';

/**
 * Lleva la vista al item recién agregado (2026-08-09). Antes, agregar un item a
 * un presupuesto largo lo dejaba fuera de pantalla y había que scrollear a mano
 * hasta el final para verlo o editarlo.
 *
 * Solo reacciona cuando la lista CRECE: editar o borrar no mueven la vista —
 * un scroll inesperado mientras se edita es peor que no hacer nada.
 *
 * Uso: colgar el ref de la ÚLTIMA fila renderizada.
 *
 *   const lastRowRef = useScrollToNewItem<HTMLTableRowElement>(items.length);
 *   ...
 *   <tr ref={idx === items.length - 1 ? lastRowRef : undefined}>
 */
export function useScrollToNewItem<T extends HTMLElement>(count: number) {
  const ref = useRef<T | null>(null);
  const prevCount = useRef(count);

  useEffect(() => {
    if (count > prevCount.current) {
      const el = ref.current;
      prevCount.current = count;
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Foco en el primer campo editable de la fila nueva, para tipear sin
      // tener que clickear. `select()` sigue la regla de inputs numéricos:
      // el contenido queda seleccionado para reemplazarlo directo.
      const editable = el.querySelector<HTMLElement>(
        'input:not([disabled]):not([type="checkbox"]), textarea:not([disabled])',
      );
      if (editable) {
        editable.focus();
        if (editable instanceof HTMLInputElement) editable.select();
      }
      return;
    }
    prevCount.current = count;
  }, [count]);

  return ref;
}
