import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventBus } from '@nestjs/cqrs';
import {
  DeleteMessageCommand,
  Message,
  ReceiveMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { ENV_KEYS } from '@config/env.constants';
import { esperarMs } from '@common/utils';
import { SQS_CLIENT } from '@modules/ingesta/aws/aws.providers';
import {
  ClaimCheckService,
  MensajeSqs,
} from '@modules/ingesta/s3/claim-check.service';
import { LicitacionWriteModel } from './cqrs/licitacion-write.model';
import { LicitacionProcesadaEvent } from './cqrs/licitacion-procesada.event';

// Long polling: reduce llamadas a SQS (free tier 1M req/mes).
const WAIT_TIME_SECONDS = 20;
const MAX_MENSAJES_POR_LOTE = 10;
// Si SQS rechaza rápido (red caída), sin pausa el while gira en hot loop.
const PAUSA_TRAS_ERROR_MS = 5_000;

export interface ResumenLote {
  readonly procesados: number;
  readonly fallidos: number;
}

@Injectable()
export class ProcesadorService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(ProcesadorService.name);
  // Flag de ciclo de vida del poller — única mutabilidad necesaria.
  private activo = false;

  constructor(
    @Inject(SQS_CLIENT) private readonly sqs: SQSClient,
    private readonly config: ConfigService,
    private readonly claimCheck: ClaimCheckService,
    private readonly writeModel: LicitacionWriteModel,
    private readonly eventBus: EventBus,
  ) {}

  onApplicationBootstrap(): void {
    const queueUrl = this.queueUrl;
    const esEntornoTest = this.config.get<string>(ENV_KEYS.NODE_ENV) === 'test';
    if (queueUrl === '' || esEntornoTest) {
      this.logger.log('Poller SQS desactivado (sin queue URL o entorno test)');
      return;
    }
    this.activo = true;
    void this.iniciarPolling(queueUrl);
  }

  onModuleDestroy(): void {
    this.activo = false;
  }

  /** Una pasada de long polling: recibe hasta 10 mensajes y los procesa. */
  async procesarLote(queueUrl: string): Promise<ResumenLote> {
    const respuesta = await this.sqs.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        WaitTimeSeconds: WAIT_TIME_SECONDS,
        MaxNumberOfMessages: MAX_MENSAJES_POR_LOTE,
      }),
    );
    const mensajes = respuesta.Messages ?? [];

    const resumen = { procesados: 0, fallidos: 0 };
    for (const mensaje of mensajes) {
      const exito = await this.procesarMensaje(queueUrl, mensaje);
      if (exito) {
        resumen.procesados += 1;
      } else {
        resumen.fallidos += 1;
      }
    }
    return resumen;
  }

  /**
   * true = procesado y eliminado de la cola. false = queda en SQS: el
   * visibility timeout lo reintenta y la redrive policy lo deriva a la DLQ.
   */
  private async procesarMensaje(
    queueUrl: string,
    mensaje: Message,
  ): Promise<boolean> {
    try {
      const envoltura = JSON.parse(mensaje.Body ?? '') as MensajeSqs;
      const payload = await this.claimCheck.resolver(envoltura);
      const documento = await this.writeModel.persistir(payload);

      this.eventBus.publish(
        new LicitacionProcesadaEvent(documento.codigoExterno, documento.fuente),
      );
      await this.sqs.send(
        new DeleteMessageCommand({
          QueueUrl: queueUrl,
          ReceiptHandle: mensaje.ReceiptHandle,
        }),
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Fallo procesando mensaje ${mensaje.MessageId ?? 'sin id'}: ${String(error)}`,
      );
      return false;
    }
  }

  private async iniciarPolling(queueUrl: string): Promise<void> {
    this.logger.log('Poller SQS iniciado');
    while (this.activo) {
      try {
        await this.procesarLote(queueUrl);
      } catch (error) {
        this.logger.error(`Error en polling SQS: ${String(error)}`);
        await esperarMs(PAUSA_TRAS_ERROR_MS);
      }
    }
  }

  private get queueUrl(): string {
    return this.config.get<string>(ENV_KEYS.SQS_QUEUE_URL, '');
  }
}
