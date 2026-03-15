import type { RepositoryBundle } from '@/src/server/repositories/contracts';
import { prismaBranchRepository } from './branchRepository';
import { prismaItemRepository } from './itemRepository';
import { prismaProductRepository } from './productRepository';
import { prismaRecipeRepository } from './recipeRepository';
import { prismaAliasRepository } from './aliasRepository';

function notImplemented(name: string): never {
  throw new Error(`${name} is not implemented yet for DATA_BACKEND=db (Phase 1)`);
}

export const prismaRepositories: RepositoryBundle = {
  branches: prismaBranchRepository,
  items: prismaItemRepository,
  products: prismaProductRepository,
  recipes: prismaRecipeRepository,
  sales: {
    async listDaily() {
      return notImplemented('sales.listDaily');
    },
    async listAdjustments() {
      return notImplemented('sales.listAdjustments');
    },
    async upsertDaily() {
      return notImplemented('sales.upsertDaily');
    },
    async addAdjustment() {
      return notImplemented('sales.addAdjustment');
    },
    async deleteAdjustment() {
      return notImplemented('sales.deleteAdjustment');
    },
  },
  audit: {
    async list() {
      return notImplemented('audit.list');
    },
    async append() {
      return notImplemented('audit.append');
    },
    async clear() {
      return notImplemented('audit.clear');
    },
  },
  aliases: prismaAliasRepository,
};
