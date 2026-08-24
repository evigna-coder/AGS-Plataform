/**
 * Abrir la pestaña del PDF **antes** de generarlo (2026-08-23).
 *
 * El bug que fija: "PDF con membrete" terminaba en el diálogo de guardar en
 * lugar de mostrar el PDF. `window.open` corría después de
 * `await pdf(...).toBlob()`, y para entonces el navegador ya no ve un gesto del
 * usuario detrás: bloquea el pop-up, el código cae al plan B —descargar— y
 * aparece "Guardar como".
 *
 * Vive en su propio módulo, sin dependencias, para poder importarlo de forma
 * ESTÁTICA. Si estuviera en `remitoPdfActions` habría que hacer
 * `await import(...)` para traerlo, y ese await ya rompe el gesto: la ventana
 * tiene que pedirse de forma SÍNCRONA, como primera instrucción del handler.
 */

/** Pestaña en blanco con un cartel de "generando", lista para recibir el PDF. */
export function abrirVentanaParaPdf(titulo = 'Generando PDF…'): Window | null {
  const win = window.open('', '_blank');
  if (!win) return null;
  win.document.open();
  win.document.write(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapar(titulo)}</title>` +
    `<style>html,body{margin:0;height:100%;background:#525659;font-family:system-ui,sans-serif}` +
    `p{color:#e8e8e8;text-align:center;padding-top:3rem;font-size:14px}</style></head>` +
    `<body><p>Generando PDF…</p></body></html>`,
  );
  win.document.close();
  return win;
}

/**
 * Muestra el PDF dentro de la pestaña ya abierta.
 *
 * Va en un iframe y no navegando la ventana: apuntar una ventana directo a una
 * URL `blob:` falla en Electron ("obtener aplicación para este vínculo").
 * Dentro de un iframe del mismo origen, funciona en los dos.
 */
export function mostrarPdfEnVentana(win: Window, url: string, titulo = 'PDF'): void {
  win.document.open();
  win.document.write(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapar(titulo)}</title>` +
    `<style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%;display:block}</style>` +
    `</head><body><iframe src="${url}"></iframe></body></html>`,
  );
  win.document.close();
}

/**
 * Plan B cuando no hay pestaña: mostrar el PDF DENTRO de la app (2026-08-23).
 *
 * Antes el plan B era descargar el archivo, y por eso el usuario veía el
 * diálogo "Guardar como" en lugar del PDF. Con los pop-ups bloqueados no hay
 * forma de abrir una pestaña por más que el gesto esté vigente, así que se
 * muestra acá mismo. Funciona siempre: no depende del bloqueador ni del
 * manejador de `blob:` de Electron.
 */
export function mostrarPdfEnOverlay(url: string, titulo = 'PDF'): void {
  const prev = document.getElementById('ags-pdf-overlay');
  if (prev) prev.remove();

  const overlay = document.createElement('div');
  overlay.id = 'ags-pdf-overlay';
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.75);' +
    'display:flex;flex-direction:column;padding:24px;gap:10px';

  const barra = document.createElement('div');
  barra.style.cssText = 'display:flex;align-items:center;gap:12px;color:#fff;font:500 13px system-ui,sans-serif';

  const nombre = document.createElement('span');
  nombre.textContent = titulo;
  nombre.style.cssText = 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';

  const btn = (texto: string) => {
    const b = document.createElement('button');
    b.textContent = texto;
    b.style.cssText =
      'background:#0D6E6E;color:#fff;border:0;border-radius:6px;padding:6px 14px;' +
      'font:600 12px system-ui,sans-serif;cursor:pointer';
    return b;
  };

  const descargar = btn('Descargar');
  descargar.onclick = () => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `${titulo.replace(/[^\w.\- ]/g, '_') || 'documento'}.pdf`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const cerrar = btn('Cerrar');
  cerrar.style.background = 'rgba(255,255,255,.15)';
  cerrar.onclick = () => overlay.remove();

  const frame = document.createElement('iframe');
  frame.src = url;
  frame.style.cssText = 'flex:1;border:0;border-radius:8px;background:#fff;width:100%';

  barra.append(nombre, descargar, cerrar);
  overlay.append(barra, frame);
  document.body.appendChild(overlay);

  const onEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', onEsc); }
  };
  document.addEventListener('keydown', onEsc);
}

function escapar(s: string): string {
  return s.replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]!));
}
