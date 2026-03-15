import type {
  Branch,
  NewProductCostVersion,
  NewProductPriceVersion,
  Product,
  ProductCostVersion,
  ProductPriceVersion,
} from '@/src/domain/types';

export interface ProductRepository {
  list(): Promise<Product[]>;
  getById(id: string): Promise<Product | null>;
  upsert(product: Product): Promise<Product>;
  delete(id: string): Promise<void>;
  listPriceVersions(productId: string, branch: Branch): Promise<ProductPriceVersion[]>;
  addPriceVersion(
    productId: string,
    branch: Branch,
    version: NewProductPriceVersion,
  ): Promise<ProductPriceVersion[]>;
  listCostVersions(productId: string, branch: Branch): Promise<ProductCostVersion[]>;
  addCostVersion(
    productId: string,
    branch: Branch,
    version: NewProductCostVersion,
  ): Promise<ProductCostVersion[]>;
}
