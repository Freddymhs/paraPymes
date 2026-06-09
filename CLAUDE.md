# CLAUDE.md — ParaPymes

Reglas específicas de este proyecto. Complementan (no reemplazan) `~/.claude/CLAUDE.md`.

## TypeScript / ESLint

- **`@typescript-eslint/no-unsafe-enum-comparison`**: Dos casos posibles:
  - Si el valor viene tipado como `number` (ej: `HttpException.getStatus()` retorna `number`) → comparar con literal numérico (`=== 400`, `=== 503`), nunca con `HttpStatus.BAD_REQUEST`.
  - Si el campo está tipado como enum en la librería (ej: Mongoose `readyState: ConnectionStates`) → comparar con el valor del enum (`ConnectionStates.connected`), nunca con el número crudo (`=== 1`).
  - La dirección de la corrección depende de cuál lado es el enum fuente — verificar el tipo antes de elegir.

- **Import cleanup**: Al eliminar el uso de un enum o símbolo de un archivo, remover su import en el mismo cambio. No dejar imports muertos para después.

## Next.js

- **Invalidación de caché tras eliminar rutas**: Al eliminar `app/**/page.tsx` o `app/**/route.ts`, el typecheck/build puede fallar con referencias muertas en `.next/dev/types/validator.ts`. Antes de re-correr typecheck o build, eliminar la caché del proyecto afectado: `rm -rf apps/<app>/.next`. Después correr `pnpm turbo ... --force` para que turbo no use el cache previo.

## Scaffolding desde templates

- **Limpieza obligatoria al adaptar templates**: Cuando se scaffolda un proyecto desde un template externo, auditar y eliminar rutas, páginas, tests y dependencias que vengan del template y no apliquen al dominio real. Es parte del scaffold (FASE 0), no se difiere. Ejemplo concreto: `template-nextjs-fullstack` trajo a `apps/ct-core-web` las rutas demo `/csr`, `/ssr`, `/ssg`, `/isr`, `/api/hello` — ninguna pertenece al producto y fueron eliminadas en auditoría.

## Docker Compose

- **`restart: no` siempre entre comillas** (`'no'`): YAML 1.1 parsea `no` sin comillas como boolean `false`. Compose lo canonicaliza, pero yamllint (regla truthy) y parsers estrictos fallan. Aplica a todo valor del "Norway problem": `no`, `yes`, `on`, `off` como strings → siempre quoted.

## Gitignore

- **Subdirs de tmp/log/build**: Cuando una herramienta escribe múltiples archivos en un subdirectorio (`tmp/`, `logs/`, `cache/`, `dist/`), ignorar el subdirectorio completo (`testsprite_tests/tmp/`), nunca un archivo puntual (`testsprite_tests/tmp/config.json`). Las herramientas suelen agregar logs adyacentes al config y los patrones puntuales dejan ruido tracked sin querer.
