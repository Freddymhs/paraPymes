import { Injectable, Logger } from '@nestjs/common';

export interface FondoScraped {
  nombre: string;
  institucion: string;
  estado: string;
  urlFuente: string;
  descripcion?: string;
  montoMax?: bigint;
  fechaApertura?: Date;
  fechaCierre?: Date;
  regiones: string[];
  tiposBeneficiario: string[];
}

// fondos.gob.cl es una SPA JS — requiere Playwright para renderizar antes de scraping.
// changedetection.io monitorea selectores clave para alertar antes de que rompa.
@Injectable()
export class FondosGobScraper {
  private readonly logger = new Logger(FondosGobScraper.name);
  private readonly BASE_URL = 'https://fondos.gob.cl';

  scrape(): FondoScraped[] {
    this.logger.log(`Iniciando scraping de ${this.BASE_URL}`);

    // TODO: Implementar con Playwright + Crawlee
    // const browser = await chromium.launch();
    // const page = await browser.newPage();
    // await page.goto(this.BASE_URL);
    // await page.waitForSelector('[data-testid="fondo-card"]');
    // const fondos = await page.evaluate(() => { ... });

    this.logger.warn('Scraper pendiente de implementación con Playwright');
    return [];
  }
}
