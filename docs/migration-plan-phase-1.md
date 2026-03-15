# Migración localStorage → Backend (Fase 1: Diseño y Preparación)

## A. Resumen ejecutivo

### Qué propongo
Implementar una migración incremental en **4 fases técnicas posteriores** (Fase 2–5), manteniendo la app operativa en todo momento mediante una capa de repositorios con estrategia dual y feature flags:

1. **Estabilizar contrato de dominio** (sin tocar UI).
2. **Agregar persistencia PostgreSQL con Prisma** y mantener localStorage como fallback temporal.
3. **Migrar primero catálogo + versionados críticos** (items/productos/costos/precios) porque son el núcleo del cálculo.
4. **Migrar operación** (recetas, ventas diarias, ajustes, importadores).
5. **Cerrar migración** (auditoría, aliases, desactivar localStorage).

### Por qué este enfoque
- Reduce riesgo: evita big-bang y permite validaciones por módulo.
- Preserva comportamiento actual: respeta `validFrom/validTo`, branch, importes y auditoría.
- Es compatible con Next.js actual: se aprovecha App Router + Route Handlers/Server Actions + Prisma.
- Permite convivencia temporal localStorage/DB para rollback simple por feature flag.

---

## B. Inventario actual del dominio

> Base analizada: `src/storage/local/store.ts` y `src/domain/types.ts`.

### 1) Entidades actuales

#### Catálogo
- **Item**: insumo base (`id`, `name`, `category`, `baseUnit`, `yieldRateDefault`, timestamps).
- **Product**: producto vendible (`id`, `name`, `category`, `recipeId?`, `wasteRatePct?`, `active`, timestamps).
- **Recipe**: receta base o subreceta (`id`, `name`, `type`, `yieldQty`, `yieldUnit`, `active`, timestamps).
- **RecipeLine**:
  - `lineType=item` → consume `itemId` con `qtyInBase`.
  - `lineType=recipe` → consume `subRecipeId` con `qtyInSubYield`.

#### Versionados
- **ItemCostVersion**: costo de insumo por `itemId + branch` con vigencia (`validFrom`, `validTo`), costo pack y rendimiento override.
- **ProductPriceVersion**: precio por `productId + branch` con vigencia.
- **ProductCostVersion**: costo por `productId + branch` con vigencia.

#### Operación / ventas
- **SalesDaily**: ventas base diarias por `date + branch + productId`.
- **SalesAdjustment**: ajustes manuales diarios (suma/resta de `qty` y `grossSalesClp`) con `note` y `createdAt`.
- **SalesEffective** (derivada): combinación de `SalesDaily + SalesAdjustment` por producto.

#### Auditoría
- **AuditLog**: bitácora genérica por entidad (`entityType`, `entityId`, `action`, `diffJson`, `actor`, `createdAt`).

#### Aliases / configuración
- **ProductAliasEntry** (clave separada de localStorage): `source + externalName -> productId`.

### 2) Relaciones reales
- `Item (1) -> (N) ItemCostVersion` por branch.
- `Product (1) -> (N) ProductPriceVersion` por branch.
- `Product (1) -> (N) ProductCostVersion` por branch.
- `Recipe (1) -> (N) RecipeLine` (líneas hijas).
- `RecipeLine(lineType=item) -> Item`.
- `RecipeLine(lineType=recipe) -> Recipe` (subreceta).
- `Product (N) -> (0..1) Recipe` mediante `recipeId` nullable.
- `SalesDaily (N) -> Product (1)` y `SalesAdjustment (N) -> Product (1)`.
- `AuditLog` referencia lógica (no FK estricta hoy).
- `ProductAliasEntry (N) -> Product (1)`.

### 3) Operaciones principales de lectura/escritura

#### Catálogo
- `list/get/upsert/delete` para `Item`, `Product`, `Recipe`, `RecipeLine`.
- Al eliminar receta: desvincula `Product.recipeId` y elimina líneas asociadas/directamente referenciadas.

