// Google Geocoding service using the Maps JavaScript SDK (same as AddressAutocomplete)

export interface GeocodingResult {
  formattedAddress: string;
  direccion: string;
  localidad: string;
  provincia: string;
  codigoPostal: string;
  pais: string;
  lat: number;
  lng: number;
  placeId: string;
}

function getComponent(components: any[], type: string): string {
  return components.find((c: any) => c.types.includes(type))?.long_name ?? '';
}

/** Ensure the Google Maps JS SDK is loaded (reuses AddressAutocomplete's script). */
function ensureGoogleMaps(): Promise<void> {
  if ((window as any).google?.maps?.Geocoder) return Promise.resolve();

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return Promise.reject(new Error('VITE_GOOGLE_MAPS_API_KEY no configurada'));

  // Check if script is already loading
  const existing = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
  if (existing) {
    return new Promise((resolve, reject) => {
      const check = setInterval(() => {
        if ((window as any).google?.maps?.Geocoder) {
          clearInterval(check);
          resolve();
        }
      }, 100);
      setTimeout(() => { clearInterval(check); reject(new Error('Timeout loading Google Maps')); }, 10000);
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps script'));
    document.head.appendChild(script);
  });
}

let geocoderInstance: any = null;

/** Geocode a free-text address using google.maps.Geocoder (JS SDK). */
export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  await ensureGoogleMaps();

  if (!geocoderInstance) {
    geocoderInstance = new (window as any).google.maps.Geocoder();
  }

  return new Promise((resolve, reject) => {
    geocoderInstance.geocode(
      { address, region: 'ar', language: 'es' },
      (results: any[], status: string) => {
        if (status !== 'OK' || !results?.length) {
          resolve(null);
          return;
        }

        const result = results[0];
        const comps = result.address_components ?? [];

        const route = getComponent(comps, 'route');
        const streetNumber = getComponent(comps, 'street_number');
        const direccion = streetNumber ? `${route} ${streetNumber}` : route;

        const localidad =
          getComponent(comps, 'locality') ||
          getComponent(comps, 'administrative_area_level_2') ||
          getComponent(comps, 'sublocality') ||
          '';

        const lat = result.geometry?.location?.lat?.();
        const lng = result.geometry?.location?.lng?.();

        resolve({
          formattedAddress: result.formatted_address || '',
          direccion,
          localidad,
          provincia: getComponent(comps, 'administrative_area_level_1'),
          codigoPostal: getComponent(comps, 'postal_code'),
          pais: getComponent(comps, 'country'),
          lat: typeof lat === 'number' ? lat : 0,
          lng: typeof lng === 'number' ? lng : 0,
          placeId: result.place_id || '',
        });
      }
    );
  });
}
