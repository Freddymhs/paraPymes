# Concepto Inicial del Proyecto

> Documento de origen — no editar. Refleja la idea original con la que se generó el backlog.
> Fecha: 2026-05-23

---

# ParaPymes — CompraTransparente

Ecosistema de 4 proyectos orientados a PYMEs chilenas proveedoras del Estado. Convierte los datos abiertos de Mercado Público y los fondos concursables estatales en inteligencia accionable: qué licitaciones atacar, a qué precio, y qué subsidios pedir.

---

## Visión general del ecosistema

```
RUT de la PYME
    │
    ├── ct-fondos      → Fondos concursables compatibles con el perfil (capital)
    │
    └── ct-core-api    → Licitaciones de Mercado Público ingestadas y normalizadas
            │
            ├── ct-core-web   → Dashboard: alertas, filtrado, favoritos
            │
            └── ct-analytics  → BI: ranking predictivo, endogamia, competencia, RAG
```

### Dependencias entre proyectos

| Proyecto | Depende de | Independiente de |
|---------|-----------|-----------------|
| ct-core-api | ChileCompra API + bulk OCDS | Todos |
| ct-core-web | ct-core-api | ct-analytics, ct-fondos |
| ct-analytics | ct-core-api (datos MongoDB) | ct-fondos |
| ct-fondos | Scrapers web | Todos |

---

## Problema que resuelve

**Mercado Público** publica +5.000 licitaciones/día pero su plataforma es difícil de navegar, no alerta a tiempo y no revela patrones ocultos. Las PYMEs postulan a ciegas sin saber si una licitación tiene probabilidad real de adjudicación o si ya está predestinada a un proveedor habitual. Cada postulación fallida es pérdida neta (garantías, tiempo, certificaciones).

**Los fondos concursables** (CORFO, SERCOTEC, FOSIS, INDAP) se publican con ventanas de 2 semanas o menos y cada institución tiene su propio portal. Sin monitoreo activo, una PYME pierde convocatorias para las que califica.

**Contexto de mercado:**
- ChileCompra: $17.643M USD anuales, 850+ organismos, 5.000 licitaciones/día
- 20% de licitaciones adjudicadas (2019–2021) tuvieron solo 1 competidor → endogamia real
- El Observatorio ChileCompra cubre <0.2% de procesos con 8 personas
- 1.2M PYMEs con RUT activo en Chile
- Ciberataque IFX Networks (sept 2023): Mercado Público estuvo caído 10 días, $2M USD/día en pérdidas

---

## ct-core-api — Backend de Ingesta

### Propósito
Ingerir datos de ChileCompra (API REST + bulk OCDS) y publicarlos como eventos procesables en SQS. Es la fuente de verdad del ecosistema.

### Stack
- NestJS 11 (Fastify)
- MongoDB Atlas M0 (free tier, 512 MB) → escalar a M10 cuando sea necesario
- AWS Lambda (ingesta periódica + alertas)
- AWS SQS FIFO (comunicación entre servicios)
- AWS S3 (payloads > 256 KB — Claim-Check pattern)
- AWS SES (notificaciones email, 3.000/mes free tier)
- Docker Compose (entorno local)

### Arquitectura de 3 servicios

**Servicio de Ingesta:**
- Cron/Lambda que consulta la API de ChileCompra periódicamente
- Circuit Breaker (opossum) para manejar inestabilidad de la API gubernamental
- Consultas pesadas entre 22:00–07:00 (recomendación oficial)
- Publica eventos en SQS FIFO con batching (hasta 10 por llamada)
- Claim-Check para payloads > 256 KB (almacena en S3, SQS lleva solo el pointer)

**Servicio Consumidor/Procesador:**
- Long polling en SQS
- Idempotencia garantizada via índice único en MongoDB sobre `CodigoExterno`
- CQRS: modelo de escritura (validar + persistir) separado del modelo de lectura (vistas desnormalizadas)
- Bus de eventos interno (NestJS CQRS module)

**Servicio de Alertas:**
- Escucha eventos de alto valor (monto, categoría, región)
- Lambda → SES (email)
- Rate limiting para no agotar cuota

### Patrones senior implementados
Circuit Breaker · Event-driven · CQRS · Idempotencia · Dead Letter Queue · Claim-Check · Retry backoff exponencial · Graceful shutdown · Health checks · Logging estructurado (Pino) · Swagger/OpenAPI · DTOs class-validator · Variables de entorno validadas al startup

