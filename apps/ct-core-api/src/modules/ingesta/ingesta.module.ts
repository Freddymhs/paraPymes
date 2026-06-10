import { Module } from '@nestjs/common';
import { LicitacionesModule } from '@modules/licitaciones/licitaciones.module';
import { ChileCompraApiClient } from './clients/chilecompra-api.client';
import { ChileCompraBreaker } from './circuit-breaker/chilecompra.breaker';
import { awsClientProviders, AWS_CLIENT_TOKENS } from './aws/aws.providers';
import { ClaimCheckService } from './s3/claim-check.service';
import { SqsPublisherService } from './sqs/sqs-publisher.service';
import { IngestaService } from './ingesta.service';
import { BulkOcdsService } from './etl/bulk-ocds.service';
import { CompraAgilService } from './etl/compra-agil.service';

@Module({
  imports: [LicitacionesModule],
  providers: [
    ChileCompraApiClient,
    ChileCompraBreaker,
    ...awsClientProviders,
    ClaimCheckService,
    SqsPublisherService,
    IngestaService,
    BulkOcdsService,
    CompraAgilService,
  ],
  exports: [
    ChileCompraApiClient,
    ChileCompraBreaker,
    ClaimCheckService,
    SqsPublisherService,
    IngestaService,
    BulkOcdsService,
    CompraAgilService,
    ...AWS_CLIENT_TOKENS,
  ],
})
export class IngestaModule {}
