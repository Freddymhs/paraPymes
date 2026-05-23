# FASE 6: ct-analytics — RAG + Inteligencia Competitiva + SNA Avanzado

**Status**: ⏸️ PENDIENTE
**Prioridad**: Media
**Dependencias**: FASE_5 (ETL histórico + modelo base deben estar corriendo)
**Sprint**: Sprint 4+

> ⚠️ **Costo RAG controlado**: ingesta inicial de 100K PDFs cuesta ~$20 USD total (GPT-4o mini). Las queries posteriores cuestan $0.15/1M tokens input. Estimar volumen de consultas antes de escalar.
>
> ⚠️ **SNA a escala**: NetworkX funciona para <500K nodos en memoria. Si el grafo completo histórico supera ese límite, migrar a Neo4j/AGE (PostgreSQL con extensión de grafos). Documentar la decisión en `docs/decisions/`.

## Orden de ejecución

1. Tarea 6.A — Pipeline PDF → LlamaIndex → pgvector
2. Tarea 6.B — NER sobre bases de licitación
3. Tarea 6.C — Endpoint queries LLM
4. Tarea 6.D — Precios históricos + curvas regresión por competidor
5. Tarea 6.E — Evaluación bidireccional de compradores (morosos, reclamos)
6. Tarea 6.F — CRM: calendario garantías + recordatorios
7. Tarea 6.G — SNA avanzado: Sigma.js frontend (WebGL)
8. Tarea 6.H — @analyticsGraph slot (ct-core-web) conectado a ct-analytics

## Tareas

### Tarea 6.A: Pipeline PDF → LlamaIndex → pgvector

- Archivo: `app/services/rag/pdf_pipeline.py` (crear)
- Qué hacer:
  - Fuente: bases administrativas y técnicas de licitaciones (PDFs en Mercado Público)
  - `unstructured[pdf]` + Tesseract OCR para PDFs escaneados
  - Chunking: `SentenceSplitter(chunk_size=512, chunk_overlap=50)`
  - Embed: OpenAI `text-embedding-3-small` ($0.02/1M tokens → barato)
  - Upsert en Supabase pgvector (tabla `licitacion_embeddings`)
  - Ingesta inicial estimada 100K PDFs: ~$20 USD total
  - Procesar en batches de 100 PDFs con sleep entre batches para no exceder rate limits OpenAI
  - Guardar `hash_contenido` del PDF para no re-ingestar el mismo documento
  - `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` en env (service key para bypass RLS en ingesta)

### Tarea 6.B: NER — Extracción de Información Clave

- Archivo: `app/services/rag/ner_extractor.py` (crear)
- Qué hacer:
  - NER sobre el texto extraído de PDFs usando LlamaIndex structured output
  - Extraer y guardar en MongoDB:
    - `criterios_evaluacion[]`: nombre, ponderación
    - `cronograma[]`: etapa, fecha
    - `multas[]`: condición, monto
    - `requisitos[]`: tipo, descripción (certificaciones, antigüedad, garantías)
  - Estos campos permiten filtrar licitaciones por requisitos sin leer el PDF completo
  - Agregar `ner_completado: bool` al schema de licitación en MongoDB

### Tarea 6.C: Endpoint Queries LLM (RAG)

- Archivo: `app/routers/rag.py` (crear)
- Qué hacer:
  - `POST /api/rag/consulta`: `{ codigo_licitacion: string, pregunta: string }` → respuesta en lenguaje natural
  - Búsqueda híbrida pgvector: vector similarity + SQL filter por `codigo_licitacion`
  - GPT-4o mini para síntesis de respuesta
  - Prompt system: "Eres un asistente especializado en licitaciones públicas chilenas. Responde en español. Si no encuentras la información en los documentos, indícalo claramente."
  - Rate limiting por usuario: máximo 10 consultas/hora (proteger costos OpenAI)
  - Agregar al router principal en `main.py`

### Tarea 6.D: Precios Históricos + Curvas de Regresión

- Archivo: `app/services/competitive/price_analysis.py` (crear)
- Qué hacer:
  - Requiere datos históricos de la última década (ETL FASE 5 completado)
  - Por cada `(rubro_sii, region)`: calcular distribución de precios adjudicados
  - Curvas de regresión por competidor: ¿este proveedor gana más cuando baja precio?
  - Endpoint `GET /api/competitiva/precios?rubro={codigo}&region={codigo}`:
    - Retornar: mediana, percentil 25, percentil 75, histograma de precios adjudicados
    - Top 5 proveedores del rubro + su precio promedio de adjudicación
  - Solo mostrar si `data_quality_score ≥ 0.7` en los datos fuente