### Ingesta de datos — dos fuentes

**API REST (incremental diario):**
```
GET https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json
    ?estado={publicada|cerrada|adjudicada|todos}
    &fecha=DDMMYYYY
    &ticket={ticket}
```
- Autenticación: ticket gratuito con RUT + ClaveÚnica
- Límite: 10.000 req/día (no negociable). Solo para updates del día actual.
- Sin rangos de fechas — hay que iterar día por día para backfill

**Bulk OCDS (histórico masivo):**
- Portal: datos-abiertos.chilecompra.cl
- Formato: archivos .7z con esquema OCDS (JSON)
- Sin rate limit — es la fuente correcta para el histórico completo
- 4.885.161 adjudicaciones históricas, 4.963.799 proveedores únicos

**Compra Ágil:** No está en la API REST. Solo disponible en CSV del portal de datos abiertos.

### Restricciones free tier
| Servicio | Límite | Implicación |
|---------|--------|-------------|
| AWS Lambda | 1M req/mes, 400K GB-s | Crons async, no polling síncrono |
| AWS SQS | 1M req/mes | Batching ≤ 10 mensajes/request |
| AWS SES | 3.000 emails/mes | Rate limiting en alertas |
| AWS S3 | 5 GB, 20K GET/mes | Solo payloads grandes (Claim-Check) |
| MongoDB M0 | 512 MB, 100 ops/s | TTL indexes, archivar histórico, connection pooling |

### Riesgos
1. API nueva con breaking changes anunciada para Q2 2026 (OCDS expandido, webhooks) — todo código contra la API actual quedará desactualizado
2. Sin SLA — ChileCompra puede modificar o suspender sin garantía
3. Compra Ágil (30–40% de compras) no está en API REST

---

## ct-core-web — Dashboard Frontend

### Propósito
Interfaz usable por PYMEs sin conocimientos técnicos. El único proyecto análogo con UI completa que sobrevivió es LicitaLAB (SaaS de pago). Esta es la razón de ser del ecosistema: un frontend real.

### Stack
- Next.js 16 con App Router
- React 19
- TypeScript strict
- TailwindCSS 4
- Supabase Auth (SSO unificado con ct-analytics)
- Vercel (deploy)
- Vitest (unit/integration) + Playwright (E2E)

### Arquitectura Next.js avanzada

**Rutas Paralelas:**
- `@analyticsGraph` — gráficos de montos adjudicados por región/categoría
- `@liveTenderFeed` — feed en vivo de licitaciones nuevas
- `@accountingSummary` — resumen de oportunidades guardadas
- Cada slot se renderiza independiente — si uno falla los demás siguen

