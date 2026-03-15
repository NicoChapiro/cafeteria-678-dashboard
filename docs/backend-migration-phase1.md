# Backend migration infra (Fase 1)

Esta fase deja lista la infraestructura para migrar gradualmente desde `localStorage` a backend (PostgreSQL + Prisma), **sin cambiar aún pantallas ni comportamiento visible de UI**.

## Qué incluye

- Prisma configurado con modelos base de dominio.
- Seed inicial para sucursales `Santiago` y `Temuco`.
- Cliente Prisma server-side seguro para Next.js (`globalThis` en dev).
- Contratos de repositorio por dominio (`branches`, `items`, `products`, `recipes`, `sales`, `audit`, `aliases`).
- Adaptador `local` envolviendo `src/storage/local/store.ts`.
- Adaptador `db` inicial con implementación Prisma para:
  - `branches`
  - `items`
  - `products`
  - `recipes`
- Selector de backend por variable `DATA_BACKEND=local|db`.

## Prisma: cómo levantar

1. Instalar dependencias:

```bash
npm install
```

2. Configurar variables:

```bash
cp .env.example .env
```

3. Generar cliente Prisma:

```bash
npm run prisma:generate
```

## Migraciones

Para crear/aplicar la migración inicial:

```bash
npm run db:migrate -- --name init
```

> Si ya existe una migración previa, Prisma aplicará el historial pendiente según el estado de tu base local.

## Seed de branches

Ejecutar seed:

```bash
npm run db:seed
```

Esto inserta/actualiza:

- `branch_santiago` / `Santiago`
- `branch_temuco` / `Temuco`

## Alternar backend de datos

En `.env`:

```bash
DATA_BACKEND="local"
```

o

```bash
DATA_BACKEND="db"
```

- `local`: usa adaptadores sobre `localStorage`.
- `db`: usa adaptadores Prisma disponibles en esta fase.

## Validación rápida

```bash
npm run lint
npm run build
```

## Estado de migración en esta fase

- ✅ Infra de datos lista para trabajo incremental.
- ✅ Contratos y adaptadores preparados.
- ⚠️ La UI **todavía no consume** repositorios DB; se mantiene sin cambios visibles.
- ⚠️ Repositorios DB de `sales`, `audit` y `aliases` quedan deliberadamente pendientes para siguientes fases.
