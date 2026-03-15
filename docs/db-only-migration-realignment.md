# Reenfoque de migración: DB-only (PostgreSQL + Prisma)

## A. Estado actual bajo el nuevo enfoque

### Qué ya sirve
- **Infraestructura Prisma base operativa**: ya existe `schema.prisma` con modelos de catálogo, versionados, ventas, auditoría y aliases, manteniendo IDs tipo `String` como requiere el proyecto. Esto calza con la decisión de conservar IDs actuales. 
- **Conexión server-side a Prisma**: existe cliente Prisma para entorno server y repositorios DB para `branches`, `items`, `products`, `recipes` y `aliases`.
- **Capa de contratos de repositorio**: el proyecto ya tiene interfaces por dominio (`items`, `products`, `recipes`, `sales`, `audit`, `aliases`, `branches`), lo que permite migrar sin rehacer UI.
- **Entrada API para catálogo**: `/api/catalog` ya enruta acciones del cliente hacia `catalogService`, habilitando que UI consuma backend sin acoplarse directamente a Prisma.

### Qué sobra (bajo DB-only)
- **Selector de backend dual por env** (`local|db`) como mecanismo principal: hoy sigue activo y mantiene dos caminos de runtime.
- **Documentación de migración fase 1 orientada a coexistencia larga**: sigue declarando estrategia dual como eje.

### Qué es deuda de transición
- **Pantallas que aún consumen `src/storage/local/store.ts` en runtime**: ventas, ajustes, dashboard, setup, importadores y auditoría siguen en localStorage directo.
- **Repositorios DB incompletos para operación**: `sales` y `audit` en adaptador Prisma están en `notImplemented`, por lo que no se puede cortar dualidad sin completar estas piezas mínimas.
- **Store local con demasiado alcance**: hoy funciona como backend real, cuando debería quedar solo como utilidad temporal de import/export o seed QA.

### Avance aplicado en catálogo (fase actual)
- **`clientCatalog` queda DB-only**: todas las operaciones de catálogo (`items`, `products`, `recipes`, `recipe_lines`, `aliases`) llaman exclusivamente `/api/catalog`.
- **Sin dependencia runtime a `store.ts` desde catálogo**: se removió el fallback local en el cliente de catálogo.
- **Puente temporal acotado sigue fuera de catálogo**: ventas, auditoría, setup, dashboard e importadores mantienen su camino actual mientras se completa su migración.

---

## B. Arquitectura corregida DB-only

### Cómo debe quedar la app

1. **PostgreSQL = única fuente de verdad**
   - Todo CRUD y lecturas operativas pasan por repositorios Prisma.
   - No existe decisión de backend por variable para lógica de negocio.

2. **Capa server única**
   - `server/services/*` consume `getRepositories()` DB-only.
   - `app/api/*` y/o Server Actions llaman servicios; la UI no toca `store.ts`.

3. **Cliente de catálogo/sales/auditoría unificado**
   - `clientCatalog` y futuros clientes deben hablar solo con API server.
   - Se elimina la bifurcación `isDb` en runtime.

4. **store.ts fuera de camino crítico**
   - Se conserva temporalmente solo para:
     - utilidades de **importación inicial** (si hay que convertir datasets locales),
     - **QA smoke local** (dataset de prueba),
     - y/o herramienta de respaldo manual.
   - No debe ser usado por pantallas productivas.

### Rol temporal de localStorage
- **Sí, pero solo como puente corto de migración de datos y QA**.
- **No** como backend soportado para operación diaria.
- Fecha objetivo: retiro total al cerrar fase de auditoría + ventas/importadores en DB.

---

## C. Plan corregido por fases (DB-only)

> Orden solicitado y priorizado para ejecución incremental compatible con el estado actual.

### Fase 1 — Infraestructura estable
**Objetivo:** cerrar base técnica para operar solo DB sin romper app.

Incluye:
- Fijar `getRepositories()` en modo DB-only (sin selector `local|db` para runtime principal).
- Mantener un **bridge explícito y acotado** para módulos aún no migrados (ver Fase puente abajo).
- Completar/validar contratos Prisma ya existentes de catálogo (items/products/recipes/aliases/branches).
- Normalizar errores de repositorio y trazas de diagnóstico.
- Ajustar documentación y envs para reflejar DB-only.

