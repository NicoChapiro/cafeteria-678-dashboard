# Cafetería 678 Dashboard

Bootstrap del MVP A para Cafetería 678 (Santiago/Temuco) con Next.js + TypeScript + Prisma.

## Requisitos

- Node.js 20+
- npm 10+
- PostgreSQL 16+

## Correr local

1. Instalar dependencias:

```bash
npm install
```

2. Configurar variables de entorno:

```bash
cp .env.example .env
```

3. Levantar servidor de desarrollo:

```bash
npm run dev
```

4. Abrir `http://localhost:3000`.

## Prisma (solo en entorno con Prisma engine disponible)

> Importante: en este entorno de ejecución hay bloqueo 403 para descargar Prisma engines desde `binaries.prisma.sh`.
> Ejecuta estos comandos en local o CI donde Prisma engine esté disponible.

1. Generar cliente Prisma:

```bash
npm run prisma:generate
```

2. Ejecutar migraciones:

```bash
npm run db:migrate
```

3. Ejecutar seed de sucursales:

```bash
npm run db:seed
```

## Scripts

- `npm run dev`: entorno de desarrollo.
- `npm run build`: build de producción.
- `npm run start`: correr build de producción.
- `npm run lint`: lint con reglas de Next.js.
- `npm run prisma:generate`: genera Prisma Client.
- `npm run db:migrate`: ejecuta migraciones Prisma.
- `npm run db:seed`: ejecuta seed Prisma.
