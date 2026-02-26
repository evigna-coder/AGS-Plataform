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

            autocompleteRef.current.addListener('place_changed', () => {
                const place = autocompleteRef.current?.getPlace();
                if (!place || !place.address_components) return;

                const comps = place.address_components ?? [];

                const formattedAddress = place.formatted_address || '';
                const street = getComponent(comps, 'route');
                const number = getComponent(comps, 'street_number');
                const provincia = getComponent(comps, 'administrative_area_level_1');
                const pais = getComponent(comps, 'country');
                const codigoPostal = getComponent(comps, 'postal_code');

                const localidad =
                    getComponent(comps, 'locality') ||
                    getComponent(comps, 'administrative_area_level_2') ||
                    getComponent(comps, 'sublocality') ||
                    '';

                const lat = place.geometry?.location?.lat();
                const lng = place.geometry?.location?.lng();

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
