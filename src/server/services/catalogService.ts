import { prisma } from '@/src/server/db/prisma';
import type { Branch, Item, Product, Recipe, RecipeLine } from '@/src/domain/types';
import { getDataBackend, getRepositories } from '@/src/server/repositories';

export async function listItems() { return getRepositories().items.list(); }
export async function getItem(id: string) { return getRepositories().items.getById(id); }
export async function upsertItem(item: Item) { return getRepositories().items.upsert(item); }
export async function listItemCosts(itemId: string, branch: Branch) { return getRepositories().items.listCostVersions(itemId, branch); }
export async function addItemCostVersion(itemId: string, branch: Branch, version: { packQtyInBase: number; packCostGrossClp: number; validFrom: Date; yieldRateOverride?: number; }) { return getRepositories().items.addCostVersion(itemId, branch, version); }

export async function listProducts() { return getRepositories().products.list(); }
export async function getProduct(id: string) { return getRepositories().products.getById(id); }
export async function upsertProduct(product: Product) { return getRepositories().products.upsert(product); }
export async function listProductPrices(productId: string, branch: Branch) { return getRepositories().products.listPriceVersions(productId, branch); }
export async function addProductPriceVersion(productId: string, branch: Branch, version: { validFrom: Date; priceGrossClp: number }) { return getRepositories().products.addPriceVersion(productId, branch, version); }
export async function listProductCosts(productId: string, branch: Branch) { return getRepositories().products.listCostVersions(productId, branch); }
export async function addProductCostVersion(productId: string, branch: Branch, version: { validFrom: Date; costGrossClp: number }) { return getRepositories().products.addCostVersion(productId, branch, version); }

export async function updateProductCostVersionValidFrom(id: string, validFrom: Date) {
  if (getDataBackend() !== 'db') throw new Error('updateProductCostVersionValidFrom only available for db backend');
  const current = await prisma.productCostVersion.findUnique({ where: { id } });
  if (!current) throw new Error('No hay costos para editar');
  await prisma.productCostVersion.update({ where: { id }, data: { validFrom } });
  return listProductCosts(current.productId, current.branchId === 'branch_temuco' ? 'Temuco' : 'Santiago');
}

export async function listRecipes() { return getRepositories().recipes.list(); }
export async function getRecipe(id: string) { return getRepositories().recipes.getById(id); }
export async function upsertRecipe(recipe: Recipe) { return getRepositories().recipes.upsert(recipe); }
export async function deleteRecipe(id: string) { return getRepositories().recipes.delete(id); }
export async function listRecipeLines(recipeId: string) { return getRepositories().recipes.listLines(recipeId); }
export async function upsertRecipeLine(line: RecipeLine) { return getRepositories().recipes.upsertLine(line); }
export async function deleteRecipeLine(id: string) { return getRepositories().recipes.deleteLine(id); }

export async function listProductAliases() { return getRepositories().aliases.list(); }
export async function upsertProductAlias(alias: { source: string; externalName: string; productId: string }) { return getRepositories().aliases.upsert(alias); }
export async function deleteProductAlias(source: string, externalName: string) { return getRepositories().aliases.delete(source, externalName); }
export async function resolveProductAlias(source: string, externalName: string) { return getRepositories().aliases.resolveProductId(source, externalName); }
