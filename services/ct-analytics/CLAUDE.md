# CLAUDE.md — template-fastapi

## Reglas del proyecto

### Alembic — registro de modelos

Al agregar un modelo SQLAlchemy nuevo, importarlo en `app/models/__init__.py`.
Es el único punto donde Alembic autogenerate detecta cambios de schema.
Sin este import, `alembic revision --autogenerate` genera migraciones vacías.

### Python — imports tardíos intencionales

Imports que deben ir después de `sys.path.insert` o `load_dotenv` llevan un comentario que
explique por qué el orden es intencionalmente no estándar. **No** `# noqa: E402`: el ruff del CI
(`pip install ruff`, ≥0.17) no habilita E402 y marca ese `noqa` como RUF100 (inútil).
