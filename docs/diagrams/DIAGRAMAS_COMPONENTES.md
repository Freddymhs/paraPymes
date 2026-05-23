# Diagramas de Componentes — ParaPymes CompraTransparente

Propósito: mapa estructural estable del ecosistema. Actualizar solo si cambia la topología (agregar/quitar servicios, cambiar fronteras).

---

## Contexto (alto nivel)

```mermaid
flowchart LR
    PYME([PYME Chilena])
    MP[(Mercado Público\nChileCompra)]
    GOB[(fondos.gob.cl\nSERCOTEC / CORFO\nFOSIS / INDAP)]
    OCDS[(Bulk OCDS .7z\ndatos-abiertos.chilecompra.cl)]
    CKAN[(datos.gob.cl\nAPI CKAN)]

    PYME -->|usa dashboard| WEB[ct-core-web\nNext.js 16]
    MP -->|API REST delta diario| API[ct-core-api\nNestJS + MongoDB]
    OCDS -->|ETL histórico| API
    GOB -->|scraping Playwright| FONDOS[ct-fondos\nNestJS + PostgreSQL]
    CKAN -->|API directa| FONDOS
    API -->|datos históricos MongoDB| ANALYTICS[ct-analytics\nFastAPI + Python]
    API -.->|licitaciones| WEB
    ANALYTICS -.->|ranking + SNA| WEB
    FONDOS -.->|fondos compatibles| WEB
    FONDOS -->|alertas email| PYME
    API -->|alertas SES| PYME
```

---

## Componentes principales

```mermaid
flowchart TB
    subgraph PYME_ACTOR["Actor"]
        P([PYME Chilena])
    end

    subgraph FRONTEND["ct-core-web — Vercel"]
        DASH[Dashboard\nNext.js 16 App Router]
        AUTH[Auth\nSupabase SSR]
        MW[Middleware Edge\nCSP + Rate Limit + RBAC]
        PR1[@liveTenderFeed\nParallel Route]
        PR2[@analyticsGraph\nParallel Route]
        PR3[@accountingSummary\nParallel Route]
        IR[(Intercepting Route\nModal Detalle)]
        SA[Server Actions\nFavoritos + Alertas]
    end

    subgraph CORE_API["ct-core-api — AWS Lambda + MongoDB Atlas"]
        INGESTA[Servicio Ingesta\nCron 22:00 + Circuit Breaker]
        SQS_PUB[SQS Publisher\nBatch ≤10 / Claim-Check S3]
        SQS_CON[Procesador SQS\nCQRS + Idempotencia]
        DLQ[DLQ Handler\nAlertas SES]
        LIC_REPO[(LicitacionesRepository\nupsertByCodigoExterno)]
        MONGO[(MongoDB Atlas\nM0→M10)]
    end

    subgraph FONDOS_SVC["ct-fondos — Railway"]
        SCRAPER[Scrapers\nPlaywright + Crawlee]
        APIFY[(Apify Starter\n$29/mes hosting)]
        MATCH[Motor Matching\nPrisma SQL]
        ALERTA_SVC[Alertas\nResend Email]
        COPILOTO[Copiloto LLM\nLlamaIndex + GPT-4o mini]
        PG[(PostgreSQL Railway\nFondo + PymeProfile + Alerta)]
    end

    subgraph ANALYTICS_SVC["ct-analytics — Modal + Railway"]
        ETL[ETL Bulk OCDS\n+ Compra Ágil CSV]
        ML[XGBoost + SMOTE\nModal.com serverless]
        FALLBACK[FallbackMatcher\nKeyword matching]
        SNA[SNA NetworkX\nGrafo bipartito]
        RAG[RAG Pipeline\nLlamaIndex + pgvector]
        PGV[(Supabase pgvector\nembeddings PDFs)]
    end

    subgraph INFRA["Infraestructura compartida"]
        REDIS[(Redis\ncolas notificación)]
        S3[(AWS S3\nClaim-Check payloads)]
        SQS_Q[(AWS SQS FIFO\n1M req/mes free)]
        SES[(AWS SES\n3K emails/mes free)]
        CDI[changedetection.io\nRailway self-hosted]
    end

    P --> MW --> AUTH --> DASH
    DASH --> PR1 & PR2 & PR3
    DASH --> IR
    DASH --> SA
    DASH -->|fetch licitaciones| LIC_REPO
    PR2 -->|ranking + SNA| ML & SNA

    INGESTA -->|circuit breaker| SQS_PUB --> SQS_Q
    SQS_Q --> SQS_CON --> LIC_REPO --> MONGO
    SQS_CON -->|payload >256KB| S3
    SQS_CON -->|fallo| DLQ --> SES
    
    SCRAPER --> APIFY
    SCRAPER --> PG
    MATCH --> PG
    ALERTA_SVC -->|Resend| P
    CDI -->|monitorea selectores| SCRAPER

    ETL --> MONGO
    ML -->|joblib model| FALLBACK
    SNA --> MONGO
    RAG --> PGV

    FONDOS_SVC --> REDIS
```

