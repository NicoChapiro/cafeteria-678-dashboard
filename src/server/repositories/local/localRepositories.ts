import type {
  AuditLog,
  Branch,
  Item,
  NewItemCostVersion,
  NewProductCostVersion,
  NewProductPriceVersion,
  Product,
  Recipe,
  RecipeLine,
  SalesAdjustment,
  SalesDaily,
} from '@/src/domain/types';
import {
  addAuditEvent,
  addItemCostVersion,
  addProductCostVersion,
  addProductPriceVersion,
  addSalesAdjustment,
  clearAuditLogs,
  deleteItem,
  deleteProduct,
  deleteProductAlias,
  deleteRecipe,
  deleteRecipeLine,
  deleteSalesAdjustment,
  getItem,
  getProduct,
  getRecipe,
  listAuditLogs,
  listItemCosts,
  listItems,
  listProductAliases,
  listProductCosts,
  listProductPrices,
  listProducts,
  listRecipeLines,
  listRecipes,
  listSalesAdjustments,
  listSalesDaily,
  resolveProductIdByAlias,
  setSalesDaily,
  upsertItem,
  upsertProduct,
  upsertProductAlias,
  upsertRecipe,
  upsertRecipeLine,
} from '@/src/storage/local/store';
import type { RepositoryBundle } from '../contracts';

const BRANCHES = [
  { id: 'branch_santiago', name: 'Santiago' as const },
  { id: 'branch_temuco', name: 'Temuco' as const },
];

export const localRepositories: RepositoryBundle = {
  branches: {
    async list() {
      return BRANCHES;
    },
    async getById(id) {
      return BRANCHES.find((branch) => branch.id === id) ?? null;
    },
  },
  items: {
    async list() {
      return listItems();
    },
    async getById(id) {
      return getItem(id) ?? null;
    },
    async upsert(item: Item) {
      return upsertItem(item);
    },
    async delete(id) {
      deleteItem(id);
    },
    async listCostVersions(itemId, branch) {
      return listItemCosts(itemId, branch);
    },
    async addCostVersion(itemId: string, branch: Branch, version: NewItemCostVersion) {
      return addItemCostVersion(itemId, branch, version);
    },
  },
  products: {
    async list() {
      return listProducts();
    },
    async getById(id) {
      return getProduct(id) ?? null;
    },
    async upsert(product: Product) {
      return upsertProduct(product);
    },
    async delete(id) {
      deleteProduct(id);
    },
    async listPriceVersions(productId, branch) {
      return listProductPrices(productId, branch);
    },
    async addPriceVersion(productId: string, branch: Branch, version: NewProductPriceVersion) {
      return addProductPriceVersion(productId, branch, version);
    },
    async listCostVersions(productId, branch) {
      return listProductCosts(productId, branch);
    },
    async addCostVersion(productId: string, branch: Branch, version: NewProductCostVersion) {
      return addProductCostVersion(productId, branch, version);
    },
  },
  recipes: {
    async list() {
      return listRecipes();
    },
    async getById(id) {
      return getRecipe(id) ?? null;
    },
    async upsert(recipe: Recipe) {
      return upsertRecipe(recipe);
    },
    async delete(id) {
      deleteRecipe(id);
    },
    async listLines(recipeId) {
      return listRecipeLines(recipeId);
    },
    async upsertLine(line: RecipeLine) {
      return upsertRecipeLine(line);
    },
    async deleteLine(id) {
      deleteRecipeLine(id);
    },
  },
  sales: {
    async listDaily(params) {
      return listSalesDaily(params);
    },
    async listAdjustments(params) {
      return listSalesAdjustments(params);
    },
    async upsertDaily(entry: SalesDaily) {
      const [next] = setSalesDaily(entry.date, entry.branch, [
        {
          id: entry.id,
          productId: entry.productId,
          qty: entry.qty,
          grossSalesClp: entry.grossSalesClp,
        },
      ]);
      return next;
    },
    async addAdjustment(entry: SalesAdjustment) {
      return addSalesAdjustment({
        date: entry.date,
        branch: entry.branch,
        productId: entry.productId,
        qty: entry.qty,
        grossSalesClp: entry.grossSalesClp,
        note: entry.note,
      });
    },
    async deleteAdjustment(id) {
      deleteSalesAdjustment(id);
    },
  },
  audit: {
    async list() {
      return listAuditLogs();
    },
    async append(event: AuditLog) {
      addAuditEvent({
        entityType: event.entityType,
        entityId: event.entityId,
        action: event.action,
        diffJson: event.diffJson,
        actor: event.actor,
      });
      return event;
    },
    async clear(actor) {
      clearAuditLogs(actor);
    },
  },
  aliases: {
    async list() {
      return listProductAliases();
    },
    async upsert(alias) {
      upsertProductAlias(alias);
    },
    async delete(source, externalName) {
      return deleteProductAlias(source, externalName);
    },
    async resolveProductId(source, externalName) {
      return resolveProductIdByAlias(source, externalName);
    },
  },
};
