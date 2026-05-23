# FASE 7: Producción + DevOps

**Status**: ⏸️ PENDIENTE
**Prioridad**: Alta (no hay producto sin deploy)
**Dependencias**: FASE_3 (ct-core-web MVP) + FASE_1 (ct-core-api ingesta)
**Sprint**: Sprint 3 — deploy básico puede hacerse en paralelo con FASE 4 y 5

> 💡 **Deploy incremental**: no esperar a que FASE 5 y 6 estén completas para ir a producción. Hacer deploy de ct-core-api + ct-core-web + ct-fondos tan pronto FASE_1 + FASE_3 estén listas. ct-analytics puede deployarse después cuando el modelo esté entrenado.
>
> ⚠️ **MongoDB M0 → M10**: el paso de M0 (512 MB free) a M10 ($57/mes) debe hacerse ANTES de que la base supere 400 MB. Monitorear con alertas en Atlas.
>
> 💰 **Costo total estimado MVP completo**: $90–137/mes (ver CONCEPTO.md §costos).

## Orden de ejecución

1. Tarea 7.A — ct-core-api: AWS Lambda deploy (ingesta + alertas)
2. Tarea 7.B — ct-fondos: Railway deploy (NestJS + PostgreSQL)
3. Tarea 7.C — ct-core-web: Vercel deploy
4. Tarea 7.D — MongoDB Atlas M0 → M10 migration
5. Tarea 7.E — changedetection.io Railway self-hosted
6. Tarea 7.F — ct-analytics: Modal.com + Railway deploy
7. Tarea 7.G — Monitoring: Sentry + CloudWatch + alertas
8. Tarea 7.H — Environment variables management (no secrets en repo)

## Tareas

### Tarea 7.A: ct-core-api — AWS Lambda Deploy

- Archivo: `apps/ct-core-api/serverless.yml` (crear) o usar AWS CDK/SAM
- Qué hacer:
  - El servicio de ingesta (cron + SQS publisher) → Lambda function
  - El procesador SQS → Lambda trigger en SQS queue
  - El servicio de alertas → Lambda trigger en DLQ
  - El API REST de licitaciones (consumido por ct-core-web) → puede ser Lambda o un servidor NestJS en Railway/EC2 según costo
  - Lambda free tier: 1M req/mes + 400K GB-s → suficiente para crons y procesamiento async
  - Variables de entorno: configurar en Lambda Environment (nunca hardcodeadas)
  - VPC: no necesaria para MVP (acceso a MongoDB Atlas por IP allowlist)
  - Graceful shutdown: manejar `SIGTERM` en el NestJS para no cortar requests en vuelo

### Tarea 7.B: ct-fondos — Railway Deploy

- Archivo: `apps/ct-fondos/railway.toml` (crear)
- Qué hacer:
  - Railway: NestJS + PostgreSQL en el mismo proyecto
  - Costo estimado: ~$10/mes (Railway Hobby)
  - `railway up` en la carpeta `apps/ct-fondos`
  - Variables de entorno en Railway dashboard (no en `.env` commiteado)
  - `prisma migrate deploy` como parte del startup script (antes de `node dist/main.js`)
  - PostgreSQL Railway: 1 GB free tier → suficiente para MVP
  - Apify Starter ($29/mes) para hosting de los scrapers Playwright (no corren en el server Railway — demasiado pesado)
  - Redis: Railway también ofrece Redis plugin

### Tarea 7.C: ct-core-web — Vercel Deploy

- Archivo: `apps/ct-core-web/vercel.json` (crear si necesario)
- Qué hacer:
  - Vercel Hobby: gratis para proyectos personales
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `CT_CORE_API_URL`, `CT_ANALYTICS_URL` en Vercel Environment Variables (no en repo)
  - Dominio personalizado: configurar en Vercel dashboard
  - ISR funciona nativamente en Vercel → no requiere config adicional
  - Edge Middleware (ya implementado): corre en los edge nodes de Vercel automáticamente
  - Vercel KV para rate limiting del middleware (si se usa rate limiting basado en KV)

### Tarea 7.D: MongoDB Atlas M0 → M10

- Archivo: `docs/decisions/DECISION_MONGODB_TIER.md` (crear cuando se haga la migración)
- Qué hacer:
  - M0 (512 MB, 100 ops/s) → M10 ($57/mes, 10 GB, sin límite de ops)
  - **Trigger**: monitorear con Atlas Alerts → alerta cuando storage > 400 MB o cuando latencia > 50ms por saturación de ops/s
  - La migración en Atlas es live (sin downtime) — Atlas replica los datos al nuevo tier
  - Agregar TTL indexes ANTES de la migración para reducir el storage acumulado
  - Connection string no cambia (Atlas maneja el failover)
  - Documentar la decisión con fecha y motivo en `docs/decisions/`