#### Versionados
- `list*Versions` por entidad+branch.
- `add*Version` aplica timeline con `applyNewVersion` y reconstruye segmentos de vigencia.
- `updateProductCostVersionValidFrom` ajusta la versión y corrige `validTo` de la anterior.

#### Operación
- `set/upsert/list salesDaily` por fecha+sucursal.
- `add/delete/list salesAdjustments` por fecha+sucursal.
- `listSalesEffective` consolida base + ajustes.
- Importadores:
  - `importSalesSantiago` agrega y opcionalmente crea productos faltantes.
  - `importSalesTemuco` valida, agrega/actualiza y puede limpiar ventas según `keepSales`.
- `duplicateSalesFromPreviousDay` duplica día anterior.

#### Auditoría
- `logAudit/addAuditEvent/list/clear`.
- Casi toda mutación relevante genera evento.

#### Aliases
- `list/upsert/delete/resolve` por `(source, externalName)` normalizado case-insensitive `es-CL`.

---

## C. Propuesta de esquema de base de datos (PostgreSQL + Prisma)

> Objetivo: **mínimo necesario**, alineado al dominio actual, sin sobrediseñar.

### 1) Tablas núcleo

#### `branches`
- `id` (PK, uuid/cuid)
- `code` (unique: `Santiago`, `Temuco`)
- `name`
- `created_at`, `updated_at`

> Nota: puede mapearse por `code` en APIs para mantener compatibilidad con el frontend.

#### `items`
- `id` PK
- `name`
- `category` nullable
- `base_unit` (enum: `g|ml|unit`)
- `yield_rate_default` numeric(8,4) nullable
- `created_at`, `updated_at`

Índices sugeridos:
- `idx_items_name` (`lower(name)`) para búsquedas.

#### `products`
- `id` PK
- `name`
- `category` nullable
- `recipe_id` FK nullable -> `recipes.id`
- `waste_rate_pct` numeric(8,4) nullable
- `active` boolean
- `created_at`, `updated_at`

Índices:
- `idx_products_name` (`lower(name)`)
- `idx_products_recipe_id`

#### `recipes`
- `id` PK
- `name`
- `type` (enum actual de `RecipeType`)
- `yield_qty` numeric(12,3)
- `yield_unit` enum (`portion|g|ml|unit`)
- `active` boolean
- `created_at`, `updated_at`

#### `recipe_lines`
- `id` PK
- `recipe_id` FK -> `recipes.id`
- `line_type` enum (`item|recipe`)
- `item_id` FK nullable -> `items.id`
- `sub_recipe_id` FK nullable -> `recipes.id`
- `qty_in_base` numeric(12,3) nullable
- `qty_in_sub_yield` numeric(12,3) nullable
- `created_at`, `updated_at`

Constraints (CHECK):
- Si `line_type='item'`: `item_id` y `qty_in_base` obligatorios; `sub_recipe_id` nulo.
- Si `line_type='recipe'`: `sub_recipe_id` y `qty_in_sub_yield` obligatorios; `item_id` nulo.
- `recipe_id <> sub_recipe_id` para bloquear self-reference (regla ya vigente en código).

### 2) Tablas de versionado

#### `item_cost_versions`
- `id` PK
- `item_id` FK -> `items.id`
- `branch_id` FK -> `branches.id`
- `pack_qty_in_base` numeric(12,3)
- `pack_cost_gross_clp` integer
- `yield_rate_override` numeric(8,4) nullable
- `valid_from` date
- `valid_to` date nullable
- `created_at`

Constraints/índices:
- `unique(item_id, branch_id, valid_from)`
- `check(valid_to is null or valid_to >= valid_from)`
- índice `(item_id, branch_id, valid_from desc)`

#### `product_price_versions`
- `id` PK
- `product_id` FK
- `branch_id` FK
- `price_gross_clp` integer
- `valid_from` date
- `valid_to` date nullable
- `created_at`