### Fase 2 — Catálogo
**Objetivo:** catálogo 100% DB en producción de app.

Incluye:
- Items + productos + recetas + aliases exclusivamente por API/server DB.
- Quitar cualquier lectura/escritura directa a `store.ts` desde páginas de catálogo.
- Verificar paridad funcional (crear/editar/listar/eliminar).

### Fase 3 — Versionados
**Objetivo:** timelines de costos/precios totalmente en DB.

Incluye:
- `item_cost_versions`, `product_price_versions`, `product_cost_versions` con reglas de vigencia.
- Endpoints/servicios para insertar versión y cerrar vigencias previas.
- Pruebas de regresión de versionado.

### Fase 4 — Recetas / costeo
**Objetivo:** costeo dependiente de recetas y costos ya DB-only.

Incluye:
- Cálculo de costo de producto sin dependencia de datasets locales.
- Validaciones de integridad de recipe lines/subrecetas en DB.

### Fase 5 — Ventas / importadores
**Objetivo:** operación comercial DB-only.

Incluye:
- Repositorios Prisma completos para `salesDaily` y `salesAdjustments`.
- Migrar importadores Santiago/Temuco y cargas manuales para persistir en DB.
- Mantener compatibilidad de formato de importación existente (sin rehacer UI).

### Fase 6 — Setup / costing / dashboard
**Objetivo:** vistas operativas consumiendo solo backend DB.

Incluye:
- Refactor de páginas que hoy leen store local.
- Consolidación de queries y métricas server-side.

### Fase 7 — Auditoría
**Objetivo:** trazabilidad operativa en DB.

Incluye:
- Implementar repositorio Prisma de `audit` y su consumo en vistas.
- Garantizar eventos críticos (mutaciones catálogo, versiones, ventas).

### Fase 8 — Retiro final de localStorage
**Objetivo:** remover deuda técnica de dualidad.

Incluye:
- Eliminar fallback runtime local en clientes/servicios.
- Limitar o remover `store.ts`; si se conserva, dejarlo en carpeta utilitaria no productiva.
- Actualizar docs y tests para DB-only definitivo.

---

## D. Recomendación inmediata

### Próxima fase exacta a ejecutar ahora
**Ejecutar ahora: Fase 5 — Ventas / importadores.**

### Por qué esta es la mejor siguiente acción
- Catálogo ya opera en DB-only a nivel cliente/API y permite enfocar el siguiente corte en operación comercial.
- Ventas/importadores concentran la deuda funcional más alta antes de poder migrar setup/dashboard.
- Completar `sales` en Prisma destraba luego auditoría y retiro total de `localStorage`.

### Alcance inmediato recomendado (incremental, sin romper UI)
1. **Implementar repositorio Prisma de ventas** (`salesDaily`, `salesAdjustments`) con paridad funcional.
2. **Migrar importadores** para persistir ventas en DB sin cambiar UI.
3. **Mantener puente temporal explícito de `store.ts` solo en dominios pendientes** (auditoría + pantallas aún no migradas).
4. **Preservar catálogo en DB-only** sin reintroducir fallback local.

---

## E. Riesgos a vigilar

### Riesgo de máximo impacto
- **Inconsistencia de datos por escritura mixta DB/localStorage** si no se corta rápido la dualidad: usuarios pueden ver datos distintos según pantalla o entorno.

### Qué puede romperse si no se ordena bien
1. **Pantallas operativas** (ventas/dashboard/setup) pueden fallar al pasar a DB-only si `sales/audit` Prisma no está listo o no existe puente temporal.
2. **Reglas de versionado** pueden divergir si quedan implementaciones paralelas (local vs DB) con diferencias de cierre de vigencias.
3. **Importadores** pueden duplicar/omitir datos si mezclan alias y productos desde fuentes distintas.
4. **Testing y QA** se vuelve poco confiable mientras existan rutas de datos múltiples.

### Mitigación mínima
- Ejecutar migración por dominio con “source of truth” única por fase.
- Agregar pruebas de paridad en cada corte (catálogo, versionados, ventas).
- Mantener puente local solo por tiempo limitado y con alcance explícito.
