import React, { useEffect, useRef, useState } from 'react';
import { Input } from './ui/Input';

export interface AutocompleteResult {
    formattedAddress: string;
    street: string;
    number: string;
    localidad: string;
    provincia: string;
    /**
     * Lo que el usuario tipeó y Google no devuelve: "km 452", "lote 7", "piso 3".
     * Los formularios lo anexan a la dirección — sin esto se perdía al elegir
     * la sugerencia (2026-08-08).
     */
    complemento: string;
    /** Texto tal cual lo tipeó el usuario, antes de que Google pise el input. */
    tipeado: string;
    pais: string;
    codigoPostal: string;
    lat?: number;
    lng?: number;
    placeId?: string;
}

function getComponent(components: any[], type: string): string {
    return components.find(c => c.types.includes(type))?.long_name ?? '';
}

/**
 * Fragmentos que Google NO devuelve pero identifican el lugar (2026-08-08):
 * "Ruta 12 km 452" existe como dirección real, pero Google resuelve "Ruta 12" y
 * el "km 452" —que es lo único que dice DÓNDE— se perdía al elegir la sugerencia.
 * Lo mismo con lotes, manzanas, parcelas y pisos.
 */
const COMPLEMENTO_PATTERNS = [
    /\bkm\.?\s*\d+(?:[.,]\d+)?\b/gi,          // km 452 / Km. 452,5
    /\bs\/?n\b/gi,                             // s/n
    /\b(?:lote|lt)\.?\s*[\w-]+\b/gi,
    /\b(?:manzana|mza?)\.?\s*[\w-]+\b/gi,
    /\bparcela\s*[\w-]+\b/gi,
    /\b(?:piso|p\.)\s*[\w-]+\b/gi,
    /\b(?:depto|dpto|dto)\.?\s*[\w-]+\b/gi,
    /\b(?:oficina|of)\.?\s*[\w-]+\b/gi,
];

/**
 * Extrae del texto TIPEADO los fragmentos que el resultado de Google no
 * contiene. Se compara sin acentos ni mayúsculas para no duplicar lo que ya
 * viene en la dirección formateada.
 */
export function extraerComplemento(tipeado: string, formattedAddress: string): string {
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const enResultado = norm(formattedAddress);
    const encontrados: string[] = [];
    for (const re of COMPLEMENTO_PATTERNS) {
        const matches = tipeado.match(re);
        if (!matches) continue;
        for (const m of matches) {
            const limpio = m.trim();
            // Ya está en la dirección de Google → no repetirlo.
            if (enResultado.includes(norm(limpio))) continue;
            if (encontrados.some(e => norm(e) === norm(limpio))) continue;
            encontrados.push(limpio);
        }
    }
    return encontrados.join(' ');
}

interface AddressAutocompleteProps {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSelectAddress: (result: AutocompleteResult) => void;
    label?: string;
    error?: string;
    placeholder?: string;
    required?: boolean;
}

let isScriptLoading = false;
let isScriptLoaded = false;

function loadGoogleMapsScript(apiKey: string, callback: () => void) {
    if (isScriptLoaded || (window as any).google?.maps?.places) {
        callback();
        return;
    }
    if (isScriptLoading) {
        const interval = setInterval(() => {
            if ((window as any).google?.maps?.places) {
                clearInterval(interval);
                callback();
            }
        }, 100);
        return;
    }

    isScriptLoading = true;
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
        isScriptLoaded = true;
        callback();
    };
    script.onerror = () => {
        console.error('Failed to load Google Maps script');
        isScriptLoading = false;
    };
    document.head.appendChild(script);
}

