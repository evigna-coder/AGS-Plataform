import React, { useEffect, useRef, useState } from 'react';
import { Input } from './ui/Input';

export interface AutocompleteResult {
    formattedAddress: string;
    street: string;
    number: string;
    localidad: string;
    provincia: string;
    pais: string;
    codigoPostal: string;
    lat?: number;
    lng?: number;
    placeId?: string;
}

function getComponent(components: any[], type: string): string {
    return components.find(c => c.types.includes(type))?.long_name ?? '';
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
                onChange={onChange}
                error={error}
                placeholder={placeholder}
                required={required}
            />
            {!apiKeyMissing && (
                <p className="text-xs text-slate-500 mt-1">
                    Busque y seleccione una dirección sugerida para estandarizar los datos (o ingrese manualmente).
                </p>
            )}
        </div>
    );
};
