import { retryConBackoff } from './retry';

const DELAYS_TEST_MS = [10, 20] as const;

describe('retryConBackoff', () => {
  it('retorna al primer intento exitoso sin reintentar', async () => {
    const fn = jest.fn().mockResolvedValue('ok');

    await expect(
      retryConBackoff(fn, { delaysMs: DELAYS_TEST_MS }),
    ).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('reintenta tras fallos y retorna el primer éxito', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('fallo 1'))
      .mockResolvedValue('ok');
    const onRetry = jest.fn();

    await expect(
      retryConBackoff(fn, { delaysMs: DELAYS_TEST_MS, onRetry }),
    ).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
  });

  it('agota delays+1 intentos y propaga el último error', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('siempre falla'));

    await expect(
      retryConBackoff(fn, { delaysMs: DELAYS_TEST_MS }),
    ).rejects.toThrow('siempre falla');
    expect(fn).toHaveBeenCalledTimes(DELAYS_TEST_MS.length + 1);
  });
});
