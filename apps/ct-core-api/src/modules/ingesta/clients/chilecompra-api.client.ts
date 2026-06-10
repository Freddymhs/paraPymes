import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENV_KEYS } from '@config/env.constants';
import { ExternalAPIError, ValidationError } from '@common/exceptions';

/**
 * Esquema crudo de la API REST actual de ChileCompra.
 * Breaking changes anunciados para Q2 2026 (OCDS expandido + webhooks):
 * nada fuera de `modules/ingesta/clients/` debe importar estos tipos.
 */
export interface LicitacionRaw {
  readonly CodigoExterno: string;
  readonly Nombre: string;
  readonly CodigoEstado: number;
  readonly FechaCierre: string | null;
  readonly [campo: string]: unknown;
}

interface ListadoLicitacionesResponse {
  readonly Cantidad: number;
  readonly FechaCreacion: string;
  readonly Listado: LicitacionRaw[];
}

const LICITACIONES_PATH = '/publico/licitaciones.json';
const ESTADO_TODOS = 'todos';
const REQUEST_TIMEOUT_MS = 10_000;
const FECHA_ISO_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Convierte fecha ISO `YYYY-MM-DD` al formato chileno `DDMMYYYY` que exige la API. */
export const toFechaChileCompra = (fechaIso: string): string => {
  if (!FECHA_ISO_PATTERN.test(fechaIso)) {
    throw new ValidationError(
      `Fecha inválida: '${fechaIso}' — se espera formato YYYY-MM-DD`,
    );
  }
  const [year, month, day] = fechaIso.split('-');
  return `${day}${month}${year}`;
};

@Injectable()
export class ChileCompraApiClient {
  private readonly logger = new Logger(ChileCompraApiClient.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Licitaciones publicadas/modificadas en la fecha dada (día puntual).
   * Límite oficial: 10.000 req/día — el histórico va por bulk OCDS, no por aquí.
   */
  async getLicitacionesByFecha(fechaIso: string): Promise<LicitacionRaw[]> {
    const url = this.buildListadoUrl(fechaIso);
    const response = await this.fetchListado(url);
    const listado = response.Listado ?? [];
    this.logger.log(
      `ChileCompra ${fechaIso}: ${listado.length} licitaciones recibidas`,
    );
    return listado;
  }

  private async fetchListado(url: URL): Promise<ListadoLicitacionesResponse> {
    // El ticket viaja en la query string: nunca loguear la URL completa.
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new ExternalAPIError(
          `ChileCompra respondió HTTP ${response.status}`,
        );
      }
      return (await response.json()) as ListadoLicitacionesResponse;
    } catch (error) {
      if (error instanceof ExternalAPIError) {
        throw error;
      }
      const reason = error instanceof Error ? error.message : String(error);
      throw new ExternalAPIError(`ChileCompra inalcanzable: ${reason}`);
    }
  }

  private buildListadoUrl(fechaIso: string): URL {
    const baseUrl = this.config.getOrThrow<string>(
      ENV_KEYS.CHILECOMPRA_API_URL,
    );
    const ticket = this.config.get<string>(ENV_KEYS.CHILECOMPRA_TICKET, '');
    const isTicketMissing = ticket === '';
    if (isTicketMissing) {
      throw new ExternalAPIError('CHILECOMPRA_TICKET no configurado');
    }
    const url = new URL(`${baseUrl}${LICITACIONES_PATH}`);
    url.searchParams.set('estado', ESTADO_TODOS);
    url.searchParams.set('fecha', toFechaChileCompra(fechaIso));
    url.searchParams.set('ticket', ticket);
    return url;
  }
}
