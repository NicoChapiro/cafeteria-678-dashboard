'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';

import BackNav from '@/src/components/BackNav';
import PageHeader from '@/src/components/PageHeader';
import PageShell from '@/src/components/PageShell';
import {
  addAuditEvent,
  addItemCostVersion,
  addProductCostVersion,
  addProductPriceVersion,
  deleteRecipeLine,
  listItemCosts,
  listItems,
  listProductCosts,
  listProductPrices,
  listProducts,
  listRecipeLines,
  listRecipes,
  upsertItem,
  upsertProduct,
  upsertRecipe,
  upsertRecipeLine,
} from '@/src/storage/local/store';

type ParsedItem = {
  sourceId: string;
  name: string;
  category?: string;
  baseUnit: 'g' | 'ml' | 'unit';
  packQtyInBase: number;
  packCostGrossClp: number;
  yieldRateDefault: number;
};

type ParsedProduct = {
  sourceId: string;
  name: string;
  category?: string;
  priceGrossClp: number | null;
  manualCostGrossClp: number | null;
};

type ParsedRecipeRow = {
  productRef: string;
  ingredientRef: string;
  qtyInBase: number;
};

type PreviewState = {
  rowsRead: { items: number; products: number; recipes: number };
  rowsValid: { items: number; products: number; recipes: number };
  parsed: {
    items: ParsedItem[];
    products: ParsedProduct[];
    recipes: ParsedRecipeRow[];
  };
  errors: string[];
};

type ImportSummary = {
  created: { items: number; products: number; recipes: number; recipeLines: number };
  updated: { items: number; products: number; recipes: number; recipeLines: number };
  skippedVersions: number;
  errors: number;
};

