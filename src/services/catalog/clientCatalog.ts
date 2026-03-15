import type {
  Branch,
  Item,
  ItemCostVersion,
  NewItemCostVersion,
  NewProductCostVersion,
  NewProductPriceVersion,
  Product,
  ProductCostVersion,
  ProductPriceVersion,
  Recipe,
  RecipeLine,
} from '@/src/domain/types';
import {
  addItemCostVersion as addItemCostVersionLocal,
  addProductCostVersion as addProductCostVersionLocal,
  addProductPriceVersion as addProductPriceVersionLocal,
  deleteProductAlias as deleteProductAliasLocal,
  deleteRecipe as deleteRecipeLocal,
  deleteRecipeLine as deleteRecipeLineLocal,
  getItem as getItemLocal,
  getProduct as getProductLocal,
  getRecipe as getRecipeLocal,
  listItemCosts as listItemCostsLocal,
  listItems as listItemsLocal,
  listProductAliases as listProductAliasesLocal,
  listProductCosts as listProductCostsLocal,
  listProductPrices as listProductPricesLocal,
  listProducts as listProductsLocal,
  listRecipeLines as listRecipeLinesLocal,
  listRecipes as listRecipesLocal,
  resolveProductIdByAlias as resolveProductAliasLocal,
  type ProductAliasEntry,
  updateProductCostVersionValidFrom as updateProductCostVersionValidFromLocal,
  upsertItem as upsertItemLocal,
  upsertProduct as upsertProductLocal,
  upsertProductAlias as upsertProductAliasLocal,
  upsertRecipe as upsertRecipeLocal,
  upsertRecipeLine as upsertRecipeLineLocal,
} from '@/src/storage/local/store';

const isDb = process.env.NEXT_PUBLIC_DATA_BACKEND === 'db';

function reviveDates<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((entry) => reviveDates(entry)) as T;
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
      if (typeof entry === 'string' && (key.toLowerCase().includes('date') || key.endsWith('At') || key.startsWith('valid'))) {
        const parsed = new Date(entry);
        out[key] = Number.isNaN(parsed.getTime()) ? entry : parsed;
      } else {
        out[key] = reviveDates(entry);
      }
    });
    return out as T;
  }
  return value;
}

async function callApi<T>(action: string, payload?: Record<string, unknown>): Promise<T> {
  const response = await fetch('/api/catalog', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Request failed');
  return reviveDates(data) as T;
}

export async function listItems(): Promise<Item[]> { return isDb ? callApi('listItems') : listItemsLocal(); }
export async function getItem(id: string): Promise<Item | undefined> { return isDb ? callApi('getItem', { id }) : getItemLocal(id); }
export async function upsertItem(item: Parameters<typeof upsertItemLocal>[0]): Promise<Item> { return isDb ? callApi('upsertItem', { item }) : upsertItemLocal(item); }
export async function listItemCosts(itemId: string, branch: Branch): Promise<ItemCostVersion[]> { return isDb ? callApi('listItemCosts', { itemId, branch }) : listItemCostsLocal(itemId, branch); }
export async function addItemCostVersion(itemId: string, branch: Branch, version: NewItemCostVersion): Promise<ItemCostVersion[]> { return isDb ? callApi('addItemCostVersion', { itemId, branch, version }) : addItemCostVersionLocal(itemId, branch, version); }

export async function listProducts(): Promise<Product[]> { return isDb ? callApi('listProducts') : listProductsLocal(); }
export async function getProduct(id: string): Promise<Product | undefined> { return isDb ? callApi('getProduct', { id }) : getProductLocal(id); }
export async function upsertProduct(product: Parameters<typeof upsertProductLocal>[0]): Promise<Product> { return isDb ? callApi('upsertProduct', { product }) : upsertProductLocal(product); }
export async function listProductPrices(productId: string, branch: Branch): Promise<ProductPriceVersion[]> { return isDb ? callApi('listProductPrices', { productId, branch }) : listProductPricesLocal(productId, branch); }
export async function addProductPriceVersion(productId: string, branch: Branch, version: NewProductPriceVersion): Promise<ProductPriceVersion[]> { return isDb ? callApi('addProductPriceVersion', { productId, branch, version }) : addProductPriceVersionLocal(productId, branch, version); }
export async function listProductCosts(productId: string, branch: Branch): Promise<ProductCostVersion[]> { return isDb ? callApi('listProductCosts', { productId, branch }) : listProductCostsLocal(productId, branch); }
export async function addProductCostVersion(productId: string, branch: Branch, version: NewProductCostVersion): Promise<ProductCostVersion[]> { return isDb ? callApi('addProductCostVersion', { productId, branch, version }) : addProductCostVersionLocal(productId, branch, version); }
export async function updateProductCostVersionValidFrom(id: string, validFrom: Date): Promise<ProductCostVersion[]> { return isDb ? callApi('updateProductCostVersionValidFrom', { id, validFrom }) : updateProductCostVersionValidFromLocal(id, validFrom); }

export async function listRecipes(): Promise<Recipe[]> { return isDb ? callApi('listRecipes') : listRecipesLocal(); }
export async function getRecipe(id: string): Promise<Recipe | undefined> { return isDb ? callApi('getRecipe', { id }) : getRecipeLocal(id); }
export async function upsertRecipe(recipe: Parameters<typeof upsertRecipeLocal>[0]): Promise<Recipe> { return isDb ? callApi('upsertRecipe', { recipe }) : upsertRecipeLocal(recipe); }
export async function deleteRecipe(id: string): Promise<void> { return isDb ? callApi('deleteRecipe', { id }) : deleteRecipeLocal(id); }
export async function listRecipeLines(recipeId: string): Promise<RecipeLine[]> { return isDb ? callApi('listRecipeLines', { recipeId }) : listRecipeLinesLocal(recipeId); }
export async function upsertRecipeLine(line: Parameters<typeof upsertRecipeLineLocal>[0]): Promise<RecipeLine> { return isDb ? callApi('upsertRecipeLine', { line }) : upsertRecipeLineLocal(line); }
export async function deleteRecipeLine(id: string): Promise<void> { return isDb ? callApi('deleteRecipeLine', { id }) : deleteRecipeLineLocal(id); }

export async function listProductAliases(): Promise<ProductAliasEntry[]> { return isDb ? callApi('listProductAliases') : listProductAliasesLocal(); }
export async function upsertProductAlias(alias: ProductAliasEntry): Promise<void> { return isDb ? callApi('upsertProductAlias', { alias }) : upsertProductAliasLocal(alias); }
export async function deleteProductAlias(source: string, externalName: string): Promise<boolean> { return isDb ? callApi('deleteProductAlias', { source, externalName }) : deleteProductAliasLocal(source, externalName); }
export async function resolveProductIdByAlias(source: string, externalName: string): Promise<string | null> { return isDb ? callApi('resolveProductAlias', { source, externalName }) : resolveProductAliasLocal(source, externalName); }
export type { ProductAliasEntry } from '@/src/storage/local/store';
