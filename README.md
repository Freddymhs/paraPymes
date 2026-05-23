# ParaPymes — CompraTransparente

Ecosistema de 4 proyectos para PYMEs chilenas proveedoras del Estado. Convierte datos de Mercado Público y fondos concursables en inteligencia accionable: qué licitaciones atacar, a qué precio, y qué subsidios pedir.

## Tech Stack

| Proyecto | Framework | Base de datos | Deploy |
|---------|-----------|---------------|--------|
| **ct-core-api** | NestJS 11 + Fastify | MongoDB Atlas (Mongoose) | AWS Lambda |
| **ct-core-web** | Next.js 16 + React 19 + Tailwind 4 | Supabase (Auth + pgvector) | Vercel |
| **ct-fondos** | NestJS 11 + Fastify | PostgreSQL (Prisma 7) | Railway |
| **ct-analytics** | FastAPI + Python | MongoDB + pgvector | Modal.com + Railway |

**Monorepo**: Turborepo + pnpm workspaces  
**Infra local**: Docker Compose (MongoDB 7 / PostgreSQL 16 / Redis 7)  
**CI**: GitHub Actions (turbo lint + typecheck + test + pytest + ruff)

## Setup

```bash
# Instalar dependencias
pnpm install

# Levantar servicios locales (MongoDB, PostgreSQL, Redis)
docker-compose up -d

# Ejecutar todos los proyectos Node.js
pnpm dev

# Solo un proyecto específico
pnpm --filter @parapymes/ct-core-api dev
pnpm --filter @parapymes/ct-core-web dev
pnpm --filter @parapymes/ct-fondos dev

# ct-analytics (Python)
cd services/ct-analytics
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

## Estructura

```
ParaPymes/
├── apps/
│   ├── ct-core-api/     ← NestJS + MongoDB (ingesta ChileCompra)
│   ├── ct-core-web/     ← Next.js 16 (dashboard PYME)
│   └── ct-fondos/       ← NestJS + PostgreSQL (fondos concursables)
├── services/
│   └── ct-analytics/    ← FastAPI + Python (ML + SNA + RAG)
├── packages/
│   └── tsconfig/        ← tsconfig base compartida
├── docs/
│   ├── backlog/         ← Fases de desarrollo (8 fases, ~68 tareas)
│   ├── diagrams/        ← Diagramas Mermaid del ecosistema
│   └── decisions/       ← ADRs (decisiones arquitectónicas)
├── docker-compose.yml
└── turbo.json
```

## Variables de entorno

Copiar `.env.example` y completar los valores:

```bash
cp .env.example .env.local
```

Ver `.env.example` para la lista completa por proyecto.

## Backlog

Ver [`docs/backlog/README.md`](docs/backlog/README.md) — 8 fases, ~68 tareas.

Sprint actual: **FASE 1** (ct-core-api ingesta) + **FASE 2** (ct-fondos scraper) en paralelo.

## Estado

- Sprint 0: ✅ COMPLETADO (monorepo scaffold, lint verde)
- Sprint 1: ⏸️ En progreso
