import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SendMessageBatchCommand, SQSClient } from '@aws-sdk/client-sqs';
import { ENV_KEYS } from '@config/env.constants';
import { partirEnLotes } from '@common/utils';
import { SQS_CLIENT } from '../aws/aws.providers';
import { ClaimCheckService } from '../s3/claim-check.service';

export interface LicitacionParaPublicar {
  readonly codigoExterno: string;
  // object: el publisher solo serializa; el shape lo garantiza el productor.
  readonly payload: object;
}

export interface ResumenPublicacion {
  readonly publicadas: number;
  readonly fallidas: number;
}

// Límite de SendMessageBatch (y cuida el free tier: 1M req/mes).
const SQS_BATCH_MAX = 10;
const MESSAGE_GROUP_ID = 'licitaciones';

@Injectable()
export class SqsPublisherService {
  private readonly logger = new Logger(SqsPublisherService.name);

  constructor(
    @Inject(SQS_CLIENT) private readonly sqs: SQSClient,
    private readonly config: ConfigService,
    private readonly claimCheck: ClaimCheckService,
  ) {}

  async publicarLicitaciones(
    fechaIso: string,
    entradas: readonly LicitacionParaPublicar[],
  ): Promise<ResumenPublicacion> {
    const queueUrl = this.config.getOrThrow<string>(ENV_KEYS.SQS_QUEUE_URL);
    const resumen = { publicadas: 0, fallidas: 0 };

    for (const lote of partirEnLotes(entradas, SQS_BATCH_MAX)) {
      const entries = await Promise.all(
        lote.map(async ({ codigoExterno, payload }, indice) => ({
          Id: String(indice),
          MessageBody: JSON.stringify(
            await this.claimCheck.envolver(fechaIso, codigoExterno, payload),
          ),
          MessageGroupId: MESSAGE_GROUP_ID,
          MessageDeduplicationId: codigoExterno,
        })),
      );

      const respuesta = await this.sqs.send(
        new SendMessageBatchCommand({ QueueUrl: queueUrl, Entries: entries }),
      );
      const fallidasLote = respuesta.Failed?.length ?? 0;
      resumen.publicadas += lote.length - fallidasLote;
      resumen.fallidas += fallidasLote;
    }

    this.logger.log(
      `SQS ${fechaIso}: ${resumen.publicadas} publicadas, ${resumen.fallidas} fallidas`,
    );
    return resumen;
  }
}
