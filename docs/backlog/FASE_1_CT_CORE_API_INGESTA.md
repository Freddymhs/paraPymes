# FASE 1: ct-core-api — Pipeline de Ingesta ChileCompra

**Status**: ⏸️ PENDIENTE
**Prioridad**: Alta — fuente de verdad del ecosistema
**Dependencias**: FASE_0
**Sprint**: Sprint 1

> ⚠️ **Diseño crítico**: La API REST de ChileCompra tiene breaking changes anunciados para Q2 2026 (OCDS expandido + webhooks). Todo acceso a la API debe aislarse en `src/modules/ingesta/clients/`. El bulk OCDS es la fuente principal para histórico — la API REST es solo para delta diario.
>
> ⚠️ **MongoDB M0**: 512 MB y 100 ops/s. TTL indexes y connection pooling deben estar activos desde el inicio. No acumular datos sin archivar.

## Orden de ejecución

1. Tarea 1.A — ChileCompra API Client (lo usan todas las demás)
2. Tarea 1.B — Circuit Breaker wrapper (depende del client)
3. Tarea 1.C — Cron ingesta diaria (depende de 1.A + 1.B)
4. Tarea 1.D — SQS Publisher (depende de 1.C)
5. Tarea 1.E — Claim-Check S3 (depende de 1.D)
6. Tarea 1.F — SQS Consumer + Procesador CQRS (depende de 1.D)
7. Tarea 1.G — Dead Letter Queue + alertas SES (depende de 1.F)
8. Tarea 1.H — Bulk OCDS ETL (independiente, puede correr en paralelo a partir de 1.F)
9. Tarea 1.I — Compra Ágil CSV ETL (independiente)
10. Tarea 1.J — Índices MongoDB + TTL (depende de 1.F)

## Tareas

### Tarea 1.A: ChileCompra API Client

- Archivo: `src/modules/ingesta/clients/chilecompra-api.client.ts` (crear)
- Qué hacer:
  - Implementar `getLicitacionesByFecha(fecha: string): Promise<LicitacionRaw[]>`
  - URL: `https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json?estado=todos&fecha=DDMMYYYY&ticket={CHILECOMPRA_TICKET}`
  - La fecha se pasa como `DDMMYYYY` (formato chileno — no ISO)
  - Respeta el límite de 10.000 req/día → solo consultar el día actual en el cron; usar bulk OCDS para histórico
  - Consultas pesadas programadas entre 22:00–07:00 (recomendación oficial ChileCompra)
  - Retornar `LicitacionRaw[]` (tipo del esquema de la API actual, aislado — cambiará en Q2 2026)
- Referencia: `src/modules/licitaciones/licitacion.schema.ts`

### Tarea 1.B: Circuit Breaker (opossum)

- Archivo: `src/modules/ingesta/circuit-breaker/chilecompra.breaker.ts` (crear)
- Qué hacer:
  - Wrappear el client de 1.A con `opossum`
  - Configurar: `timeout: 10000, errorThresholdPercentage: 50, resetTimeout: 30000`
  - Fallback: log warning + retornar array vacío (NO lanzar excepción — el sistema sigue con datos previos)
  - Retry backoff exponencial antes de abrir el circuit (3 intentos: 1s, 2s, 4s)
  - Exponer estado del circuit en el health check (`/health`)
- Referencia: `src/health/health.controller.ts`

### Tarea 1.C: Cron de Ingesta Diaria

- Archivo: `src/modules/ingesta/ingesta.service.ts` (crear)
- Qué hacer:
  - `@Cron('0 22 * * *')` — inicia a las 22:00 (fuera de horas pico)
  - Obtener licitaciones del día via client con circuit breaker
  - Normalizar `LicitacionRaw` → `CreateLicitacionDto` (mapear campos a schema Mongoose)
  - Publicar batch a SQS (Tarea 1.D)
  - Loguear: cuántas recibidas, cuántas publicadas, cuántas fallidas
- Referencia: `src/modules/scraper/scraper.service.ts` (ct-fondos, mismo patrón cron)

### Tarea 1.D: SQS Publisher

- Archivo: `src/modules/ingesta/sqs/sqs-publisher.service.ts` (crear)
- Qué hacer:
  - Usar `@aws-sdk/client-sqs` (ya instalado)
  - `SendMessageBatch`: máximo 10 mensajes por llamada (límite SQS — 1M req/mes free tier)
  - SQS FIFO: `MessageGroupId = 'licitaciones'`, `MessageDeduplicationId = codigoExterno`
  - Si payload > 256 KB → Claim-Check (Tarea 1.E): publicar en S3 y enviar solo el pointer en SQS
  - Leer `SQS_QUEUE_URL` de `env.constants.ts`
- Referencia: `src/config/env.constants.ts`

### Tarea 1.E: Claim-Check (S3 para payloads grandes)

- Archivo: `src/modules/ingesta/s3/claim-check.service.ts` (crear)
- Qué hacer:
  - Usar `@aws-sdk/client-s3` (ya instalado)
  - Si `JSON.stringify(payload).length > 200_000` → subir a S3, retornar `{ type: 'claim-check', s3Key: '...' }`
  - Key pattern: `licitaciones/${fecha}/${codigoExterno}.json`
  - El consumidor (Tarea 1.F) debe detectar el tipo `claim-check` y descargar antes de procesar
  - Leer `S3_BUCKET_PAYLOADS` de `env.constants.ts`

