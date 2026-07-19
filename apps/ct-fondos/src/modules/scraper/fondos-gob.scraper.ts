import { Injectable, Logger } from '@nestjs/common';
import { PlaywrightCrawler, Configuration } from '@crawlee/playwright';
import type { Locator, Page } from 'playwright';

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

// fondos.gob.cl renderiza la grilla en servidor, pero se scrapea con Playwright
// igual: resiliencia ante cambios a render cliente y mandato del backlog (FASE 2).
// changedetection.io monitorea estos selectores para alertar antes de que rompan.
const SELECTORS = {
  grilla: '.row.grilla',
  fondoCard: '.row.grilla a[href*="/ficha/"]',
  estadoBadge: '.titular .badge',
  alcanceGeo: '.titular span:has(i.bi-geo-alt)',
  institucion: '.titular small.text-uppercase',
  nombre: '.titular h6',
  cardBodyParrafos: '.card-body p',
} as const;

// Orden fijo de los <p> dentro de .card-body en fondos.gob.cl
const PARRAFO_BENEFICIARIOS = 0;
const PARRAFO_FECHAS = 1;
const PARRAFO_MONTOS = 2;

// 1 home + ~20 categorías /searchernew/ + margen
const MAX_REQUESTS_POR_CRAWL = 40;

const ALCANCE_NACIONAL = 'nacional';
const REGEX_FECHA_INICIO = /Inicio:\s*(\d{2})[-/](\d{2})[-/](\d{4})/;
const REGEX_FECHA_FIN = /Fin:\s*(\d{2})[-/](\d{2})[-/](\d{4})/;
const REGEX_MONTO = /\$\s*([\d.]+)/;

const parsearFecha = (texto: string, regex: RegExp): Date | undefined => {
  const match = regex.exec(texto);
  if (!match) return undefined;
  const [, dia, mes, anio] = match;
  return new Date(Date.UTC(Number(anio), Number(mes) - 1, Number(dia)));
};

const parsearMonto = (texto: string): bigint | undefined => {
  const match = REGEX_MONTO.exec(texto);
  if (!match) return undefined;
  return BigInt(match[1].replaceAll('.', ''));
};

// "Nacional" = sin restricción regional → lista vacía (matching la trata como "todas")
const parsearRegiones = (alcanceGeo: string | null): string[] => {
  if (!alcanceGeo) return [];
  const alcance = alcanceGeo.trim();
  const esNacional = alcance.toLowerCase() === ALCANCE_NACIONAL;
  return esNacional ? [] : [alcance];
};

@Injectable()
export class FondosGobScraper {
  private readonly logger = new Logger(FondosGobScraper.name);
  private readonly BASE_URL = 'https://fondos.gob.cl';

  async scrape(): Promise<FondoScraped[]> {
    this.logger.log(`Iniciando scraping de ${this.BASE_URL}`);

    const fondosPorUrl = new Map<string, FondoScraped>();

    const crawler = new PlaywrightCrawler(
      {
        maxRequestsPerCrawl: MAX_REQUESTS_POR_CRAWL,
        requestHandler: async ({ page, enqueueLinks }) => {
          await enqueueLinks({ globs: [`${this.BASE_URL}/searchernew/**`] });

          const fondos = await this.extraerFondosDePagina(page);
          for (const fondo of fondos) {
            fondosPorUrl.set(fondo.urlFuente, fondo);
          }
        },
        failedRequestHandler: ({ request }, error) => {
          this.logger.error(`Request fallido ${request.url}: ${error.message}`);
        },
      },
      new Configuration({ persistStorage: false }),
    );

    await crawler.run([this.BASE_URL]);

    this.logger.log(`Scraping finalizado: ${fondosPorUrl.size} fondos únicos`);
    return [...fondosPorUrl.values()];
  }

  private async extraerFondosDePagina(page: Page): Promise<FondoScraped[]> {
    await page.waitForSelector(SELECTORS.grilla);

    const cards = await page.locator(SELECTORS.fondoCard).all();
    const fondos: FondoScraped[] = [];

    for (const card of cards) {
      const fondo = await this.extraerFondo(card);
      if (fondo) {
        fondos.push(fondo);
      }
    }

    return fondos;
  }

  private async extraerFondo(card: Locator): Promise<FondoScraped | null> {
    const href = await card.getAttribute('href');
    const nombre = await this.textoDe(card, SELECTORS.nombre);
    const institucion = await this.textoDe(card, SELECTORS.institucion);
    const estado = await this.textoDe(card, SELECTORS.estadoBadge);

    const faltanObligatorios = !href || !nombre || !institucion || !estado;
    if (faltanObligatorios) {
      this.logger.warn(`Card sin campos obligatorios, se omite (href=${href})`);
      return null;
    }

    const alcanceGeo = await this.textoDe(card, SELECTORS.alcanceGeo);
    const parrafos = await card
      .locator(SELECTORS.cardBodyParrafos)
      .allTextContents();
    const beneficiarios = parrafos[PARRAFO_BENEFICIARIOS]?.trim();
    const fechasTexto = parrafos[PARRAFO_FECHAS] ?? '';
    const montoTexto = parrafos[PARRAFO_MONTOS] ?? '';

    return {
      nombre,
      institucion,
      estado: estado.toLowerCase(),
      urlFuente: new URL(href, this.BASE_URL).toString(),
      montoMax: parsearMonto(montoTexto),
      fechaApertura: parsearFecha(fechasTexto, REGEX_FECHA_INICIO),
      fechaCierre: parsearFecha(fechasTexto, REGEX_FECHA_FIN),
      regiones: parsearRegiones(alcanceGeo),
      tiposBeneficiario: beneficiarios ? [beneficiarios] : [],
    };
  }

  private async textoDe(
    card: Locator,
    selector: string,
  ): Promise<string | null> {
    const elemento = card.locator(selector).first();
    const existe = (await elemento.count()) > 0;
    if (!existe) return null;

    const texto = await elemento.textContent();
    return texto?.trim() ?? null;
  }
}