### Tarea 7.E: changedetection.io — Railway Self-hosted

- Qué hacer:
  - `ghcr.io/dgtlmoon/changedetection.io:latest` en Railway
  - Costo: ~$0 en free tier, ~$5/mes si supera
  - Configurar monitores para los selectores de todos los scrapers activos:
    - fondos.gob.cl
    - sercotec.cl/convocatorias
    - corfo.cl/programas
    - fosis.gob.cl/convocatorias
  - Alerta vía email cuando selector desaparece → fix el scraper antes de que falle en producción
  - Frecuencia de check: 1 vez por día (no necesita más)

### Tarea 7.F: ct-analytics — Modal.com + Railway

- Qué hacer:
  - **Inferencia ML**: Modal.com serverless (`modal deploy app/modal_app.py`)
    - Free tier: $30/mes de créditos → más que suficiente para MVP
    - Se activa por request, no corre 24/7
  - **SNA cron mensual**: Railway cron job (`railway cron --schedule "0 2 1 * *" "python app/services/sna/compute_graph.py"`)
    - Recalcula el grafo bipartito completo y lo guarda en MongoDB
    - Costo Railway: incluido en el plan del proyecto ct-fondos si ya está en Railway
  - **FastAPI API**: Railway como servicio web (mismo proyecto que el cron)
    - `uvicorn main:app --host 0.0.0.0 --port 8000`
  - Variables de entorno: `MONGODB_URI`, `OPENAI_API_KEY`, `SUPABASE_URL`, `MODAL_INFERENCE_URL`

### Tarea 7.G: Monitoring — Sentry + CloudWatch

- Qué hacer:
  - **Sentry** (free tier: 5K eventos/mes):
    - ct-core-api: `@sentry/nestjs` → capturar errores no manejados + performance
    - ct-core-web: `@sentry/nextjs` → capturar errores de SSR + client-side
    - ct-fondos: `@sentry/nestjs`
    - ct-analytics: `sentry-sdk` Python
  - **AWS CloudWatch**:
    - Lambda invocations, errors, duration → alertas si error rate > 5%
    - SQS queue depth → alerta si DLQ > 0 mensajes (significa mensajes fallidos)
    - S3 bucket size → monitorear crecimiento de payloads Claim-Check
  - **MongoDB Atlas**:
    - Alert: storage > 400 MB (trigger para upgrade a M10)
    - Alert: ops/s > 80 (cerca del límite de 100 → optimizar queries o upgradar)
  - **Uptime check**: UptimeRobot (free) → ping `/health` de cada servicio cada 5 minutos

### Tarea 7.H: Environment Variables — Gestión Segura

- Archivo: `.env.example` (ya existe en raíz → actualizar si hay nuevas variables)
- Qué hacer:
  - **Nunca** commitear `.env` real → ya en `.gitignore`
  - Variables por entorno:
    - Local: `.env.local` en cada app
    - Railway: Railway Environment Variables dashboard
    - Lambda: Lambda Environment en AWS console
    - Vercel: Vercel Environment Variables dashboard
    - Modal.com: Modal Secrets
  - Rotar credenciales cada 6 meses: CHILECOMPRA_TICKET, OPENAI_API_KEY, SUPABASE_SERVICE_KEY
  - AWS: usar IAM roles con principio de mínimo privilegio (no usar root credentials)
  - Documentar qué variable va en qué servicio en el `README.md` (sin los valores reales)

## Criterios de Aceptación

- [ ] ct-core-api ingesta ejecuta diariamente en Lambda y los logs aparecen en CloudWatch
- [ ] ct-fondos responde en Railway (`GET /health` → 200 con `db: 'connected'`)
- [ ] ct-core-web deployado en Vercel y accesible desde URL pública
- [ ] Login + dashboard funcionan en producción (no solo local)
- [ ] MongoDB Atlas tiene alerta configurada para storage > 400 MB
- [ ] SQS DLQ tiene alerta en CloudWatch → 0 mensajes en condiciones normales
- [ ] Sentry captura errores en los 4 proyectos (verificar con un error de prueba)
- [ ] UptimeRobot monitorea `/health` de ct-core-api + ct-fondos + ct-analytics
- [ ] Ninguna variable de entorno con valor real está commiteada al repo
- [ ] changedetection.io corre en Railway y tiene monitores activos para todos los scrapers
