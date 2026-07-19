import { Module } from '@nestjs/common';
import { FondosRepository } from './fondos.repository.js';

@Module({
  providers: [FondosRepository],
  exports: [FondosRepository],
})
export class FondosModule {}
