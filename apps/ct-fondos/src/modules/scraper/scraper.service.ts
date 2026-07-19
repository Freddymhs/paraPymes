import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FondosRepository } from '@modules/fondos/fondos.repository.js';
import { FondosGobScraper, FondoScraped } from './fondos-gob.scraper.js';

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(
    private readonly fondosGob: FondosGobScraper,
    private readonly fondosRepo: FondosRepository,
  ) {}

  // Corre diariamente a las 08:00 — fondos.gob.cl es la fuente primaria.
  // Errores se loguean sin relanzar: el cron no debe morir por un fallo de scraping.
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async runDailyScrape(): Promise<void> {
    this.logger.log('Iniciando ciclo diario de scraping');

    try {
      const fondos = await this.fondosGob.scrape();
      this.logger.log(`Scraped ${fondos.length} fondos desde fondos.gob.cl`);

      const persistidos = await this.persistir(fondos);
      this.logger.log(
        `Persistencia: ${persistidos} upserted, ${fondos.length - persistidos} fallidos`,
      );
    } catch (error) {
      this.logger.error('Ciclo de scraping falló', error);
    }
  }

  async runManual(): Promise<void> {
    return this.runDailyScrape();
  }

  private async persistir(fondos: readonly FondoScraped[]): Promise<number> {
    const resultados = await Promise.allSettled(
      fondos.map((fondo) => this.fondosRepo.upsertByUrlFuente(fondo)),
    );

    for (const resultado of resultados) {
      if (resultado.status === 'rejected') {
        this.logger.error('Upsert de fondo falló', resultado.reason);
      }
    }

    const exitosos = resultados.filter((r) => r.status === 'fulfilled');
    return exitosos.length;
  }
}
