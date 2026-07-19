import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { FondosModule } from '@modules/fondos/fondos.module.js';
import { ScraperService } from './scraper.service.js';
import { FondosGobScraper } from './fondos-gob.scraper.js';

@Module({
  imports: [ScheduleModule.forRoot(), FondosModule],
  providers: [ScraperService, FondosGobScraper],
  exports: [ScraperService],
})
export class ScraperModule {}
