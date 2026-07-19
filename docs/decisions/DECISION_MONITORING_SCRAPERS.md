# ADR: Monitoring de scrapers con changedetection.io

**Fecha**: 2026-07-13
**Estado**: Aceptada
**Fase**: FASE_2 (Tarea 2.E)

## Contexto

`FondosGobScraper` depende de selectores CSS del HTML de fondos.gob.cl
(grilla `.row.grilla`, cards `a[href*="/ficha/"]`, badge de estado,
`small.text-uppercase` para institución, `h6` para nombre). Si el sitio
cambia su layout, el scraper rompe en silencio: el cron de las 08:00
persiste 0 fondos y nadie se entera hasta que las alertas a PYMEs dejan
de salir.

Ya existe una red de seguridad reactiva: el test de sanidad diario en
GitHub Actions (`scraper-sanity`, cron 09:00 UTC) falla si el scrape
retorna < 10 fondos o campos obligatorios nulos. Pero detecta el fallo
**después** de que ocurrió.

## Decisión

Self-hostear **changedetection.io** en Railway como alerta **pre-fallo**:
monitorea los selectores clave del sitio y notifica cuando cambian, antes
de que el scraper llegue a romperse en producción.

- Costo: $0 en Railway free tier (~$5/mes si supera el límite).
- Alternativas descartadas: Visualping/Distill (SaaS pago, límites de
  checks en free tier); depender solo del sanity test (reactivo, no
  preventivo).

## Setup en Railway

```bash
railway init --name ct-monitoring
railway add --image ghcr.io/dgtlmoon/changedetection.io
railway up --service changedetection
```

Variables de entorno del servicio:

- `BASE_URL` — URL pública que asigna Railway (para links en notificaciones)
- `PORT=5000` (puerto por defecto del container)

## Monitores a configurar (mínimo 2)

| URL                                                                       | Selector monitoreado             | Qué detecta                                              |
| ------------------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------- |
| `https://fondos.gob.cl`                                                   | `.row.grilla a[href*="/ficha/"]` | Cambio en estructura de cards / grilla del home          |
| `https://fondos.gob.cl/searchernew/emprendimiento%20e%20innovaci%C3%B3n/` | `.titular .badge`                | Cambio en badges de estado (ABIERTO/CERRADO) en listados |

En cada monitor: modo "CSS selector", frecuencia diaria (antes de las
08:00 del cron del scraper), notificación por email (o webhook Slack via
Apprise, soportado nativo por changedetection.io).

## Consecuencias

- Doble red: changedetection.io avisa el cambio de layout (preventivo) y
  `scraper-sanity` confirma la rotura funcional (reactivo).
- Los selectores viven en dos lugares (código + monitores): al cambiar
  `SELECTORS` en `fondos-gob.scraper.ts`, actualizar los monitores en el
  mismo cambio.
- Infraestructura externa al monorepo: no hay código NestJS asociado.
