import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ChileCompraBreaker } from './circuit-breaker/chilecompra.breaker';
import {
  LicitacionParaPublicar,
  SqsPublisherService,
} from './sqs/sqs-publisher.service';
import { normalizarLicitacion } from './normalizacion/licitacion.mapper';

// 22:00 Chile: fuera de horas pico, según recomendación oficial ChileCompra.
const CRON_INGESTA_DIARIA = '0 22 * * *';
const TIMEZONE_CHILE = 'America/Santiago';

export interface ResumenIngesta {
  readonly recibidas: number;
  readonly publicadas: number;
  readonly fallidas: number;
  readonly descartadas: number;
}

/** Fecha actual en Chile como YYYY-MM-DD (el server puede correr en UTC). */
const fechaHoyChileIso = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE_CHILE }).format(
    new Date(),
  );

@Injectable()
export class IngestaService {
  private readonly logger = new Logger(IngestaService.name);

  constructor(
    private readonly breaker: ChileCompraBreaker,
    private readonly publisher: SqsPublisherService,
  ) {}

  @Cron(CRON_INGESTA_DIARIA, { timeZone: TIMEZONE_CHILE })
  async ingestarDiaActual(): Promise<ResumenIngesta> {
    return this.ingestarFecha(fechaHoyChileIso());
  }

  async ingestarFecha(fechaIso: string): Promise<ResumenIngesta> {
    const recibidas = await this.breaker.getLicitacionesByFecha(fechaIso);

    const normalizadas: LicitacionParaPublicar[] = [];
    for (const raw of recibidas) {
      const payload = normalizarLicitacion(raw);
      if (payload === null) {
        this.logger.warn(
          `Licitación descartada (campos mínimos/estado desconocido): ${raw.CodigoExterno || 'sin código'}`,
        );
        continue;
      }
      normalizadas.push({ codigoExterno: payload.codigoExterno, payload });
    }

    const descartadas = recibidas.length - normalizadas.length;
    const { publicadas, fallidas } =
      normalizadas.length > 0
        ? await this.publisher.publicarLicitaciones(fechaIso, normalizadas)
        : { publicadas: 0, fallidas: 0 };

    const resumen = {
      recibidas: recibidas.length,
      publicadas,
      fallidas,
      descartadas,
    };
    this.logger.log(`Ingesta ${fechaIso}: ${JSON.stringify(resumen)}`);
    return resumen;
  }
}