const BRANCHES = ['Santiago', 'Temuco'] as const;

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('es-CL')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeEntityName(value: string): string {
  return value
    .toLocaleLowerCase('es-CL')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/ /g, '');
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const text = String(value ?? '').trim();
  if (!text) {
    return null;
  }

  const compact = text.replace(/\s/g, '');
  const normalized = compact.includes(',')
    ? compact.replace(/\./g, '').replace(',', '.')
    : compact;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function slugify(value: string): string {
  return value
    .toLocaleLowerCase('es-CL')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function resolveBaseUnit(unitRaw: unknown): { baseUnit: 'g' | 'ml' | 'unit'; multiplier: number } | null {
  const unit = normalizeText(unitRaw).toLocaleLowerCase('es-CL').replace('.', '');

  if (unit === 'kg') return { baseUnit: 'g', multiplier: 1000 };
  if (unit === 'g' || unit === 'gr' || unit === 'gramo' || unit === 'gramos') return { baseUnit: 'g', multiplier: 1 };
  if (unit === 'l' || unit === 'lt') return { baseUnit: 'ml', multiplier: 1000 };
  if (unit === 'ml') return { baseUnit: 'ml', multiplier: 1 };
  if (unit === 'unid' || unit === 'unidad' || unit === 'unidades' || unit === 'unit' || unit === 'u') {
    return { baseUnit: 'unit', multiplier: 1 };
  }

  return null;
}

function parseWorkbook(buffer: ArrayBuffer): PreviewState {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const errors: string[] = [];

  const itemsSheet = workbook.Sheets.Ingredientes;
  const productsSheet = workbook.Sheets.Productos;
  const recipesSheet = workbook.Sheets.Recetas;

  if (!itemsSheet) errors.push('Falta hoja "Ingredientes".');
  if (!productsSheet) errors.push('Falta hoja "Productos".');
  if (!recipesSheet) errors.push('Falta hoja "Recetas".');

  const itemsRows = itemsSheet ? XLSX.utils.sheet_to_json<Record<string, unknown>>(itemsSheet, { defval: '' }) : [];
  const productsRows = productsSheet ? XLSX.utils.sheet_to_json<Record<string, unknown>>(productsSheet, { defval: '' }) : [];
  const recipesRows = recipesSheet ? XLSX.utils.sheet_to_json<Record<string, unknown>>(recipesSheet, { defval: '' }) : [];

  const parsedItems: ParsedItem[] = [];
  const parsedProducts: ParsedProduct[] = [];
  const parsedRecipes: ParsedRecipeRow[] = [];

  itemsRows.forEach((raw, index) => {
    const row = index + 2;
    const byHeader = new Map<string, unknown>();
    Object.entries(raw).forEach(([k, v]) => byHeader.set(normalizeHeader(k), v));

    const sourceId = normalizeText(byHeader.get('id') ?? String(row));
    const name = normalizeText(byHeader.get('nombre'));
    const category = normalizeText(byHeader.get('categoria')) || undefined;
    const cost = toNumber(byHeader.get('costo'));
    const qty = toNumber(byHeader.get('cantidad')) ?? 1;
    const merma = toNumber(byHeader.get('merma en %') ?? byHeader.get('merma')) ?? 0;
    const unitInfo = resolveBaseUnit(byHeader.get('unidad'));

    if (!name || cost === null || qty === null || !unitInfo) {
      errors.push(`Ingredientes fila ${row} inválida.`);
      return;
    }

    if (cost < 0 || qty <= 0 || merma < 0 || merma >= 1) {
      errors.push(`Ingredientes fila ${row} fuera de rango.`);
      return;
    }

    parsedItems.push({
      sourceId,
      name,
      category,
      baseUnit: unitInfo.baseUnit,
      packQtyInBase: qty * unitInfo.multiplier,
      packCostGrossClp: Math.round(cost),
      yieldRateDefault: Math.round((1 - merma) * 10000) / 10000,
    });
  });

  productsRows.forEach((raw, index) => {
    const row = index + 2;
    const byHeader = new Map<string, unknown>();
    Object.entries(raw).forEach(([k, v]) => byHeader.set(normalizeHeader(k), v));

    const sourceId = normalizeText(byHeader.get('id') ?? String(row));
    const name = normalizeText(byHeader.get('nombre'));
    const category = normalizeText(byHeader.get('categoria')) || undefined;
    const price = toNumber(byHeader.get('precio'));
    const manualCost = toNumber(byHeader.get('costo'));

    if (!name) {
      errors.push(`Productos fila ${row} inválida.`);
      return;
    }

    if ((price !== null && price < 0) || (manualCost !== null && manualCost < 0)) {
      errors.push(`Productos fila ${row} fuera de rango.`);
      return;
    }

    parsedProducts.push({
      sourceId,
      name,
      category,
      priceGrossClp: price === null ? null : Math.round(price),
      manualCostGrossClp: manualCost === null ? null : Math.round(manualCost),
    });
  });

  recipesRows.forEach((raw, index) => {
    const row = index + 2;
    const byHeader = new Map<string, unknown>();
    Object.entries(raw).forEach(([k, v]) => byHeader.set(normalizeHeader(k), v));

    const productRef = normalizeText(byHeader.get('producto'));
    const ingredientRef = normalizeText(byHeader.get('ingrediente'));
    const qty = toNumber(byHeader.get('cantidad'));
    const unitInfo = resolveBaseUnit(byHeader.get('unidad'));

    if (!productRef || !ingredientRef || qty === null || qty <= 0 || !unitInfo) {
      errors.push(`Recetas fila ${row} inválida.`);
      return;
    }

    parsedRecipes.push({
      productRef,
      ingredientRef,
      qtyInBase: qty * unitInfo.multiplier,
    });
  });

  return {
    rowsRead: { items: itemsRows.length, products: productsRows.length, recipes: recipesRows.length },
    rowsValid: { items: parsedItems.length, products: parsedProducts.length, recipes: parsedRecipes.length },
    parsed: { items: parsedItems, products: parsedProducts, recipes: parsedRecipes },
    errors,
  };
}

function hasVersionOnDate(dateIso: string, dates: Date[]): boolean {
  return dates.some((date) => date.toISOString().slice(0, 10) === dateIso);
}

function deterministicRecipeLineId(recipeId: string, itemId: string): string {
  return `line_${slugify(`${recipeId}-${itemId}`)}`;
}

export default function ImportBasePage() {
  const [file, setFile] = useState<File | null>(null);
  const [validFrom, setValidFrom] = useState('2026-01-01');
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [updatePrices, setUpdatePrices] = useState(true);
  const [updateIngredientCosts, setUpdateIngredientCosts] = useState(true);
  const [updateRecipes, setUpdateRecipes] = useState(true);
  const [replaceRecipeLines, setReplaceRecipeLines] = useState(true);
  const [updateProductManualCosts, setUpdateProductManualCosts] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handlePreview(): Promise<void> {
    if (!file) {
      setMessage({ type: 'error', text: 'Selecciona un archivo .xlsx.' });
      return;
    }

    try {
      const result = parseWorkbook(await file.arrayBuffer());
      setPreview(result);
      setSummary(null);
      setMessage({ type: 'success', text: 'Previsualización lista.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Error procesando archivo.' });
    }
  }

  function handleImport(): void {
    if (!preview) {
      setMessage({ type: 'error', text: 'Primero previsualiza el archivo.' });
      return;
    }

    const validFromDate = new Date(`${validFrom}T00:00:00.000Z`);
    if (Number.isNaN(validFromDate.getTime())) {
      setMessage({ type: 'error', text: 'Vigencia desde inválida.' });
      return;
    }

    const existingItems = listItems();
    const existingProducts = listProducts();
    const existingRecipes = listRecipes();

    const itemsByNormalizedName = new Map(
      existingItems.map((item) => [normalizeEntityName(item.name), item]),
    );
    const productsByNormalizedName = new Map(
      existingProducts.map((product) => [normalizeEntityName(product.name), product]),
    );

    const result: ImportSummary = {
      created: { items: 0, products: 0, recipes: 0, recipeLines: 0 },
      updated: { items: 0, products: 0, recipes: 0, recipeLines: 0 },
      skippedVersions: 0,
      errors: preview.errors.length,
    };

    const resolvedItems = new Map<string, { id: string; name: string }>();

    preview.parsed.items.forEach((entry) => {
      const byName = itemsByNormalizedName.get(normalizeEntityName(entry.name));
      const itemId = byName?.id ?? `item_${slugify(entry.sourceId || entry.name)}`;
      const existed = Boolean(byName);

      upsertItem({
        id: itemId,
        name: entry.name,
        category: entry.category,
        baseUnit: entry.baseUnit,
        yieldRateDefault: entry.yieldRateDefault,
      });

      if (existed) result.updated.items += 1;
      else result.created.items += 1;

      if (updateIngredientCosts) {
        BRANCHES.forEach((branch) => {
          const versions = listItemCosts(itemId, branch);
          const existsDate = hasVersionOnDate(validFrom, versions.map((version) => version.validFrom));
          if (existsDate) {
            result.skippedVersions += 1;
            return;
          }

          addItemCostVersion(itemId, branch, {
            packQtyInBase: entry.packQtyInBase,
            packCostGrossClp: entry.packCostGrossClp,
            validFrom: validFromDate,
          });
        });
      }

      resolvedItems.set(normalizeEntityName(entry.name), { id: itemId, name: entry.name });
      resolvedItems.set(normalizeEntityName(entry.sourceId), { id: itemId, name: entry.name });
    });

    const resolvedProducts = new Map<string, { id: string; name: string; recipeId: string | null | undefined }>();

    preview.parsed.products.forEach((entry) => {
      const byName = productsByNormalizedName.get(normalizeEntityName(entry.name));
      const productId = byName?.id ?? `product_${slugify(entry.sourceId || entry.name)}`;
      const existed = Boolean(byName);

      upsertProduct({
        id: productId,
        name: entry.name,
        category: entry.category,
        active: byName?.active ?? true,
        recipeId: byName?.recipeId ?? null,
      });

      if (existed) result.updated.products += 1;
      else result.created.products += 1;

      const priceGrossClp = entry.priceGrossClp;
      if (updatePrices && priceGrossClp !== null) {
        BRANCHES.forEach((branch) => {
          const versions = listProductPrices(productId, branch);
          const existsDate = hasVersionOnDate(validFrom, versions.map((version) => version.validFrom));
          if (existsDate) {
            result.skippedVersions += 1;
            return;
          }

          addProductPriceVersion(productId, branch, {
            priceGrossClp,
            validFrom: validFromDate,
          });
        });
      }

      resolvedProducts.set(normalizeEntityName(entry.name), {
        id: productId,
        name: entry.name,
        recipeId: byName?.recipeId,
      });
      resolvedProducts.set(normalizeEntityName(entry.sourceId), {
        id: productId,
        name: entry.name,
        recipeId: byName?.recipeId,
      });
    });

    const recipeProductIds = new Set<string>();

    if (updateRecipes) {
      const recipeRowsByProductId = new Map<string, ParsedRecipeRow[]>();

      preview.parsed.recipes.forEach((row) => {
        const product = resolvedProducts.get(normalizeEntityName(row.productRef));
        const item = resolvedItems.get(normalizeEntityName(row.ingredientRef));

        if (!product || !item) {
          result.errors += 1;
          return;
        }

        const bucket = recipeRowsByProductId.get(product.id) ?? [];
        bucket.push({ ...row, productRef: product.id, ingredientRef: item.id });
        recipeRowsByProductId.set(product.id, bucket);
      });

      recipeRowsByProductId.forEach((rows, productId) => {
        const product = listProducts().find((entry) => entry.id === productId);
        if (!product) {
          result.errors += 1;
          return;
        }

        recipeProductIds.add(product.id);
        const recipeId = `recipe_${slugify(product.name)}`;
        const existedRecipe = existingRecipes.some((recipe) => recipe.id === recipeId);

        upsertRecipe({
          id: recipeId,
          name: product.name,
          type: 'intermedia',
          yieldQty: 1,
          yieldUnit: 'portion',
          active: true,
        });

        if (existedRecipe) result.updated.recipes += 1;
        else result.created.recipes += 1;

        upsertProduct({
          id: product.id,
          name: product.name,
          category: product.category,
          active: product.active,
          recipeId,
        });

        const existingLineIds = new Set(listRecipeLines(recipeId).map((line) => line.id));
        const mergedByItemId = new Map<string, number>();
        rows.forEach((row) => {
          mergedByItemId.set(row.ingredientRef, (mergedByItemId.get(row.ingredientRef) ?? 0) + row.qtyInBase);
        });

        const desiredLineIds = new Set(
          Array.from(mergedByItemId.keys()).map((itemId) => deterministicRecipeLineId(recipeId, itemId)),
        );

        if (replaceRecipeLines) {
          existingLineIds.forEach((existingLineId) => {
            if (!desiredLineIds.has(existingLineId)) {
              deleteRecipeLine(existingLineId);
            }
          });
        }

        mergedByItemId.forEach((qtyInBase, itemId) => {
          const lineId = deterministicRecipeLineId(recipeId, itemId);
          const existedLine = existingLineIds.has(lineId);
          upsertRecipeLine({
            id: lineId,
            recipeId,
            lineType: 'item',
            itemId,
            qtyInBase: Math.round(qtyInBase * 1000) / 1000,
          });

          if (existedLine) result.updated.recipeLines += 1;
          else result.created.recipeLines += 1;
        });
      });
    }

    if (updateProductManualCosts) {
      const productsAfterRecipe = new Map(listProducts().map((product) => [product.id, product]));

      preview.parsed.products.forEach((entry) => {
        if (entry.manualCostGrossClp === null) {
          return;
        }

        const resolved = resolvedProducts.get(normalizeEntityName(entry.name));
        if (!resolved) {
          result.errors += 1;
          return;
        }

        const product = productsAfterRecipe.get(resolved.id);
        if (!product) {
          result.errors += 1;
          return;
        }

        const hasRecipeAfterImport = Boolean(product.recipeId) || recipeProductIds.has(product.id);
        if (hasRecipeAfterImport) {
          return;
        }

        BRANCHES.forEach((branch) => {
          const versions = listProductCosts(product.id, branch);
          const existsDate = hasVersionOnDate(validFrom, versions.map((version) => version.validFrom));
          if (existsDate) {
            result.skippedVersions += 1;
            return;
          }

          addProductCostVersion(product.id, branch, {
            costGrossClp: entry.manualCostGrossClp as number,
            validFrom: validFromDate,
          });
        });
      });
    }

    addAuditEvent({
      entityType: 'dataset',
      entityId: 'base_consolidada',
      action: 'base_import_v3',
      diffJson: {
        created: result.created,
        updated: result.updated,
        skippedVersions: result.skippedVersions,
        errors: result.errors,
        validFrom,
        toggles: {
          updatePrices,
          updateIngredientCosts,
          updateRecipes,
          replaceRecipeLines,
          updateProductManualCosts,
        },
      },
    });

    setSummary(result);
    setMessage({ type: 'success', text: 'Importación base v3 completada. salesDaily se preservó.' });
  }

  const fileStateLabel = file ? `Archivo seleccionado: ${file.name}` : 'Sin archivo seleccionado';
  const fileStateTone = file ? '#0f5132' : '#6b7280';

  return (
    <PageShell>
      <PageHeader
        title="Importar Base Consolidada v3"
        description="Carga tu planilla consolidada, revisa la previsualización y confirma la importación con control total sobre las actualizaciones."
        backNav={<BackNav />}
      />

      <section className="card" style={{ marginBottom: 0 }}>
        <h2 style={{ marginTop: 0, marginBottom: 4 }}>1) Archivo y vigencia</h2>
        <p className="muted" style={{ marginBottom: 12 }}>
          Selecciona el archivo <strong>.xlsx</strong>, valida su contenido en la previsualización y luego ejecuta la importación.
        </p>

        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(240px, 1.5fr) minmax(180px, 1fr)', alignItems: 'end' }}>
          <label>
            Archivo .xlsx
            <input
              className="input"
              type="file"
              accept=".xlsx"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setPreview(null);
                setSummary(null);
                setMessage(null);
              }}
            />
          </label>

          <label>
            Vigencia desde
            <input className="input" type="date" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} />
          </label>
        </div>

        <p
          style={{
            margin: '10px 0 0',
            fontSize: 13,
            color: fileStateTone,
            fontWeight: file ? 600 : 500,
          }}
        >
          {fileStateLabel}
        </p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <button className="btn" type="button" onClick={handlePreview}>Previsualizar archivo</button>
          <button className="btnSecondary" type="button" onClick={handleImport} disabled={!preview}>Importar base</button>
        </div>

        <div className="calloutInfo" style={{ marginTop: 12 }}>
          <strong>Guía rápida:</strong> la previsualización no escribe datos; la importación sí aplica cambios según las opciones seleccionadas.
        </div>
      </section>

      <section className="card" style={{ marginBottom: 0 }}>
        <h2 style={{ marginTop: 0, marginBottom: 4 }}>2) Opciones de actualización</h2>
        <p className="muted" style={{ marginBottom: 12 }}>
          Activa solo los bloques que quieras actualizar durante la importación.
        </p>

        <div style={{ display: 'grid', gap: 8 }}>
          <label className="calloutSuccess" style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 10px' }}>
            <input type="checkbox" checked={updatePrices} onChange={(event) => setUpdatePrices(event.target.checked)} />
            <span>Actualizar precios</span>
          </label>
          <label className="calloutSuccess" style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 10px' }}>
            <input type="checkbox" checked={updateIngredientCosts} onChange={(event) => setUpdateIngredientCosts(event.target.checked)} />
            <span>Actualizar costos ingredientes</span>
          </label>
          <label className="calloutSuccess" style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 10px' }}>
            <input type="checkbox" checked={updateRecipes} onChange={(event) => setUpdateRecipes(event.target.checked)} />
            <span>Actualizar recetas</span>
          </label>
          <label className="calloutInfo" style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 10px' }}>
            <input type="checkbox" checked={replaceRecipeLines} onChange={(event) => setReplaceRecipeLines(event.target.checked)} />
            <span>Reemplazar líneas de receta (elimina ingredientes no presentes)</span>
          </label>
          <label className="calloutSuccess" style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 10px' }}>
            <input type="checkbox" checked={updateProductManualCosts} onChange={(event) => setUpdateProductManualCosts(event.target.checked)} />
            <span>Actualizar costo manual productos</span>
          </label>
        </div>
      </section>

      {message ? (
        <section className={message.type === 'error' ? 'alert' : 'calloutSuccess'} style={{ marginBottom: 0 }}>
          <strong>{message.type === 'error' ? 'No se pudo completar la acción.' : 'Acción completada.'}</strong>
          <p style={{ margin: '6px 0 0' }}>{message.text}</p>
        </section>
      ) : null}

      {preview ? (
        <section className="card" style={{ marginBottom: 0 }}>
          <h2 style={{ marginTop: 0, marginBottom: 4 }}>3) Revisión de previsualización</h2>
          <p className="muted" style={{ marginBottom: 12 }}>
            Verifica el volumen leído, los registros válidos y errores detectados antes de importar.
          </p>

          <div className="grid" style={{ marginBottom: 12 }}>
            <article className="card" style={{ marginBottom: 0, padding: 10 }}>
              <h3 style={{ margin: 0, fontSize: 14 }}>Ingredientes</h3>
              <p style={{ margin: '4px 0 0', fontWeight: 700 }}>{preview.rowsValid.items} válidos</p>
              <p className="muted" style={{ marginTop: 2, fontSize: 12 }}>{preview.rowsRead.items} leídos</p>
            </article>
            <article className="card" style={{ marginBottom: 0, padding: 10 }}>
              <h3 style={{ margin: 0, fontSize: 14 }}>Productos</h3>
              <p style={{ margin: '4px 0 0', fontWeight: 700 }}>{preview.rowsValid.products} válidos</p>
              <p className="muted" style={{ marginTop: 2, fontSize: 12 }}>{preview.rowsRead.products} leídos</p>
            </article>
            <article className="card" style={{ marginBottom: 0, padding: 10 }}>
              <h3 style={{ margin: 0, fontSize: 14 }}>Recetas</h3>
              <p style={{ margin: '4px 0 0', fontWeight: 700 }}>{preview.rowsValid.recipes} válidos</p>
              <p className="muted" style={{ marginTop: 2, fontSize: 12 }}>{preview.rowsRead.recipes} leídos</p>
            </article>
            <article className="card" style={{ marginBottom: 0, padding: 10 }}>
              <h3 style={{ margin: 0, fontSize: 14 }}>Errores</h3>
              <p style={{ margin: '4px 0 0', fontWeight: 700, color: preview.errors.length > 0 ? '#b00020' : '#0f5132' }}>
                {preview.errors.length}
              </p>
              <p className="muted" style={{ marginTop: 2, fontSize: 12 }}>Detectados en la previsualización</p>
            </article>
          </div>

          {preview.errors.length > 0 ? (
            <details className="calloutWarning">
              <summary>Ver errores (máximo 20)</summary>
              <ul>
                {preview.errors.slice(0, 20).map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ) : null}

      {summary ? (
        <section className="card" style={{ marginBottom: 0 }}>
          <h2 style={{ marginTop: 0, marginBottom: 4 }}>4) Resultado de importación</h2>
          <p className="muted" style={{ marginBottom: 12 }}>
            Resumen operativo de registros creados, actualizados y observaciones del proceso.
          </p>

          <div className="grid">
            <article className="card" style={{ marginBottom: 0, padding: 10 }}>
              <h3 style={{ margin: 0, fontSize: 14 }}>Items</h3>
              <p style={{ margin: '6px 0 0' }}>Creados: <strong>{summary.created.items}</strong></p>
              <p style={{ margin: '2px 0 0' }}>Actualizados: <strong>{summary.updated.items}</strong></p>
            </article>
            <article className="card" style={{ marginBottom: 0, padding: 10 }}>
              <h3 style={{ margin: 0, fontSize: 14 }}>Productos</h3>
              <p style={{ margin: '6px 0 0' }}>Creados: <strong>{summary.created.products}</strong></p>
              <p style={{ margin: '2px 0 0' }}>Actualizados: <strong>{summary.updated.products}</strong></p>
            </article>
            <article className="card" style={{ marginBottom: 0, padding: 10 }}>
              <h3 style={{ margin: 0, fontSize: 14 }}>Recetas</h3>
              <p style={{ margin: '6px 0 0' }}>Creadas: <strong>{summary.created.recipes}</strong></p>
              <p style={{ margin: '2px 0 0' }}>Actualizadas: <strong>{summary.updated.recipes}</strong></p>
            </article>
            <article className="card" style={{ marginBottom: 0, padding: 10 }}>
              <h3 style={{ margin: 0, fontSize: 14 }}>Líneas de receta</h3>
              <p style={{ margin: '6px 0 0' }}>Creadas: <strong>{summary.created.recipeLines}</strong></p>
              <p style={{ margin: '2px 0 0' }}>Actualizadas: <strong>{summary.updated.recipeLines}</strong></p>
            </article>
            <article className="card" style={{ marginBottom: 0, padding: 10 }}>
              <h3 style={{ margin: 0, fontSize: 14 }}>Versiones omitidas</h3>
              <p style={{ margin: '6px 0 0', fontWeight: 700 }}>{summary.skippedVersions}</p>
              <p className="muted" style={{ marginTop: 2, fontSize: 12 }}>Coinciden con la misma fecha de vigencia</p>
            </article>
            <article className="card" style={{ marginBottom: 0, padding: 10 }}>
              <h3 style={{ margin: 0, fontSize: 14 }}>Errores totales</h3>
              <p style={{ margin: '6px 0 0', fontWeight: 700, color: summary.errors > 0 ? '#b00020' : '#0f5132' }}>{summary.errors}</p>
              <p className="muted" style={{ marginTop: 2, fontSize: 12 }}>Incluye errores de previsualización y resolución</p>
            </article>
          </div>
        </section>
      ) : null}
    </PageShell>
  );
}
