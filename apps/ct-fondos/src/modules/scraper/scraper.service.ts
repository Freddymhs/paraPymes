import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FondosGobScraper } from './fondos-gob.scraper.js';

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(private readonly fondosGob: FondosGobScraper) {}

  // Corre diariamente a las 08:00 — fondos.gob.cl es la fuente primaria
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  runDailyScrape(): void {
    this.logger.log('Iniciando ciclo diario de scraping');

    const fondos = this.fondosGob.scrape();
    this.logger.log(`Scraped ${fondos.length} fondos desde fondos.gob.cl`);

    // TODO: persistir via FondosRepository
  }

  runManual(): void {
    return this.runDailyScrape();
  }
}
