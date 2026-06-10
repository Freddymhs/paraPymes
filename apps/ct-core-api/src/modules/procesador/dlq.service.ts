import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  DeleteMessageCommand,
  Message,
  ReceiveMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { SendEmailCommand, SESClient } from '@aws-sdk/client-ses';
import { ENV_KEYS } from '@config/env.constants';
import { SES_CLIENT, SQS_CLIENT } from '@modules/ingesta/aws/aws.providers';
import {
  MensajeFallido,
  MensajeFallidoDocument,
} from './mensajes-fallidos/mensaje-fallido.schema';

const CRON_DLQ_POLL = '*/5 * * * *';
const MAX_MENSAJES_POR_LOTE = 10;
// No agotar SES free tier (3K emails/mes): máximo 1 alerta cada 30 minutos.
const INTERVALO_MIN_ALERTAS_MS = 30 * 60 * 1000;
const RAZON_DEFAULT = 'Mensaje derivado a DLQ por agotamiento de reintentos';

@Injectable()
export class DlqService {
  private readonly logger = new Logger(DlqService.name);
  // Rate limit de alertas — única mutabilidad necesaria.
  private ultimaAlertaMs = 0;

  constructor(
    @Inject(SQS_CLIENT) private readonly sqs: SQSClient,
    @Inject(SES_CLIENT) private readonly ses: SESClient,
    private readonly config: ConfigService,
    @InjectModel(MensajeFallido.name)
    private readonly mensajesFallidos: Model<MensajeFallidoDocument>,
  ) {}

  @Cron(CRON_DLQ_POLL)
  async revisarDlq(): Promise<number> {
    const dlqUrl = this.config.get<string>(ENV_KEYS.SQS_DLQ_URL, '');
    if (dlqUrl === '') {
      return 0;
    }

    const respuesta = await this.sqs.send(
      new ReceiveMessageCommand({
        QueueUrl: dlqUrl,
        MaxNumberOfMessages: MAX_MENSAJES_POR_LOTE,
      }),
    );
    const mensajes = respuesta.Messages ?? [];
    if (mensajes.length === 0) {
      return 0;
    }

    for (const mensaje of mensajes) {
      await this.archivarMensaje(dlqUrl, mensaje);
    }
    await this.alertarSiCorresponde(mensajes.length);
    return mensajes.length;
  }

  /** Persiste el fallo en MongoDB para debugging y lo saca de la DLQ. */
  private async archivarMensaje(
    dlqUrl: string,
    mensaje: Message,
  ): Promise<void> {
    await this.mensajesFallidos.create({
      sqsMessageId: mensaje.MessageId,
      body: mensaje.Body ?? '',
      razon: RAZON_DEFAULT,
    });
    await this.sqs.send(
      new DeleteMessageCommand({
        QueueUrl: dlqUrl,
        ReceiptHandle: mensaje.ReceiptHandle,
      }),
    );
  }

  private async alertarSiCorresponde(cantidad: number): Promise<void> {
    const ahora = Date.now();
    const enVentanaDeSilencio =
      ahora - this.ultimaAlertaMs < INTERVALO_MIN_ALERTAS_MS;
    if (enVentanaDeSilencio) {
      this.logger.warn(
        `DLQ con ${cantidad} mensajes — alerta suprimida por rate limit`,
      );
      return;
    }

    const fromEmail = this.config.get<string>(ENV_KEYS.SES_FROM_EMAIL, '');
    if (fromEmail === '') {
      this.logger.warn('SES_FROM_EMAIL no configurado — alerta DLQ omitida');
      return;
    }

    await this.ses.send(
      new SendEmailCommand({
        Source: fromEmail,
        Destination: { ToAddresses: [fromEmail] },
        Message: {
          Subject: { Data: `[ct-core-api] DLQ con ${cantidad} mensajes` },
          Body: {
            Text: {
              Data: `Se detectaron ${cantidad} mensajes en la DLQ de licitaciones. Revisar la colección mensajes_fallidos en MongoDB.`,
            },
          },
        },
      }),
    );
    this.ultimaAlertaMs = ahora;
    this.logger.log(`Alerta DLQ enviada (${cantidad} mensajes)`);
  }
}
