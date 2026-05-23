import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Licitacion, LicitacionSchema } from './licitacion.schema.js';
import { LicitacionesRepository } from './licitaciones.repository.js';
import { LicitacionesService } from './licitaciones.service.js';
import { LicitacionesController } from './licitaciones.controller.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Licitacion.name, schema: LicitacionSchema },
    ]),
  ],
  providers: [LicitacionesRepository, LicitacionesService],
  controllers: [LicitacionesController],
  exports: [LicitacionesRepository],
})
export class LicitacionesModule {}
