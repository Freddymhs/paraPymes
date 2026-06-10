import { Injectable, Logger } from '@nestjs/common';
import CircuitBreaker from 'opossum';
import { retryConBackoff } from '@common/utils';
import {
  ChileCompraApiClient,
  LicitacionRaw,
} from '../clients/chilecompra-api.client';

const BREAKER_TIMEOUT_MS = 10_000;
const ERROR_THRESHOLD_PERCENTAGE = 50;
const RESET_TIMEOUT_MS = 30_000;
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000] as const;
// El circuit no evalúa el threshold hasta acumular todos los intentos del
// retry: garantiza el backoff completo (1s/2s/4s) antes de abrir.
const VOLUME_THRESHOLD = RETRY_DELAYS_MS.length + 1;

export type CircuitState = 'closed' | 'open' | 'halfOpen';

/**
 * Protege el acceso a ChileCompra: retry exponencial alrededor del breaker
 * (cada intento es un fire con timeout propio) y fallback a [] — el pipeline
 * continúa con datos previos, nunca propaga la caída del upstream.
 */
@Injectable()
export class ChileCompraBreaker {
  private readonly logger = new Logger(ChileCompraBreaker.name);
  private readonly breaker: CircuitBreaker<[string], LicitacionRaw[]>;

  constructor(private readonly client: ChileCompraApiClient) {
    this.breaker = new CircuitBreaker(
      (fechaIso: string) => this.client.getLicitacionesByFecha(fechaIso),
      {
        timeout: BREAKER_TIMEOUT_MS,
        errorThresholdPercentage: ERROR_THRESHOLD_PERCENTAGE,
        resetTimeout: RESET_TIMEOUT_MS,
        volumeThreshold: VOLUME_THRESHOLD,
      },
    );
  }

  async getLicitacionesByFecha(fechaIso: string): Promise<LicitacionRaw[]> {
    try {
      return await retryConBackoff(() => this.breaker.fire(fechaIso), {
        delaysMs: RETRY_DELAYS_MS,
        onRetry: (intento, error) =>
          this.logger.warn(
            `Reintento ${intento}/${RETRY_DELAYS_MS.length} ChileCompra ${fechaIso}: ${String(error)}`,
          ),
      });
    } catch (error) {
      this.logger.warn(
        `ChileCompra no disponible para ${fechaIso} (circuit ${this.estado}): ${String(error)} — continuando con []`,
      );
      return [];
    }
  }

  get estado(): CircuitState {
    if (this.breaker.opened) {
      return 'open';
    }
    if (this.breaker.halfOpen) {
      return 'halfOpen';
    }
    return 'closed';
  }
}
