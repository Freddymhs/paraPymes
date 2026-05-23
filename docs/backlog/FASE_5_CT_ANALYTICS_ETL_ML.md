# FASE 5: ct-analytics — ETL Histórico + XGBoost + SNA Básico

**Status**: ⏸️ PENDIENTE
**Prioridad**: Media — prerequisito temporal crítico
**Dependencias**: FASE_1 (ct-core-api debe tener **mínimo 3–6 meses de datos acumulados**)
**Sprint**: Sprint 3+ (no antes)

> 🚫 **NO INICIAR esta fase antes de que ct-core-api lleve 3–6 meses acumulando datos en MongoDB.**
> Sin suficientes datos históricos, los modelos ML no tienen señal: el class imbalance 1:700 lo hace especialmente sensible a la cantidad de ejemplos positivos. Con pocos meses de datos los modelos darán recall ~0 sobre la clase minoritaria.
>
> ⚠️ **Problema conocido de calidad OCDS**: RUTs con formato inconsistente, sin datos de pago efectivo (solo adjudicación), organismos que no reportan completamente. Cada registro debe tener `data_quality_score`. NO mostrar métricas si score < 0.7.
>
> ⚠️ **Compra Ágil**: 30–40% de compras NO está en la API REST ni en bulk OCDS con el mismo esquema. Requiere ETL separado desde CSV (ya planificado en FASE 1, Tarea 1.I). Sin este ETL, el modelo está entrenado sobre 60–70% del mercado.

## Orden de ejecución

1. Tarea 5.A — ETL bulk OCDS .7z histórico (prerequisito de todo lo ML)
2. Tarea 5.B — ETL Compra Ágil CSV (complementario, no bloquea pero sí afecta calidad)
3. Tarea 5.C — Feature engineering tabular
4. Tarea 5.D — XGBoost + SMOTE training pipeline
5. Tarea 5.E — Validación y export del modelo
6. Tarea 5.F — FallbackMatcher (ya existe skeleton — completar)
7. Tarea 5.G — SNA NetworkX básico
8. Tarea 5.H — FastAPI endpoints completos (/ranking + /sna)
9. Tarea 5.I — Modal.com deploy (inferencia serverless)
10. Tarea 5.J — Re-entrenamiento mensual GitHub Actions

## Tareas

### Tarea 5.A: ETL Bulk OCDS Histórico

- Archivo: `app/services/etl/bulk_ocds_etl.py` (crear)
- Qué hacer:
  - Fuente: `datos-abiertos.chilecompra.cl` → archivos `.7z` (sin rate limit)
  - Volumen: 4.885.161 adjudicaciones, 4.963.799 proveedores únicos (última década)
  - Pipeline: descomprimir `.7z` → leer JSON OCDS → normalizar → upsert MongoDB
  - Normalización obligatoria antes de insertar:
    - RUT: convertir a formato `12345678-9` (eliminar puntos, guión en posición correcta)
    - Montos: siempre en CLP (algunos registros OCDS vienen en UF/USD)
    - Fechas: siempre ISO 8601 UTC
  - `data_quality_score`: float 0.0–1.0 por registro. Criterios:
    - `nombre` no nulo: +0.2
    - `monto` no nulo y > 0: +0.2
    - `fechaCierre` no nula: +0.2
    - `rut_proveedor` normalizado: +0.2
    - `items[]` no vacío: +0.2
  - NO mostrar en el dashboard ni usar en ML si `data_quality_score < 0.7`
  - Correr en off-hours (01:00–06:00) para no saturar MongoDB M0 (100 ops/s)
  - Procesar en batches de 1.000 documentos (no cargar todo en memoria)
- Referencia: `app/services/ml/ranking_service.py` (ver cómo se accede a MongoDB)

### Tarea 5.B: ETL Compra Ágil CSV

- Archivo: `app/services/etl/compra_agil_etl.py` (crear)
- Qué hacer:
  - Compra Ágil representa 30–40% de compras del Estado — NO es opcional
  - Fuente: `datos-abiertos.chilecompra.cl` → CSV (estructura diferente al OCDS JSON)
  - Mapear columnas CSV al mismo schema que las licitaciones OCDS → upsert MongoDB
  - Campo `fuente: 'compra-agil'` para distinguir en queries
  - Sin campo de RUT del proveedor en algunos registros → `data_quality_score` más bajo
  - Frecuencia: mensual (mismo día que bulk OCDS, después de que termina)

### Tarea 5.C: Feature Engineering Tabular

