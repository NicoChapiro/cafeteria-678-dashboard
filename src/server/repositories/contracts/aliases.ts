export type ProductAlias = {
  source: string;
  externalName: string;
  productId: string;
};

export interface AliasRepository {
  list(): Promise<ProductAlias[]>;
  upsert(alias: ProductAlias): Promise<void>;
  delete(source: string, externalName: string): Promise<boolean>;
  resolveProductId(source: string, externalName: string): Promise<string | null>;
}
