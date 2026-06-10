import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SQSClient } from '@aws-sdk/client-sqs';
import { S3Client } from '@aws-sdk/client-s3';
import { SESClient } from '@aws-sdk/client-ses';
import { ENV_KEYS } from '@config/env.constants';

export const SQS_CLIENT = Symbol('SQS_CLIENT');
export const S3_CLIENT = Symbol('S3_CLIENT');
export const SES_CLIENT = Symbol('SES_CLIENT');

const regionDe = (config: ConfigService): string =>
  config.getOrThrow<string>(ENV_KEYS.AWS_REGION);

export const awsClientProviders: Provider[] = [
  {
    provide: SQS_CLIENT,
    inject: [ConfigService],
    useFactory: (config: ConfigService) =>
      new SQSClient({ region: regionDe(config) }),
  },
  {
    provide: S3_CLIENT,
    inject: [ConfigService],
    useFactory: (config: ConfigService) =>
      new S3Client({ region: regionDe(config) }),
  },
  {
    provide: SES_CLIENT,
    inject: [ConfigService],
    useFactory: (config: ConfigService) =>
      new SESClient({ region: regionDe(config) }),
  },
];

export const AWS_CLIENT_TOKENS = [SQS_CLIENT, S3_CLIENT, SES_CLIENT];
