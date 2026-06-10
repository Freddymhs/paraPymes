import { Module } from '@nestjs/common';
import { IngestaModule } from '@modules/ingesta/ingesta.module';
import { HealthController } from './health.controller';

@Module({
  imports: [IngestaModule],
  controllers: [HealthController],
})
export class HealthModule {}