### Tarea 6.E: Evaluación Bidireccional de Compradores

- Archivo: `app/services/competitive/buyer_evaluation.py` (crear)
- Qué hacer:
  - Por cada organismo comprador, calcular:
    - `plazo_pago_real_promedio`: días entre adjudicación y pago efectivo (si hay dato — nota: OCDS a veces no lo tiene)
    - `reclamos_formales`: cantidad de reclamos en Contraloría o Mercado Público (scraping externo o estimación)
    - `concentracion_proveedores`: HHI del organismo (ya calculado en SNA — reutilizar)
    - `score_comprador`: 0–100 basado en los 3 factores anteriores
  - Endpoint `GET /api/compradores/{codigo}`:
    - Retornar: score, plazo pago, concentración, flag `moroso: bool`, top proveedores
  - Si `plazo_pago_real_promedio` no disponible → `data_quality_score` del organismo < 0.5 → no mostrar plazo

### Tarea 6.F: CRM — Calendario Garantías + Recordatorios

- Archivos:
  - `app/services/crm/crm_service.py` (crear)
  - `app/routers/crm.py` (crear)
- Qué hacer:
  - Tabla en Supabase (PostgreSQL): `procesos_activos` con `{ rut_proveedor, codigo_licitacion, estado, fecha_cierre_postulacion, fecha_garantia, notas }`
  - El proveedor registra qué licitaciones está siguiendo
  - Endpoint `POST /api/crm/proceso`: agregar proceso activo
  - Endpoint `GET /api/crm/recordatorios`: licitaciones con cierre en próximos 7 días
  - Notificaciones: enviar email 7 días antes y 1 día antes del cierre de garantía
  - Anti-churn objetivo: incrustarse en el flujo diario del equipo comercial de la PYME

### Tarea 6.G: SNA Avanzado — Frontend Sigma.js

- Archivos:
  - `src/app/dashboard/@analyticsGraph/sna-graph.tsx` (crear en ct-core-web)
  - Documentar en `docs/decisions/DECISION_SNA_VISUALIZACION.md`
- Qué hacer:
  - Sigma.js + graphology para renderizar el grafo bipartito en WebGL
  - Soporta 100K+ nodos sin degradar performance (WebGL vs SVG/Canvas)
  - Datos del grafo vienen de `GET /api/sna/organismo/{codigo}` (ct-analytics)
  - Interacción: click en nodo organismo → ver sus proveedores + HHI
  - Click en nodo proveedor → ver a qué organismos les vende + concentración
  - Color coding: rojo = HHI > 0.25 (endogamia alta), verde = HHI < 0.10 (mercado abierto)
  - Para el grafo completo (>500K nodos): Railway cron mensual — no hacer en tiempo real
  - Si NetworkX falla con grafo completo → documentar en `docs/decisions/` la migración a Neo4j/AGE

### Tarea 6.H: @analyticsGraph Slot — Conectar ct-core-web con ct-analytics

- Archivo: `src/app/dashboard/@analyticsGraph/page.tsx` (modificar — actualizar skeleton de FASE 3)
- Qué hacer:
  - Fetch datos de ct-analytics (`CT_ANALYTICS_URL` en env de ct-core-web)
  - Gráfico de montos adjudicados por región/categoría (Recharts o Chart.js)
  - Integrar SNA graph (Sigma.js) en el slot `@analyticsGraph`
  - SSR del gráfico con datos del mes actual → ISR `revalidate: 3600` (1h)
  - Si ct-analytics no responde → mostrar skeleton sin error (resiliencia del slot independiente)

## Criterios de Aceptación

- [ ] Pipeline RAG ingesta al menos 100 PDFs de prueba sin error de memoria
- [ ] `POST /api/rag/consulta` retorna respuesta contextualizada en < 5 segundos
- [ ] NER extrae correctamente criterios y fechas de al menos 10 PDFs de prueba
- [ ] `GET /api/competitiva/precios?rubro=X` retorna distribución de precios con percentiles
- [ ] `GET /api/compradores/{codigo}` retorna score del organismo y flag `moroso`
- [ ] CRM: recordatorios enviados 7 días y 1 día antes del cierre (test con fecha futura)
- [ ] Sigma.js renderiza grafo de 1.000 nodos sin lag visible (>30 FPS)
- [ ] `@analyticsGraph` slot del dashboard carga datos reales de ct-analytics
- [ ] Si ct-analytics no responde, el slot `@analyticsGraph` muestra skeleton sin tirar otros slots
- [ ] `pytest` pasa para todos los nuevos servicios RAG y competitiva
