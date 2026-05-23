# FASE 4: ct-fondos — Scrapers Múltiples + Matching Completo + Notificaciones

**Status**: ⏸️ PENDIENTE
**Prioridad**: Media-Alta
**Dependencias**: FASE_2 (fondos.gob.cl debe estar scrapeando)
**Sprint**: Sprint 2 (paralelo con FASE 3)

> ⚠️ **CORFO — URL blobwhere**: CORFO usa OpenText Vignette CMS. Las URLs tienen un parámetro `blobwhere` opaco que cambia cuando se republica el contenido. Nunca guardar la URL directa como identificador. Extraer y guardar el ID interno del fondo (el que aparece en el contenido o en el path, no en el query string).
>
> ⚠️ **No automatizar postulaciones**: ClaveÚnica bloquea cualquier intento de automatización de postulación. El copiloto LLM ayuda a redactar — la postulación ocurre en el portal oficial. Documentar esto en el código para no perder tiempo intentándolo.
>
> ⚠️ **Anti-spam**: máximo 1 alerta por usuario por día — el usuario NO debe recibir spam. Resend free tier: 3.000 emails/mes.

## Orden de ejecución

1. Tarea 4.A — Scraper SERCOTEC (WordPress, riesgo moderado de rotura)
2. Tarea 4.B — Scraper CORFO (OpenText Vignette, blobwhere)
3. Tarea 4.C — Scraper FOSIS (semanal)
4. Tarea 4.D — API CKAN datos.gob.cl (sin scraping, API directa)
5. Tarea 4.E — Motor de matching completo (todos los criterios del perfil)
6. Tarea 4.F — Sistema de alertas email (Resend)
7. Tarea 4.G — Calendario de convocatorias
8. Tarea 4.H — Copiloto LLM básico (LlamaIndex sobre fichas)

## Tareas

### Tarea 4.A: Scraper SERCOTEC (WordPress)

- Archivo: `src/modules/scraper/sercotec.scraper.ts` (crear)
- Qué hacer:
  - SERCOTEC.cl usa WordPress → el DOM es relativamente estable pero puede romperse con actualizaciones de tema
  - Playwright: navegar a `/convocatorias`, extraer lista de fondos activos
  - `robots.txt` de SERCOTEC solo bloquea `/wp-admin/` → scraping de convocatorias es legal
  - SERCOTEC tiene sitemap disponible → considerarlo como fuente alternativa para URLs
  - Cron: `@Cron(CronExpression.EVERY_DAY_AT_8AM)` (igual que fondos.gob.cl)
  - Agregar al `ScraperModule` junto a `FondosGobScraper`
  - changedetection.io: agregar selector key de SERCOTEC al monitoreo
- Referencia: `src/modules/scraper/fondos-gob.scraper.ts`

### Tarea 4.B: Scraper CORFO (OpenText Vignette)

- Archivo: `src/modules/scraper/corfo.scraper.ts` (crear)
- Qué hacer:
  - CORFO usa OpenText Vignette CMS — URLs con `blobwhere` que cambian al republicar
  - **CRÍTICO**: extraer el ID interno del fondo (campo en el contenido HTML, no en la URL). Usar ese ID como `urlFuente` en el modelo `Fondo` — o mejor, crear campo `idExterno` en el schema Prisma
  - `robots.txt` de CORFO solo bloquea `/sites/cpp/convocatorias/` → scraping de otras secciones permitido
  - Cron: `@Cron('0 8 */2 * *')` — cada 2 días (3x/semana según CONCEPTO.md)
  - Monto mínimo CORFO: $250.000 USD → fondos para startups e I+D
  - Agregar campo `idExterno: String?` al schema Prisma `Fondo` para guardar el ID CORFO
- Referencia: `prisma/schema.prisma` — agregar `idExterno` a `Fondo`

### Tarea 4.C: Scraper FOSIS

- Archivo: `src/modules/scraper/fosis.scraper.ts` (crear)
- Qué hacer:
  - FOSIS.gob.cl → navegación manual con Playwright a sección convocatorias
  - Cron: `@Cron('0 8 * * 1')` — semanal los lunes
  - Perfil objetivo: sectores vulnerables, fondos $300K–$1M CLP per cápita
  - Menor frecuencia de convocatorias que SERCOTEC → semanal es suficiente
  - changedetection.io: agregar selector key de FOSIS al monitoreo
- Referencia: `src/modules/scraper/sercotec.scraper.ts`

### Tarea 4.D: API CKAN datos.gob.cl (sin scraping)

- Archivo: `src/modules/scraper/datos-gob.client.ts` (crear)
- Qué hacer:
  - `datos.gob.cl` usa CKAN → tiene API REST directa, sin scraping necesario
  - `GET https://datos.gob.cl/api/3/action/package_search?q=fondos&fq=organization:...`
  - Usar para histórico de fondos — sin rate limit
  - Fuente de datos complementaria a los scrapers
  - Cron: mensual (histórico no cambia a diario)
  - No es Playwright — es un cliente HTTP simple (usar `fetch` o `axios`)