export const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
    value,
    onChange,
    onSelectAddress,
    label,
    error,
    placeholder = 'Buscar dirección...',
    required = false
}) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const autocompleteRef = useRef<any>(null);
    /** Último texto TIPEADO por el usuario (Google pisa el input al seleccionar). */
    const tipeadoRef = useRef('');
    const [apiKeyMissing, setApiKeyMissing] = useState(false);

    useEffect(() => {
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            setApiKeyMissing(true);
            return;
        }

        loadGoogleMapsScript(apiKey, () => {
            if (!inputRef.current) return;

            autocompleteRef.current = new (window as any).google.maps.places.Autocomplete(inputRef.current, {
                fields: ['address_components', 'geometry', 'formatted_address', 'place_id'],
                types: ['address']
            });

            autocompleteRef.current.addListener('place_changed', async () => {
                // Lo tipeado ANTES de que Google reemplace el input — de ahí se
                // rescata el "km 452" que la sugerencia no trae.
                const tipeado = tipeadoRef.current;
                const place = autocompleteRef.current?.getPlace();
                if (!place || !place.address_components) return;

                const comps = place.address_components ?? [];

                const formattedAddress = place.formatted_address || '';
                const street = getComponent(comps, 'route');
                const number = getComponent(comps, 'street_number');
                const pais = getComponent(comps, 'country');
                let codigoPostal = getComponent(comps, 'postal_code');

                const adminLevel1 = getComponent(comps, 'administrative_area_level_1');
                const adminLevel2 = getComponent(comps, 'administrative_area_level_2');
                const locality = getComponent(comps, 'locality');
                const sublocality = getComponent(comps, 'sublocality');

                // CABA: Google devuelve admin_level_1 = "Ciudad Autónoma de Buenos Aires"
                // y locality = "Buenos Aires". Para evitar redundancia, usamos CABA como localidad
                // y dejamos provincia vacía.
                const isCABA = adminLevel1.toLowerCase().includes('ciudad aut');
                let localidad: string;
                let provincia: string;

                if (isCABA) {
                    localidad = 'Ciudad Autónoma de Buenos Aires';
                    provincia = '';
                } else {
                    localidad = locality || adminLevel2 || sublocality || '';
                    provincia = adminLevel1;
                }

                const lat = place.geometry?.location?.lat();
                const lng = place.geometry?.location?.lng();

                // Fallback: Places Autocomplete often omits postal_code for AR street-level
                // addresses (el CP está asociado a la locality, no al street_address).
                // Geocoding API por lat/lng sí lo devuelve en esos casos.
                if (!codigoPostal && typeof lat === 'number' && typeof lng === 'number') {
                    try {
                        const geocoder = new (window as any).google.maps.Geocoder();
                        const { results } = await geocoder.geocode({ location: { lat, lng } });
                        for (const r of results ?? []) {
                            const cp = getComponent(r.address_components ?? [], 'postal_code');
                            if (cp) { codigoPostal = cp; break; }
                        }
                    } catch (err) {
                        console.warn('Reverse-geocode for postal_code failed', err);
                    }
                }

                const result: AutocompleteResult = {
                    formattedAddress,
                    street,
                    number,
                    complemento: extraerComplemento(tipeado, formattedAddress),
                    tipeado,
                    localidad,
                    provincia,
                    pais,
                    codigoPostal,
                    lat: typeof lat === 'number' ? lat : undefined,
                    lng: typeof lng === 'number' ? lng : undefined,
                    placeId: place.place_id || undefined
                };

                onSelectAddress(result);
            });
        });

        return () => {
            if (autocompleteRef.current && (window as any).google) {
                (window as any).google.maps.event.clearInstanceListeners(autocompleteRef.current);
            }
        };
    }, [onSelectAddress]);

    return (
        <div>
            <Input
                ref={inputRef}
                label={label}
                value={value}
                onChange={e => { tipeadoRef.current = e.target.value; onChange(e); }}
                error={error}
                placeholder={placeholder}
                required={required}
            />
            {!apiKeyMissing && (
                <p className="text-xs text-slate-500 mt-1">
                    Busque y seleccione una dirección sugerida para estandarizar los datos (o ingrese manualmente).
                    {' '}El <strong>km</strong>, lote o piso que escriba se conserva aunque Google no lo reconozca.
                </p>
            )}
        </div>
    );
};
