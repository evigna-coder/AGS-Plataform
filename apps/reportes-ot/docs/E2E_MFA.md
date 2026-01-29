# Tests E2E — MFA (Reportes OT)

## Alcance

- **Unit tests (Cloud Functions)**: `apps/reportes-ot/functions` — `npm test` (Jest). Cubren config, generación de options WebAuthn, middleware (dominio, admin).
- **Unit tests (Frontend)**: `apps/reportes-ot` — `npm test` (Vitest). Cubren authService (dominio), webauthnClient (fetch mock), LoginScreen (click y onError).

## E2E con WebAuthn

Los flujos completos de MFA (Google Sign-In + segundo factor con Face/patrón/huella) **dependen de WebAuthn en el navegador**. En muchos entornos de CI (headless, sin dispositivo biométrico) no se puede simular un autenticador de plataforma real.

### Opciones recomendadas

1. **E2E en staging con dispositivo real**  
   Ejecutar pruebas E2E (p. ej. Playwright o Cypress) en un entorno de staging, en un dispositivo o emulador que soporte WebAuthn de plataforma (Chrome con flags, Safari en iOS, etc.), usando una cuenta de prueba @agsanalitica.com.

2. **E2E parcial sin segundo factor**  
   - Cuenta de prueba **sin** dispositivos MFA registrados: el flujo termina en “solo Google” y se muestra la app.  
   - Comprobar: pantalla de login → “Ingresar con Google” → (mock o cuenta de prueba) → redirección a la app.  
   - No se prueba el modal de WebAuthn ni `navigator.credentials.get()` en CI sin soporte real.

3. **Límites en CI**  
   - Los tests unitarios (Jest + Vitest) sí se pueden ejecutar en CI.  
   - Los E2E que requieran WebAuthn de plataforma deben documentarse como “ejecutar en staging o local con dispositivo compatible”.

### Ejemplo de checklist E2E manual (staging)

- [ ] Cargar la app y ver pantalla de login con “Ingresar con Google”.
- [ ] Iniciar sesión con cuenta @agsanalitica.com; si no hay dispositivo MFA, se muestra la app directamente.
- [ ] Si hay dispositivo MFA registrado, se muestra el modal “Confirma desbloqueo en tu dispositivo” y, tras completar, se muestra la app.
- [ ] Desde la app, abrir “Seguridad” y registrar un dispositivo (Face/patrón/huella); ver mensaje de éxito.
- [ ] Cerrar sesión y volver a entrar; debe pedirse el segundo factor y, tras completarlo, acceder a la app.

### CI

- **Cloud Functions**: en cada PR, ejecutar `cd apps/reportes-ot/functions && npm test` (17 tests: config, webauthn, middleware).
- **Frontend**: en cada PR, ejecutar `cd apps/reportes-ot && npm install && npm test` (Vitest: authService, webauthnClient, LoginScreen). Requiere `jsdom` y `vitest` en devDependencies.
- **E2E completos con WebAuthn**: opcional en pipeline; si se añaden, ejecutar en staging o en job con dispositivo/emulador compatible y documentar en este archivo.
