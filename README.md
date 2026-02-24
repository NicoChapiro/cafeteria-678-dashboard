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

## Prisma (ejecutar fuera de este entorno bloqueado)

Este entorno bloquea la descarga de Prisma engine (`403` a `binaries.prisma.sh`).
Corre estos comandos en una máquina local o CI con acceso al engine:

```bash
npm run prisma:generate
npm run db:migrate
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
