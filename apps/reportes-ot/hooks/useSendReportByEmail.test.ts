import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ── Mocks de las dependencias externas del hook ──────────────────────────────
const mockSendGmail = vi.fn();
const mockRequestToken = vi.fn();

vi.mock('../services/gmailService', () => ({
  sendGmail: (...args: unknown[]) => mockSendGmail(...args),
  approxMimeSize: () => 1024, // chico, nunca supera el límite
  GMAIL_SIZE_LIMIT_BYTES: 24 * 1024 * 1024,
}));

vi.mock('./useGoogleOAuth', () => ({
  useGoogleOAuth: () => ({ requestToken: mockRequestToken }),
}));

vi.mock('../utils/buildEmailContent', () => ({
  resolveRecipients: () => ['cliente@ejemplo.com'],
  buildSubject: () => 'Asunto de prueba',
  buildHtmlBody: () => '<p>cuerpo</p>',
}));

import { useSendReportByEmail } from './useSendReportByEmail';
import type { DeliveryFn } from './usePDFGeneration';

const fakeResult = {
  reportBlob: new Blob(['pdf'], { type: 'application/pdf' }),
  reportFilename: 'reporte-123.pdf',
  protocolBlob: null,
  protocolFilename: null,
} as any;

function buildDeps(overrides: Partial<Record<string, any>> = {}) {
  const saveReport = vi.fn().mockResolvedValue(undefined);
  const showAlert = vi.fn();
  const showConfirm = vi.fn().mockResolvedValue(false);

  // Por defecto handleFinalSubmit imita el flujo REAL ya arreglado:
  // invoca el delivery y deja que sus errores se PROPAGUEN.
  const handleFinalSubmit = vi.fn(async (delivery: DeliveryFn) => {
    await delivery(fakeResult, { setStep: () => {} });
  });

  const deps = {
    formState: { emailPrincipal: 'cliente@ejemplo.com', destinatariosExtras: [], destinatariosManuales: [] } as any,
    contactosDB: [] as any,
    firebase: { saveReport } as any,
    otNumber: '123.01',
    handleFinalSubmit,
    showAlert,
    showConfirm,
    ...overrides,
  };
  return { deps, saveReport, showAlert, showConfirm, handleFinalSubmit };
}

const alertTitles = (showAlert: ReturnType<typeof vi.fn>) =>
  showAlert.mock.calls.map((c) => c[0]?.title);

const enviadoPorEmailWrites = (saveReport: ReturnType<typeof vi.fn>) =>
  saveReport.mock.calls.map((c) => c[1]?.enviadoPorEmail).filter(Boolean);

describe('useSendReportByEmail', () => {
  beforeEach(() => {
    mockSendGmail.mockReset();
    mockRequestToken.mockReset();
    mockRequestToken.mockResolvedValue('fake-token');
  });

  it('envío OK: muestra "Reporte enviado" y registra enviadoPorEmail con estado "enviado"', async () => {
    mockSendGmail.mockResolvedValue({ id: 'm1', threadId: 't1' });
    const { deps, saveReport, showAlert } = buildDeps();

    const { result } = renderHook(() => useSendReportByEmail(deps));
    await act(async () => { await result.current.sendByEmail(); });

    expect(alertTitles(showAlert)).toContain('Reporte enviado');
    const registros = enviadoPorEmailWrites(saveReport);
    expect(registros.at(-1)?.estado).toBe('enviado');
  });

  it('falla Gmail (handleFinalSubmit propaga): NO muestra "Reporte enviado" y registra estado "error"', async () => {
    mockSendGmail.mockRejectedValue(new Error('Gmail API error: 500'));
    const { deps, saveReport, showAlert } = buildDeps();

    const { result } = renderHook(() => useSendReportByEmail(deps));
    await act(async () => { await result.current.sendByEmail(); });

    // La garantía central: sin falso "Reporte enviado".
    expect(alertTitles(showAlert)).not.toContain('Reporte enviado');
    const registros = enviadoPorEmailWrites(saveReport);
    expect(registros.at(-1)?.estado).toBe('error');
    expect(registros.at(-1)?.error).toContain('Gmail API error');
  });

  it('regresión del bug: aunque handleFinalSubmit se TRAGUE el error, NO hay falso "Reporte enviado"', async () => {
    mockSendGmail.mockRejectedValue(new Error('network down'));
    // handleFinalSubmit que swallowea (comportamiento viejo / belt-and-suspenders):
    // llama al delivery pero atrapa su throw y retorna normal.
    const swallowing = vi.fn(async (delivery: DeliveryFn) => {
      try { await delivery(fakeResult, { setStep: () => {} }); } catch { /* tragado */ }
    });
    const { deps, saveReport, showAlert } = buildDeps({ handleFinalSubmit: swallowing });

    const { result } = renderHook(() => useSendReportByEmail(deps));
    await act(async () => { await result.current.sendByEmail(); });

    // La bandera `delivered` protege contra el falso éxito aun si el caller traga el error.
    expect(alertTitles(showAlert)).not.toContain('Reporte enviado');
    const registros = enviadoPorEmailWrites(saveReport);
    expect(registros.at(-1)?.estado).toBe('error');
  });
});