- Archivo: `app/services/ml/feature_engineering.py` (crear)
- Qué hacer:
  - Variables predictoras basadas en el CONCEPTO.md:
    - `frecuencia_compra_organismo`: veces que el organismo licitó en el mismo rubro (últimos 12 meses)
    - `tramo_monetario`: categoría del monto (bins: <1M, 1M–10M, 10M–100M, >100M CLP)
    - `oferentes_historicos_promedio`: promedio de oferentes por licitación del organismo
    - `tasa_concentracion_hhi`: HHI del organismo (proveedor más frecuente)
    - `rubro_proveedor_match`: 1 si el rubro del proveedor coincide con el de la licitación
    - `dias_hasta_cierre`: días desde publicación hasta cierre
    - `mes_publicacion`: mes del año (patrones estacionales)
    - `region_match`: 1 si región del proveedor = región del organismo
  - Variable target: `adjudicado`: 1 si el proveedor ganó, 0 si postuló y no ganó
  - **Class imbalance**: ratio 1:700 (1 adjudicado por cada 700 postulaciones fallidas)
  - Export: `pd.DataFrame` con columnas tipadas → guardar en archivo Parquet para reutilizar
- Referencia: `app/services/ml/ranking_service.py`

### Tarea 5.D: XGBoost + SMOTE Training Pipeline

- Archivo: `app/services/ml/train.py` (crear)
- Qué hacer:
  - Cargar features desde Parquet (Tarea 5.C)
  - Aplicar SMOTE antes del entrenamiento para balancear clases:
    ```python
    from imblearn.over_sampling import SMOTE
    sm = SMOTE(random_state=42, sampling_strategy=0.1)
    X_res, y_res = sm.fit_resample(X_train, y_train)
    ```
  - Entrenar XGBoost con `scale_pos_weight=707` (ratio de clases) Y SMOTE (ambos — estrategia doble):
    ```python
    model = xgb.XGBClassifier(
        scale_pos_weight=707,
        eval_metric='aucpr',
        early_stopping_rounds=50,
        max_depth=6,
        learning_rate=0.05,
        n_estimators=500,
    )
    ```
  - Umbral de decisión: optimizar para recall ≥ 0.85 sobre la clase positiva (adjudicado=1)
    - No usar threshold=0.5 por defecto — ajustar con curva precision-recall
  - Validación: `StratifiedKFold(n_splits=5)` para respetar el imbalance
  - Métricas a reportar: precision, recall, F1, AUC-PR (no AUC-ROC — engañoso con imbalance extremo)
  - Si `confidence < CONFIDENCE_THRESHOLD (0.6)` → usar FallbackMatcher (Tarea 5.F)

### Tarea 5.E: Validación + Export del Modelo

- Archivo: `app/services/ml/model_registry.py` (crear)
- Qué hacer:
  - Export como joblib: `joblib.dump(model, 'models/ranking_model.joblib')` (~50 MB)
  - Guardar también: `feature_names.json` (orden exacto de features para inferencia)
  - Guardar: `threshold.json` con el threshold optimizado para recall ≥ 0.85
  - Versionar el modelo con timestamp: `models/ranking_model_YYYYMMDD.joblib`
  - Test de sanidad post-entrenamiento: recall en test set ≥ 0.80 — si no, no exportar y alertar
  - Subir a S3 o GitHub Release como artifact del workflow de re-entrenamiento (Tarea 5.J)

### Tarea 5.F: FallbackMatcher — Completar

- Archivo: `app/services/ml/fallback_matcher.py` (modificar — esqueleto ya existe)
- Qué hacer:
  - El skeleton ya existe. Implementar la lógica real:
  - Si `confidence < 0.6`: matching por keywords exactas entre el título de la licitación y el rubro del proveedor
  - Keywords extraídas del campo SII del proveedor (actividad económica)
  - Retornar `score: float` en rango 0.0–1.0 basado en coincidencias de términos clave
  - Loguear cuántas veces se usa el fallback vs el modelo ML (métrica de salud del modelo)
- Referencia: `app/services/ml/fallback_matcher.py`

### Tarea 5.G: SNA NetworkX — Grafo Bipartito

