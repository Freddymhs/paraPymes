import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';
import { IngestaModule } from '@modules/ingesta/ingesta.module';
import {
  Licitacion,
  LicitacionSchema,
} from '@modules/licitaciones/licitacion.schema';
import { LicitacionesModule } from '@modules/licitaciones/licitaciones.module';
import {
  MensajeFallido,
  MensajeFallidoSchema,
} from './mensajes-fallidos/mensaje-fallido.schema';
import { LicitacionReadModel } from './cqrs/licitacion-read.model';
import { LicitacionWriteModel } from './cqrs/licitacion-write.model';
import { ProcesadorService } from './procesador.service';
import { DlqService } from './dlq.service';

@Module({
  imports: [
    CqrsModule,
    IngestaModule,
    LicitacionesModule,
    MongooseModule.forFeature([
      { name: Licitacion.name, schema: LicitacionSchema },
      { name: MensajeFallido.name, schema: MensajeFallidoSchema },
    ]),
  ],
  providers: [
    LicitacionWriteModel,
    LicitacionReadModel,
    ProcesadorService,
    DlqService,
  ],
  exports: [LicitacionWriteModel, LicitacionReadModel],
})
export class ProcesadorModule {}
