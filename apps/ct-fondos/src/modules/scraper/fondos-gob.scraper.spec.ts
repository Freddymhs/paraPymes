import { FondosGobScraper } from './fondos-gob.scraper.js';

// Smoke test REAL contra fondos.gob.cl — no es unitario: lanza Playwright y
// navega el sitio vivo. Solo corre con RUN_SCRAPER_SANITY=1 (cron diario en CI).
// Si falla, el layout de fondos.gob.cl cambió y el scraper está roto.
const SANITY_ENABLED = process.env['RUN_SCRAPER_SANITY'] === '1';
const describeSanity = SANITY_ENABLED ? describe : describe.skip;

const SANITY_TIMEOUT_MS = 300_000;
const MIN_FONDOS_ESPERADOS = 10;

describeSanity('FondosGobScraper (sanity — sitio real)', () => {
  const scraper = new FondosGobScraper();

  it(
    `scrape() retorna >= ${MIN_FONDOS_ESPERADOS} fondos válidos, sin duplicados`,
    async () => {
      const fondos = await scraper.scrape();

      expect(fondos.length).toBeGreaterThanOrEqual(MIN_FONDOS_ESPERADOS);

      for (const fondo of fondos) {
        expect(fondo.nombre).toBeTruthy();
        expect(fondo.institucion).toBeTruthy();
        expect(fondo.estado).toBeTruthy();
        expect(fondo.urlFuente).toMatch(/^https:\/\/fondos\.gob\.cl\//);
        expect(Array.isArray(fondo.regiones)).toBe(true);
        expect(Array.isArray(fondo.tiposBeneficiario)).toBe(true);
      }

      const urls = fondos.map((f) => f.urlFuente);
      expect(new Set(urls).size).toBe(urls.length);
    },
    SANITY_TIMEOUT_MS,
  );
});
