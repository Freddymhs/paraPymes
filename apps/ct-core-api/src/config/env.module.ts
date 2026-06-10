import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';

export const EnvModule = ConfigModule.forRoot({
  isGlobal: true,
  validationSchema: Joi.object({
    NODE_ENV: Joi.string()
      .valid('development', 'production', 'test')
      .default('development'),
    PORT: Joi.number().default(3000),
    DATABASE_URL: Joi.string().required(),
    CORS_ORIGINS: Joi.string().default('http://localhost:3001'),
    PINO_LOG_LEVEL: Joi.string()
      .valid('trace', 'debug', 'info', 'warn', 'error', 'fatal')
      .default('info'),
    THROTTLE_TTL: Joi.number().default(60),
    THROTTLE_LIMIT: Joi.number().default(100),
    CHILECOMPRA_API_URL: Joi.string()
      .uri()
      .default('https://api.mercadopublico.cl/servicios/v1'),
    CHILECOMPRA_TICKET: Joi.string().allow('').default(''),
    AWS_REGION: Joi.string().default('us-east-1'),
    SQS_QUEUE_URL: Joi.string().allow('').default(''),
    SQS_DLQ_URL: Joi.string().allow('').default(''),
    S3_BUCKET_PAYLOADS: Joi.string().allow('').default(''),
    SES_FROM_EMAIL: Joi.string().allow('').default(''),
  }),
  validationOptions: { abortEarly: false },
});
