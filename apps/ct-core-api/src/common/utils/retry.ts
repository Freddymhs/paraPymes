export interface RetryOptions {
  readonly delaysMs: readonly number[];
  readonly onRetry?: (intento: number, error: unknown) => void;
}

export const esperarMs = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Ejecuta `fn`; ante fallo reintenta tras cada delay de `delaysMs`.
 * Total de intentos = delaysMs.length + 1. El último error se propaga.
 */
export const retryConBackoff = async <T>(
  fn: () => Promise<T>,
  { delaysMs, onRetry }: RetryOptions,
): Promise<T> => {
  for (const [indice, delayMs] of delaysMs.entries()) {
    try {
      return await fn();
    } catch (error) {
      onRetry?.(indice + 1, error);
      await esperarMs(delayMs);
    }
  }
  return fn();
};
