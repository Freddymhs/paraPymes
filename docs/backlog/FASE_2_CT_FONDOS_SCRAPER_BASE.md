# FASE 2: ct-fondos — Scraper fondos.gob.cl + Base

**Status**: ⏸️ PENDIENTE
**Prioridad**: Alta — independiente del core, puede correr en paralelo a FASE 1
**Dependencias**: FASE_0
**Sprint**: Sprint 1 (paralelo con FASE 1)

> ⚠️ **fondos.gob.cl es SPA JS** — no se puede scrapear con HTTP simple. Requiere Playwright para que se renderice el DOM.
>
> ⚠️ **Principio anti-fracaso #1**: fondos.gob.cl primero. Un scraper bien mantenido de esta fuente cubre más que 4 scrapers mal mantenidos de otras. Las fuentes adicionales (CORFO, SERCOTEC, FOSIS) van en FASE 4.
>
> ⚠️ **changedetection.io es obligatorio** — alertar antes de que el scraper rompa en producción, no después.

## Orden de ejecución

1. Tarea 2.A — FondosGobScraper Playwright (esqueleto ya existe, implementar)
2. Tarea 2.B — FondosRepository Prisma (persiste lo que scrapeó 2.A)
3. Tarea 2.C — Integrar ScraperService → FondosRepository (conectar 2.A con 2.B)
4. Tarea 2.D — Tests de sanidad diarios del scraper
5. Tarea 2.E — changedetection.io Railway self-hosted
6. Tarea 2.F — Prisma migrate en producción (Railway PostgreSQL)

## Tareas

### Tarea 2.A: FondosGobScraper — Implementación Playwright

- Archivo: `src/modules/scraper/fondos-gob.scraper.ts` (modificar — esqueleto ya existe)
- Qué hacer:
  - Implementar `async scrape(): Promise<FondoScraped[]>` con Playwright + Crawlee
  - `fondos.gob.cl` es SPA JS → `await page.waitForSelector('[data-testid="fondo-card"]')` o selector equivalente (verificar con inspector)
  - Crawlee gestiona: reintentos, session rotation, rate limiting automático
  - Extraer por cada fondo: `nombre`, `institucion`, `estado`, `urlFuente`, `descripcion`, `montoMax`, `fechaApertura`, `fechaCierre`, `regiones[]`, `tiposBeneficiario[]`
  - Hosting MVP: Apify Starter ($29/mes) — el scraper corre ahí, no en el server de NestJS
  - `BASE_URL` ya está en la clase como constante — mantener así
  - La interfaz `FondoScraped` ya está definida — no cambiar su forma
- Referencia: `src/modules/scraper/fondos-gob.scraper.ts` (esqueleto existente)

### Tarea 2.B: FondosRepository

- Archivo: `src/modules/fondos/fondos.repository.ts` (crear)
- Qué hacer:
  - Inyectar `PrismaService`
  - `upsertByUrlFuente(data: FondoScraped): Promise<Fondo>` — usar `prisma.fondo.upsert` con `where: { urlFuente }` como identificador (o mejor: ID interno del fondo si fondos.gob.cl lo expone)
  - `findActivos(): Promise<Fondo[]>` — `where: { estado: 'abierto' }`
  - `findByRegionAndTipo(region: string, tipo: string): Promise<Fondo[]>`
  - **No guardar la URL de CORFO** si tiene `blobwhere` en el path (ver FASE 4 para CORFO — aquí solo fondos.gob.cl)
- Referencia: `src/modules/matching/matching.service.ts` (ya usa PrismaService)

### Tarea 2.C: Integrar ScraperService con FondosRepository

- Archivo: `src/modules/scraper/scraper.service.ts` (modificar — esqueleto ya existe)
- Qué hacer:
  - Inyectar `FondosRepository`
  - En `runDailyScrape()`: llamar `await this.fondosGob.scrape()` (ahora es async) → iterar resultados → `this.fondosRepo.upsertByUrlFuente(fondo)`
  - Loguear: cuántos fondos scrapeados, cuántos upserted, cuántos fallidos
  - Cambiar `runDailyScrape()` a `async` y `runManual()` también (el scraper ahora es async)
  - Capturar y loguear errores de Playwright sin relanzar — el cron no debe morir por un error de scraping
- Referencia: `src/modules/scraper/scraper.service.ts`

### Tarea 2.D: Tests de Sanidad del Scraper

- Archivo: `src/modules/scraper/fondos-gob.scraper.spec.ts` (crear)
- Qué hacer:
  - Test que verifica que el scraper retorna al menos 1 fondo (smoke test real, no mock)
  - Test que verifica que los campos obligatorios no son null: `nombre`, `institucion`, `estado`, `urlFuente`
  - Configurar en CI (`ci.yml`) para que este test corra diariamente (no solo en PR) via `schedule: cron: '0 9 * * *'`
  - Si el test falla → GitHub Actions envía notificación (email o Slack webhook) → scraper probablemente roto
  - Este test NO es unitario — requiere acceso real a fondos.gob.cl → marcar como `@slow` o separar en job aparte
- Referencia: `.github/workflows/ci.yml`

### Tarea 2.E: changedetection.io — Setup Railway

- Archivo: `docs/decisions/DECISION_MONITORING_SCRAPERS.md` (crear)
- Qué hacer:
  - Documentar la decisión: changedetection.io self-hosted en Railway ($0 en free tier, ~$5/mes si supera)
  - Configurar monitores para selectores clave en fondos.gob.cl (los que el scraper usa)
  - Alerta pre-fallo: si el selector desaparece → notificación inmediata → fix antes de que el scraper rompa en producción
  - No hay código NestJS aquí — es infraestructura externa
  - Instrucciones de setup en el ADR: `railway up --service changedetection`

### Tarea 2.F: Prisma Migrate Producción (Railway PostgreSQL)

- Archivo: `prisma/schema.prisma` (ya existe con los modelos Fondo + PymeProfile + Alerta)
- Qué hacer:
  - Crear migración: `pnpm prisma migrate dev --name init_fondos_schema`
  - Agregar a `package.json`: `"migrate:prod": "prisma migrate deploy"` (para Railway)
  - Railway PostgreSQL free tier: 1 GB, suficiente para MVP
  - `DATABASE_URL` configurar en Railway environment variables (nunca en el repo)
  - Verificar que el índice `@@unique([rut])` en `PymeProfile` está en la migración generada

## Criterios de Aceptación

- [ ] `scrape()` retorna al menos 10 fondos reales de fondos.gob.cl (con Playwright)
- [ ] Cada fondo tiene `nombre`, `institucion`, `estado`, `urlFuente` no nulos
- [ ] `upsertByUrlFuente` no duplica si se llama dos veces con el mismo fondo
- [ ] El cron de las 08:00 ejecuta y persiste fondos en PostgreSQL (verificar con `SELECT COUNT(*) FROM "Fondo"`)
- [ ] Test de sanidad corre en GitHub Actions diariamente y falla ruidosamente si fondos.gob.cl cambia
- [ ] changedetection.io monitorea al menos 2 selectores clave de fondos.gob.cl
- [ ] `prisma migrate deploy` corre sin errores en Railway
- [ ] `pnpm turbo typecheck` pasa sin errores en ct-fondos
