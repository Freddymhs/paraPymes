import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { ENV_KEYS } from '@config/env.constants';
import { ExternalAPIError } from '@common/exceptions';
import { S3_CLIENT } from '../aws/aws.providers';

export const MENSAJE_TIPOS = {
  LICITACION: 'licitacion',
  CLAIM_CHECK: 'claim-check',
} as const;

export interface MensajeDirecto {
  readonly type: typeof MENSAJE_TIPOS.LICITACION;
  // object: payload JSON-serializable arbitrario; el consumer lo re-tipa al resolver.
  readonly payload: object;
}

export interface MensajeClaimCheck {
  readonly type: typeof MENSAJE_TIPOS.CLAIM_CHECK;
  readonly s3Key: string;
}

export type MensajeSqs = MensajeDirecto | MensajeClaimCheck;

// Límite duro SQS: 256 KB. Margen para atributos/envoltura del mensaje.
const CLAIM_CHECK_THRESHOLD_BYTES = 200_000;

@Injectable()
export class ClaimCheckService {
  private readonly logger = new Logger(ClaimCheckService.name);

  constructor(
    @Inject(S3_CLIENT) private readonly s3: S3Client,
    private readonly config: ConfigService,
  ) {}

  /** Payload chico → mensaje directo. Grande → sube a S3 y retorna pointer. */
  async envolver(
    fechaIso: string,
    codigoExterno: string,
    payload: object,
  ): Promise<MensajeSqs> {
    const serializado = JSON.stringify(payload);
    const esGrande = serializado.length > CLAIM_CHECK_THRESHOLD_BYTES;
    if (!esGrande) {
      return { type: MENSAJE_TIPOS.LICITACION, payload };
    }

    const s3Key = `licitaciones/${fechaIso}/${codigoExterno}.json`;
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
        Body: serializado,
        ContentType: 'application/json',
      }),
    );
    this.logger.log(
      `Claim-check: payload ${codigoExterno} (${serializado.length} bytes) → s3://${this.bucket}/${s3Key}`,
    );
    return { type: MENSAJE_TIPOS.CLAIM_CHECK, s3Key };
  }

  /** Mensaje directo → payload inline. Claim-check → descarga de S3. */
  async resolver(mensaje: MensajeSqs): Promise<Record<string, unknown>> {
    if (mensaje.type === MENSAJE_TIPOS.LICITACION) {
      // Post-SQS el mensaje siempre viene de JSON.parse: es un plain object.
      return mensaje.payload as Record<string, unknown>;
    }

    const respuesta = await this.s3.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: mensaje.s3Key }),
    );
    if (!respuesta.Body) {
      throw new ExternalAPIError(`S3 sin Body para ${mensaje.s3Key}`);
    }
    const contenido = await respuesta.Body.transformToString();
    return JSON.parse(contenido) as Record<string, unknown>;
  }

  private get bucket(): string {
    return this.config.getOrThrow<string>(ENV_KEYS.S3_BUCKET_PAYLOADS);
  }
}
