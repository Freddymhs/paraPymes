import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ScraperService } from './scraper.service.js';
import { FondosGobScraper } from './fondos-gob.scraper.js';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [ScraperService, FondosGobScraper],
  exports: [ScraperService],
})
export class ScraperModule {}
