import type { AliasRepository } from './aliases';
import type { AuditRepository } from './audit';
import type { BranchRepository } from './branches';
import type { ItemRepository } from './items';
import type { ProductRepository } from './products';
import type { RecipeRepository } from './recipes';
import type { SalesRepository } from './sales';

export type RepositoryBundle = {
  branches: BranchRepository;
  items: ItemRepository;
  products: ProductRepository;
  recipes: RecipeRepository;
  sales: SalesRepository;
  audit: AuditRepository;
  aliases: AliasRepository;
};

export type DataBackend = 'local' | 'db';
