/**
 * Pre-descarga de imágenes para el PDF de Equipos.
 *
 * @react-pdf fetchea las URLs por su cuenta, pero preferimos resolverlas acá
 * (fetch → blob → dataURL) para controlar errores: una foto caída NO debe
 * romper la generación del PDF, solo omitirse. El bucket ya tiene CORS GET *
 * (cors.json), así que el fetch desde el browser funciona con los download
 * URLs de Storage (token embebido en la URL).
 */
export async function fetchFotosAsDataUrls(urls: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(
    [...new Set(urls)].map(async (url) => {
      try {
        const resp = await fetch(url);
        if (!resp.ok) return;
        const blob = await resp.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
        out[url] = dataUrl;
      } catch (err) {
        console.warn('[PDF Equipos] No se pudo descargar la foto, se omite:', url, err);
      }
    }),
  );
  return out;
}