Constraints equivalentes a item cost.

#### `product_cost_versions`
- `id` PK
- `product_id` FK
- `branch_id` FK
- `cost_gross_clp` integer
- `valid_from` date
- `valid_to` date nullable
- `created_at`

Constraints equivalentes.

> Regla de no-solapamiento: mantener en capa de dominio (como hoy con `applyNewVersion`) al inicio. Opcionalmente endurecer luego con `daterange` + constraint EXCLUDE.

### 3) Tablas operación / ventas

#### `sales_daily`
- `id` PK
- `date` date
- `branch_id` FK
- `product_id` FK
- `qty` numeric(12,3)
- `gross_sales_clp` integer
- `created_at`, `updated_at`

Constraints/índices:
- `unique(date, branch_id, product_id)` (el store hoy reemplaza por key lógica).
- índices por `(branch_id, date)` y `(product_id, date)`.

#### `sales_adjustments`
- `id` PK
- `date` date
- `branch_id` FK
- `product_id` FK
- `qty` numeric(12,3)
- `gross_sales_clp` integer
- `note` text nullable
- `created_at`

Índices:
- `(branch_id, date)`.

### 4) Auditoría

#### `audit_logs`
- `id` PK
- `entity_type` text
- `entity_id` text
- `action` text
- `diff_json` jsonb
- `actor` text
- `created_at`

Índices:
- `(entity_type, entity_id, created_at desc)`
- `gin(diff_json)` opcional (si se consulta contenido).

### 5) Aliases / configuración

#### `product_aliases`
- `id` PK
- `source` text
- `external_name` text
- `product_id` FK -> `products.id`
- `created_at`, `updated_at`

Constraints:
- `unique(lower(source), lower(external_name))` (o columnas normalizadas `source_norm`, `external_name_norm`).

---

## D. Arquitectura recomendada

### Stack
- **Next.js (App Router)**
- **PostgreSQL**
- **Prisma ORM**
- Sin auth por ahora (según restricción).

### Estructura de carpetas sugerida (mínima)

```text
src/
  app/
    api/
      v1/
        items/route.ts
        products/route.ts
        ...
  server/
    db/
      prisma.ts
    repositories/
      item-repository.ts
      product-repository.ts
      sales-repository.ts
      ...
      local/
        ... (adaptadores al store actual para transición)
      prisma/
        ... (implementación nueva)
    services/
      versioning-service.ts
      sales-service.ts
      recipe-service.ts
      audit-service.ts
    mappers/
      dto-mappers.ts
      db-mappers.ts
    contracts/
      repositories.ts
```

### Separación de responsabilidades
- **UI** (`src/app`, componentes): solo consume casos de uso/API, sin SQL ni Prisma.
- **Acceso a datos** (`server/repositories`): encapsula Prisma/localStorage; expone interfaces.
- **Lógica de dominio** (`server/services`): validaciones, timeline, consolidado de ventas, reglas de receta.
- **Entrada server** (Route Handlers o Server Actions): valida request/response y llama servicios.

### Decisión práctica recomendada
Para este proyecto, iniciar con **Route Handlers REST internos (`/api/v1`)** y usar Server Actions solo en pantallas muy acopladas. Motivo: facilita pruebas, migración gradual y scripts de importación.

---

## E. Plan de migración por etapas

## Fase 2 — “Capa de abstracción sin romper UI”
1. Definir interfaces de repositorio por agregado (`ItemsRepo`, `ProductsRepo`, etc.).
2. Crear implementación `local` que delegue a `src/storage/local/store.ts` (sin cambiar comportamiento).
3. Mover reglas críticas de dominio (versionado, consolidado ventas) a `server/services` reutilizables.
4. Inyectar repositorio por flag (`DATA_BACKEND=local|db`).

**Salida:** app sigue igual, pero desacoplada del storage directo.

