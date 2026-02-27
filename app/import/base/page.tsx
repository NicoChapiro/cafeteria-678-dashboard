'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';

import {
  addAuditEvent,
  addItemCostVersion,
  addProductPriceVersion,
  listItemCosts,
  listItems,
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
  excelId: string;
  itemId: string;
  category?: string;
  name: string;
  baseUnit: 'g' | 'ml' | 'unit';
  packQtyInBase: number;
  packCostGrossClp: number;
  yieldRateDefault: number;
};

type ParsedProduct = {
  excelId: string;
  productId: string;
  category?: string;
  name: string;
  priceGrossClp: number;
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

  const itemsSheet = workbook.Sheets['Ingredientes e Insumos'];
  const productsSheet = workbook.Sheets['Productos'];
  const recipesSheet = workbook.Sheets['Recetas'];

  if (!itemsSheet) errors.push('Falta hoja "Ingredientes e Insumos".');
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

    const excelId = normalizeText(byHeader.get('id'));
    const name = normalizeText(byHeader.get('nombre'));
    const category = normalizeText(byHeader.get('categoria')) || undefined;
    const cost = toNumber(byHeader.get('costo'));
    const qty = toNumber(byHeader.get('cantidad')) ?? 1;
    const unitInfo = resolveBaseUnit(byHeader.get('unidad'));
    const merma = toNumber(byHeader.get('merma en %'));

    if (!excelId || !name || cost === null || qty === null || !unitInfo || merma === null) {
      errors.push(`Ingredientes e Insumos fila ${row} inválida.`);
      return;
    }

    if (cost < 0 || qty <= 0 || merma < 0 || merma >= 1) {
      errors.push(`Ingredientes e Insumos fila ${row} fuera de rango.`);
      return;
    }

    parsedItems.push({
      excelId,
      itemId: `item_${excelId}`,
      category,
      name,
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

    const excelId = normalizeText(byHeader.get('id'));
    const name = normalizeText(byHeader.get('nombre'));
    const category = normalizeText(byHeader.get('categoria')) || undefined;
    const price = toNumber(byHeader.get('precio'));

    if (!excelId || !name || price === null || price < 0) {
      errors.push(`Productos fila ${row} inválida.`);
      return;
    }

    parsedProducts.push({
      excelId,
      productId: `product_${excelId}`,
      category,
      name,
      priceGrossClp: Math.round(price),
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

    const itemsById = new Map(listItems().map((item) => [item.id, item]));
    const productsById = new Map(listProducts().map((product) => [product.id, product]));
    const recipesById = new Map(listRecipes().map((recipe) => [recipe.id, recipe]));

    const productsByName = new Map(preview.parsed.products.map((product) => [product.name.toLocaleLowerCase('es-CL'), product]));
    const productsByExcelId = new Map(preview.parsed.products.map((product) => [product.excelId, product]));
    const itemsByName = new Map(preview.parsed.items.map((item) => [item.name.toLocaleLowerCase('es-CL'), item]));
    const itemsByExcelId = new Map(preview.parsed.items.map((item) => [item.excelId, item]));

    const result: ImportSummary = {
      created: { items: 0, products: 0, recipes: 0, recipeLines: 0 },
      updated: { items: 0, products: 0, recipes: 0, recipeLines: 0 },
      skippedVersions: 0,
      errors: preview.errors.length,
    };

    preview.parsed.items.forEach((entry) => {
      const existed = itemsById.has(entry.itemId);
      upsertItem({
        id: entry.itemId,
        name: entry.name,
        category: entry.category,
        baseUnit: entry.baseUnit,
        yieldRateDefault: entry.yieldRateDefault,
      });
      if (existed) result.updated.items += 1;
      else result.created.items += 1;

      BRANCHES.forEach((branch) => {
        const versions = listItemCosts(entry.itemId, branch);
        const existsDate = hasVersionOnDate(validFrom, versions.map((version) => version.validFrom));
        if (existsDate) {
          result.skippedVersions += 1;
          return;
        }

        addItemCostVersion(entry.itemId, branch, {
          packQtyInBase: entry.packQtyInBase,
          packCostGrossClp: entry.packCostGrossClp,
          validFrom: validFromDate,
        });
      });
    });

    preview.parsed.products.forEach((entry) => {
      const existed = productsById.has(entry.productId);
      upsertProduct({
        id: entry.productId,
        name: entry.name,
        category: entry.category,
        active: true,
        recipeId: productsById.get(entry.productId)?.recipeId ?? null,
      });
      if (existed) result.updated.products += 1;
      else result.created.products += 1;

      BRANCHES.forEach((branch) => {
        const versions = listProductPrices(entry.productId, branch);
        const existsDate = hasVersionOnDate(validFrom, versions.map((version) => version.validFrom));
        if (existsDate) {
          result.skippedVersions += 1;
          return;
        }

        addProductPriceVersion(entry.productId, branch, {
          priceGrossClp: entry.priceGrossClp,
          validFrom: validFromDate,
        });
      });
    });

    const recipesByProductId = new Map<string, ParsedRecipeRow[]>();

    preview.parsed.recipes.forEach((row) => {
      const product = productsByExcelId.get(row.productRef) ?? productsByName.get(row.productRef.toLocaleLowerCase('es-CL'));
      const item = itemsByExcelId.get(row.ingredientRef) ?? itemsByName.get(row.ingredientRef.toLocaleLowerCase('es-CL'));

      if (!product || !item) {
        result.errors += 1;
        return;
      }

      const bucket = recipesByProductId.get(product.productId) ?? [];
      bucket.push({ ...row, productRef: product.productId, ingredientRef: item.itemId });
      recipesByProductId.set(product.productId, bucket);
    });

    recipesByProductId.forEach((rows, productId) => {
      const product = preview.parsed.products.find((entry) => entry.productId === productId);
      if (!product) return;

      const recipeId = `recipe_${slugify(product.name)}`;
      const existedRecipe = recipesById.has(recipeId);
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
        id: product.productId,
        name: product.name,
        category: product.category,
        active: true,
        recipeId,
      });

      const existingLineIds = new Set(listRecipeLines(recipeId).map((line) => line.id));
      const mergedByItemId = new Map<string, number>();
      rows.forEach((row) => {
        mergedByItemId.set(row.ingredientRef, (mergedByItemId.get(row.ingredientRef) ?? 0) + row.qtyInBase);
      });

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

    addAuditEvent({
      entityType: 'dataset',
      entityId: 'base_consolidada',
      action: 'base_import',
      diffJson: {
        created: result.created,
        updated: result.updated,
        skippedVersions: result.skippedVersions,
        errors: result.errors,
        validFrom,
      },
    });

    setSummary(result);
    setMessage({ type: 'success', text: 'Importación base completada.' });
  }

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Importar Base Consolidada</h1>

      <section style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap', marginBottom: 16 }}>
        <label>
          Archivo .xlsx
          <br />
          <input
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
          <br />
          <input type="date" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} />
        </label>

        <button type="button" onClick={handlePreview}>Previsualizar</button>
        <button type="button" onClick={handleImport} disabled={!preview}>Importar</button>
      </section>

      {message ? <p style={{ color: message.type === 'error' ? '#b00020' : '#0f5132' }}>{message.text}</p> : null}

      {preview ? (
        <section style={{ marginBottom: 16 }}>
          <h2>Resumen previsualización</h2>
          <ul>
            <li>Items leídos/válidos: {preview.rowsRead.items} / {preview.rowsValid.items}</li>
            <li>Productos leídos/válidos: {preview.rowsRead.products} / {preview.rowsValid.products}</li>
            <li>Recetas leídas/válidas: {preview.rowsRead.recipes} / {preview.rowsValid.recipes}</li>
            <li>Errores: {preview.errors.length}</li>
          </ul>

          {preview.errors.length > 0 ? (
            <details>
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
        <section>
          <h2>Resumen importación</h2>
          <ul>
            <li>Items creados/actualizados: {summary.created.items} / {summary.updated.items}</li>
            <li>Productos creados/actualizados: {summary.created.products} / {summary.updated.products}</li>
            <li>Recetas creadas/actualizadas: {summary.created.recipes} / {summary.updated.recipes}</li>
            <li>Líneas receta creadas/actualizadas: {summary.created.recipeLines} / {summary.updated.recipeLines}</li>
            <li>Versiones omitidas por misma vigencia: {summary.skippedVersions}</li>
            <li>Errores totales: {summary.errors}</li>
          </ul>
        </section>
      ) : null}
    </main>
  );
}
