# Backlog — ParaPymes CompraTransparente

Ecosistema de 4 proyectos para PYMEs chilenas proveedoras del Estado.

## Fases

| Fase | Proyecto(s) | Sprint | Status |
|------|------------|--------|--------|
| [FASE_0_BASE](FASE_0_BASE.md) | Todos | Sprint 0 | ✅ COMPLETADO |
| [FASE_1_CT_CORE_API_INGESTA](FASE_1_CT_CORE_API_INGESTA.md) | ct-core-api | Sprint 1 | ⏸️ PENDIENTE |
| [FASE_2_CT_FONDOS_SCRAPER_BASE](FASE_2_CT_FONDOS_SCRAPER_BASE.md) | ct-fondos | Sprint 1 (paralelo) | ⏸️ PENDIENTE |
| [FASE_3_CT_CORE_WEB_DASHBOARD_MVP](FASE_3_CT_CORE_WEB_DASHBOARD_MVP.md) | ct-core-web | Sprint 2 | ⏸️ PENDIENTE |
| [FASE_4_CT_FONDOS_MATCHING_NOTIFICACIONES](FASE_4_CT_FONDOS_MATCHING_NOTIFICACIONES.md) | ct-fondos | Sprint 2 (paralelo) | ⏸️ PENDIENTE |
| [FASE_5_CT_ANALYTICS_ETL_ML](FASE_5_CT_ANALYTICS_ETL_ML.md) | ct-analytics | Sprint 3+ ⚠️ | ⏸️ PENDIENTE |
| [FASE_6_CT_ANALYTICS_RAG_BI](FASE_6_CT_ANALYTICS_RAG_BI.md) | ct-analytics | Sprint 4+ | ⏸️ PENDIENTE |
| [FASE_7_PRODUCCION](FASE_7_PRODUCCION.md) | Todos | Sprint 3 (parcial) | ⏸️ PENDIENTE |

> ⚠️ **FASE 5 y 6 tienen prerequisito temporal**: ct-core-api debe llevar mínimo 3–6 meses acumulando datos en MongoDB antes de que los modelos ML tengan señal suficiente. No iniciar FASE 5 antes de ese umbral.

## Dependencias entre fases

```
FASE_0 (completado)
    │
    ├── FASE_1 (ct-core-api) ─────────────────────┐
    │                                             │
    └── FASE_2 (ct-fondos base)                   │
            │                                     │
            └── FASE_4 (ct-fondos completo)        │
                                                  ▼
                                          FASE_3 (ct-core-web)
                                                  │
                                     FASE_5 (ct-analytics ML) ← requiere 3–6 meses de datos
                                                  │
                                          FASE_6 (RAG + BI)
                                                  
FASE_7 (producción) → deploy incremental: desde FASE_3 en adelante
```

## Diagramas de Referencia

| Archivo | Tipo | Contenido |
|---------|------|-----------|
| [`../diagrams/DIAGRAMAS_COMPONENTES.md`](../diagrams/DIAGRAMAS_COMPONENTES.md) | Flowcharts | Topología completa del ecosistema |

Referencia estructural estable. Actualizar solo ante cambios de topología (agregar/quitar servicios o cambiar frontera).

## Decisiones Técnicas

Carpeta [`../decisions/`](../decisions/) — documentar aquí decisiones arquitectónicas cuando surjan durante el desarrollo.

Formato: `DECISION_[TEMA].md` — explica el **POR QUÉ**, no el qué.

Decisiones pre-documentadas en el CONCEPTO.md que conviene formalizar aquí cuando se implementen:
- `DECISION_MONGODB_TIER.md` — cuándo y por qué escalar de M0 a M10
- `DECISION_SNA_VISUALIZACION.md` — NetworkX vs Neo4j/AGE según escala del grafo
- `DECISION_MONITORING_SCRAPERS.md` — changedetection.io self-hosted en Railway

## Resumen de tareas por fase

| Fase | Tareas | Complejidad |
|------|--------|-------------|
| FASE_0 | 8 | — (completado) |
| FASE_1 | 10 | Alta (AWS + CQRS + circuit breaker) |
| FASE_2 | 6 | Media-Alta (Playwright + Prisma) |
| FASE_3 | 10 | Alta (Next.js avanzado + Auth) |
| FASE_4 | 8 | Media (scrapers + matching + Resend) |
| FASE_5 | 10 | Muy Alta (ML + ETL masivo + SNA) |
| FASE_6 | 8 | Alta (RAG + BI + visualización) |
| FASE_7 | 8 | Media (deploy + monitoring) |

**Total**: ~68 tareas
