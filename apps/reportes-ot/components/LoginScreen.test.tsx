import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginScreen } from './LoginScreen';

const mockSignInWithGoogle = vi.fn();

vi.mock('../services/authService', () => ({
  signInWithGoogle: (...args: unknown[]) => mockSignInWithGoogle(...args),
}));

describe('LoginScreen', () => {
  beforeEach(() => {
    mockSignInWithGoogle.mockReset();
  });

  it('renders title and Google sign-in button', () => {
    render(<LoginScreen />);
    expect(screen.getByText(/Reportes OT/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Ingresar con Google/i })).toBeTruthy();
  });

  it('calls signInWithGoogle when button is clicked', async () => {
    mockSignInWithGoogle.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<LoginScreen />);
    await user.click(screen.getByRole('button', { name: /Ingresar con Google/i }));
    await waitFor(() => {
      expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1);
    });
  });

  it('calls onError when signInWithGoogle throws', async () => {
    mockSignInWithGoogle.mockRejectedValue(new Error('Auth failed'));
    const onError = vi.fn();
    const user = userEvent.setup();
    render(<LoginScreen onError={onError} />);
    await user.click(screen.getByRole('button', { name: /Ingresar con Google/i }));
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Auth failed');
    });
  });
});
