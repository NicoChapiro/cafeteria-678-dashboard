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

3. Ejecutar migración inicial:

```bash
npx prisma migrate dev --name init
```

4. Ejecutar seed de sucursales:

```bash
npx prisma db seed
```

5. Levantar servidor de desarrollo:

```bash
npm run dev
```

6. Abrir `http://localhost:3000`.

## Scripts

- `npm run dev`: entorno de desarrollo.
- `npm run build`: build de producción.
- `npm run start`: correr build de producción.
- `npm run lint`: lint con reglas de Next.js.
- `npm run prisma:migrate`: alias para `prisma migrate dev`.
- `npm run prisma:seed`: alias para `prisma db seed`.

## TODO

- TODO: confirmar versiones finales de dependencias según política del equipo.
- TODO: confirmar mirror/proxy que permita descargar engines de Prisma desde `binaries.prisma.sh` en entornos restringidos.
