import type {
  Branch,
  Item,
  ItemCostVersion,
  NewItemCostVersion,
  NewProductCostVersion,
  NewProductPriceVersion,
  Product,
  ProductAliasEntry,
  ProductCostVersion,
  ProductPriceVersion,
  Recipe,
  RecipeLine,
} from '@/src/domain/types';

type UpsertItemInput = Omit<Item, 'createdAt' | 'updatedAt'> & Partial<Pick<Item, 'createdAt' | 'updatedAt'>>;
type UpsertProductInput = Omit<Product, 'createdAt' | 'updatedAt'> & Partial<Pick<Product, 'createdAt' | 'updatedAt'>>;
type UpsertRecipeInput = Omit<Recipe, 'createdAt' | 'updatedAt'> & Partial<Pick<Recipe, 'createdAt' | 'updatedAt'>>;

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

export async function listItems(): Promise<Item[]> { return callApi('listItems'); }
export async function getItem(id: string): Promise<Item | undefined> { return callApi('getItem', { id }); }
export async function upsertItem(item: UpsertItemInput): Promise<Item> { return callApi('upsertItem', { item }); }
export async function listItemCosts(itemId: string, branch: Branch): Promise<ItemCostVersion[]> { return callApi('listItemCosts', { itemId, branch }); }
export async function addItemCostVersion(itemId: string, branch: Branch, version: NewItemCostVersion): Promise<ItemCostVersion[]> { return callApi('addItemCostVersion', { itemId, branch, version }); }

export async function listProducts(): Promise<Product[]> { return callApi('listProducts'); }
export async function getProduct(id: string): Promise<Product | undefined> { return callApi('getProduct', { id }); }
export async function upsertProduct(product: UpsertProductInput): Promise<Product> { return callApi('upsertProduct', { product }); }
export async function listProductPrices(productId: string, branch: Branch): Promise<ProductPriceVersion[]> { return callApi('listProductPrices', { productId, branch }); }
export async function addProductPriceVersion(productId: string, branch: Branch, version: NewProductPriceVersion): Promise<ProductPriceVersion[]> { return callApi('addProductPriceVersion', { productId, branch, version }); }
export async function listProductCosts(productId: string, branch: Branch): Promise<ProductCostVersion[]> { return callApi('listProductCosts', { productId, branch }); }
export async function addProductCostVersion(productId: string, branch: Branch, version: NewProductCostVersion): Promise<ProductCostVersion[]> { return callApi('addProductCostVersion', { productId, branch, version }); }
export async function updateProductCostVersionValidFrom(id: string, validFrom: Date): Promise<ProductCostVersion[]> { return callApi('updateProductCostVersionValidFrom', { id, validFrom }); }

export async function listRecipes(): Promise<Recipe[]> { return callApi('listRecipes'); }
export async function getRecipe(id: string): Promise<Recipe | undefined> { return callApi('getRecipe', { id }); }
export async function upsertRecipe(recipe: UpsertRecipeInput): Promise<Recipe> { return callApi('upsertRecipe', { recipe }); }
export async function deleteRecipe(id: string): Promise<void> { return callApi('deleteRecipe', { id }); }
export async function listRecipeLines(recipeId: string): Promise<RecipeLine[]> { return callApi('listRecipeLines', { recipeId }); }
export async function upsertRecipeLine(line: RecipeLine): Promise<RecipeLine> { return callApi('upsertRecipeLine', { line }); }
export async function deleteRecipeLine(id: string): Promise<void> { return callApi('deleteRecipeLine', { id }); }

export async function listProductAliases(): Promise<ProductAliasEntry[]> { return callApi('listProductAliases'); }
export async function upsertProductAlias(alias: ProductAliasEntry): Promise<void> { return callApi('upsertProductAlias', { alias }); }
export async function deleteProductAlias(source: string, externalName: string): Promise<boolean> { return callApi('deleteProductAlias', { source, externalName }); }
export async function resolveProductIdByAlias(source: string, externalName: string): Promise<string | null> { return callApi('resolveProductAlias', { source, externalName }); }
export type { ProductAliasEntry };
