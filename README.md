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



## Dataset QA smoke (localStorage)

Para habilitar pruebas funcionales reales en `/setup`, `/products/costing` y `/dashboard`:

1. Levanta la app:

```bash
npm run dev
```

2. Abre `http://localhost:3000/qa/smoke-seed`.
3. Haz clic en **Cargar dataset QA smoke**.

Esto reemplaza el dataset local actual del navegador con un set mínimo y reproducible para smoke testing operativo.

## Rutas principales

- `/`: panel raíz con navegación a módulos del MVP.
- `/items`: catálogo de insumos.
- `/products`: catálogo de productos vendibles.
- `/recipes`: recetas y costeo base.
- `/sales/temuco`: carga manual de ventas Temuco.
- `/sales/temuco/import`: importador XLSX para Temuco.
- `/sales/santiago/import`: importador XLSX para Santiago.
- `/import/base`: importador BaseConsolidada.xlsx (Items/Productos/Recetas).
- `/audit`: vista de auditoría de márgenes/costos.

## Scripts

- `npm run dev`: entorno de desarrollo.
- `npm run build`: build de producción.
- `npm run start`: correr build de producción.
- `npm run lint`: lint con reglas de Next.js.
- `npm run prisma:generate`: genera Prisma Client.
- `npm run db:migrate`: ejecuta migraciones Prisma.
- `npm run db:seed`: ejecuta seed Prisma.

## LocalStorage (Paso 4A, sin DB)

El store local vive en `src/storage/local/store.ts` y persiste en browser bajo la clave:

- `cafe678:data:v1`

Incluye operaciones para `Item` y `ItemCostVersion` por sucursal, usando el helper de versionado (`applyNewVersion`) para cerrar vigencias al insertar una nueva versión. También expone `exportData()` / `importData(json)` para respaldo y carga de datos en formato JSON.
