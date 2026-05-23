# FASE 0: BASE — Monorepo Scaffold

**Status**: ✅ COMPLETADO
**Prioridad**: Bloqueante (prerequisito de todo)
**Sprint**: Sprint 0

## Tareas

### Tarea 0.1: Monorepo Turborepo + pnpm workspaces ✅
- Archivo: `pnpm-workspace.yaml`, `turbo.json`, `package.json` raíz
- Turbo pipeline: build → lint → typecheck → test → test:e2e con cache por proyecto

### Tarea 0.2: Packages compartidos ✅
- Archivo: `packages/tsconfig/base.json` (ES2023, strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes)
- Archivo: `packages/tsconfig/nextjs.json` (extends base + dom + Bundler moduleResolution)

### Tarea 0.3: Docker Compose local ✅
- MongoDB 7 → puerto 27017 (ct-core-api)
- PostgreSQL 16 → puerto 5432 (ct-fondos)
- Redis 7 → puerto 6379 (ct-fondos colas)
- Todos con healthchecks

### Tarea 0.4: ct-core-api scaffold ✅
- NestJS 11 + Fastify + @nestjs/mongoose + MongoDB
- Módulo licitaciones con schema Mongoose (CodigoExterno índice único — idempotencia)
- Health check via ConnectionStates.connected
- Eliminado: Prisma + pg (reemplazado por Mongoose)
- @aws-sdk/client-sqs, @aws-sdk/client-s3, @aws-sdk/client-ses instalados
- opossum (circuit breaker) instalado

### Tarea 0.5: ct-core-web scaffold ✅
- Next.js 16 + React 19 + Tailwind 4
- @supabase/ssr + @supabase/supabase-js
- Middleware auth edge (session refresh + redirect)
- Dashboard layout con parallel route @liveTenderFeed (+ default.tsx obligatorio — bug Next.js #74895)
- Login page placeholder

### Tarea 0.6: ct-fondos scaffold ✅
- NestJS 11 + Fastify + Prisma 7 + PostgreSQL
- Schema: Fondo + PymeProfile + Alerta
- FondosGobScraper skeleton (Playwright TODO)
- MatchingService skeleton (Prisma query por región)
- ScraperModule con @nestjs/schedule

### Tarea 0.7: ct-analytics scaffold ✅
- FastAPI + Python
- requirements.txt: scikit-learn, XGBoost, LightGBM, SMOTE, NetworkX, LlamaIndex, pgvector, pymongo
- Routers: /api/ranking/{rut} + /api/sna/organismo/{codigo} (skeletons)
- Services: RankingService + FallbackMatcher + SnaService (skeletons)

### Tarea 0.8: CI/CD GitHub Actions ✅
- ci-apps: pnpm turbo lint + typecheck + test
- ci-analytics: pytest + ruff

## Criterios de Aceptación

- [x] `pnpm turbo lint` → 3/3 proyectos verde
- [x] `docker-compose up` levanta MongoDB + PostgreSQL + Redis
- [x] `/health` responde en ct-core-api (MongoDB connectivity check)
- [x] ct-fondos `prisma generate` sin errores
- [x] ct-analytics `uvicorn main:app` arranca sin errores