---

## Flujo de ingesta de datos

```mermaid
sequenceDiagram
    participant Lambda as Lambda Cron (22:00)
    participant CB as Circuit Breaker
    participant CHILECOMPRA as ChileCompra API
    participant SQS as AWS SQS FIFO
    participant S3 as AWS S3
    participant CONSUMER as Procesador SQS
    participant MONGO as MongoDB Atlas

    Lambda->>CB: getLicitacionesByFecha(hoy)
    CB->>CHILECOMPRA: GET /licitaciones?fecha=DDMMYYYY&ticket=...
    alt API responde OK
        CHILECOMPRA-->>CB: LicitacionRaw[]
        CB-->>Lambda: LicitacionRaw[]
        loop Batch de 10
            Lambda->>SQS: SendMessageBatch (≤10 mensajes)
            alt payload > 256 KB
                Lambda->>S3: PutObject(licitaciones/{fecha}/{codigo}.json)
                Lambda->>SQS: SendMessage({type: claim-check, s3Key: ...})
            end
        end
    else API falla o timeout
        CB-->>Lambda: [] (fallback vacío — sistema sigue con datos previos)
    end

    CONSUMER->>SQS: ReceiveMessage (long polling 20s)
    SQS-->>CONSUMER: mensajes
    alt mensaje es claim-check
        CONSUMER->>S3: GetObject(s3Key)
        S3-->>CONSUMER: payload completo
    end
    CONSUMER->>MONGO: upsertByCodigoExterno (idempotente)
    CONSUMER->>SQS: DeleteMessage (solo si upsert OK)
```

---

## Free tier y costos MVP

```mermaid
flowchart LR
    subgraph FREE["Free Tier (mes 1–3)"]
        F1[MongoDB M0\n512 MB / 100 ops/s]
        F2[AWS Lambda\n1M req + 400K GB-s]
        F3[AWS SQS\n1M req/mes]
        F4[AWS SES\n3K emails/mes]
        F5[AWS S3\n5 GB / 20K GET]
        F6[Vercel Hobby\ngratis]
        F7[Modal.com\n$30 créditos]
    end

    subgraph PAID["Costos fijos MVP"]
        P1[Apify Starter\n$29/mes]
        P2[Railway\n~$10/mes]
        P3[Supabase Pro\n$25/mes]
        P4[GPT-4o mini\n$3-15/mes]
    end

    subgraph UPGRADE["Upgrade cuando escala"]
        U1[MongoDB M10\n$57/mes cuando >400 MB]
        U2[Railway Pro\n+$5 si necesario]
    end
```

---

> Actualizar este archivo cuando se agregue un nuevo servicio externo, se cambie el proveedor de algún componente, o se modifique la frontera entre servicios. No actualizar por cambios internos a un servicio.