### Tarea 4.E: Motor de Matching Completo

- Archivo: `src/modules/matching/matching.service.ts` (modificar — esqueleto existe, completar)
- Qué hacer:
  - El esqueleto actual solo filtra por `estado: 'abierto'` y `region`
  - Agregar todos los criterios del perfil `PymeProfile`:
    - `tamanoFiscal`: micro/pequeña/mediana/grande → cada fondo tiene tramos elegibles
    - `rubroSii`: código de actividad SII → cruzar con `tiposBeneficiario[]` del fondo
    - `generoSocietario`: algunos fondos priorizan mujeres empresarias
    - `antiguedadAnios`: SERCOTEC exige antigüedad mínima (verificar por fondo)
  - Matching es en tiempo real (query SQL, no batch)
  - Agregar endpoint `GET /matching/fondos?rut=12345678-9` que internamente recupera el `PymeProfile` por RUT y ejecuta el matching
  - `PymeProfile` se crea/actualiza via endpoint separado `POST /perfil/pyme`
- Referencia: `src/modules/matching/matching.service.ts`, `src/modules/matching/matching.controller.ts`

### Tarea 4.F: Sistema de Alertas Email (Resend)

- Archivo: `src/modules/alertas/alertas.service.ts` (crear)
- Qué hacer:
  - Instalar `resend` (SDK oficial) si no está: `pnpm add resend`
  - Al scraper descubrir un fondo nuevo `estado: 'abierto'` → disparar matching contra todos los `PymeProfile` de la DB
  - Para cada PYME que califica → enviar email via Resend
  - **Anti-spam**: tabla `Alerta` en PostgreSQL (ya en schema Prisma) como registro de alertas enviadas. Antes de enviar: verificar que no se envió alerta a esa PYME por ese fondo en las últimas 24h
  - Máximo 1 alerta por usuario por día (todas las fuentes combinadas)
  - Template email: nombre del fondo, institución, monto, fecha cierre, link al fondo, link al copiloto
  - Resend free tier: 3.000 emails/mes → suficiente para MVP (<100 usuarios activos)
  - Campo `SES_FROM_EMAIL` en env.constants (ya existe en ct-core-api — agregar equivalente en ct-fondos: `RESEND_FROM_EMAIL`)

### Tarea 4.G: Calendario de Convocatorias

- Archivos:
  - `src/modules/calendario/calendario.service.ts` (crear)
  - `src/modules/calendario/calendario.controller.ts` (crear)
- Qué hacer:
  - `GET /calendario?mes=YYYY-MM` → retorna fondos con `fechaApertura` y `fechaCierre` en ese mes
  - Incluir fondos históricos (patrón por institución y época del año) — si hay datos suficientes
  - Respuesta incluye: `{ fondos: Fondo[], patrones: { institucion, mesesFrequentes }[] }`
  - El frontend (ct-core-web) lo usará para mostrar vista cronológica — preparar la API correctamente tipada

### Tarea 4.H: Copiloto LLM — LlamaIndex sobre Fichas

- Archivo: `src/modules/copiloto/copiloto.service.ts` (crear)
- Qué hacer:
  - LlamaIndex + pgvector (Supabase) para búsqueda semántica sobre fichas de convocatoria
  - Instalar: `pnpm add llamaindex` (verificar versión compatible)
  - Pipeline: ficha PDF/HTML → chunk → embed (OpenAI) → upsert en pgvector
  - Endpoint `POST /copiloto/consulta` con `{ rut: string, pregunta: string }` → respuesta contextualizada al perfil de la PYME
  - **NO automatizar la postulación** — el copiloto ayuda a redactar el modelo de negocios, Lean Canvas, memoria técnica. La postulación la hace el usuario en el portal oficial con su ClaveÚnica
  - Agregar comentario en el código: `// ClaveÚnica bloquea cualquier automatización de postulación — no intentar`
  - GPT-4o mini para respuestas → costo estimado: $3–10 USD/mes MVP
  - `OPENAI_API_KEY` en env

## Criterios de Aceptación

- [ ] Scrapers de SERCOTEC, CORFO y FOSIS retornan al menos 1 fondo real en modo manual
- [ ] CORFO: ningún fondo guardado con URL que contenga `blobwhere` (verificar en DB)
- [ ] Matching retorna fondos correctos para un `PymeProfile` de prueba (rubroSii + región + tamanoFiscal)
- [ ] Alerta email llega vía Resend cuando se crea un fondo nuevo que califica para un perfil de prueba
- [ ] No se envían 2 alertas en el mismo día para la misma PYME por el mismo fondo (verificar tabla `Alerta`)
- [ ] `GET /calendario?mes=2026-06` retorna fondos con fechas correctas
- [ ] Copiloto responde en español con contexto del perfil PYME (respuesta no genérica)
- [ ] El código del copiloto tiene comentario explícito: no automatizar postulación (ClaveÚnica)
- [ ] changedetection.io tiene monitores activos para fondos.gob.cl + SERCOTEC + CORFO + FOSIS
- [ ] `pnpm turbo typecheck` pasa sin errores en ct-fondos
