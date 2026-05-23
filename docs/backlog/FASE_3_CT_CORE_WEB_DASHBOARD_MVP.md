# FASE 3: ct-core-web — Dashboard MVP

**Status**: ⏸️ PENDIENTE
**Prioridad**: Alta — el frontend es la razón de ser del ecosistema
**Dependencias**: FASE_1 (ct-core-api debe estar sirviendo licitaciones)
**Sprint**: Sprint 2

> ⚠️ **Anti-patrón de proyectos muertos**: todos los proyectos previos (branst, DCCP-Hugo, gepd, ComprasTransparentes) llegaron a demo funcional y desaparecieron por falta de frontend. El dashboard es tan importante como el backend.
>
> ⚠️ **No anidar parallel + intercepting routes** — bugs conocidos Next.js #65192, #74895, #83278. Los parallel routes (@slots) y las intercepting routes ((.)) deben existir en niveles separados del árbol.
>
> ⚠️ **default.tsx obligatorio** en cada slot de parallel route — sin él Next.js crashea al navegar directamente a una URL (bug #74895, ya aplicado en @liveTenderFeed).

## Orden de ejecución

1. Tarea 3.A — Auth completo (login + register + logout) — prerequisito de dashboard
2. Tarea 3.B — ct-core-api client (fetch service) — prerequisito de 3.C
3. Tarea 3.C — Listado licitaciones (tabla principal del dashboard)
4. Tarea 3.D — Filtros región/rubro/estado/monto
5. Tarea 3.E — Ruta interceptora (modal detalle)
6. Tarea 3.F — Server Actions: favoritos + alertas
7. Tarea 3.G — Parallel routes completos (@analyticsGraph + @accountingSummary)
8. Tarea 3.H — ISR + caching multinivel
9. Tarea 3.I — Middleware completo (CSP + rate limiting + RBAC + i18n)
10. Tarea 3.J — Vitest unit tests + Playwright E2E base

## Tareas

### Tarea 3.A: Auth Completo — Supabase

- Archivos:
  - `src/app/(auth)/login/page.tsx` (modificar — placeholder actual → implementar)
  - `src/app/(auth)/register/page.tsx` (crear)
  - `src/app/(auth)/login/actions.ts` (crear — Server Actions de auth)
  - `src/lib/supabase/server.ts` (ya existe — verificar)
- Qué hacer:
  - Login: formulario RUT + password → `supabase.auth.signInWithPassword()`
  - Register: RUT + email + password → `supabase.auth.signUp()` + crear perfil en Supabase DB
  - Logout: Server Action `supabase.auth.signOut()` + redirect a `/login`
  - Validación de RUT chileno antes de enviar (formato XX.XXX.XXX-X)
  - Error handling: credenciales inválidas, email ya registrado, RUT inválido → mensajes en español
  - Usar `useOptimistic` para mostrar estado de loading sin bloquear la UI
- Referencia: `src/middleware.ts`, `src/lib/supabase/server.ts`

### Tarea 3.B: ct-core-api Client (fetch service)

- Archivo: `src/lib/api/licitaciones.client.ts` (crear)
- Qué hacer:
  - Función `getLicitaciones(filtros: LicitacionFiltros): Promise<Licitacion[]>` — fetch a ct-core-api
  - Función `getLicitacion(codigo: string): Promise<Licitacion>` — detalle individual
  - Función `getLicitacionesStats(): Promise<{ total: number, hoy: number }>` — para ISR
  - Usar `CT_CORE_API_URL` de env
  - Tipado estricto: `LicitacionFiltros`, `Licitacion` — interfaces basadas en el schema Mongoose de ct-core-api
  - No lanzar excepción si ct-core-api no responde — retornar array vacío + log (resiliencia: si ct-core-api cae, el dashboard sigue mostrando datos cacheados)
- Referencia: `src/lib/supabase/server.ts` (patrón similar de client factory)

### Tarea 3.C: Listado Licitaciones

- Archivos:
  - `src/app/dashboard/page.tsx` (modificar — placeholder actual → implementar)
  - `src/components/licitaciones/licitaciones-table.tsx` (crear)
  - `src/components/licitaciones/licitacion-row.tsx` (crear)
- Qué hacer:
  - Server Component: fetch directo a ct-core-api con los filtros del searchParams
  - Streaming progresivo con `<Suspense fallback={<TableSkeleton />}>`
  - Tabla: columnas `Código`, `Nombre`, `Organismo`, `Monto`, `Cierre`, `Estado`
  - Paginación: cursor-based (no offset) para no saturar MongoDB
  - Click en fila → ruta interceptora (Tarea 3.E) o URL directa si navega directo
  - Columna `Estado` con badge de color: abierta=verde, cerrada=gris, adjudicada=azul
  - Monto en CLP formateado (ej: `$1.234.567`)

### Tarea 3.D: Filtros — Región, Rubro, Estado, Monto

- Archivo: `src/components/licitaciones/filtros.tsx` (crear — Client Component)
- Qué hacer:
  - Filtros en searchParams de URL (no estado local) → permite compartir URL filtrada + SSR
  - Región: select con las 16 regiones de Chile
  - Rubro SII: select con rubros (cargar desde ct-core-api o hardcodear top 20 para MVP)
  - Estado: `todos | abierta | cerrada | adjudicada | desierta`
  - Monto: rango min/max en CLP (inputs numéricos)
  - Aplicar filtros sin reload (uso de `router.push` + searchParams) → RSC recarga solo el segmento de la tabla
  - Limpiar filtros → botón que resetea searchParams

### Tarea 3.E: Ruta Interceptora — Modal Detalle

- Archivos:
  - `src/app/dashboard/(.)licitacion/[codigo]/page.tsx` (crear — intercepting route)
  - `src/app/dashboard/licitacion/[codigo]/page.tsx` (crear — full page si navegan directo a URL)
  - `src/components/licitaciones/licitacion-modal.tsx` (crear)
- Qué hacer:
  - Click en licitación desde el dashboard → modal con detalle SIN perder el contexto (filtros, scroll)
  - Navegar directamente a `/dashboard/licitacion/ABC-1234` → página completa (sin modal)
  - **NO anidar parallel routes con intercepting routes** — el modal va en un nivel separado
  - Modal: nombre, organismo, descripción, monto, fechas, link a Mercado Público, botón favorito
  - Cerrar modal → volver al dashboard con filtros intactos (usar `router.back()`)
- Referencia: CONCEPTO.md §ct-core-web bugs conocidos (#65192, #74895, #83278)

### Tarea 3.F: Server Actions — Favoritos + Alertas

- Archivo: `src/app/dashboard/actions.ts` (crear)
- Qué hacer:
  - `guardarFavorito(codigoLicitacion: string)` — upsert en Supabase DB tabla `favoritos`
  - `eliminarFavorito(codigoLicitacion: string)` — delete de `favoritos`
  - `configurarAlerta(filtros: AlertaFiltros)` — insert en `alertas_usuario`
  - Usar `useOptimistic` en el componente botón de favorito → respuesta inmediata sin esperar Server Action
  - Validar que el usuario está autenticado antes de cada action (obtener user de Supabase)
  - Revalidar caché del dashboard tras guardar favorito (`revalidateTag('favoritos')`)

### Tarea 3.G: Parallel Routes Completos

- Archivos:
  - `src/app/dashboard/@analyticsGraph/page.tsx` (crear)
  - `src/app/dashboard/@analyticsGraph/default.tsx` (crear — obligatorio, retorna null)
  - `src/app/dashboard/@accountingSummary/page.tsx` (crear)
  - `src/app/dashboard/@accountingSummary/default.tsx` (crear — obligatorio, retorna null)
  - `src/app/dashboard/@liveTenderFeed/page.tsx` (modificar — placeholder → implementar)
- Qué hacer:
  - `@analyticsGraph`: gráfico de montos adjudicados por región/categoría (datos de ct-analytics cuando estén — skeleton para MVP)
  - `@liveTenderFeed`: feed en vivo de licitaciones nuevas (últimas 10 del día, actualiza cada 60s con `router.refresh()`)
  - `@accountingSummary`: resumen de favoritos y alertas activas del usuario
  - Cada slot falla independiente sin tirar el dashboard completo (Suspense con ErrorBoundary por slot)
  - **default.tsx en todos los slots** → ya hecho en @liveTenderFeed, replicar en los nuevos

### Tarea 3.H: ISR + Caching Multinivel

- Archivos:
  - `src/app/dashboard/page.tsx` (modificar)
  - `src/lib/api/licitaciones.client.ts` (modificar)
- Qué hacer:
  - Estadísticas del dashboard: `revalidateTag('stats')` + `revalidate: 900` (15 min via ISR)
  - Listado de licitaciones: cache por filtros con `unstable_cache` + tag `licitaciones-{filtros-hash}`
  - Favoritos del usuario: NO cachear (son datos per-user, dinámicos)
  - Datos de ct-core-api: fetch con `next: { tags: ['licitaciones'], revalidate: 300 }` (5 min)
  - Si ct-core-api no responde: retornar datos cacheados del Router Cache de Vercel → dashboard sigue funcionando

### Tarea 3.I: Middleware Completo

- Archivo: `src/middleware.ts` (modificar — auth ya implementado → agregar CSP + rate limiting + i18n)
- Qué hacer:
  - CSP headers: `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`
  - Rate limiting por IP: máximo 100 req/min usando Vercel KV o header-based tracking
  - RBAC básico: rutas `/admin/*` solo accesibles para `role: 'admin'` en metadata de Supabase
  - i18n ES/EN: detectar `Accept-Language` → `es` por defecto, `/en/*` para inglés
  - Mantener la lógica de auth ya existente (no romper el flujo actual)
- Referencia: `src/middleware.ts` (ya tiene auth → agregar encima)

### Tarea 3.J: Vitest + Playwright E2E Base

- Archivos:
  - `src/lib/api/licitaciones.client.test.ts` (crear)
  - `e2e/dashboard.spec.ts` (crear)
- Qué hacer:
  - Vitest: test del client de ct-core-api (mock fetch, verificar que los filtros se pasan correctamente en la URL)
  - Vitest: test de validación de RUT chileno
  - Playwright E2E: flujo completo login → dashboard → filtrar → click licitación → modal → cerrar → favorito
  - Playwright E2E: verificar que si ct-core-api retorna vacío, el dashboard muestra estado vacío sin crashear
  - Correr en CI: `pnpm turbo test` + `pnpm turbo test:e2e` (separados en jobs distintos)

## Criterios de Aceptación

- [ ] Login con usuario Supabase válido → redirige al dashboard
- [ ] Dashboard muestra tabla de licitaciones reales consumidas de ct-core-api
- [ ] Filtros por región y estado funcionan sin reload completo de la página
- [ ] Click en licitación → abre modal; navegar directo a URL → página completa
- [ ] Guardar favorito actualiza la UI con `useOptimistic` antes de que responda el Server Action
- [ ] `@liveTenderFeed` actualiza sin afectar los otros slots del dashboard
- [ ] Si ct-core-api está caído, el dashboard muestra datos del cache (no error 500)
- [ ] CSP headers presentes en todas las respuestas (verificar con DevTools → Network → Response Headers)
- [ ] `pnpm turbo typecheck` pasa sin errores en ct-core-web
- [ ] Playwright E2E pasa el flujo login → dashboard → favorito