## Fase 3 — “Persistencia DB para catálogo + versionados”
Orden exacto sugerido:
1. `branches` (seed: Santiago, Temuco).
2. `items` + `item_cost_versions`.
3. `products` + `product_price_versions` + `product_cost_versions`.
4. `product_aliases`.

Acciones:
- Implementar repos Prisma de esos módulos.
- Mantener fallback local por flag.
- Migrar datos iniciales desde export JSON a DB (script idempotente).

**Salida:** núcleo económico en DB, UI intacta.

## Fase 4 — “Recetas + operación de ventas”
Orden exacto:
1. `recipes` + `recipe_lines`.
2. `sales_daily`.
3. `sales_adjustments`.
4. Importadores Santiago/Temuco sobre repositorio DB.

Acciones:
- Validar equivalencia funcional con snapshots de cálculos (`salesEffective`, costos por producto).
- Garantizar `unique(date, branch, product)` en ventas base.

**Salida:** operación diaria ya persistida en backend.

## Fase 5 — “Auditoría completa + retiro localStorage”
1. Conectar `audit_logs` como escritura principal.
2. Mantener export/import en formato compatible (si se necesita soporte operativo).
3. Desactivar escrituras localStorage y dejar modo readonly temporal para rollback corto.
4. Retirar código legacy cuando estabilidad esté confirmada.

**Salida:** backend como fuente única de verdad.

### Cómo evitar romper la app
- Feature flags por dominio (`catalog_db_enabled`, `sales_db_enabled`, etc.).
- Pruebas de regresión por contratos de repositorio (mismo input/output para local vs prisma).
- Migración por tabla con scripts idempotentes y backfill verificable.
- Métricas básicas: conteos y checksums por entidad tras cada migración.

---

## F. Riesgos y decisiones abiertas

### Decisiones críticas antes de implementar
1. **IDs**: conservar IDs string actuales o regenerar en DB.
   - Recomendación: conservar para minimizar impacto de referencias cruzadas.
2. **Granularidad de fechas** en versionado:
   - Hoy se normaliza a día UTC; conviene fijar `DATE` (no timestamp) para `validFrom/validTo`.
3. **Política de solapamiento de versiones**:
   - Solo capa de servicio inicialmente vs constraint fuerte SQL.
4. **Creación automática de productos en import Santiago**:
   - Mantener o parametrizar por entorno.
5. **Estrategia de actor en auditoría** sin auth:
   - Definir valor estable (`system|local|importer`) y luego extender.

### Zonas delicadas del store actual
- Reconstrucción de timelines con `applyNewVersion` (riesgo alto de divergencia al portar).
- `updateProductCostVersionValidFrom` (ajuste de límites entre versiones).
- `deleteRecipe` (efectos cascada lógicos sobre productos y subrecetas).
- `importSalesTemuco` con `keepSales` (semántica de limpieza por fechas importadas).
- `listSalesEffective` (fuente para reportes: debe permanecer idéntica).
- `clearAuditLogs` reemplaza histórico por un único evento de limpieza (decidir si preservar conducta).

### Riesgos por dominio
- **Versionado**: solapamientos o huecos de vigencia no detectados.
- **Branch**: inconsistencias entre enum de app y catálogo DB.
- **Consolidado ventas**: diferencias por redondeo (`qty` a 3 decimales, montos enteros).
- **Recetas**: ciclos indirectos entre subrecetas (hoy sólo se bloquea self-reference directa).
- **Ventas/importaciones**: duplicados si no se respeta unique natural por día+sucursal+producto.
- **Audit**: crecimiento rápido de `diff_json` y costo de almacenamiento.
- **Aliases**: colisiones por case/acentos; normalización debe quedar explícita.

---

## Notas finales (alcance de Fase 1)
- Esta fase **no implementa endpoints ni migración de datos en runtime**.
- Se entrega diseño ejecutable, ordenado e incremental para comenzar Fase 2.
- Se recomienda arrancar por repositorios e interfaces para proteger la UI actual.
