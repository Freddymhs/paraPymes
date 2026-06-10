# ADR: CQRS sobre la misma colección MongoDB

**Fecha**: 2026-06-10
**Estado**: Aceptada
**Fase**: FASE_1 (Tarea 1.F)

## Contexto

El pipeline de ingesta de ct-core-api usa CQRS: un write model que valida y
persiste licitaciones, y un read model que sirve proyecciones para el
dashboard. El patrón canónico separa físicamente el almacenamiento de
escritura del de lectura (colecciones o bases distintas, sincronizadas por
eventos).

El cluster es MongoDB Atlas M0: **512 MB de storage y ~100 ops/s**.

## Decisión

Ambos modelos operan sobre la **misma colección** `licitaciones`:

- `LicitacionWriteModel` — valida campos mínimos (codigoExterno, nombre,
  estado ∈ enum de dominio) y persiste vía `upsertByCodigoExterno`
  (idempotencia por índice único).
- `LicitacionReadModel` — queries `lean()` con proyección de campos
  (`vistaDashboard`), sin hidratar documentos Mongoose ni pasar por el
  write model.

La separación es **lógica** (clases, responsabilidades, contratos), no
física (colecciones).

## Razones

1. **Storage**: duplicar la colección en vistas materializadas costaría más
   de los 512 MB disponibles de lo que ahorra en latencia de lectura.
2. **Ops/s**: mantener vistas sincronizadas duplica escrituras — contra el
   límite de ~100 ops/s del M0.
3. **Volumen actual**: las lecturas del dashboard con `lean()` + proyección
   + índices (`{estado, fechaCierre}`) son suficientes para el MVP.

## Consecuencias

- El bus de eventos (`LicitacionProcesadaEvent` vía `@nestjs/cqrs`) ya
  existe: si en el futuro se materializa una vista separada, los handlers
  se suscriben sin tocar el write path.
- Migrar a separación física es un cambio de infraestructura (cluster
  pagado), no de arquitectura de código.

## Revisión

Revisar si: el cluster sube de tier (M10+), o las queries del dashboard
superan latencias aceptables con proyecciones lean.
