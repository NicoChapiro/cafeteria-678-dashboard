import type { Branch, Item, ItemCostVersion, NewItemCostVersion } from '@/src/domain/types';

export interface ItemRepository {
  list(): Promise<Item[]>;
  getById(id: string): Promise<Item | null>;
  upsert(item: Item): Promise<Item>;
  delete(id: string): Promise<void>;
  listCostVersions(itemId: string, branch: Branch): Promise<ItemCostVersion[]>;
  addCostVersion(itemId: string, branch: Branch, version: NewItemCostVersion): Promise<ItemCostVersion[]>;
}