### Tarea 1.F: SQS Consumer + Procesador CQRS

- Archivo: `src/modules/procesador/procesador.service.ts` (crear)
- Qué hacer:
  - Long polling en SQS: `WaitTimeSeconds: 20` (reduce llamadas API, importante para free tier)
  - Detectar si el mensaje es Claim-Check → descargar de S3 antes de procesar
  - **Idempotencia**: `LicitacionesRepository.upsertByCodigoExterno()` — ya existe, usa `findOneAndUpdate` con `upsert: true`. El índice único en MongoDB garantiza que no hay duplicados
  - CQRS: separar `LicitacionWriteModel` (validación + persistencia) de `LicitacionReadModel` (vistas desnormalizadas para queries de ct-core-web)
  - Publicar evento interno `LicitacionProcesadaEvent` via `@nestjs/cqrs`
  - Si falla procesamiento → enviar a DLQ (Tarea 1.G)
  - Eliminar mensaje de SQS solo si el procesamiento fue exitoso
- Referencia: `src/modules/licitaciones/licitaciones.repository.ts`

### Tarea 1.G: Dead Letter Queue + Alertas SES

- Archivo: `src/modules/procesador/dlq.service.ts` (crear)
- Qué hacer:
  - Configurar DLQ en SQS (`SQS_DLQ_URL` de env)
  - Poller separado que lee mensajes de la DLQ
  - Si DLQ tiene mensajes → enviar email alerta via SES (`@aws-sdk/client-ses`)
  - Rate limiting de alertas: máximo 1 email de DLQ cada 30 minutos (no agotar SES free tier: 3K/mes)
  - Guardar en MongoDB los mensajes fallidos con timestamp + razón de fallo para debugging

### Tarea 1.H: Bulk OCDS ETL (histórico)

- Archivo: `src/modules/ingesta/etl/bulk-ocds.service.ts` (crear)
- Qué hacer:
  - Fuente: datos-abiertos.chilecompra.cl → archivos `.7z` (esquema OCDS JSON)
  - Sin rate limit — es la fuente correcta para la última década (4.885.161 adjudicaciones)
  - Descomprimir `.7z` en memoria o disco temporal → parsear JSON → normalizar → upsert en MongoDB
  - `data_quality_score` por registro: calcular basado en completitud de campos clave
  - Normalizar RUTs a formato estándar antes de insertar (problema conocido en OCDS: formatos inconsistentes)
  - Este proceso es one-time (histórico) + mensual (actualizaciones). No es el cron diario
  - Correr en off-hours para no saturar los 100 ops/s de MongoDB M0
- Referencia: `src/modules/licitaciones/licitacion.schema.ts` (el campo `dataQualityScore` hay que agregarlo)

### Tarea 1.I: Compra Ágil CSV ETL

- Archivo: `src/modules/ingesta/etl/compra-agil.service.ts` (crear)
- Qué hacer:
  - **Compra Ágil NO está en la API REST** — solo en CSV del portal de datos abiertos (datos-abiertos.chilecompra.cl)
  - Representa 30–40% de todas las compras → ignorarla es perder 1/3 del mercado
  - Descargar CSV → parsear → normalizar al mismo schema que licitaciones OCDS → upsert MongoDB
  - Agregar campo `fuente: 'compra-agil'` para distinguirlas en queries
  - Frecuencia: mensual (mismo ciclo que bulk OCDS)

### Tarea 1.J: Índices MongoDB + TTL

- Archivo: `src/modules/licitaciones/licitacion.schema.ts` (modificar)
- Qué hacer:
  - Verificar índice único en `codigoExterno` (ya existe — revisar que tenga `sparse: false`)
  - Agregar índice compuesto: `{ estado: 1, fechaCierre: 1 }` (ya existe — verificar)
  - Agregar índice: `{ codigoOrganismo: 1, estado: 1 }` (ya existe — verificar)
  - Agregar TTL: documentos con `estado: 'archivado'` y `updatedAt` > 18 meses → auto-eliminar
  - TTL crítico para MongoDB M0 (512 MB): sin él el storage se agota en meses
  - Agregar campo `dataQualityScore: number` al schema (usado en ct-analytics: no mostrar si < 0.7)
- Referencia: `src/modules/licitaciones/licitacion.schema.ts`

## Criterios de Aceptación

- [ ] Cron ejecuta diariamente a las 22:00 y publica licitaciones en SQS
- [ ] Circuit breaker se abre si ChileCompra no responde y el sistema continúa sin lanzar excepción
- [ ] Mensajes > 256 KB van a S3 + pointer en SQS (verificar con payload de prueba > 256 KB)
- [ ] Procesador consume SQS con long polling y hace upsert idempotente (reinsertar mismo CodigoExterno no duplica)
- [ ] Mensajes fallidos llegan a DLQ y disparan alerta SES (sin superar 1 email/30 min)
- [ ] ETL bulk OCDS procesa al menos 1 archivo .7z sin error de memoria ni timeout
- [ ] Compra Ágil CSV se inserta con `fuente: 'compra-agil'` y no duplica con datos OCDS
- [ ] TTL configurado: verificar con `db.licitaciones.getIndexes()` que existe el TTL index
- [ ] `/health` expone estado del circuit breaker además de la conexión MongoDB
- [ ] `pnpm turbo typecheck` pasa sin errores en ct-core-api