**Rutas Interceptoras:**
- Click en licitación → modal con detalle sin perder contexto del dashboard
- Navegación directa a la URL → página completa
- **No anidar** parallel + intercepting routes (bugs conocidos Next.js #65192, #74895, #83278)

**Patrones:**
- RSC + Streaming progresivo del dashboard
- Server Actions (guardar favoritos, configurar alertas) + `useOptimistic`
- ISR con `revalidateTag` (estadísticas cada 15 min)
- Middleware: auth JWT edge, rate limiting por IP, RBAC, CSP headers, i18n ES/EN
- Caching multinivel: React cache → fetch tags → Router Cache → CDN Vercel

### Valor para el usuario
- **Persona natural:** Encuentra licitaciones sin navegar Mercado Público
- **PYME:** Recibe alertas cuando aparecen oportunidades en su rubro
- **Ciudadano:** Transparencia sobre el gasto estatal

---

## ct-analytics — Plataforma de BI y Analítica Predictiva

### Propósito
Convertir los datos históricos de Mercado Público en decisiones accionables: qué licitaciones atacar, a qué precio, contra quién, y cuáles evitar porque estadísticamente están dirigidas.

### Dependencia
Se construye sobre los datos que ct-core-api ingesta y normaliza en MongoDB. Sin ct-core-api funcionando con datos históricos (mínimo 3–6 meses), este proyecto no tiene suficiente señal para los modelos.

### Stack
```
Datos
├── MongoDB (datos de ct-core-api) → análisis tabular
├── Bulk OCDS histórico .7z → ETL → MongoDB (última década)
├── SII datasets CSV → enriquecimiento por actividad económica
└── PDFs bases de licitación → pipeline RAG

ML (ranking predictivo tabular)
├── scikit-learn / XGBoost / LightGBM
├── Modelo exportado como joblib (~50 MB)
├── Re-entrenamiento mensual via GitHub Actions
└── Inferencia serverless: Modal.com (free tier $30/mes)

RAG (bases de licitación PDF)
├── LlamaIndex + unstructured[pdf] (OCR con Tesseract)
├── Supabase pgvector (búsqueda híbrida vector + SQL)
└── GPT-4o mini ($0.15/1M tokens input)

SNA (detección de proveedores cautivos)
├── NetworkX offline (MVP, grafo bipartito <500K nodos)
├── Railway cron mensual para grafo completo
└── Sigma.js + graphology frontend (WebGL, 100K+ nodos)

API / Frontend
├── FastAPI (microservicio ML) → expone ranking + SNA
└── Next.js + Sigma.js dashboard BI
```

### Features centrales

**1. Motor de Ranking Predictivo (ML)**
- Variables: frecuencia de compra del organismo, tramos monetarios, oferentes históricos, tasa de concentración
- Output: coeficiente de probabilidad de adjudicación por licitación
- Problema documentado: class imbalance extremo (ratio relevante/irrelevante ≈ 1:700)
- Estrategia: SMOTE oversampling en training + threshold recall 0.85 + `class_weight={0:1, 1:707}`
- Fallback: si `confidence < 0.6`, matching por keywords exactas (regla determinista)

**2. Detección de Proveedores Cautivos — SNA**
- Análisis de Redes Sociales sobre grafo bipartito comprador ↔ proveedor
- Algoritmos: betweenness centrality, componentes conectadas, Herfindahl-Hirschman (HHI)
- "Índice de Endogamia del Comprador": alerta antes de invertir en postular a licitación dirigida
- Basado en: Herrera, Torres, Nicolis y Salas (2020) + García Rodríguez 2022 (UAM)

**3. Inteligencia Competitiva**
- Precios históricos de competidores por rubro y región
- Curvas de regresión de precios por competidor y sector
- Requiere datos históricos de la última década

**4. RAG sobre Bases de Licitación (LLM)**
- NLP sobre PDFs de bases administrativas y técnicas
- NER automático: extrae criterios de evaluación, cronogramas, multas, requisitos
- Preguntas en lenguaje natural sobre documentos
- Costo ingesta inicial 100K PDFs: ~$20 USD total

**5. Evaluación Bidireccional de Compradores**
- Califica organismos: plazos de pago reales, reclamos formales, concentración de proveedores
- Protege el flujo de caja frente a instituciones morosas

**6. CRM Especializado**
- Calendario de fechas críticas por proceso
- Recordatorios de garantías y cierres de postulación
- Anti-churn: incrustarse en el flujo diario del equipo comercial

### Calidad de datos OCDS — problemas conocidos
| Problema | Mitigación |
|---------|-----------|
| Sin datos de pago efectivo (solo adjudicación) | Columna `data_quality_score` por registro |
| RUTs con formato inconsistente | Normalización en ETL antes del análisis |
| Organismos que no reportan completamente | No mostrar métricas si `data_quality_score < 0.7` |
| Compra Ágil fuera de API | ETL complementario desde CSV bulk |

### Costos de infraestructura MVP
| Componente | Servicio | Costo/mes |
|-----------|---------|-----------|
| Base de datos | MongoDB Atlas M10 | ~$57 |
| Vector store + SQL | Supabase Pro | $25 |
| Inferencia ML | Modal.com | $0–30 |
| LLM queries RAG | GPT-4o mini | ~$3–15 |
| SNA jobs | Lambda / Railway | ~$5–10 |
| **Total estimado MVP** | | **~$90–137/mes** |

---

## ct-fondos — Agregador de Fondos Concursables

### Propósito
Agregar fondos concursables de CORFO, SERCOTEC, FOSIS e INDAP, hacer matching automático con el perfil de la PYME, y alertar en tiempo real cuando se abre una convocatoria compatible.

### Independencia
No depende del core. Comparte el perfil de la PYME (RUT + datos SII) con ct-analytics, formando la super-app B2B.

### Stack
```
Fuentes de datos (scraping con Playwright)
├── fondos.gob.cl      → cron diario (fuente primaria — SPA JS)
├── sercotec.cl        → cron diario (WordPress)
├── corfo.cl           → 3x/semana (OpenText Vignette CMS)
├── fosis.gob.cl       → semanal
└── datos.gob.cl CKAN  → API directa (histórico, sin scraping)

Scraping
├── Playwright (auto-wait nativo para sitios JS-heavy)
├── Crawlee (wrapper Node.js — reintentos, session management, rate limiting)
├── Hosting MVP: Apify Starter ($29/mes)
└── Monitoreo: changedetection.io (self-hosted Railway) → alerta pre-fallo

Backend (independiente del core)
├── NestJS + PostgreSQL (Supabase/Railway)
└── Redis (colas de notificación)

Notificaciones
├── Email: Resend (3.000/mes gratis) → canal primario MVP
└── WhatsApp Business API: Twilio → 360dialog (feature premium fase 2)

Copiloto LLM
├── LlamaIndex + pgvector sobre fichas de convocatorias
└── GPT-4o mini
```

### Features centrales

**1. Motor de Matching Paramétrico**
- Perfil: tamaño fiscal, ingresos netos, región, rubro SII, género societario, antigüedad legal
- Cross-match contra fondos activos en tiempo real
- Solo muestra lo que califica

**2. Alertas en Tiempo Real**
- Alerta inmediata cuando abre convocatoria compatible
- Máximo 1 alerta/día por usuario (anti-spam)
- Opt-in doble confirmación para WhatsApp

**3. Copiloto LLM para Postulación**
- Preparación previa: redacción de modelo de negocios, Lean Canvas, memoria técnica
- La postulación ocurre en el portal oficial (ClaveÚnica bloquea cualquier automatización — no intentar)

**4. Calendario de Convocatorias**
- Vista cronológica de aperturas y cierres
- Historial de patrones por institución y época del año

### Taxonomía de fuentes
| Institución | Tramo de fondos | Perfil objetivo |
|------------|----------------|----------------|
| CORFO | Desde $250.000 USD | Startups, I+D, internacionalización |
| SERCOTEC | $2M–$9M CLP | MiPyMEs formales, cooperativas |
| FOSIS | $300K–$1M CLP per cápita | Sectores vulnerables |
| INDAP | Bonificaciones recurrentes | Agricultura campesina |

### Legalidad del scraping (verificado abril 2026)
- CORFO robots.txt: solo bloquea `/sites/cpp/convocatorias/`, resto permitido
- SERCOTEC robots.txt: solo bloquea `/wp-admin/`, tiene sitemap disponible
- fondos.gob.cl robots.txt: retorna 404 (sin restricciones)
- Sin ley chilena contra web scraping de sitios gubernamentales públicos

### Fragilidad de scrapers — mitigaciones
- CORFO usa OpenText Vignette: URLs con `blobwhere` opaco que cambia al republicar → no guardar URL directa, solo ID del fondo
- SERCOTEC WordPress: riesgo moderado de rotura por actualizaciones de tema
- Regla: scrapers deben tener tests de sanidad que corran diariamente
- changedetection.io monitora selectores clave → alerta antes de rotura en producción

### Costos de infraestructura MVP
| Componente | Servicio | Costo/mes |
|-----------|---------|-----------|
| Scraping hosting | Apify Starter | $29 |
| Monitoreo scrapers | changedetection.io self-hosted | $0 |
| Backend + DB | Railway NestJS + PostgreSQL | ~$10 |
| Notificaciones | Resend free tier (email) | $0 |
| LLM copiloto | GPT-4o mini | ~$3–10 |
| **Total MVP (sin WhatsApp)** | | **~$42–49/mes** |
| WhatsApp (1K usuarios, 5 msg/mes) | Meta + BSP Twilio | +~$150 |

### Principios anti-fracaso para ct-fondos
1. fondos.gob.cl primero — un scraper bien mantenido cubre más que 4 scrapers mal mantenidos
2. Email como canal primario (gratuito), WhatsApp como feature premium
3. El copiloto LLM es el diferenciador — fondos.gob.cl ya lista los fondos, la ayuda para redactar es la razón de pago
4. No automatizar postulaciones — ClaveÚnica lo bloquea. Documentar esto para no perder tiempo

---

## Competencia y diferenciación

### Competidores directos

| Plataforma | País | Foco | Precio | Diferencia con nosotros |
|-----------|------|------|--------|------------------------|
| **LicitaLAB** | Chile | Proveedor que vende al Estado | 2.2–5 UF/mes (~$40–110 USD) | RAG orientado al proveedor, no análisis de patrones. Sin SNA, sin ranking ML |
| **Maxxa** | Chile | Recomendador gratuito | Gratis (modelo crédito) | Solo matching básico por RUT. Sin BI ni análisis histórico |
| **Analiza.cl** | Chile (Estado) | Transparencia pública | Gratis | Caído (ECONNREFUSED). Sin alertas, sin predicción |
| **LATAM Compra** | Colombia | Agregador 17 países | Sin precio público | Sin SNA ni ranking ML verificado |

**Vacío confirmado:** ningún competidor tiene (a) ranking predictivo ML por proveedor, (b) SNA para detección de cautividad, (c) RAG orientado al análisis del comprador público.

### Por qué los proyectos anteriores fracasaron

| Repo | Stack | Razón de muerte |
|------|-------|----------------|
| branst/CL-MercadoPublico-Parser | Lambda + SQS + DynamoDB | Sin producto ni usuario final. Murió en 7 meses |
| DCCP-Hugo/MercadoPublicoOCDS | R + PostgreSQL + Shiny | Stack inaccesible para devs web. Sin audiencia |
| gepd/MercadoPublico | TypeScript SDK | Solo wrapper de URLs. Sin valor agregado |
| ComprasTransparentes/api | Python Flask | Sin frontend. Solo replica otra API |

**Patrón común:** todos llegaron a demo funcional y desaparecieron. **El diferenciador real de CompraTransparente es el frontend completo y funcional — algo que ningún proyecto anterior logró.**

---

## Riesgos principales

| Riesgo | Impacto | Mitigación |
|--------|---------|-----------|
| API ChileCompra breaking change Q2 2026 | Alto | Diseñar ingesta sobre bulk OCDS como fuente primaria |
| Arquitectura sin producto (patrón de muerte) | Crítico | MVP usable primero, features avanzados después |
| Class imbalance extremo en ML (1:700) | Alto | SMOTE + threshold asimétrico + fallback determinista |
| Scrapers frágiles ante rediseños institucionales | Medio | changedetection.io + tests diarios de sanidad |
| MongoDB sin primitivas de grafo | Medio | NetworkX para SNA, migrar a Neo4j/AGE si >500K aristas |
| Rate limit ChileCompra (10K req/día) | Alto | Bulk OCDS para histórico, API REST solo para delta diario |

---

## Principios anti-fracaso (del análisis de proyectos muertos)

1. **Producto primero, arquitectura después.** El MVP debe ser usable por una PYME sin conocimientos técnicos antes de optimizar.
2. **No ser un wrapper.** Agregar valor real: filtrado inteligente, alertas, visualización, resiliencia ante caídas.
3. **Stack mainstream.** NestJS + Next.js + FastAPI tienen comunidad activa y empleabilidad.
4. **Procesamiento incremental.** No intentar descargar todo el histórico al inicio.
5. **Frontend visible.** Si no hay interfaz, no hay usuario. El dashboard es tan importante como el backend.
6. **Free tier sostenible.** AWS free tier permanente + MongoDB Atlas M0 + Vercel Hobby.
7. **Resiliencia como feature.** Si ChileCompra cae (como en sept 2023 por 10 días), CompraTransparente sigue mostrando el último estado conocido.

---

## Roadmap de desarrollo

```
Sprint 0 — Scaffold (paralelo, todos los proyectos)
├── Monorepo Turborepo + pnpm workspaces
├── Cada proyecto inicializado desde template
├── Docker Compose local (MongoDB + PostgreSQL + Redis)
└── CI/CD básico (lint + typecheck + test en PR)

Sprint 1 — Primer valor real (paralelo)
├── ct-core-api: ChileCompra API client → ingesta del día actual
└── ct-fondos:   Scraper fondos.gob.cl → fondos en PostgreSQL

Sprint 2 — Primeras interfaces
├── ct-core-web: Listado de licitaciones del día (consumiendo ct-core-api)
└── ct-fondos:   Motor de matching + alertas email básicas

Sprint 3+ — Inteligencia (requiere datos acumulados)
└── ct-analytics: Feature engineering → primer modelo XGBoost → SNA básico
```

**Regla de oro:** ct-analytics necesita mínimo 3–6 meses de datos históricos acumulados en MongoDB antes de que los modelos tengan señal suficiente. No es el primer proyecto en desarrollar features avanzadas.