- Archivo: `app/services/sna/sna_service.py` (modificar — esqueleto ya existe)
- Qué hacer:
  - Grafo bipartito: nodos tipo A = organismos compradores, nodos tipo B = proveedores
  - Arista: organismo → proveedor si el proveedor ganó al menos 1 licitación de ese organismo
  - Peso de arista: número de adjudicaciones
  - Algoritmos a calcular:
    - `betweenness_centrality`: proveedores más influyentes en la red
    - HHI por organismo: `HHI = sum(s_i^2)` donde `s_i` es la cuota de cada proveedor
    - Umbral: `HHI > 0.25 (HHI_ALTO)` → "Índice de Endogamia Alto" → alerta al usuario antes de postular
    - Componentes conectadas: clusters de organismos con proveedores compartidos
  - Límite MVP: <500K nodos → NetworkX en memoria es suficiente. Si supera → migrar a Neo4j/AGE
  - El grafo completo se recalcula mensualmente (Railway cron, Tarea 5.J)
  - Cache del resultado en MongoDB (el cálculo tarda minutos — no recalcular por request)
- Referencia: `app/services/sna/sna_service.py` (esqueleto existente con HHI_ALTO=0.25)

### Tarea 5.H: FastAPI Endpoints Completos

- Archivos:
  - `app/routers/ranking.py` (modificar — esqueleto existe → implementar lógica real)
  - `app/routers/sna.py` (modificar — esqueleto existe → implementar lógica real)
- Qué hacer:
  - `GET /api/ranking/{rut}`:
    - Cargar perfil del proveedor (historial desde MongoDB)
    - Obtener licitaciones abiertas
    - Calcular score con modelo XGBoost (o fallback si confidence < 0.6)
    - Retornar top 20 licitaciones ordenadas por score
    - Respuesta: `{ rut, licitaciones: [{ codigo, nombre, score, confidence, fuente: 'ml'|'fallback' }] }`
    - NO retornar licitaciones con `data_quality_score < 0.7` en la fuente
  - `GET /api/sna/organismo/{codigo}`:
    - Leer resultado pre-calculado de MongoDB (no recalcular en caliente)
    - Retornar: HHI, lista de proveedores frecuentes con cuotas, betweenness_centrality del organismo, flag `endogamia_alta: bool`
- Referencia: `app/routers/ranking.py`, `app/routers/sna.py`

### Tarea 5.I: Modal.com Deploy (Inferencia Serverless)

- Archivo: `app/modal_app.py` (crear)
- Qué hacer:
  - Modal.com free tier: $30/mes de créditos → suficiente para MVP (inferencia por request, no servidor 24/7)
  - Función serverless que carga el modelo joblib y corre inferencia
  - La FastAPI local llama a Modal para inferencia (no carga el modelo en el proceso FastAPI)
  - Esto reduce la RAM del servidor FastAPI (el modelo de 50 MB no vive en memoria 24/7)
  - `modal deploy app/modal_app.py` → URL de inferencia → guardar en `.env` como `MODAL_INFERENCE_URL`

### Tarea 5.J: Re-entrenamiento Mensual GitHub Actions

- Archivo: `.github/workflows/retrain-ml.yml` (crear)
- Qué hacer:
  - Schedule: `cron: '0 2 1 * *'` (1° de cada mes a las 02:00 UTC)
  - Steps: instalar deps → correr `app/services/ml/train.py` → validar recall ≥ 0.80 → subir modelo a S3 → notificar (email/Slack)
  - Si recall < 0.80 → no deployar el nuevo modelo → mantener el anterior → crear GitHub Issue automáticamente
  - El workflow usa `MONGODB_URI` y `OPENAI_API_KEY` como GitHub Secrets

## Criterios de Aceptación

- [ ] ETL bulk OCDS procesa al menos 1 archivo .7z completo sin OOM ni timeout
- [ ] Todos los registros tienen `data_quality_score` calculado correctamente
- [ ] RUTs normalizados: ningún RUT con puntos o formato incorrecto en MongoDB
- [ ] Modelo XGBoost entrenado con recall ≥ 0.80 en test set (AUC-PR reportado)
- [ ] Si `confidence < 0.6`, FallbackMatcher retorna un score > 0 para licitaciones del mismo rubro
- [ ] `GET /api/ranking/{rut}` retorna top 20 licitaciones con `score` y `fuente` en respuesta JSON
- [ ] `GET /api/sna/organismo/{codigo}` retorna `endogamia_alta: true` para organismo con HHI > 0.25
- [ ] Licitaciones con `data_quality_score < 0.7` NO aparecen en las respuestas de la API
- [ ] Modal.com inferencia responde en < 3 segundos por request
- [ ] GitHub Actions re-entrena mensualmente y no deployea si recall < 0.80
- [ ] `pytest` pasa en ct-analytics con los nuevos tests
